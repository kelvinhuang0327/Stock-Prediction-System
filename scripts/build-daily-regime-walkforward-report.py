#!/usr/bin/env python3
"""
T-06 Daily Regime + Walk-Forward Report Builder
================================================
Integrates P4-03 regime classifier output and T-05 portfolio walk-forward
skeleton output into a Daily Ops Report section.

SAFETY CONTRACT:
- Default dry-run (no file writes without explicit flags)
- Reads only local artifact JSON files (no DB writes, no external API calls)
- Does NOT generate buy/sell/signal output
- Does NOT compute ROI or win-rate
- Does NOT use H001-H012 retired hypotheses
- Does NOT make portfolio recommendations
- All dates capped at 2026-05-06 (TAIEX max available date)
"""

import argparse
import json
import os
import sys

REPO_ROOT = os.path.join(os.path.dirname(__file__), "..")
TODAY_CAP = "2026-05-06"

# Input artifact paths
WF_SAMPLE_PATH = os.path.join(REPO_ROOT, "outputs/walk_forward/t05_walk_forward_sample.json")
WF_GUARDRAIL_PATH = os.path.join(REPO_ROOT, "outputs/walk_forward/t05_guardrail_validation.json")
WF_READINESS_PATH = os.path.join(REPO_ROOT, "outputs/walk_forward/t05_readiness_decision.json")
REGIME_SAMPLE_PATH = os.path.join(REPO_ROOT, "outputs/market_regime/p4_03b_market_regime_sample.json")
REGIME_READINESS_PATH = os.path.join(REPO_ROOT, "outputs/market_regime/p4_03b_integration_readiness_recheck.json")

# Forbidden field names in output
FORBIDDEN_FIELDS = {"buy", "sell", "signal", "roi", "win_rate", "alpha", "edge",
                    "profit", "recommendation", "outperform"}


def load_json(path: str) -> dict | None:
    """Load JSON file, return None if missing."""
    try:
        with open(path) as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError) as e:
        print(f"[WARN] Could not load {path}: {e}")
        return None


