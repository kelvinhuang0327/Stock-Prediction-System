#!/usr/bin/env python3

from __future__ import annotations

import argparse
import json
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


DEFAULT_MODE = "safe-run"
SKIP_GLOBAL_HARD_OFF = "GLOBAL_HARD_OFF"
SKIP_SCHEDULER_DISABLED = "SCHEDULER_DISABLED"
SKIP_SAFE_RUN_BLOCK = "SAFE_RUN_BLOCK"
MANUAL_BLOCKED_CALLERS = {"api", "ai_service", "ai_modules_service"}


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


@dataclass(frozen=True)
class PolicyPaths:
    state_path: Path
    scheduler_state_path: Path
    event_log_path: Path


def resolve_paths(project_root: str) -> PolicyPaths:
    root = Path(project_root).resolve()
    runtime_root = root / "runtime" / "agent_orchestrator"
    runtime_root.mkdir(parents=True, exist_ok=True)
    return PolicyPaths(
        state_path=runtime_root / "llm_execution_policy_state.json",
        scheduler_state_path=runtime_root / "scheduler_state.json",
        event_log_path=runtime_root / "llm_execution_events.jsonl",
    )


def default_state() -> dict[str, Any]:
    return {
        "version": "1.0",
        "mode": DEFAULT_MODE,
        "blocked_execution_count": 0,
        "allowed_execution_count": 0,
        "last_llm_call_at": None,
        "last_blocked_at": None,
        "last_skip_reason": None,
        "last_caller": None,
        "last_provider": None,
        "last_model": None,
        "last_task_id": None,
        "updated_at": now_iso(),
    }


def load_json(path: Path, fallback: dict[str, Any]) -> dict[str, Any]:
    if not path.exists():
        path.write_text(json.dumps(fallback, indent=2), encoding="utf-8")
        return dict(fallback)
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        path.write_text(json.dumps(fallback, indent=2), encoding="utf-8")
        return dict(fallback)


def write_json(path: Path, payload: dict[str, Any]) -> None:
    payload["updated_at"] = now_iso()
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")


def load_scheduler_enabled(paths: PolicyPaths) -> bool:
    if not paths.scheduler_state_path.exists():
        return True
    try:
        payload = json.loads(paths.scheduler_state_path.read_text(encoding="utf-8"))
        return bool(payload.get("schedulerEnabled", True))
    except Exception:
        return True


def append_event(paths: PolicyPaths, payload: dict[str, Any]) -> None:
    payload["at"] = now_iso()
    with paths.event_log_path.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(payload, ensure_ascii=True) + "\n")


def build_decision(mode: str, scheduler_enabled: bool, caller: str, caller_context: str) -> tuple[bool, str | None]:
    if mode == "hard-off":
        return False, SKIP_GLOBAL_HARD_OFF
    if not scheduler_enabled:
        return False, SKIP_SCHEDULER_DISABLED
    if caller_context == "manual" and caller in MANUAL_BLOCKED_CALLERS:
        return False, SKIP_SAFE_RUN_BLOCK
    return True, None


def handle_get_state(args: argparse.Namespace) -> None:
    paths = resolve_paths(args.project_root)
    state = load_json(paths.state_path, default_state())
    result = {
        **state,
        "scheduler_enabled": load_scheduler_enabled(paths),
        "state_path": str(paths.state_path),
        "event_log_path": str(paths.event_log_path),
    }
    print(json.dumps(result))


def handle_set_mode(args: argparse.Namespace) -> None:
    paths = resolve_paths(args.project_root)
    state = load_json(paths.state_path, default_state())
    state["mode"] = args.mode
    write_json(paths.state_path, state)
    append_event(paths, {"event": "policy_mode_changed", "mode": args.mode})
    print(json.dumps({"ok": True, "mode": args.mode, "state_path": str(paths.state_path)}))


