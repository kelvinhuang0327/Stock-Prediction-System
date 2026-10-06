#!/usr/bin/env python3
"""
GBGF Stock POC Reproducibility Verifier — P3-02
Verifies that a re-run of the Stock POC gate pipeline matches the archived pack.

Usage:
    python3 scripts/verify_stock_poc_reproducibility.py \
        --pack outputs/stock_poc/reproducibility/stock_poc_pack_20260505.json

Exit codes:
    0 — all checks PASS
    1 — one or more checks FAIL
"""

import argparse
import hashlib
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT))


# ─── Helpers ─────────────────────────────────────────────────────────────────

def sha256_file(path: Path) -> str:
    if not path.exists():
        return ""
    return hashlib.sha256(path.read_bytes()).hexdigest()


def sha256_json_list(data: list) -> str:
    return hashlib.sha256(json.dumps(data, sort_keys=True).encode()).hexdigest()


def check(label: str, passed: bool, detail: str = "") -> bool:
    icon = "✅" if passed else "❌"
    print(f"  {icon}  {label}")
    if detail:
        print(f"        {detail}")
    return passed


# ─── Verification steps ───────────────────────────────────────────────────────

def verify_source_artifacts(pack: dict) -> bool:
    print("\n── Source Artifact Checksums ────────────────────────────────")
    all_ok = True
    for artifact, expected_sha in pack.get("source_artifact_sha256", {}).items():
        # artifact may be an absolute path (stock pack) or a relative path (h6 pack)
        artifact_path = Path(artifact) if Path(artifact).is_absolute() else ROOT / artifact
        actual_sha = sha256_file(artifact_path)
        ok = actual_sha == expected_sha
        detail = f"expected {expected_sha[:16]}... got {actual_sha[:16]}..." if not ok else ""
        all_ok = check(Path(artifact).name, ok, detail) and all_ok
    return all_ok


def verify_script_checksum(pack: dict) -> bool:
    print("\n── Script Checksum ──────────────────────────────────────────")
    script_sha = pack.get("script_sha256", "")
    if isinstance(script_sha, dict):
        items = list(script_sha.items())
    else:
        # Plain string: refers to run_gbgf_stock_poc.py (the reproduction script)
        items = [("scripts/run_gbgf_stock_poc.py", script_sha)]

    all_ok = True
    for script_path, expected_sha in items:
        actual_sha = sha256_file(ROOT / script_path)
        ok = actual_sha == expected_sha
        detail = f"expected {expected_sha[:16]}... got {actual_sha[:16]}..." if not ok else ""
        all_ok = check(Path(script_path).name, ok, detail) and all_ok
    return all_ok


def re_run_pipeline(pack: dict) -> dict:
    print("\n── Re-running Stock POC Pipeline ────────────────────────────")
    cmd_str = pack.get("reproduction_command", "python3 scripts/run_gbgf_stock_poc.py --dry-run")
    parts = cmd_str.split()
    # normalise: ensure python3 is the interpreter
    if parts[0] != "python3":
        parts = ["python3"] + parts

    result = subprocess.run(
        parts,
        cwd=str(ROOT),
        capture_output=True,
        text=True,
    )
    if result.returncode not in (0, 1):  # exit=1 allowed (gate FAILs → exit 1 by design)
        print(f"  ❌  Pipeline crashed with code {result.returncode}")
        print(result.stderr[-500:] if result.stderr else "")
        return {}
    print(f"  ✅  Pipeline exited {result.returncode} (exit=1 expected: G03 FAIL on mock data)")

    result_path = ROOT / "outputs" / "stock_poc" / "stock_poc_gate_result.json"
    if not result_path.exists():
        print("  ❌  output JSON not found after re-run")
        return {}
    return json.loads(result_path.read_text())


def verify_gate_statuses(fresh: dict, pack: dict) -> bool:
    print("\n── Gate Status Comparison ───────────────────────────────────")
    expected = pack.get("expected_gate_statuses", pack.get("gate_statuses", {}))
    actual = {g["gate_id"]: g["status"] for g in fresh.get("gate_results", [])}
    all_ok = True
    for gate_id in sorted(expected.keys()):
        exp = expected[gate_id]
        act = actual.get(gate_id, "MISSING")
        ok = act == exp
        detail = f"expected={exp}, got={act}" if not ok else ""
        all_ok = check(f"{gate_id}", ok, detail) and all_ok
    return all_ok


def verify_classification(fresh: dict, pack: dict) -> bool:
    print("\n── Final Classification ─────────────────────────────────────")
    expected = pack.get("expected_classification")
    actual = fresh.get("final_classification", "MISSING")
    ok = actual == expected
    return check(
        f"final_classification: {actual}",
        ok,
        f"expected={expected}" if not ok else "",
    )


def verify_gate_result_sha(fresh: dict, pack: dict) -> bool:
    print("\n── Gate Result SHA256 ───────────────────────────────────────")
    expected_sha = pack.get("gate_result_sha256", "")
    if not expected_sha:
        return check("gate_result_sha256", False, "Not present in pack")
    fresh_sha = sha256_json_list(fresh.get("gate_results", []))
    ok = fresh_sha == expected_sha
    detail = f"expected {expected_sha[:16]}... got {fresh_sha[:16]}..." if not ok else ""
    return check("gate_result_sha256", ok, detail)


