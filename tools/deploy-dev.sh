#!/bin/bash
# Deploy a branch to the DEV site, https://scale-architect-dev.vercel.app,
# so it can be checked by hand before anything goes to production.
#
#   bash tools/deploy-dev.sh          # deploys origin/v2
#   bash tools/deploy-dev.sh v3       # deploys origin/v3
#
# It runs the whole test suite (tools/test-all.sh) on that exact commit first and
# stops if anything fails. Then it builds from a clean checkout of the pushed
# branch (your working copy is never touched) into its own folder, linked to its own Vercel project
# (scale-architect-dev). It refuses to run if that folder is linked to the
# production project.
set -euo pipefail

BRANCH="${1:-v2}"
REPO="$(cd "$(dirname "$0")/.." && pwd)"
DEV_DIR="/Users/Shared/scale-architect-dev"
DEV_PROJECT="scale-architect-dev"
SCOPE="23maniks-projects"
PROD_PROJECT_ID="prj_HTX21vAujFdvFNfvAWpCRlLSZ8fh"   # scale-architect (production)

WT="$(mktemp -d)/src"
git -C "$REPO" fetch origin "$BRANCH"
git -C "$REPO" worktree add --detach "$WT" "origin/$BRANCH"
# rm + prune works on old git too (no `git worktree remove` before git 2.17)
trap 'rm -rf "$(dirname "$WT")"; git -C "$REPO" worktree prune' EXIT
COMMIT="$(git -C "$WT" log -1 --format='%h %s')"

# Test gate: the exact commit being deployed must pass every test first.
# Skip only with SKIP_TESTS=1 (and say why to whoever checks the dev site).
if [ "${SKIP_TESTS:-0}" = "1" ]; then
  echo "⚠️  SKIP_TESTS=1: deploying WITHOUT running the tests." >&2
elif [ -f "$WT/tools/test-all.sh" ]; then
  # Reuse the repo's installed test tools instead of downloading them again
  if [ -d "$REPO/node_modules/@playwright/test" ] && [ ! -e "$WT/node_modules" ]; then
    ln -s "$REPO/node_modules" "$WT/node_modules"
  fi
  echo "Running tests on origin/$BRANCH ($COMMIT)…"
  if ! bash "$WT/tools/test-all.sh"; then
    # Keep the screenshots and traces of what failed (the checkout is deleted on exit)
    rm -rf "$REPO/test-results" && cp -R "$WT/test-results" "$REPO/" 2>/dev/null \
      && echo "Screenshots and traces of the failures: $REPO/test-results" >&2
    echo >&2
    echo "❌ Tests failed: nothing was deployed. Fix them (or see tests/helpers/known-bugs.mjs) and push again." >&2
    exit 1
  fi
else
  node "$WT/tools/run-tests.mjs" || { echo "❌ Tests failed: nothing was deployed." >&2; exit 1; }
fi

bash "$WT/tools/sync-deploy.sh" "$DEV_DIR"

cd "$DEV_DIR"
if [ ! -f .vercel/project.json ]; then
  npx vercel project add "$DEV_PROJECT" --scope "$SCOPE" || true   # fine if it already exists
  npx vercel link --yes --project "$DEV_PROJECT" --scope "$SCOPE"
fi
if grep -q "$PROD_PROJECT_ID" .vercel/project.json; then
  echo "Refusing: $DEV_DIR is linked to the PRODUCTION project." >&2
  exit 1
fi

# "--prod" here only updates the dev project's own address, never scale-architect.vercel.app
npx vercel deploy --prod --yes --scope "$SCOPE"

echo
echo "Dev site: https://$DEV_PROJECT.vercel.app"
echo "Built from origin/$BRANCH at $COMMIT"
