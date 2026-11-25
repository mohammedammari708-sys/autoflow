#!/usr/bin/env bash
# Start AutoFlow API + web together for local development.
# Usage: bash scripts/dev.sh   (Ctrl+C stops both)
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
trap 'kill 0' INT TERM EXIT
(cd "$ROOT/apps/api" && npm run dev) &
(cd "$ROOT/apps/web" && npm run dev) &
wait