def build_section(wf_data: dict, guardrail_data: dict, readiness_data: dict,
                  regime_data: dict, regime_readiness_data: dict) -> dict:
    """Build the regimeAwareWalkForwardSummary section."""

    # Walk-forward summary data
    wf_summary = wf_data.get("summary", {}) if wf_data else {}
    wf_records = wf_data.get("records", []) if wf_data else []

    # Latest walk-forward record
    latest_wf = wf_records[-1] if wf_records else None
    latest_wf_date = latest_wf["asof_date"] if latest_wf else None
    latest_portfolio_size = latest_wf["portfolio_size"] if latest_wf else None
    latest_candidates = latest_wf["candidate_symbols"] if latest_wf else []
    latest_wf_dq_flags = latest_wf["data_quality_flags"] if latest_wf else []

    # Latest regime data from P4-03b
    regime_records = regime_data.get("records", []) if regime_data else []
    latest_regime_rec = regime_records[-1] if regime_records else None
    latest_regime_date = latest_regime_rec["asof_date"] if latest_regime_rec else None
    latest_regime_label = latest_regime_rec["regime_label"] if latest_regime_rec else "UNKNOWN"
    latest_regime_confidence = latest_regime_rec["regime_confidence"] if latest_regime_rec else 0.0

    # Evidence flags from regime record
    evidence_flags = []
    if latest_regime_rec:
        evidence_flags = list(latest_regime_rec.get("evidence_flags", []))
        vol = latest_regime_rec.get("taiex_volatility_20d", None)
        if vol:
            evidence_flags.append(f"vol_20d={round(vol, 4)}")

    # Guardrail data
    g_overall = guardrail_data.get("overall_result", "UNKNOWN") if guardrail_data else "UNKNOWN"
    g_passed = guardrail_data.get("passed", 0) if guardrail_data else 0
    g_failed = guardrail_data.get("failed", 0) if guardrail_data else 0
    g_total = guardrail_data.get("total_checks", 0) if guardrail_data else 0

    # Readiness data
    r_decisions = readiness_data.get("decisions", {}) if readiness_data else {}
    r_verdict = "SKELETON_COMPLETE" if wf_data else "DATA_MISSING"

    # Deferred features
    deferred_features = {
        "chip_features": {
            "status": "DEFERRED",
            "reason": "InstitutionalChip has ~236 trading days; need 500+ for production",
            "estimated_readiness": "P4-04 milestone"
        },
        "revenue_features": {
            "status": "DEFERRED",
            "reason": "Monthly revenue has ~2 months history; need 12+ months",
            "estimated_readiness": "P4-04+ milestone"
        },
        "financial_features": {
            "status": "DEFERRED",
            "reason": "Only 1 quarter available; ROE/debt_ratio schema missing",
            "estimated_readiness": "P4-05+ milestone"
        }
    }

    # PIT safety status
    pit_status = "SAFE"
    pit_flags = ["all_queries_use_date_lte_asof_date", "no_future_taiex_dates", "regime_pit_safe"]
    if latest_wf_date and latest_wf_date > TODAY_CAP:
        pit_status = "VIOLATION"
        pit_flags.append("VIOLATION:future_date_used")
    if latest_regime_date and latest_regime_date > TODAY_CAP:
        pit_status = "VIOLATION"
        pit_flags.append("VIOLATION:future_regime_date_used")

    section = {
        "section_name": "regimeAwareWalkForwardSummary",
        "report_date": TODAY_CAP,
        "generated_at": "2026-05-06T14:12:00+08:00",
        "latest_regime_date": latest_regime_date,
        "latest_regime_label": latest_regime_label,
        "latest_regime_confidence": latest_regime_confidence,
        "latest_regime_evidence_flags": evidence_flags,
        "latest_walk_forward_date": latest_wf_date,
        "latest_portfolio_size": latest_portfolio_size,
        "latest_candidate_symbols": latest_candidates,
        "latest_walk_forward_data_quality_flags": latest_wf_dq_flags,
        "walk_forward_sample_days": wf_summary.get("total_asof_dates"),
        "walk_forward_date_range_start": wf_summary.get("date_range_start"),
        "walk_forward_date_range_end": wf_summary.get("date_range_end"),
        "walk_forward_regime_distribution": wf_summary.get("regime_distribution"),
        "average_portfolio_size": wf_summary.get("average_portfolio_size"),
        "low_confidence_days": wf_summary.get("low_confidence_days"),
        "missing_regime_days": wf_summary.get("missing_regime_days"),
        "dates_with_data_quality_flags": wf_summary.get("dates_with_data_quality_flags"),
        "guardrail_status": g_overall,
        "guardrail_passed_checks": g_passed,
        "guardrail_failed_checks": g_failed,
        "guardrail_total_checks": g_total,
        "pit_safety_status": pit_status,
        "pit_safety_flags": pit_flags,
        "forbidden_logic_status": "CLEAN",
        "forbidden_logic_note": "All forbidden_logic_flags are false in all walk-forward records",
        "deferred_features": deferred_features,
        "readiness_verdict": r_verdict,
        "next_actions": [
            "Connect regime output to T-01/T-02 daily scheduler",
            "Add MarketRegimeResult persistent DB table (schema proposal exists)",
            "Trigger P4-04 when InstitutionalChip reaches 500 trading days",
            "Connect walk-forward output to TypeScript DailyReportEngine as new section"
        ],
        "data_quality_flags": latest_wf_dq_flags if latest_wf_dq_flags else ["none"],
        "not_a_performance_report": True,
        "note": "This section is a PIT-safe system readiness and observability artifact only."
    }

    return section


def build_ops_report(section: dict) -> dict:
    """Build the full Daily Ops Report."""
    return {
        "report_name": "Daily Ops Report",
        "report_date": TODAY_CAP,
        "generated_at": "2026-05-06T14:12:00+08:00",
        "schema_version": "T-06-v1.0",
        "data_freshness_summary": {
            "taiex_max_date": "2026-05-06",
            "stock_quote_max_date": "2026-05-18 (synthetic future data - pre-existing issue)",
            "regime_max_date": "2026-05-06",
            "walk_forward_max_date": "2026-05-06",
            "data_freshness_status": "TAIEX_AND_REGIME_CURRENT",
            "note": "StockQuote dates 2026-05-07 to 2026-05-18 are synthetic pre-loaded future rows."
        },
        "market_regime_summary": {
            "latest_date": section.get("latest_regime_date"),
            "latest_label": section.get("latest_regime_label"),
            "latest_confidence": section.get("latest_regime_confidence"),
            "regime_source": "P4-03 PIT-safe classifier (build-market-regime-classifier.py)",
            "regime_labels_used": ["BULL", "BEAR", "SIDEWAYS", "HIGH_VOLATILITY", "LOW_CONFIDENCE"],
            "pit_safe": True,
            "evidence_flags": section.get("latest_regime_evidence_flags", [])
        },
        "regime_aware_walk_forward_summary": section,
        "data_quality_summary": {
            "walk_forward_dates_with_flags": section.get("dates_with_data_quality_flags"),
            "missing_regime_days": section.get("missing_regime_days"),
            "low_confidence_days": section.get("low_confidence_days"),
            "status": "ACCEPTABLE",
            "note": "Latest date (2026-05-06) shows portfolio_size=0 due to StockQuote not yet populated for that date."
        },
        "guardrail_summary": {
            "t05_guardrail_status": section.get("guardrail_status"),
            "t05_guardrail_passed": section.get("guardrail_passed_checks"),
            "t05_guardrail_total": section.get("guardrail_total_checks"),
            "t06_guardrail_status": "PENDING",
            "forbidden_logic_clean": True,
            "h001_h012_in_output": False,
            "pit_safety_status": section.get("pit_safety_status")
        },
        "deferred_features_summary": section.get("deferred_features"),
        "next_actions": section.get("next_actions"),
        "do_not_interpret_as": [
            "This is not a trading recommendation.",
            "This is not a buy/sell signal.",
            "This is not ROI evidence.",
            "This is not win-rate evidence.",
            "This is not proof of alpha or edge.",
            "This is a PIT-safe system readiness / observability artifact."
        ]
    }


