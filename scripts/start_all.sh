#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# start_all.sh
#
# Unified startup entrypoint for launchd main-service auto boot.
# - Starts backend (required) and frontend (shared or separate).
# - Checks target port conflicts before spawn.
# - Runs health checks + smoke checks after startup.
# - In --foreground mode, keeps process alive for launchd supervision.
# ---------------------------------------------------------------------------

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
RUNTIME_DIR="$PROJECT_DIR/runtime/agent_orchestrator"
PID_DIR="$RUNTIME_DIR/pids"
LOG_DIR="$PROJECT_DIR/logs/launchd"
ENV_FILE_DEFAULT="$PROJECT_DIR/deploy/launchd-orchestrator/launchd.env"
STOP_SCRIPT="$SCRIPT_DIR/stop_all.sh"

FOREGROUND=0
NO_SMOKE=0
DRY_RUN=0

for arg in "$@"; do
  case "$arg" in
    --foreground) FOREGROUND=1 ;;
    --no-smoke) NO_SMOKE=1 ;;
    --dry-run) DRY_RUN=1 ;;
    *)
      echo "[start_all] Unknown argument: $arg" >&2
      exit 2
      ;;
  esac
done

mkdir -p "$PID_DIR" "$LOG_DIR"

ENV_FILE="${ORCHESTRATOR_LAUNCHD_ENV:-$ENV_FILE_DEFAULT}"
if [[ -f "$ENV_FILE" ]]; then
  # shellcheck disable=SC1090
  source "$ENV_FILE"
fi

export PATH="${LAUNCHD_PATH:-/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:$PATH}"

BACKEND_PORT="${BACKEND_PORT:-3000}"
BACKEND_CMD="${BACKEND_CMD:-npm run dev -- -H 127.0.0.1 -p ${BACKEND_PORT}}"
BACKEND_HEALTH_URL="${BACKEND_HEALTH_URL:-http://127.0.0.1:${BACKEND_PORT}/api/system/health}"

# Next.js 在本專案同時承載 API 與 UI；預設使用 shared 模式。
FRONTEND_MODE="${FRONTEND_MODE:-shared}" # shared | separate
FRONTEND_PORT="${FRONTEND_PORT:-3000}"
FRONTEND_CMD="${FRONTEND_CMD:-}"
FRONTEND_HEALTH_URL="${FRONTEND_HEALTH_URL:-http://127.0.0.1:${FRONTEND_PORT}/}"

HEALTH_RETRIES="${HEALTH_RETRIES:-45}"
HEALTH_RETRY_INTERVAL_SEC="${HEALTH_RETRY_INTERVAL_SEC:-2}"
MONITOR_INTERVAL_SEC="${MONITOR_INTERVAL_SEC:-20}"

SMOKE_COMMAND="${SMOKE_COMMAND:-curl -fsS http://127.0.0.1:${BACKEND_PORT}/api/orchestrator/summary >/dev/null}"

BACKEND_PID_FILE="$PID_DIR/backend.pid"
FRONTEND_PID_FILE="$PID_DIR/frontend.pid"

BACKEND_STDOUT_LOG="$LOG_DIR/backend.stdout.log"
BACKEND_STDERR_LOG="$LOG_DIR/backend.stderr.log"
FRONTEND_STDOUT_LOG="$LOG_DIR/frontend.stdout.log"
FRONTEND_STDERR_LOG="$LOG_DIR/frontend.stderr.log"
MAIN_LOG="$LOG_DIR/start_all.log"
SMOKE_LOG="$LOG_DIR/smoke.log"

log() {
  local message="$1"
  echo "$(date '+%Y-%m-%d %H:%M:%S') [start_all] $message" | tee -a "$MAIN_LOG"
}

