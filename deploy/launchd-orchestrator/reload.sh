#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "==> Reloading launchd agents"
bash "$SCRIPT_DIR/install.sh" "$@"
