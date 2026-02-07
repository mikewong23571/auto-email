#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

mkdir -p dist

echo "Building linux/amd64 (CGO disabled)..."
CGO_ENABLED=0 GOOS=linux GOARCH=amd64 \
	go build -trimpath -ldflags='-s -w' -o dist/mailcli-linux-amd64 .

echo "Building linux/arm64 (CGO disabled)..."
CGO_ENABLED=0 GOOS=linux GOARCH=arm64 \
	go build -trimpath -ldflags='-s -w' -o dist/mailcli-linux-arm64 .

echo "Done. Artifacts:"
ls -la dist/
