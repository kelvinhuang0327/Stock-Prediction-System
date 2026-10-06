#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# install.sh
#
# Install launchd jobs for:
# - main service auto-start (RunAtLoad + KeepAlive)
# - planner tick every 10 min
# - worker tick every 10 min
# - worker daemon (RunAtLoad + KeepAlive)
#
# Supported scopes:
# - agent:  per-user LaunchAgent, starts after login
# - daemon: system LaunchDaemon, starts before login
# ---------------------------------------------------------------------------

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$(dirname "$SCRIPT_DIR")")"
TEMPLATE_DIR="$SCRIPT_DIR/templates"
AGENTS_DIR="$HOME/Library/LaunchAgents"
DAEMONS_DIR="/Library/LaunchDaemons"
LOG_DIR="$PROJECT_DIR/logs/launchd"
PID_DIR="$PROJECT_DIR/runtime/agent_orchestrator/pids"
PATH_VALUE="${LAUNCHD_PATH:-/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin}"
ENABLE_WORKER_DAEMON="${ENABLE_WORKER_DAEMON:-1}"
DRY_RUN=0
SCOPE="${LAUNCHD_SCOPE:-agent}"
DEFAULT_RUN_AS_USER="${SUDO_USER:-$(id -un)}"
DEFAULT_RUN_AS_GROUP="$(id -Gn "$DEFAULT_RUN_AS_USER" 2>/dev/null | awk '{print $1}')"
if [[ -z "$DEFAULT_RUN_AS_GROUP" || "$DEFAULT_RUN_AS_GROUP" =~ ^[0-9]+$ ]]; then
  DEFAULT_RUN_AS_GROUP="staff"
fi
RUN_AS_USER="${LAUNCHD_RUN_AS_USER:-$DEFAULT_RUN_AS_USER}"
RUN_AS_GROUP="${LAUNCHD_RUN_AS_GROUP:-$DEFAULT_RUN_AS_GROUP}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run)
      DRY_RUN=1
      shift
      ;;
    --scope)
      SCOPE="${2:-}"
      shift 2
      ;;
    --scope=*)
      SCOPE="${1#*=}"
      shift
      ;;
    --user)
      RUN_AS_USER="${2:-}"
      shift 2
      ;;
    --user=*)
      RUN_AS_USER="${1#*=}"
      shift
      ;;
    --group)
      RUN_AS_GROUP="${2:-}"
      shift 2
      ;;
    --group=*)
      RUN_AS_GROUP="${1#*=}"
      shift
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 2
      ;;
  esac
done

if [[ "$SCOPE" != "agent" && "$SCOPE" != "daemon" ]]; then
  echo "Invalid --scope: $SCOPE (expected agent|daemon)" >&2
  exit 2
fi

if [[ "$SCOPE" == "daemon" && "$DRY_RUN" != "1" && "$EUID" -ne 0 ]]; then
  echo "LaunchDaemon install requires root. Re-run with sudo or use --dry-run." >&2
  exit 1
fi

ENV_EXAMPLE="$SCRIPT_DIR/launchd.env.example"
ENV_FILE="$SCRIPT_DIR/launchd.env"

PLISTS=(
  "com.stocksystem.main-service.plist"
  "com.stocksystem.orchestrator.planner-tick.plist"
  "com.stocksystem.orchestrator.worker-tick.plist"
)

if [[ "$ENABLE_WORKER_DAEMON" == "1" ]]; then
  PLISTS+=("com.stocksystem.orchestrator.worker-daemon.plist")
fi

render_plist() {
  local template="$1"
  local target="$2"
  sed \
    -e "s|__PROJECT_ROOT__|$PROJECT_DIR|g" \
    -e "s|__PATH__|$PATH_VALUE|g" \
    -e "s|__RUN_AS_USER__|$RUN_AS_USER|g" \
    -e "s|__RUN_AS_GROUP__|$RUN_AS_GROUP|g" \
    "$template" >"$target"
}

