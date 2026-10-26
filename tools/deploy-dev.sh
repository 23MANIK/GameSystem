#!/bin/bash
# Deploy a branch to the DEV site, https://scale-architect-dev.vercel.app,
# so it can be checked by hand before anything goes to production.
#
#   bash tools/deploy-dev.sh          # deploys origin/v2
#   bash tools/deploy-dev.sh v3       # deploys origin/v3
#
# It builds from a clean checkout of the pushed branch (your working copy is
# never touched) into its own folder, linked to its own Vercel project
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
trap 'git -C "$REPO" worktree remove --force "$WT"' EXIT
COMMIT="$(git -C "$WT" log -1 --format='%h %s')"

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
