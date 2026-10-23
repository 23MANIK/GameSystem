#!/bin/bash
# Copy just the game (index.html, css/, js/) plus the edge rate limiter
# (deploy/middleware.js) and headers (deploy/vercel.json) to a folder outside the home-folder
# git repo, so `npx vercel` there deploys the game and nothing else.
#
#   bash tools/sync-deploy.sh            # refresh the copy
#   cd /Users/Shared/scale-architect && npx vercel --prod   # then deploy
set -euo pipefail

SRC="$(cd "$(dirname "$0")/.." && pwd)"
DEST="${1:-/Users/Shared/scale-architect}"

mkdir -p "$DEST"
# --delete keeps the copy identical (files removed here are removed there),
# but never touches Vercel's own link folder
rsync -a --delete --exclude '.vercel' --exclude '.DS_Store' \
  "$SRC/index.html" "$SRC/css" "$SRC/js" \
  "$SRC/deploy/middleware.js" "$SRC/deploy/vercel.json" "$SRC/deploy/api" "$DEST/"

echo "Game copied to $DEST"
echo "Deploy with:  cd $DEST && npx vercel --prod"
