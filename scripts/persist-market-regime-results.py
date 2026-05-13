#!/usr/bin/env python3
"""
T-08: persist-market-regime-results.py
Safe persistence script for MarketRegimeResult table.
Default: --dry-run (no DB writes unless --apply given)
"""
import argparse
import json
import os
import sqlite3
import sys
import datetime

DB_PATH = "prisma/dev.db"
DEFAULT_INPUT = "outputs/market_regime/p4_03b_market_regime_sample.json"
DRY_RUN_REPORT_JSON = "outputs/market_regime/t08_persistence_dry_run_report.json"
DRY_RUN_REPORT_MD   = "outputs/market_regime/t08_persistence_dry_run_report.md"
APPLY_REPORT_JSON   = "outputs/market_regime/t08_persistence_apply_report.json"
APPLY_REPORT_MD     = "outputs/market_regime/t08_persistence_apply_report.md"

SOURCE  = "P4_03_MARKET_REGIME_CLASSIFIER"
VERSION = "p4_03b_v1"
ALLOWED_LABELS = {"BULL", "BEAR", "SIDEWAYS", "HIGH_VOLATILITY", "LOW_CONFIDENCE"}
MAX_DATE = "2026-05-06"

FORBIDDEN_FIELDS = {"buy","sell","signal","roi","win_rate","alpha","edge","profit",
                    "recommendation","outperform"}


def validate_record(r, idx):
    errors = []
    date = r.get("asof_date","")
    if not date or len(date) != 10:
        errors.append(f"[{idx}] invalid date format: {date!r}")
    elif date > MAX_DATE:
        errors.append(f"[{idx}] future date: {date} > {MAX_DATE}")
    label = r.get("regime_label","")
    if label not in ALLOWED_LABELS:
        errors.append(f"[{idx}] invalid regimeLabel: {label!r}")
    conf = r.get("regime_confidence")
    if conf is None or not (0.0 <= float(conf) <= 1.0):
        errors.append(f"[{idx}] invalid confidence: {conf!r}")
    # Validate JSON fields
    for field in ["evidence_flags","missing_features","pit_safety_flags"]:
        val = r.get(field)
        if val is not None:
            try:
                if isinstance(val, str):
                    json.loads(val)
                elif not isinstance(val, list):
                    errors.append(f"[{idx}] {field} must be list or JSON string")
            except json.JSONDecodeError:
                errors.append(f"[{idx}] {field} not valid JSON")
    return errors


def record_to_row(r):
    def to_json_str(v):
        if v is None:
            return None
        if isinstance(v, str):
            return v
        return json.dumps(v, ensure_ascii=False)
    now = datetime.datetime.now().isoformat()
    return {
        "date":                r["asof_date"],
        "regimeLabel":         r["regime_label"],
        "confidence":          float(r["regime_confidence"]),
        "taiexClose":          r.get("taiex_close"),
        "taiexMa50":           r.get("taiex_ma50"),
        "taiexMa200":          r.get("taiex_ma200"),
        "taiexReturn1d":       r.get("taiex_return_1d"),
        "taiexReturn20d":      r.get("taiex_return_20d"),
        "taiexVolatility20d":  r.get("taiex_volatility_20d"),
        "marketBreadthProxy":  r.get("market_breadth_proxy"),
        "evidenceJson":        to_json_str(r.get("evidence_flags")),
        "missingFeaturesJson": to_json_str(r.get("missing_features")),
        "pitSafetyJson":       to_json_str(r.get("pit_safety_flags")),
        "source":              SOURCE,
        "version":             VERSION,
        "createdAt":           now,
        "updatedAt":           now,
    }


def load_records(input_file):
    with open(input_file) as f:
        data = json.load(f)
    if isinstance(data, list):
        return data
    if isinstance(data, dict):
        if "records" in data:
            return data["records"]
        # might be dict of date -> record
        vals = list(data.values())
        if vals and isinstance(vals[0], dict) and "asof_date" in vals[0]:
            return vals
    raise ValueError(f"Cannot parse records from {input_file}")