job_domain_prefix() {
  if [[ "$SCOPE" == "daemon" ]]; then
    echo "system/"
    return
  fi
  echo "gui/$(id -u)/"
}

job_dir() {
  if [[ "$SCOPE" == "daemon" ]]; then
    echo "$DAEMONS_DIR"
    return
  fi
  echo "$AGENTS_DIR"
}

warn_on_cross_scope_install() {
  local other_scope_dir
  if [[ "$SCOPE" == "daemon" ]]; then
    other_scope_dir="$AGENTS_DIR"
  else
    other_scope_dir="$DAEMONS_DIR"
  fi

  local detected=0
  for plist in "${PLISTS[@]}"; do
    if [[ -f "$other_scope_dir/$plist" ]]; then
      detected=1
      break
    fi
  done

  if [[ "$detected" == "1" ]]; then
    echo "WARNING: Existing launchd jobs were found in $other_scope_dir." >&2
    echo "         Uninstall the other scope first to avoid duplicate auto-start processes." >&2
  fi
}

template_path_for() {
  local plist="$1"
  if [[ "$SCOPE" == "daemon" ]]; then
    echo "$TEMPLATE_DIR/daemon/${plist}.template"
    return
  fi
  echo "$TEMPLATE_DIR/${plist}.template"
}

reload_job() {
  local target="$1"
  local label="$2"

  if [[ "$DRY_RUN" == "1" ]]; then
    echo "    [dry-run] would load $target"
    return
  fi

  if [[ "$SCOPE" == "daemon" ]]; then
    chown root:wheel "$target"
    chmod 644 "$target"
    launchctl bootout system "$target" 2>/dev/null || true
    launchctl bootstrap system "$target"
    launchctl enable "system/$label" 2>/dev/null || true
    launchctl kickstart -k "system/$label" 2>/dev/null || true
    return
  fi

  launchctl unload -w "$target" 2>/dev/null || true
  launchctl load -w "$target"
}

echo "==> Preparing directories"
mkdir -p "$(job_dir)" "$LOG_DIR" "$PID_DIR"
warn_on_cross_scope_install

if [[ ! -f "$ENV_FILE" && -f "$ENV_EXAMPLE" ]]; then
  echo "==> Creating launchd env file from example: $ENV_FILE"
  cp "$ENV_EXAMPLE" "$ENV_FILE"
fi

echo "==> Making scripts executable"
chmod +x \
  "$PROJECT_DIR/scripts/start_all.sh" \
  "$PROJECT_DIR/scripts/stop_all.sh" \
  "$PROJECT_DIR/scripts/run-orchestrator-planner-tick.sh" \
  "$PROJECT_DIR/scripts/run-orchestrator-worker-tick.sh" \
  "$PROJECT_DIR/scripts/run-orchestrator-worker-daemon.sh"

for plist in "${PLISTS[@]}"; do
  template="$(template_path_for "$plist")"
  if [[ "$DRY_RUN" == "1" ]]; then
    target="/tmp/${plist}"
  else
    target="$(job_dir)/$plist"
  fi

  echo "==> Rendering $plist"
  render_plist "$template" "$target"

  if [[ "$DRY_RUN" == "1" ]]; then
    echo "    [dry-run] rendered -> $target"
  else
    echo "==> Reloading $plist"
    reload_job "$target" "${plist%.plist}"
  fi
done

echo
if [[ "$DRY_RUN" == "1" ]]; then
  echo "Dry-run completed. No launchctl changes were made."
else
  echo "Install completed."
fi
echo "Scope:                $SCOPE"
echo "Run as user/group:    $RUN_AS_USER:$RUN_AS_GROUP"
echo "Launchd directory:    $(job_dir)"
echo "Project log directory:  $LOG_DIR"
echo
echo "Useful commands:"
echo "  bash $SCRIPT_DIR/reload.sh --scope $SCOPE"
echo "  bash $SCRIPT_DIR/uninstall.sh --scope $SCOPE"
echo "  launchctl print $(job_domain_prefix)com.stocksystem.main-service"
echo "  tail -f $LOG_DIR/main-service.stdout.log"
