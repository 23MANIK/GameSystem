#!/bin/bash
# Copy just the game (index.html, css/, js/) plus the edge rate limiter
# (deploy/middleware.js), headers (deploy/vercel.json), the /api functions and
# DesignGame's server code to a folder outside the home-folder
# git repo, so `npx vercel` there deploys the game and nothing else.
#
#   bash tools/sync-deploy.sh            # refresh the copy
#   bash tools/vercel-deploy.sh --prod   # then deploy (tags version, commit, branch)
set -euo pipefail

SRC="$(cd "$(dirname "$0")/.." && pwd)"
DEST="${1:-/Users/Shared/scale-architect}"

mkdir -p "$DEST"
# --delete keeps the copy identical (files removed here are removed there),
# but never touches Vercel's own link folder
rsync -a --delete --exclude '.vercel' --exclude '.DS_Store' \
  "$SRC/index.html" "$SRC/css" "$SRC/js" \
  "$SRC/deploy/middleware.js" "$SRC/deploy/vercel.json" "$SRC/deploy/api" \
  "$SRC/package.json" "$SRC/package-lock.json" "$DEST/"

# Create DesignGame's server code (/api/designgame) and the notes its prompts read.
# The middleware keeps these from being served as pages.
mkdir -p "$DEST/tools" "$DEST/docs/designgame"
rsync -a --delete --exclude '.DS_Store' "$SRC/tools/designgame" "$DEST/tools/"
cp "$SRC/docs/designgame/data-pack-format.md" "$DEST/docs/designgame/"
cp "$SRC/.claude/skills/design-product-levels/reference/engine-capabilities.md" "$DEST/docs/designgame/"

echo "Game copied to $DEST"
echo "Deploy with:  bash tools/vercel-deploy.sh --prod   (tags the deploy with its version)"
