#!/bin/bash
# Deploy Scale Architect to Vercel and record which code it is.
# Every deploy carries three tags that the "My apps" dashboard reads:
#   version  git tag of this commit, e.g. v2.0.0, or v2.0.0-9-g1e64be1 when the
#            commit is 9 past the tag; "-dirty" is added if files have
#            uncommitted changes
#   commit   short commit id
#   branch   git branch
#
#   bash tools/vercel-deploy.sh                    # preview (not live)
#   bash tools/vercel-deploy.sh --prod             # production
#   bash tools/vercel-deploy.sh --prod /Users/Shared/scale-architect-dev   # Dev project
#   bash tools/vercel-deploy.sh --dry-run --prod   # print the command, deploy nothing
#
# It refreshes the deploy copy first (tools/sync-deploy.sh), so the tags always
# match the files that ship.
set -euo pipefail

SRC="$(cd "$(dirname "$0")/.." && pwd)"
PROD=""
DRY=""
DEST="/Users/Shared/scale-architect"
for arg in "$@"; do
  case "$arg" in
    --prod) PROD="--prod" ;;
    --dry-run) DRY=1 ;;
    -*) echo "Unknown option: $arg" >&2; exit 1 ;;
    *) DEST="$arg" ;;
  esac
done

VERSION="$(git -C "$SRC" describe --tags --always --dirty)"
COMMIT="$(git -C "$SRC" rev-parse --short HEAD)"
BRANCH="$(git -C "$SRC" rev-parse --abbrev-ref HEAD)"

CMD=(npx vercel $PROD --yes --meta "version=$VERSION" --meta "commit=$COMMIT" --meta "branch=$BRANCH")

echo "Deploying $VERSION (commit $COMMIT, branch $BRANCH) from $DEST ${PROD:+to PRODUCTION}"
if [ -n "$DRY" ]; then
  echo "Dry run, would run in $DEST: ${CMD[*]}"
  exit 0
fi

bash "$SRC/tools/sync-deploy.sh" "$DEST"
cd "$DEST"
"${CMD[@]}"