def verify_safety_confirmations(fresh: dict, pack: dict) -> bool:
    print("\n── Safety Confirmations ─────────────────────────────────────")
    all_ok = True
    safety_checks = [
        ("no_db_write",          fresh.get("db_modified", True) is False),
        ("no_production_write",  fresh.get("production_write", True) is False),
        ("no_strategy_added",    fresh.get("strategy_added", True) is False),
        ("not_trading_advice",   fresh.get("is_trading_recommendation", True) is False),
        ("dry_run",              fresh.get("dry_run", False) is True),
    ]
    for label, ok in safety_checks:
        all_ok = check(label, ok) and all_ok
    return all_ok


def verify_domain_specific(fresh: dict) -> bool:
    """Stock-specific checks: PIT risks must surface in gate messages."""
    print("\n── Stock-Domain Specific Checks ─────────────────────────────")
    all_ok = True

    # G02 message must reference PIT or survivorship
    g02 = next((g for g in fresh.get("gate_results", []) if g["gate_id"] == "G02"), None)
    pit_mentioned = g02 and ("PIT" in g02.get("message", "") or "survivorship" in g02.get("message", "").lower())
    all_ok = check("G02 surfaces PIT/survivorship risk", bool(pit_mentioned)) and all_ok

    # G03 must FAIL (random mock data has no edge)
    g03 = next((g for g in fresh.get("gate_results", []) if g["gate_id"] == "G03"), None)
    g03_fail = g03 and g03.get("status") == "FAIL"
    all_ok = check("G03 correctly FAILs on mock noise data", bool(g03_fail)) and all_ok

    # G09 must be BLOCKED
    g09 = next((g for g in fresh.get("gate_results", []) if g["gate_id"] == "G09"), None)
    g09_blocked = g09 and g09.get("status") == "BLOCKED"
    all_ok = check("G09 BLOCKED (no production write)", bool(g09_blocked)) and all_ok

    # G10 must be BLOCKED (never auto-approved)
    g10 = next((g for g in fresh.get("gate_results", []) if g["gate_id"] == "G10"), None)
    g10_blocked = g10 and g10.get("status") == "BLOCKED"
    all_ok = check("G10 BLOCKED (no human review)", bool(g10_blocked)) and all_ok

    # domain_report must mention STOCK and pit_risks
    domain_report = fresh.get("domain_report", {})
    all_ok = check("domain_report.domain == STOCK", domain_report.get("domain") == "STOCK") and all_ok
    all_ok = check("domain_report contains pit_risks", bool(domain_report.get("pit_risks"))) and all_ok

    return all_ok


# ─── Main ────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="Verify GBGF Stock POC reproducibility against archived pack"
    )
    parser.add_argument("--pack", required=True, help="Path to the reproducibility pack JSON")
    parser.add_argument("--skip-rerun", action="store_true", default=False,
                        help="Skip re-running pipeline; use existing output JSON")
    args = parser.parse_args()

    pack_path = ROOT / args.pack
    if not pack_path.exists():
        print(f"ERROR: Pack not found: {pack_path}")
        sys.exit(1)

    pack = json.loads(pack_path.read_text())

    print(f"\n{'─'*72}")
    print(f"  GBGF Stock POC Reproducibility Verifier")
    print(f"  Pack: {args.pack}")
    print(f"  Run ID: {pack.get('run_id', 'N/A')}")
    print(f"  Strategy: {pack.get('strategy_id', 'N/A')} ({pack.get('domain', 'N/A')})")
    print(f"{'─'*72}")

    results = []

    results.append(verify_source_artifacts(pack))
    results.append(verify_script_checksum(pack))

    if args.skip_rerun:
        print("\n  [skip-rerun] Loading existing output JSON...")
        fresh_path = ROOT / "outputs" / "stock_poc" / "stock_poc_gate_result.json"
        if not fresh_path.exists():
            print("  ❌  outputs/stock_poc/stock_poc_gate_result.json not found")
            sys.exit(1)
        fresh = json.loads(fresh_path.read_text())
    else:
        fresh = re_run_pipeline(pack)
        if not fresh:
            print("\n  ❌  Re-run failed. Cannot continue verification.")
            sys.exit(1)

    results.append(verify_gate_statuses(fresh, pack))
    results.append(verify_classification(fresh, pack))
    results.append(verify_gate_result_sha(fresh, pack))
    results.append(verify_safety_confirmations(fresh, pack))
    results.append(verify_domain_specific(fresh))

    pass_count = sum(results)
    total = len(results)
    all_pass = all(results)

    print(f"\n{'─'*72}")
    print(f"  Verification: {pass_count}/{total} checks PASS")
    if all_pass:
        print("  ✅  STOCK POC REPRODUCIBILITY VERIFIED")
        print(f"  Classification confirmed: {pack.get('expected_classification')}")
    else:
        print("  ❌  REPRODUCIBILITY FAILED — investigate diffs above")
    print(f"{'─'*72}\n")

    return 0 if all_pass else 1


if __name__ == "__main__":
    sys.exit(main())