is_pid_running() {
  local pid="$1"
  [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null
}

read_pid_file() {
  local pid_file="$1"
  if [[ ! -f "$pid_file" ]]; then
    return 1
  fi
  tr -d '[:space:]' < "$pid_file"
}

port_listener_pid() {
  local port="$1"
  lsof -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null | head -n 1 || true
}

check_port_available() {
  local port="$1"
  local service_name="$2"
  local existing_pid
  existing_pid="$(port_listener_pid "$port")"
  if [[ -n "$existing_pid" ]]; then
    log "ERROR: ${service_name} target port ${port} is already occupied by PID ${existing_pid}."
    return 1
  fi
  return 0
}

start_process() {
  local service_name="$1"
  local command="$2"
  local pid_file="$3"
  local stdout_file="$4"
  local stderr_file="$5"
  local port="$6"

  if [[ -z "$command" ]]; then
    log "ERROR: ${service_name} command is empty."
    return 1
  fi

  if pid="$(read_pid_file "$pid_file" 2>/dev/null || true)"; then
    if is_pid_running "$pid"; then
      log "${service_name} already running (PID ${pid}), skipping restart."
      return 0
    fi
    log "${service_name} pid file was stale (${pid}); cleaning."
    rm -f "$pid_file"
  fi

  check_port_available "$port" "$service_name"

  if [[ "$DRY_RUN" == "1" ]]; then
    log "[dry-run] would start ${service_name}: ${command}"
    return 0
  fi

  log "Starting ${service_name} (port ${port})"
  /bin/bash -lc "cd \"$PROJECT_DIR\" && ${command}" >>"$stdout_file" 2>>"$stderr_file" &
  local child_pid=$!
  echo "$child_pid" > "$pid_file"
  sleep 1

  if ! is_pid_running "$child_pid"; then
    log "ERROR: ${service_name} failed to stay alive after launch (PID ${child_pid})."
    return 1
  fi

  return 0
}

wait_for_http() {
  local url="$1"
  local name="$2"
  local retries="$3"
  local interval="$4"

  if [[ "$DRY_RUN" == "1" ]]; then
    log "[dry-run] would health-check ${name}: ${url}"
    return 0
  fi

  local i
  for ((i = 1; i <= retries; i++)); do
    if curl -fsS --max-time 3 "$url" >/dev/null 2>&1; then
      log "${name} health check passed: ${url}"
      return 0
    fi
    sleep "$interval"
  done

  log "ERROR: ${name} health check failed: ${url}"
  return 1
}

run_smoke() {
  if [[ "$NO_SMOKE" == "1" ]]; then
    log "Skipping smoke check because --no-smoke is set."
    return 0
  fi
  if [[ -z "$SMOKE_COMMAND" ]]; then
    log "Skipping smoke check because SMOKE_COMMAND is empty."
    return 0
  fi
  if [[ "$DRY_RUN" == "1" ]]; then
    log "[dry-run] would run smoke command: ${SMOKE_COMMAND}"
    return 0
  fi

  log "Running smoke check."
  if /bin/bash -lc "cd \"$PROJECT_DIR\" && ${SMOKE_COMMAND}" >>"$SMOKE_LOG" 2>&1; then
    log "Smoke check passed."
    return 0
  fi

  log "ERROR: Smoke check failed."
  return 1
}

stop_all_silent() {
  if [[ -x "$STOP_SCRIPT" ]]; then
    "$STOP_SCRIPT" --quiet || true
  fi
}

validate_frontend_mode() {
  if [[ "$FRONTEND_MODE" == "shared" ]]; then
    FRONTEND_PORT="$BACKEND_PORT"
    return 0
  fi
  if [[ "$FRONTEND_MODE" == "separate" ]]; then
    if [[ -z "$FRONTEND_CMD" ]]; then
      log "ERROR: FRONTEND_MODE=separate but FRONTEND_CMD is empty."
      return 1
    fi
    return 0
  fi
  log "ERROR: Unsupported FRONTEND_MODE=${FRONTEND_MODE}, expected shared|separate."
  return 1
}

monitor_foreground() {
  trap 'log "Received stop signal, cleaning up."; stop_all_silent; exit 0' INT TERM

  log "Entering --foreground supervision loop."
  while true; do
    if [[ "$DRY_RUN" == "0" ]]; then
      local backend_pid
      backend_pid="$(read_pid_file "$BACKEND_PID_FILE" 2>/dev/null || true)"
      if [[ -z "$backend_pid" ]] || ! is_pid_running "$backend_pid"; then
        log "ERROR: backend process is not alive."
        stop_all_silent
        return 1
      fi

      if [[ "$FRONTEND_MODE" == "separate" ]]; then
        local frontend_pid
        frontend_pid="$(read_pid_file "$FRONTEND_PID_FILE" 2>/dev/null || true)"
        if [[ -z "$frontend_pid" ]] || ! is_pid_running "$frontend_pid"; then
          log "ERROR: frontend process is not alive."
          stop_all_silent
          return 1
        fi
      fi

      if ! curl -fsS --max-time 3 "$BACKEND_HEALTH_URL" >/dev/null 2>&1; then
        log "ERROR: backend health check failed during monitor loop."
        stop_all_silent
        return 1
      fi
    fi

    sleep "$MONITOR_INTERVAL_SEC"
  done
}

main() {
  log "Project directory: $PROJECT_DIR"
  log "Using env file: $ENV_FILE"
  log "FRONTEND_MODE=${FRONTEND_MODE}, BACKEND_PORT=${BACKEND_PORT}, FRONTEND_PORT=${FRONTEND_PORT}"

  validate_frontend_mode

  start_process "backend" "$BACKEND_CMD" "$BACKEND_PID_FILE" "$BACKEND_STDOUT_LOG" "$BACKEND_STDERR_LOG" "$BACKEND_PORT"
  if [[ "$FRONTEND_MODE" == "separate" ]]; then
    start_process "frontend" "$FRONTEND_CMD" "$FRONTEND_PID_FILE" "$FRONTEND_STDOUT_LOG" "$FRONTEND_STDERR_LOG" "$FRONTEND_PORT"
  else
    log "frontend uses shared backend process (Next.js monolith mode)."
  fi

  wait_for_http "$BACKEND_HEALTH_URL" "backend" "$HEALTH_RETRIES" "$HEALTH_RETRY_INTERVAL_SEC" || {
    stop_all_silent
    return 1
  }
  wait_for_http "$FRONTEND_HEALTH_URL" "frontend" "$HEALTH_RETRIES" "$HEALTH_RETRY_INTERVAL_SEC" || {
    stop_all_silent
    return 1
  }

  run_smoke || {
    stop_all_silent
    return 1
  }

  log "Startup completed successfully."

  if [[ "$FOREGROUND" == "1" ]]; then
    monitor_foreground
    return $?
  fi

  return 0
}

main
