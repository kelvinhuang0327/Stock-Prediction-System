#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

TASK_ID="${1:-}"
PROMPT_PATH="${2:-}"
CONTRACT_PATH="${3:-}"
PROVIDER="${4:-codex}"
OBJECTIVE="${5:-}"
COPILOT_CLI="/Users/kelvin/Library/Application Support/Code/User/globalStorage/github.copilot-chat/copilotCli/copilot"

if [[ -z "$TASK_ID" || -z "$PROMPT_PATH" || -z "$CONTRACT_PATH" ]]; then
  echo "Usage: $0 <task_id> <prompt_path> <contract_path> [provider] [objective]" >&2
  exit 2
fi

if [[ ! -f "$PROMPT_PATH" ]]; then
  echo "Prompt file not found: $PROMPT_PATH" >&2
  exit 2
fi

if [[ ! -f "$CONTRACT_PATH" ]]; then
  echo "Contract file not found: $CONTRACT_PATH" >&2
  exit 2
fi

export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:$PATH"
cd "$PROJECT_DIR"

cat <<EOF
[orchestrator-worker] task_id=$TASK_ID provider=$PROVIDER
[orchestrator-worker] prompt_path=$PROMPT_PATH
[orchestrator-worker] contract_path=$CONTRACT_PATH
EOF

WORKER_PROMPT=$(cat <<EOF
You are the external worker for a project orchestrator.

Task metadata:
- task_id: $TASK_ID
- provider: $PROVIDER
- objective: $OBJECTIVE

Follow the instructions in these files strictly:
- Prompt: $PROMPT_PATH
- Contract: $CONTRACT_PATH

Execution requirements:
1. Perform the requested implementation work in the current repository.
2. Respect contract constraints and forbidden changes.
3. Run relevant verification commands.
4. At the end, provide a concise completion summary.
EOF
)

if [[ ! -x "$COPILOT_CLI" ]]; then
  echo "Copilot CLI not found or not executable: $COPILOT_CLI" >&2
  exit 2
fi

"$COPILOT_CLI" \
  -p "$WORKER_PROMPT" \
  --output-format text \
  --allow-all-tools \
  --allow-all-paths \
  --no-ask-user

changed_files_json="$({
  git diff --name-only --relative
  git diff --name-only --relative --cached
} | sed '/^$/d' | awk '
  BEGIN { printf "["; first = 1 }
  {
    gsub(/\\/, "\\\\");
    gsub(/\"/, "\\\"");
    if (!first) printf ",";
    printf "\"%s\"", $0;
    first = 0;
  }
  END { printf "]" }
')"

echo "CHANGED_FILES_JSON: $changed_files_json"
