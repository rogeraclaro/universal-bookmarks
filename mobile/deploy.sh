#!/bin/bash
# Deploy mobile PWA to VPS
# Usage: ./deploy.sh

set -e

VPS_USER_HOST="root@62.169.25.188"
VPS_PATH="/home/masellas-links/htdocs/links.masellas.info/mobile"

echo "Building..."
npm run build

echo "Deploying to $VPS_USER_HOST:$VPS_PATH ..."
rsync -av --delete dist/ "$VPS_USER_HOST:$VPS_PATH/"

echo "Done. Visit https://links.masellas.info/mobile/"