def handle_evaluate(args: argparse.Namespace) -> None:
    paths = resolve_paths(args.project_root)
    state = load_json(paths.state_path, default_state())
    scheduler_enabled = load_scheduler_enabled(paths)
    allowed, skip_reason = build_decision(state.get("mode", DEFAULT_MODE), scheduler_enabled, args.caller, args.caller_context)

    state["last_caller"] = args.caller
    state["last_provider"] = args.provider
    state["last_model"] = args.model
    state["last_task_id"] = args.task_id
    if allowed:
        state["allowed_execution_count"] = int(state.get("allowed_execution_count", 0)) + 1
    else:
        state["blocked_execution_count"] = int(state.get("blocked_execution_count", 0)) + 1
        state["last_blocked_at"] = now_iso()
        state["last_skip_reason"] = skip_reason
    write_json(paths.state_path, state)

    event = {
        "event": "llm_preflight",
        "decision": "allow" if allowed else "skip",
        "mode": state.get("mode", DEFAULT_MODE),
        "scheduler_enabled": scheduler_enabled,
        "caller": args.caller,
        "caller_context": args.caller_context,
        "provider": args.provider,
        "model": args.model,
        "task_id": args.task_id,
        "skip_reason": skip_reason,
    }
    append_event(paths, event)

    print(
        json.dumps(
            {
                "allowed": allowed,
                "mode": state.get("mode", DEFAULT_MODE),
                "scheduler_enabled": scheduler_enabled,
                "caller": args.caller,
                "caller_context": args.caller_context,
                "provider": args.provider,
                "model": args.model,
                "task_id": args.task_id,
                "skip_reason": skip_reason,
                "blocked_execution_count": state.get("blocked_execution_count", 0),
                "last_llm_call_at": state.get("last_llm_call_at"),
                "state_path": str(paths.state_path),
                "event_log_path": str(paths.event_log_path),
            }
        )
    )


def handle_record_execution(args: argparse.Namespace) -> None:
    paths = resolve_paths(args.project_root)
    state = load_json(paths.state_path, default_state())
    state["last_llm_call_at"] = now_iso()
    state["last_caller"] = args.caller
    state["last_provider"] = args.provider
    state["last_model"] = args.model
    state["last_task_id"] = args.task_id
    write_json(paths.state_path, state)
    append_event(
        paths,
        {
            "event": "llm_execution",
            "mode": state.get("mode", DEFAULT_MODE),
            "scheduler_enabled": load_scheduler_enabled(paths),
            "caller": args.caller,
            "provider": args.provider,
            "model": args.model,
            "task_id": args.task_id,
        },
    )
    print(json.dumps({"ok": True, "last_llm_call_at": state["last_llm_call_at"]}))


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Central LLM execution policy evaluator")
    subparsers = parser.add_subparsers(dest="command", required=True)

    def add_project_root(target: argparse.ArgumentParser) -> None:
        target.add_argument("--project-root", required=True)

    get_state = subparsers.add_parser("get-state")
    add_project_root(get_state)
    get_state.set_defaults(handler=handle_get_state)

    set_mode = subparsers.add_parser("set-mode")
    add_project_root(set_mode)
    set_mode.add_argument("--mode", choices=["safe-run", "hard-off"], required=True)
    set_mode.set_defaults(handler=handle_set_mode)

    evaluate = subparsers.add_parser("evaluate")
    add_project_root(evaluate)
    evaluate.add_argument("--caller", required=True)
    evaluate.add_argument("--caller-context", choices=["background", "manual"], default="background")
    evaluate.add_argument("--provider", default="")
    evaluate.add_argument("--model", default="")
    evaluate.add_argument("--task-id", default="")
    evaluate.set_defaults(handler=handle_evaluate)

    record_execution = subparsers.add_parser("record-execution")
    add_project_root(record_execution)
    record_execution.add_argument("--caller", required=True)
    record_execution.add_argument("--provider", default="")
    record_execution.add_argument("--model", default="")
    record_execution.add_argument("--task-id", default="")
    record_execution.set_defaults(handler=handle_record_execution)

    return parser


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()
    args.handler(args)


if __name__ == "__main__":
    main()