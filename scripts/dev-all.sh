#!/bin/sh
# API :8080 + UI (Vite) :80
set -e
cd "$(dirname "$0")/.."
trap 'kill 0 2>/dev/null' EXIT INT TERM

echo "API  → http://127.0.0.1:8080"
echo "UI   → http://127.0.0.1 (port 80 — may need sudo on macOS)"

NODE_ENV=development bun --env-file=.env.development --env-file=.env run --watch server.ts &
pnpm --dir web dev &

wait
