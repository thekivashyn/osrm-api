#!/bin/sh
# Fallback when dev IP changes: SSH tunnel so .env can keep localhost URLs.
# Usage: ./scripts/dev-remote-tunnel.sh
# Then:  bun run dev:remote:tunnel
set -e
HOST="${ROUTING_SSH_HOST:-root@149.28.134.50}"
echo "Tunnel localhost:5050/5051/4000 -> $HOST (Ctrl+C to stop)"
exec ssh -N \
  -L 5050:127.0.0.1:5050 \
  -L 5051:127.0.0.1:5051 \
  -L 4000:127.0.0.1:4000 \
  "$HOST"