def run(input_file, dry_run):
    print(f"=== T-08 Persistence Script ===")
    print(f"Input: {input_file}")
    print(f"Mode: {'DRY-RUN' if dry_run else 'APPLY'}")
    print(f"DB: {DB_PATH}")

    if not os.path.exists(input_file):
        print(f"ERROR: Input file not found: {input_file}")
        sys.exit(1)
    if not os.path.exists(DB_PATH):
        print(f"ERROR: DB not found: {DB_PATH}")
        sys.exit(1)

    records = load_records(input_file)
    print(f"Loaded {len(records)} records")

    # Validate all records
    all_errors = []
    for i, r in enumerate(records):
        all_errors.extend(validate_record(r, i))

    if all_errors:
        print(f"VALIDATION ERRORS ({len(all_errors)}):")
        for e in all_errors[:10]:
            print(f"  {e}")
        report = {
            "status": "FAIL_VALIDATION",
            "mode": "dry_run" if dry_run else "apply",
            "input_file": input_file,
            "record_count": len(records),
            "validation_errors": all_errors,
            "planned_inserts": 0,
            "planned_updates": 0,
            "generated_at": datetime.datetime.now().isoformat()
        }
        out_json = DRY_RUN_REPORT_JSON if dry_run else APPLY_REPORT_JSON
        with open(out_json, "w") as f:
            json.dump(report, f, indent=2)
        sys.exit(1)

    conn = sqlite3.connect(DB_PATH)
    # Snapshot row counts for safety assertion
    sq_before = conn.execute("SELECT COUNT(*) FROM StockQuote").fetchone()[0]
    mi_before = conn.execute("SELECT COUNT(*) FROM MarketIndex").fetchone()[0]
    wfr_before = conn.execute("SELECT COUNT(*) FROM WalkForwardResult").fetchone()[0]

    # Check existing
    rows = record_to_row(records[0])
    planned_inserts = []
    planned_updates = []
    for r in records:
        row = record_to_row(r)
        existing = conn.execute(
            "SELECT id FROM MarketRegimeResult WHERE date=? AND source=? AND version=?",
            (row["date"], row["source"], row["version"])
        ).fetchone()
        if existing:
            planned_updates.append(row)
        else:
            planned_inserts.append(row)

    print(f"Planned inserts: {len(planned_inserts)}")
    print(f"Planned updates: {len(planned_updates)}")

    actual_inserts = 0
    actual_updates = 0

    if not dry_run:
        import uuid
        for row in planned_inserts:
            cuid = "c" + uuid.uuid4().hex[:24]
            conn.execute("""
                INSERT INTO MarketRegimeResult
                (id,date,regimeLabel,confidence,taiexClose,taiexMa50,taiexMa200,
                 taiexReturn1d,taiexReturn20d,taiexVolatility20d,marketBreadthProxy,
                 evidenceJson,missingFeaturesJson,pitSafetyJson,source,version,createdAt,updatedAt)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
            """, (
                cuid, row["date"], row["regimeLabel"], row["confidence"],
                row["taiexClose"], row["taiexMa50"], row["taiexMa200"],
                row["taiexReturn1d"], row["taiexReturn20d"], row["taiexVolatility20d"],
                row["marketBreadthProxy"], row["evidenceJson"],
                row["missingFeaturesJson"], row["pitSafetyJson"],
                row["source"], row["version"], row["createdAt"], row["updatedAt"]
            ))
            actual_inserts += 1
        for row in planned_updates:
            conn.execute("""
                UPDATE MarketRegimeResult SET
                  regimeLabel=?, confidence=?, taiexClose=?, taiexMa50=?, taiexMa200=?,
                  taiexReturn1d=?, taiexReturn20d=?, taiexVolatility20d=?,
                  marketBreadthProxy=?, evidenceJson=?, missingFeaturesJson=?,
                  pitSafetyJson=?, updatedAt=?
                WHERE date=? AND source=? AND version=?
            """, (
                row["regimeLabel"], row["confidence"],
                row["taiexClose"], row["taiexMa50"], row["taiexMa200"],
                row["taiexReturn1d"], row["taiexReturn20d"], row["taiexVolatility20d"],
                row["marketBreadthProxy"], row["evidenceJson"],
                row["missingFeaturesJson"], row["pitSafetyJson"], row["updatedAt"],
                row["date"], row["source"], row["version"]
            ))
            actual_updates += 1
        conn.commit()

        # Safety assertion: other tables unchanged
        sq_after  = conn.execute("SELECT COUNT(*) FROM StockQuote").fetchone()[0]
        mi_after  = conn.execute("SELECT COUNT(*) FROM MarketIndex").fetchone()[0]
        wfr_after = conn.execute("SELECT COUNT(*) FROM WalkForwardResult").fetchone()[0]
        safety_ok = (sq_after == sq_before and mi_after == mi_before and wfr_after == wfr_before)
        if not safety_ok:
            print("SAFETY VIOLATION: unexpected mutation to StockQuote/MarketIndex/WalkForwardResult!")
            conn.close()
            sys.exit(2)
        print(f"Safety check PASS: StockQuote={sq_after}, MarketIndex={mi_after}, WalkForwardResult={wfr_after}")

    mrr_count = conn.execute("SELECT COUNT(*) FROM MarketRegimeResult").fetchone()[0]
    conn.close()

    report = {
        "status": "PASS",
        "mode": "dry_run" if dry_run else "apply",
        "input_file": input_file,
        "record_count": len(records),
        "validation_errors": [],
        "planned_inserts": len(planned_inserts),
        "planned_updates": len(planned_updates),
        "actual_inserts": 0 if dry_run else actual_inserts,
        "actual_updates": 0 if dry_run else actual_updates,
        "market_regime_result_row_count_after": mrr_count,
        "safety_check": {
            "stock_quote_before": sq_before,
            "market_index_before": mi_before,
            "walk_forward_result_before": wfr_before
        },
        "source": SOURCE,
        "version": VERSION,
        "generated_at": datetime.datetime.now().isoformat()
    }

    out_json = DRY_RUN_REPORT_JSON if dry_run else APPLY_REPORT_JSON
    out_md   = DRY_RUN_REPORT_MD   if dry_run else APPLY_REPORT_MD
    os.makedirs(os.path.dirname(out_json), exist_ok=True)
    with open(out_json, "w") as f:
        json.dump(report, f, indent=2)

    md_lines = [
        f"# T-08 Persistence {'Dry-Run' if dry_run else 'Apply'} Report\n",
        f"**Date:** 2026-05-06  ",
        f"**Mode:** {'DRY-RUN' if dry_run else 'APPLY'}  ",
        f"**Status:** {report['status']}\n",
        f"| Metric | Value |",
        f"|--------|-------|",
        f"| Input records | {report['record_count']} |",
        f"| Planned inserts | {report['planned_inserts']} |",
        f"| Planned updates | {report['planned_updates']} |",
        f"| Actual inserts | {report['actual_inserts']} |",
        f"| Actual updates | {report['actual_updates']} |",
        f"| MarketRegimeResult rows after | {report['market_regime_result_row_count_after']} |",
        f"| Validation errors | 0 |",
    ]
    with open(out_md, "w") as f:
        f.write("\n".join(md_lines))

    mode_str = "DRY-RUN" if dry_run else "APPLY"
    print(f"\n{mode_str} COMPLETE: status={report['status']}")
    print(f"Report: {out_json}")
    return 0


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true", default=True, help="Dry-run (default)")
    parser.add_argument("--apply", action="store_true", help="Actually write to DB")
    parser.add_argument("--input", default=DEFAULT_INPUT)
    args = parser.parse_args()
    dry_run = not args.apply
    sys.exit(run(args.input, dry_run))