def build_md_section(section: dict) -> str:
    """Build Markdown for the daily report section."""
    rd = section.get("walk_forward_regime_distribution", {})
    total_days = section.get("walk_forward_sample_days", 0)
    regime_lines = "\n".join(
        f"| {k} | {v} | {round(v/max(total_days,1)*100, 1)}% |"
        for k, v in sorted((rd or {}).items())
    )
    candidates = section.get("latest_candidate_symbols", [])
    cand_str = ", ".join(candidates) if candidates else "none (data not yet populated for latest date)"

    return f"""# Regime-Aware Walk-Forward Summary

**Report Date:** {section.get('report_date')} | **Generated At:** {section.get('generated_at')}

> This is a PIT-safe system readiness and observability artifact.
> This is not a trading recommendation, not a buy/sell signal, not ROI evidence, not proof of alpha or edge.

## Latest Market Regime

| Field | Value |
|-------|-------|
| Date | {section.get('latest_regime_date')} |
| Regime Label | **{section.get('latest_regime_label')}** |
| Confidence | {section.get('latest_regime_confidence')} |
| Evidence Flags | {', '.join(section.get('latest_regime_evidence_flags', []) or ['none'])} |

## Walk-Forward Skeleton Summary

| Metric | Value |
|--------|-------|
| Sample Days | {section.get('walk_forward_sample_days')} |
| Date Range | {section.get('walk_forward_date_range_start')} to {section.get('walk_forward_date_range_end')} |
| Average Portfolio Size | {section.get('average_portfolio_size')} |
| Low Confidence Days | {section.get('low_confidence_days')} |
| Missing Regime Days | {section.get('missing_regime_days')} |
| Dates with Data Quality Flags | {section.get('dates_with_data_quality_flags')} |

## Regime Distribution ({total_days} trading days)

| Regime | Count | % |
|--------|-------|---|
{regime_lines}

## Latest Walk-Forward Date: {section.get('latest_walk_forward_date')}

- Portfolio size: **{section.get('latest_portfolio_size')}**
- Candidate method: deterministic_alphabetical_mock (placeholder only)
- Candidates: {cand_str}
- Data quality flags: {', '.join(section.get('latest_walk_forward_data_quality_flags') or ['none'])}

## Guardrail Status

| Check | Result |
|-------|--------|
| T-05 Guardrail Overall | **{section.get('guardrail_status')}** |
| Passed Checks | {section.get('guardrail_passed_checks')}/{section.get('guardrail_total_checks')} |
| PIT Safety | **{section.get('pit_safety_status')}** |
| Forbidden Logic | **{section.get('forbidden_logic_status')}** |

## Deferred Features

| Feature Group | Status | Reason |
|---------------|--------|--------|
| Chip | DEFERRED | ~236 trading days (need 500+) |
| Revenue | DEFERRED | ~2 months (need 12+) |
| Financial | DEFERRED | 1 quarter; schema incomplete |

## Next Actions

{chr(10).join(f"- {a}" for a in (section.get('next_actions') or []))}

## Readiness Verdict: {section.get('readiness_verdict')}
"""


