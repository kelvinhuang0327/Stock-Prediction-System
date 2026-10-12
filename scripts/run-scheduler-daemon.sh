#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# run-scheduler-daemon.sh
#
# Shell wrapper for the autonomous scheduler daemon.
# Used by the macOS launchd plist so the daemon picks up the correct
# PATH, Node.js, and ts-node environment.
#
# Usage (direct):
#   bash scripts/run-scheduler-daemon.sh [--once] [--skip-reconcile] [--interval-ms=N]
#
# Usage (via launchd):
#   Invoked automatically by com.trading.autonomous-scheduler.plist
# ---------------------------------------------------------------------------

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Extend PATH so that node / npm are found even in a bare launchd environment
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:$PATH"

# Ensure ts-node resolves modules relative to the project
export TS_NODE_COMPILER_OPTIONS='{"module":"commonjs"}'

cd "$PROJECT_DIR"

exec node \
  "$PROJECT_DIR/node_modules/.bin/ts-node" \
  -r tsconfig-paths/register \
  "$PROJECT_DIR/scripts/local-autonomous-scheduler.ts" \
  "$@"
