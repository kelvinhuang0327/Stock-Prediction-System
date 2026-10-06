#!/usr/bin/env python3
"""
run-daily-regime-aware-pipeline.py

Daily Regime-Aware Report Pipeline (T-07 updated in T-08)
Orchestrates: TAIEX freshness check => regime classifier => persistence => walk-forward => daily report => validation

Usage:
  python3 scripts/run-daily-regime-aware-pipeline.py --dry-run
  python3 scripts/run-daily-regime-aware-pipeline.py --apply
  python3 scripts/run-daily-regime-aware-pipeline.py --date 2026-05-06 --dry-run
  python3 scripts/run-daily-regime-aware-pipeline.py --date 2026-05-06 --apply

Safety:
  - Default mode is dry-run.
  - Only taiex_backfill_if_needed writes MarketIndex; market_regime_persistence writes MarketRegimeResult.
  - No StockQuote mutation. No production DB write. No strategy validation.
  - No buy/sell/signal. No ROI/win-rate. No H001-H012. No H013+.
  - External API only allowed in taiex_backfill_if_needed stage.
"""

import argparse
import datetime
import json
import os
import re
import subprocess
import sys
import time

FORBIDDEN_FIELDS = [
    "buy", "sell", "signal", "roi", "win_rate",
    "alpha", "edge", "profit", "recommendation", "outperform"
]

REQUIRED_ARTIFACTS = [
    "outputs/market_regime/p4_03b_market_regime_sample.json",
    "outputs/walk_forward/t05_walk_forward_sample.json",
    "outputs/daily_report/t06_daily_report_section.json",
    "outputs/daily_report/t06_daily_report_section.md",
    "outputs/daily_report/t06_daily_ops_report.json",
    "outputs/daily_report/t06_daily_ops_report.md",
]

ALLOWED_FINAL_STATUSES = [
    "PASS",
    "PASS_WITH_DEGRADED_FRESHNESS",
    "FAIL_GUARDRAIL",
    "FAIL_ARTIFACT_VALIDATION",
    "FAIL_STAGE_EXECUTION",
    "BLOCKED_EXTERNAL_API",
    "BLOCKED_SAFETY_RULE",
]


def parse_args():
    parser = argparse.ArgumentParser(description="Daily Regime-Aware Report Pipeline (T-07)")
    parser.add_argument("--dry-run", dest="dry_run", action="store_true", default=False)
    parser.add_argument("--apply", action="store_true", default=False)
    parser.add_argument("--date", type=str, default=None)
    return parser.parse_args()


def resolve_mode(args):
    if args.apply and args.dry_run:
        print("ERROR: Cannot specify both --apply and --dry-run", file=sys.stderr)
        sys.exit(1)
    return "apply" if args.apply else "dry-run"


def resolve_date(date_str):
    cap = datetime.date(2026, 5, 6)
    if date_str:
        try:
            d = datetime.date.fromisoformat(date_str)
        except ValueError:
            print("ERROR: Invalid date format: " + date_str, file=sys.stderr)
            sys.exit(1)
    else:
        d = datetime.date.today()
    return str(min(d, cap))


def run_command(cmd, timeout=120):
    started_at = datetime.datetime.now().isoformat()
    t0 = time.time()
    try:
        result = subprocess.run(
            cmd, shell=True, capture_output=True, text=True, timeout=timeout,
            env=os.environ.copy()
        )
        duration_ms = int((time.time() - t0) * 1000)
        return {
            "exit_code": result.returncode,
            "stdout": result.stdout,
            "stderr": result.stderr,
            "started_at": started_at,
            "ended_at": datetime.datetime.now().isoformat(),
            "duration_ms": duration_ms,
            "stdout_tail": result.stdout[-500:] if result.stdout else "",
            "stderr_tail": result.stderr[-300:] if result.stderr else "",
        }
    except subprocess.TimeoutExpired:
        duration_ms = int((time.time() - t0) * 1000)
        return {
            "exit_code": -1,
            "stdout": "", "stderr": "TIMEOUT",
            "started_at": started_at,
            "ended_at": datetime.datetime.now().isoformat(),
            "duration_ms": duration_ms,
            "stdout_tail": "", "stderr_tail": "TIMEOUT",
        }