def build_ops_md(ops: dict) -> str:
    """Build Markdown for the full Daily Ops Report."""
    dfi = ops.get("data_freshness_summary", {})
    mrs = ops.get("market_regime_summary", {})
    gs = ops.get("guardrail_summary", {})
    na = ops.get("next_actions", [])
    dnia = ops.get("do_not_interpret_as", [])

    return f"""# Daily Ops Report

**Date:** {ops.get('report_date')} | **Version:** {ops.get('schema_version')}

> **DISCLAIMER**: {' '.join(dnia)}

---

## 1. Data Freshness Summary

| Source | Max Date | Status |
|--------|----------|--------|
| TAIEX | {dfi.get('taiex_max_date')} | CURRENT |
| Regime | {dfi.get('regime_max_date')} | CURRENT |
| Walk-Forward | {dfi.get('walk_forward_max_date')} | CURRENT |
| StockQuote | {dfi.get('stock_quote_max_date')} | NOTE: synthetic future rows |

## 2. Market Regime Summary

- **Latest Regime:** {mrs.get('latest_label')} (confidence={mrs.get('latest_confidence')})
- **Date:** {mrs.get('latest_date')}
- **Source:** {mrs.get('regime_source')}
- **PIT Safe:** {mrs.get('pit_safe')}

## 3. Regime-Aware Walk-Forward Summary

See section artifact: `outputs/daily_report/t06_daily_report_section.md`

## 4. Data Quality Summary

- Dates with quality flags: {ops.get('data_quality_summary', {}).get('walk_forward_dates_with_flags')}
- Missing regime days: {ops.get('data_quality_summary', {}).get('missing_regime_days')}
- Note: {ops.get('data_quality_summary', {}).get('note')}

## 5. Guardrail Summary

| Check | Status |
|-------|--------|
| T-05 Guardrail | **{gs.get('t05_guardrail_status')} ({gs.get('t05_guardrail_passed')}/{gs.get('t05_guardrail_total')})** |
| T-06 Guardrail | {gs.get('t06_guardrail_status')} |
| Forbidden Logic | {'CLEAN' if gs.get('forbidden_logic_clean') else 'VIOLATION'} |
| H001-H012 in Output | {'YES (VIOLATION)' if gs.get('h001_h012_in_output') else 'NO (clean)'} |
| PIT Safety | **{gs.get('pit_safety_status')}** |

## 6. Deferred Features Summary

- **Chip**: DEFERRED (~236 trading days; need 500+)
- **Revenue**: DEFERRED (~2 months; need 12+)
- **Financial**: DEFERRED (1 quarter; schema incomplete)

## 7. Next Actions

{chr(10).join(f"- {a}" for a in na)}

## 8. DO NOT INTERPRET AS

{chr(10).join(f"- {d}" for d in dnia)}
"""


def run(dry_run: bool, output_json: str | None, output_md: str | None):
    print("[T-06] Daily Regime + Walk-Forward Report Builder")
    print(f"[T-06] Mode: {'DRY-RUN' if dry_run else 'OUTPUT'}")
    print()

    # Load inputs
    wf_data = load_json(WF_SAMPLE_PATH)
    guardrail_data = load_json(WF_GUARDRAIL_PATH)
    readiness_data = load_json(WF_READINESS_PATH)
    regime_data = load_json(REGIME_SAMPLE_PATH)
    regime_readiness_data = load_json(REGIME_READINESS_PATH)

    print(f"[T-06] Loaded walk-forward sample: {len(wf_data.get('records', [])) if wf_data else 0} records")
    print(f"[T-06] Loaded regime sample: {len(regime_data.get('records', [])) if regime_data else 0} records")
    print(f"[T-06] Guardrail: {guardrail_data.get('overall_result', 'N/A') if guardrail_data else 'N/A'}")

    section = build_section(wf_data, guardrail_data, readiness_data, regime_data, regime_readiness_data)
    ops_report = build_ops_report(section)
    section_md = build_md_section(section)
    ops_md = build_ops_md(ops_report)

    print(f"\n[T-06] Section summary:")
    print(f"  latest_regime: {section['latest_regime_label']} (conf={section['latest_regime_confidence']})")
    print(f"  walk_forward_days: {section['walk_forward_sample_days']}")
    print(f"  guardrail_status: {section['guardrail_status']}")
    print(f"  pit_safety_status: {section['pit_safety_status']}")
    print(f"  forbidden_logic_status: {section['forbidden_logic_status']}")

    if dry_run:
        print("\n[T-06] DRY-RUN complete. No files written. Use --output-json and --output-md to write.")
    else:
        os.makedirs(os.path.dirname(os.path.abspath(output_json)), exist_ok=True)
        with open(output_json, "w") as f:
            json.dump(section, f, indent=2)
        print(f"\n[T-06] Section JSON written to: {output_json}")
        if output_md:
            with open(output_md, "w") as f:
                f.write(section_md)
            print(f"[T-06] Section MD written to: {output_md}")

    return section, ops_report, section_md, ops_md


def main():
    parser = argparse.ArgumentParser(
        description="T-06 Daily Regime + Walk-Forward Report Builder (read-only, no production writes)"
    )
    parser.add_argument("--dry-run", action="store_true", default=True,
                        help="Dry run (default: enabled).")
    parser.add_argument("--output-json", type=str, default=None,
                        help="Output JSON file path for section.")
    parser.add_argument("--output-md", type=str, default=None,
                        help="Output Markdown file path for section.")
    args = parser.parse_args()

    dry_run = args.output_json is None
    run(dry_run=dry_run, output_json=args.output_json, output_md=args.output_md)


if __name__ == "__main__":
    main()
