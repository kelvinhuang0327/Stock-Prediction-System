#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

ENV_FILE_DEFAULT="$PROJECT_DIR/deploy/launchd-orchestrator/launchd.env"
ENV_FILE="${ORCHESTRATOR_LAUNCHD_ENV:-$ENV_FILE_DEFAULT}"
if [[ -f "$ENV_FILE" ]]; then
	set -a
	# shellcheck disable=SC1090
	source "$ENV_FILE"
	set +a
fi

export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:$PATH"
cd "$PROJECT_DIR"

exec npm run orchestrator:planner -- --force
