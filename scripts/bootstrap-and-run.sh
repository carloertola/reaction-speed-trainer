#!/usr/bin/env bash
set -euo pipefail

REPO_URL="${1:-}"
TARGET_DIR="${2:-reaction-speed-trainer}"

if [[ -z "$REPO_URL" ]]; then
  echo "Usage: $0 <git_repo_url> [target_dir]"
  exit 1
fi

if ! command -v git >/dev/null 2>&1; then
  echo "git is required but not installed." >&2
  exit 1
fi

echo "Cloning $REPO_URL into $TARGET_DIR"
git clone "$REPO_URL" "$TARGET_DIR"
cd "$TARGET_DIR"

chmod +x scripts/run-local.sh
./scripts/run-local.sh
