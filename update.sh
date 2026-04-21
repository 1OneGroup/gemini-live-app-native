#!/bin/bash
set -e
cd /root/avinash

echo "==> Pulling latest code..."
git pull

echo "==> Rebuilding & restarting container..."
docker compose -p avinash up -d --build

echo "==> Done!"
docker ps --filter name=gemini-live-bridge-avinash --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
