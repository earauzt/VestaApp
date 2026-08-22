#!/usr/bin/env bash
# Install the CRA app and put `react-scripts` on the PATH Vercel uses
# when the project Root Directory is the monorepo root (not frontend/).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

npm ci --prefix frontend --legacy-peer-deps

mkdir -p node_modules/.bin
install -m 0755 "$ROOT/scripts/react-scripts" node_modules/.bin/react-scripts