def check_forbidden_fields(data):
    data_str = json.dumps(data)
    violations = []
    for field in FORBIDDEN_FIELDS:
        if re.search(r'"' + field + r'"\s*:', data_str):
            violations.append(field)
    return violations


def validate_artifact(path):
    if not os.path.exists(path):
        return {"exists": False, "parse_ok": False, "error": "FILE_NOT_FOUND", "forbidden_violations": []}
    if not path.endswith(".json"):
        return {"exists": True, "parse_ok": True, "error": None, "forbidden_violations": []}
    try:
        with open(path) as f:
            data = json.load(f)
        violations = check_forbidden_fields(data)
        return {"exists": True, "parse_ok": True, "error": None, "forbidden_violations": violations}
    except Exception as e:
        return {"exists": True, "parse_ok": False, "error": str(e), "forbidden_violations": []}


def make_stage_record(name, cmd, run_result, output_files, writes_db, calls_external_api, stage_status, guardrail_status, json_parse_status):
    return {
        "stage_name": name,
        "status": stage_status,
        "command": cmd,
        "started_at": run_result.get("started_at", ""),
        "ended_at": run_result.get("ended_at", ""),
        "duration_ms": run_result.get("duration_ms", 0),
        "exit_code": run_result.get("exit_code", -1),
        "stdout_tail": run_result.get("stdout_tail", ""),
        "stderr_tail": run_result.get("stderr_tail", ""),
        "output_files_exist": {f: os.path.exists(f) for f in output_files},
        "json_parse_status": json_parse_status,
        "guardrail_status": guardrail_status,
        "writes_db": writes_db,
        "calls_external_api": calls_external_api,
    }


def skipped_result(reason):
    now = datetime.datetime.now().isoformat()
    return {
        "exit_code": 0, "stdout": "SKIPPED: " + reason, "stderr": "",
        "started_at": now, "ended_at": now, "duration_ms": 0,
        "stdout_tail": "SKIPPED: " + reason, "stderr_tail": "",
    }


