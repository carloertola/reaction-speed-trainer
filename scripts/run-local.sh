#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is required but not found." >&2
  exit 1
fi
if ! command -v python3 >/dev/null 2>&1; then
  echo "python3 is required but not found." >&2
  exit 1
fi

echo "Installing backend dependencies..."
npm install

echo "Starting backend on http://localhost:8787 ..."
node backend/server.js &
BACK_PID=$!

echo "Starting frontend on http://localhost:4173 ..."
python3 -m http.server 4173 --bind 127.0.0.1 &
FRONT_PID=$!

cleanup() {
  echo "\nStopping local servers..."
  kill "$BACK_PID" "$FRONT_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

echo "\nReaction Speed Trainer is running:"
echo "- Frontend: http://localhost:4173"
echo "- Backend:  http://localhost:8787"
echo "Press Ctrl+C to stop."

wait "$BACK_PID" "$FRONT_PID"
