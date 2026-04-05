#!/bin/bash
# CosmicBorn deploy — Mac → VPS → GitHub → Vercel
# Same pattern as BirthContext/ITRF
# NOTE: /root/cosmicborn-deploy.sh needs setup on first deploy

set -e

VPS="root@100.76.58.88"
VPS_MONOREPO="/root/3150"
VPS_DEPLOY_REPO="/root/cosmicborn-deploy"
BUILD_DIR="$(dirname "$0")"

echo "🚀 CosmicBorn deploy starting..."

# Ensure git identity for Vercel
git config user.email "stephan.geyer@gmail.com" 2>/dev/null || true

# Rsync build files to VPS monorepo
echo "📦 Syncing to VPS monorepo..."
rsync -avz --delete \
  --exclude '.git' \
  --exclude 'node_modules' \
  --exclude '_staging' \
  "$BUILD_DIR/" \
  "$VPS:$VPS_MONOREPO/ventures/cosmicborn/build/"

# Trigger VPS deploy script
echo "🔄 Triggering VPS deploy..."
ssh "$VPS" "bash /root/cosmicborn-deploy.sh"

echo "✅ Deploy complete! Check Vercel dashboard for build status."