def run_pipeline(mode, target_date):
    stages = []
    degraded = False
    fail_reason = None

    print("\n=== T-07 Daily Regime-Aware Report Pipeline ===")
    print("Mode: " + mode + "  |  Target date: " + target_date + "\n")

    # Stage 1: freshness_check
    print("[1/8] freshness_check -- TAIEX gap detection (dry-run)...")
    cmd1 = "python3 scripts/backfill-taiex-gap.py --dry-run"
    r1 = run_command(cmd1)
    gap_detected = "Would insert" in r1["stdout"] or "gap" in r1["stdout"].lower()
    s1_status = "PASS" if r1["exit_code"] == 0 else "FAIL"
    stages.append(make_stage_record(
        "freshness_check", cmd1, r1, [], False, False,
        s1_status, "PASS" if r1["exit_code"] == 0 else "FAIL", "N/A"
    ))
    if s1_status == "FAIL":
        fail_reason = "FAIL_STAGE_EXECUTION"
        print("  FAIL freshness_check: " + r1["stderr_tail"][:200])
    else:
        print("  PASS freshness_check (gap_detected=" + str(gap_detected) + ")")

    # Stage 2: taiex_backfill_if_needed
    print("[2/8] taiex_backfill_if_needed...")
    if mode == "apply" and gap_detected and s1_status == "PASS":
        cmd2 = "python3 scripts/backfill-taiex-gap.py --apply"
        print("  Running: " + cmd2)
        r2 = run_command(cmd2, timeout=180)
        if r2["exit_code"] != 0:
            degraded = True
            s2_status = "DEGRADED"
            print("  DEGRADED backfill: " + r2["stderr_tail"][:200])
        else:
            s2_status = "PASS"
            print("  PASS backfill")
    else:
        reason = "dry-run mode" if mode == "dry-run" else ("no gap" if not gap_detected else "freshness_check failed")
        cmd2 = "SKIPPED (" + reason + ")"
        r2 = skipped_result(reason)
        s2_status = "SKIPPED"
        print("  SKIPPED (" + reason + ")")
    stages.append(make_stage_record(
        "taiex_backfill_if_needed", cmd2, r2, [], True, True,
        s2_status, s2_status, "N/A"
    ))

    # Stage 3: market_regime_classifier
    print("[3/8] market_regime_classifier...")
    regime_output = "outputs/market_regime/p4_03b_market_regime_sample.json"
    cmd3 = "python3 scripts/build-market-regime-classifier.py --output " + regime_output
    r3 = run_command(cmd3)
    art3 = validate_artifact(regime_output) if r3["exit_code"] == 0 else {"exists": False, "parse_ok": False, "error": "stage failed", "forbidden_violations": []}
    s3_status = "PASS" if r3["exit_code"] == 0 and art3["parse_ok"] else "FAIL"
    if s3_status == "FAIL" and not fail_reason:
        fail_reason = "FAIL_STAGE_EXECUTION"
    print("  " + s3_status)
    stages.append(make_stage_record(
        "market_regime_classifier", cmd3, r3, [regime_output], False, False,
        s3_status,
        "PASS" if not art3.get("forbidden_violations") else "FAIL",
        "PASS" if art3["parse_ok"] else "FAIL"
    ))

    # Stage 4: market_regime_persistence
    persist_input = regime_output
    if mode == "apply":
        print("[4/9] market_regime_persistence (APPLY - writes MarketRegimeResult)...")
        cmd4p = ("python3 scripts/persist-market-regime-results.py"
                 " --input " + persist_input + " --apply")
    else:
        print("[4/9] market_regime_persistence (DRY-RUN)...")
        cmd4p = ("python3 scripts/persist-market-regime-results.py"
                 " --input " + persist_input + " --dry-run")
    r4p = run_command(cmd4p)
    persist_dry_rpt = "outputs/market_regime/t08_persistence_dry_run_report.json"
    persist_apply_rpt = "outputs/market_regime/t08_persistence_apply_report.json"
    persist_artifact = persist_apply_rpt if mode == "apply" else persist_dry_rpt
    art4p = validate_artifact(persist_artifact) if r4p["exit_code"] == 0 else {"exists": False, "parse_ok": False, "error": "stage failed", "forbidden_violations": []}
    s4p_status = "PASS" if r4p["exit_code"] == 0 and art4p["parse_ok"] else "FAIL"
    if s4p_status == "FAIL" and not fail_reason:
        fail_reason = "FAIL_STAGE_EXECUTION"
    print("  " + s4p_status)
    stages.append(make_stage_record(
        "market_regime_persistence", cmd4p, r4p, [persist_artifact],
        False, mode == "apply",
        s4p_status,
        "PASS" if not art4p.get("forbidden_violations") else "FAIL",
        "PASS" if art4p["parse_ok"] else "FAIL"
    ))

    # Stage 5: portfolio_walk_forward_skeleton
    print("[5/9] portfolio_walk_forward_skeleton...")
    wf_output = "outputs/walk_forward/t05_walk_forward_sample.json"
    cmd4 = "python3 scripts/build-portfolio-walk-forward-skeleton.py --output " + wf_output
    r4 = run_command(cmd4)
    art4 = validate_artifact(wf_output) if r4["exit_code"] == 0 else {"exists": False, "parse_ok": False, "error": "stage failed", "forbidden_violations": []}
    s4_status = "PASS" if r4["exit_code"] == 0 and art4["parse_ok"] else "FAIL"
    if s4_status == "FAIL" and not fail_reason:
        fail_reason = "FAIL_STAGE_EXECUTION"
    print("  " + s4_status)
    stages.append(make_stage_record(
        "portfolio_walk_forward_skeleton", cmd4, r4, [wf_output], False, False,
        s4_status,
        "PASS" if not art4.get("forbidden_violations") else "FAIL",
        "PASS" if art4["parse_ok"] else "FAIL"
    ))

    # Stage 6: daily_report_builder
    print("[6/9] daily_report_builder...")
    rpt_json = "outputs/daily_report/t06_daily_report_section.json"
    rpt_md = "outputs/daily_report/t06_daily_report_section.md"
    cmd5 = ("python3 scripts/build-daily-regime-walkforward-report.py"
            " --output-json " + rpt_json + " --output-md " + rpt_md)
    r5 = run_command(cmd5)
    art5a = validate_artifact(rpt_json) if r5["exit_code"] == 0 else {"exists": False, "parse_ok": False, "error": "stage failed", "forbidden_violations": []}
    ops_path = "outputs/daily_report/t06_daily_ops_report.json"
    art5b = validate_artifact(ops_path) if r5["exit_code"] == 0 else {"exists": False, "parse_ok": False, "error": "stage failed", "forbidden_violations": []}
    s5_status = "PASS" if r5["exit_code"] == 0 and art5a["parse_ok"] and art5b["parse_ok"] else "FAIL"
    if s5_status == "FAIL" and not fail_reason:
        fail_reason = "FAIL_STAGE_EXECUTION"
    has_disclaimer = False
    if art5b["parse_ok"]:
        try:
            with open(ops_path) as f:
                ops_data = json.load(f)
            has_disclaimer = "do_not_interpret_as" in ops_data
        except Exception:
            pass
    print("  " + s5_status + " (do_not_interpret_as=" + str(has_disclaimer) + ")")
    stages.append(make_stage_record(
        "daily_report_builder", cmd5, r5,
        [rpt_json, rpt_md, ops_path, "outputs/daily_report/t06_daily_ops_report.md"],
        False, False, s5_status,
        "PASS" if (not art5a.get("forbidden_violations") and not art5b.get("forbidden_violations")) else "FAIL",
        "PASS" if (art5a["parse_ok"] and art5b["parse_ok"]) else "FAIL"
    ))

    # Stage 7: guardrail_validation
    print("[7/9] guardrail_validation...")
    check_files = [
        "outputs/daily_report/t06_daily_report_section.json",
        "outputs/daily_report/t06_daily_ops_report.json",
        "outputs/market_regime/p4_03b_market_regime_sample.json",
        "outputs/walk_forward/t05_walk_forward_sample.json",
    ]
    guardrail_checks = {}
    all_guardrails_pass = True
    for cf in check_files:
        av = validate_artifact(cf)
        viol = av.get("forbidden_violations", [])
        guardrail_checks[cf] = {"parse_ok": av["parse_ok"], "forbidden_violations": viol}
        if not av["parse_ok"] or viol:
            all_guardrails_pass = False
    guardrail_checks["do_not_interpret_as"] = has_disclaimer
    if not has_disclaimer:
        all_guardrails_pass = False
    s6_status = "PASS" if all_guardrails_pass else "FAIL"
    if s6_status == "FAIL" and not fail_reason:
        fail_reason = "FAIL_GUARDRAIL"
    print("  " + s6_status)
    now6 = datetime.datetime.now().isoformat()
    r6 = {"exit_code": 0 if s6_status == "PASS" else 1, "stdout": "", "stderr": "",
          "started_at": now6, "ended_at": now6, "duration_ms": 0, "stdout_tail": "", "stderr_tail": ""}
    stages.append(make_stage_record(
        "guardrail_validation", "internal guardrail check", r6, [], False, False,
        s6_status, s6_status, "PASS"
    ))

    # Stage 8: artifact_validation
    print("[8/9] artifact_validation...")
    art_results = {}
    all_arts_ok = True
    for af in REQUIRED_ARTIFACTS:
        av = validate_artifact(af)
        art_results[af] = {"exists": av["exists"], "parse_ok": av["parse_ok"]}
        if not av["exists"] or (af.endswith(".json") and not av["parse_ok"]):
            all_arts_ok = False
    s7_status = "PASS" if all_arts_ok else "FAIL"
    if s7_status == "FAIL" and not fail_reason:
        fail_reason = "FAIL_ARTIFACT_VALIDATION"
    print("  " + s7_status)
    now7 = datetime.datetime.now().isoformat()
    r7 = {"exit_code": 0 if s7_status == "PASS" else 1, "stdout": "", "stderr": "",
          "started_at": now7, "ended_at": now7, "duration_ms": 0, "stdout_tail": "", "stderr_tail": ""}
    stages.append(make_stage_record(
        "artifact_validation", "internal artifact check", r7, [], False, False,
        s7_status, s7_status, "PASS"
    ))

    # Stage 9: readiness_decision
    print("[9/9] readiness_decision...")
    if degraded and not fail_reason:
        final_status = "PASS_WITH_DEGRADED_FRESHNESS"
    elif fail_reason:
        final_status = fail_reason
    else:
        final_status = "PASS"

    assert final_status in ALLOWED_FINAL_STATUSES, "Invalid status: " + final_status

    stages_passed = sum(1 for s in stages if s["status"] in ("PASS", "SKIPPED"))
    stages_failed = sum(1 for s in stages if s["status"] == "FAIL")
    stages_degraded = sum(1 for s in stages if s["status"] == "DEGRADED")

    now8 = datetime.datetime.now().isoformat()
    r8 = {"exit_code": 0, "stdout": "final_status=" + final_status, "stderr": "",
          "started_at": now8, "ended_at": now8, "duration_ms": 0,
          "stdout_tail": "final_status=" + final_status, "stderr_tail": ""}
    stages.append(make_stage_record(
        "readiness_decision", "pipeline summary generation", r8,
        ["outputs/scheduler/t07_pipeline_run_summary.json",
         "outputs/scheduler/t07_pipeline_run_summary.md"],
        False, False, "PASS", "PASS", "N/A"
    ))

    summary = {
        "pipeline_name": "dailyRegimeAwareReportPipeline",
        "run_date": target_date,
        "generated_at": datetime.datetime.now().isoformat(),
        "mode": mode,
        "total_stages": len(stages),
        "stages_passed": stages_passed,
        "stages_failed": stages_failed,
        "stages_degraded": stages_degraded,
        "gap_detected": gap_detected,
        "freshness_status": "GAP_DETECTED" if gap_detected else "UP_TO_DATE",
        "daily_report_status": "GENERATED" if s5_status == "PASS" else "FAILED",
        "has_do_not_interpret_as": has_disclaimer,
        "guardrail_checks": guardrail_checks,
        "artifact_validation": art_results,
        "artifacts_generated": [af for af, av in art_results.items() if av["exists"]],
        "artifacts_missing": [af for af, av in art_results.items() if not av["exists"]],
        "json_parse_results": {af: av["parse_ok"] for af, av in art_results.items() if af.endswith(".json")},
        "stage_results": stages,
        "final_pipeline_status": final_status,
    }

    os.makedirs("outputs/scheduler", exist_ok=True)
    with open("outputs/scheduler/t07_pipeline_run_summary.json", "w") as f:
        json.dump(summary, f, indent=2)

    md_lines = [
        "# T-07 Pipeline Run Summary",
        "",
        "**Run Date:** " + target_date,
        "**Mode:** " + mode,
        "**Generated At:** " + summary["generated_at"],
        "",
        "## Overall Result",
        "",
        "**Final Pipeline Status: `" + final_status + "`**",
        "",
        "| Metric | Value |",
        "|--------|-------|",
        "| Total Stages | " + str(len(stages)) + " |",
        "| Passed | " + str(stages_passed) + " |",
        "| Failed | " + str(stages_failed) + " |",
        "| Degraded | " + str(stages_degraded) + " |",
        "| TAIEX Gap Detected | " + str(gap_detected) + " |",
        "| Daily Report Status | " + summary["daily_report_status"] + " |",
        "| do_not_interpret_as | " + str(has_disclaimer) + " |",
        "",
        "## Stage Results",
        "",
        "| Stage | Status | Duration |",
        "|-------|--------|----------|",
    ]
    for s in stages:
        md_lines.append("| " + s["stage_name"] + " | " + s["status"] + " | " + str(s["duration_ms"]) + "ms |")
    md_lines += ["", "## Artifact Validation", ""]
    for af, av in art_results.items():
        icon = "OK" if av["exists"] and av.get("parse_ok", True) else "MISSING"
        md_lines.append("- [" + icon + "] " + af)

    with open("outputs/scheduler/t07_pipeline_run_summary.md", "w") as f:
        f.write("\n".join(md_lines) + "\n")

    print("\n=== PIPELINE RESULT: " + final_status + " ===\n")
    return summary


def main():
    args = parse_args()
    mode = resolve_mode(args)
    target_date = resolve_date(args.date)
    summary = run_pipeline(mode, target_date)
    exit_code = 0 if summary["final_pipeline_status"] in ("PASS", "PASS_WITH_DEGRADED_FRESHNESS") else 1
    sys.exit(exit_code)


if __name__ == "__main__":
    main()
