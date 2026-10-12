"""
P3-09: Failed Hypothesis Diagnostics & Signal Attribution
Analyzes H001–H008 validation results to explain failure modes,
produce symbol-level & feature-level diagnostics, and generate
improvement recommendations — without creating new hypotheses or
writing to production systems.
"""

from __future__ import annotations

import json
import os
import sys
from collections import defaultdict
from datetime import datetime
from pathlib import Path
from typing import Any

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
REPO_ROOT = Path(__file__).resolve().parent.parent
BATCH_DIR = REPO_ROOT / "outputs" / "stock_validation_real_batch"
REGISTRY_V1 = REPO_ROOT / "research" / "stock_hypothesis_registry.json"
REGISTRY_V2 = REPO_ROOT / "research" / "stock_hypothesis_registry_v2.json"
OUT_DIR = REPO_ROOT / "outputs" / "stock_diagnostics"

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
VALID_FAILURE_REASONS = frozenset([
    "LOW_SIGNAL_COUNT",
    "SIGNAL_TOO_NOISY",
    "NEGATIVE_ROI",
    "UNSTABLE_ACROSS_SYMBOLS",
    "PERMUTATION_FAIL",
    "BH_FDR_FAIL",
    "DATA_INSUFFICIENT",
    "MIXED_WEAK_SIGNAL",
])

# Feature metadata for v2 diagnositcs
V2_FEATURE_RULES = {
    "volume_zscore_20d": {
        "hypothesis": "STOCK_H004_MOM_VOL_CONFIRM",
        "condition": "volume_zscore_20d > 1.0",
        "description": "Volume z-score > 1.0 filter (1-sigma above mean volume)",
        "potential_issue": "Only ~16% of days exceed +1σ in normal distribution; ETFs with stable volume may rarely trigger",
    },
    "breakout_20d_high": {
        "hypothesis": "STOCK_H006_LOW_VOL_BREAKOUT",
        "condition": "close > max(high[-20:]) AND volatility_20d <= p25(volatility_20d)",
        "description": "Simultaneous low-vol AND 20d breakout — dual filter",
        "potential_issue": "Low-vol periods rarely coincide with fresh 20d highs; Taiwan ETFs have smooth price curves",
    },
    "universe_relative_strength": {
        "hypothesis": "STOCK_H007_RELATIVE_STRENGTH",
        "condition": "return_20d > universe_median_return_20d",
        "description": "Requires multi-symbol universe data on same date",
        "potential_issue": "Single-symbol validation cannot compute universe median → DATA_INSUFFICIENT for all windows",
    },
    "pullback_rule": {
        "hypothesis": "STOCK_H005_PULLBACK_UPTREND",
        "condition": "close > ma60 AND return_5d < 0 AND return_20d > 0",
        "description": "Triple-condition pullback filter",
        "potential_issue": "Three simultaneous conditions may over-filter; ETFs often lack clear 60d trend + pullback combo",
    },
    "etf_defensive_momentum": {
        "hypothesis": "STOCK_H008_ETF_DEF_MOMENTUM",
        "condition": "is_etf AND return_20d > 0 AND drawdown_20d > -0.05",
        "description": "ETF-only with drawdown constraint",
        "potential_issue": "Non-ETF symbols return 0 signals; 5% drawdown threshold may exclude many valid ETF periods",
    },
}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _load_json(path: Path) -> Any:
    with open(path) as f:
        return json.load(f)


def _write_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


def _latest_batch_date(batch_dir: Path) -> str | None:
    dates = sorted(
        d.name for d in batch_dir.iterdir() if d.is_dir() and d.name.isdigit()
    )
    return dates[-1] if dates else None


def _collect_gate_results(batch_root: Path) -> list[dict]:
    """Walk batch_root and collect all gate_result.json entries."""
    results = []
    for symbol_dir in sorted(batch_root.iterdir()):
        if not symbol_dir.is_dir():
            continue
        symbol = symbol_dir.name
        for hyp_dir in sorted(symbol_dir.iterdir()):
            if not hyp_dir.is_dir():
                continue
            gate_file = hyp_dir / "gate_result.json"
            if gate_file.exists():
                gate = _load_json(gate_file)
                gate["_symbol"] = symbol
                gate["_hyp_dir"] = hyp_dir.name
                results.append(gate)
    return results


def _classify_failure_reason(
    total_signals: int,
    avg_roi: float,
    avg_sharpe: float,
    permutation_pass_count: int,
    bh_fdr_pass_count: int,
    data_insufficient_count: int,
    total_windows: int,
    roi_std: float,
) -> str:
    """Assign a single primary failure reason."""
    valid_windows = total_windows - data_insufficient_count
    if data_insufficient_count > 0 and valid_windows == 0:
        return "DATA_INSUFFICIENT"
    if data_insufficient_count > 0 and data_insufficient_count >= total_windows // 2:
        return "DATA_INSUFFICIENT"
    if total_signals < 10:
        return "LOW_SIGNAL_COUNT"
    if avg_roi < -0.10:
        return "NEGATIVE_ROI"
    # noisy: high std relative to mean absolute roi
    if roi_std > 0 and abs(avg_roi) < roi_std * 0.5:
        if permutation_pass_count == 0 and bh_fdr_pass_count == 0:
            return "SIGNAL_TOO_NOISY"
    if bh_fdr_pass_count == 0 and permutation_pass_count == 0:
        if roi_std > 0.3:
            return "UNSTABLE_ACROSS_SYMBOLS"
        if avg_roi >= 0:
            return "MIXED_WEAK_SIGNAL"
        return "PERMUTATION_FAIL"
    if bh_fdr_pass_count == 0:
        return "BH_FDR_FAIL"
    return "PERMUTATION_FAIL"


# ---------------------------------------------------------------------------
# 1. Hypothesis-level diagnostics
# ---------------------------------------------------------------------------
def build_hypothesis_diagnostics(
    gate_results: list[dict],
    all_hyp_ids: list[str],
) -> list[dict]:
    hyp_data: dict[str, dict] = defaultdict(lambda: {
        "total_signals": 0,
        "roi_values": [],
        "sharpe_values": [],
        "permutation_pass_count": 0,
        "bh_fdr_pass_count": 0,
        "data_insufficient_count": 0,
        "symbols_seen": set(),
        "windows_tested": 0,
        "best_symbol": None,
        "best_symbol_roi": -999,
        "worst_symbol": None,
        "worst_symbol_roi": 999,
        "best_window": None,
        "best_window_roi": -999,
        "worst_window": None,
        "worst_window_roi": 999,
    })

    for gate in gate_results:
        hyp_id = gate.get("hypothesis_id", "").upper()
        sym = gate.get("_symbol", "?")
        for wr in gate.get("window_results", []):
            hyp_data[hyp_id]["symbols_seen"].add(sym)
            hyp_data[hyp_id]["windows_tested"] += 1
            if wr.get("status") == "DATA_INSUFFICIENT":
                hyp_data[hyp_id]["data_insufficient_count"] += 1
                continue
            n_sig = wr.get("n_signals", 0)
            roi = wr.get("roi_annualized", 0.0)
            sharpe = wr.get("sharpe_annualized", 0.0)
            perm_p = wr.get("raw_p_value", 1.0)
            bh_pass = wr.get("bh_fdr_pass", False)
            win = wr.get("window_days", 0)

            hyp_data[hyp_id]["total_signals"] += n_sig
            hyp_data[hyp_id]["roi_values"].append(roi)
            hyp_data[hyp_id]["sharpe_values"].append(sharpe)
            if perm_p < 0.05:
                hyp_data[hyp_id]["permutation_pass_count"] += 1
            if bh_pass:
                hyp_data[hyp_id]["bh_fdr_pass_count"] += 1

            # Track best/worst symbol
            if roi > hyp_data[hyp_id]["best_symbol_roi"]:
                hyp_data[hyp_id]["best_symbol_roi"] = roi
                hyp_data[hyp_id]["best_symbol"] = sym
            if roi < hyp_data[hyp_id]["worst_symbol_roi"]:
                hyp_data[hyp_id]["worst_symbol_roi"] = roi
                hyp_data[hyp_id]["worst_symbol"] = sym

            # Track best/worst window
            if roi > hyp_data[hyp_id]["best_window_roi"]:
                hyp_data[hyp_id]["best_window_roi"] = roi
                hyp_data[hyp_id]["best_window"] = win
            if roi < hyp_data[hyp_id]["worst_window_roi"]:
                hyp_data[hyp_id]["worst_window_roi"] = roi
                hyp_data[hyp_id]["worst_window"] = win

    diagnostics = []
    for hyp_id in all_hyp_ids:
        h = hyp_data.get(hyp_id, {})
        roi_vals = h.get("roi_values", [])
        sharpe_vals = h.get("sharpe_values", [])
        n_sym = len(h.get("symbols_seen", set()))
        avg_roi = sum(roi_vals) / len(roi_vals) if roi_vals else 0.0
        avg_sharpe = sum(sharpe_vals) / len(sharpe_vals) if sharpe_vals else 0.0
        roi_std = (
            (sum((r - avg_roi) ** 2 for r in roi_vals) / len(roi_vals)) ** 0.5
            if len(roi_vals) > 1
            else 0.0
        )
        total_sig = h.get("total_signals", 0)
        avg_sig_per_sym = total_sig / n_sym if n_sym > 0 else 0.0

        # signal_coverage_rate: fraction of OK windows with ≥1 signal
        total_win = h.get("windows_tested", 0)
        di_count = h.get("data_insufficient_count", 0)
        ok_win = total_win - di_count
        sig_coverage = avg_sig_per_sym / 500.0  # normalised against 500d window

        failure_reason = _classify_failure_reason(
            total_signals=total_sig,
            avg_roi=avg_roi,
            avg_sharpe=avg_sharpe,
            permutation_pass_count=h.get("permutation_pass_count", 0),
            bh_fdr_pass_count=h.get("bh_fdr_pass_count", 0),
            data_insufficient_count=di_count,
            total_windows=total_win,
            roi_std=roi_std,
        )

        diagnostics.append({
            "hypothesis_id": hyp_id,
            "total_signals": total_sig,
            "avg_signals_per_symbol": round(avg_sig_per_sym, 1),
            "signal_coverage_rate": round(min(sig_coverage, 1.0), 4),
            "avg_roi": round(avg_roi, 4),
            "avg_sharpe": round(avg_sharpe, 4),
            "roi_std": round(roi_std, 4),
            "best_symbol": h.get("best_symbol"),
            "worst_symbol": h.get("worst_symbol"),
            "best_window": h.get("best_window"),
            "worst_window": h.get("worst_window"),
            "permutation_pass_count": h.get("permutation_pass_count", 0),
            "bh_fdr_pass_count": h.get("bh_fdr_pass_count", 0),
            "data_insufficient_count": di_count,
            "total_windows_tested": total_win,
            "ok_windows": ok_win,
            "symbols_evaluated": sorted(h.get("symbols_seen", set())),
            "failure_reason": failure_reason,
        })

    return diagnostics


# ---------------------------------------------------------------------------
# 2. Symbol-level diagnostics
# ---------------------------------------------------------------------------
def build_symbol_diagnostics(gate_results: list[dict]) -> list[dict]:
    sym_data: dict[str, dict] = defaultdict(lambda: {
        "roi_values": [],
        "sharpe_values": [],
        "signal_count": 0,
        "hyp_roi": {},
        "data_insufficient_count": 0,
    })

    for gate in gate_results:
        hyp_id = gate.get("hypothesis_id", "")
        sym = gate.get("_symbol", "?")
        for wr in gate.get("window_results", []):
            sym_data[sym]["data_insufficient_count"] += (
                1 if wr.get("status") == "DATA_INSUFFICIENT" else 0
            )
            if wr.get("status") != "OK":
                continue
            roi = wr.get("roi_annualized", 0.0)
            sharpe = wr.get("sharpe_annualized", 0.0)
            n_sig = wr.get("n_signals", 0)
            sym_data[sym]["roi_values"].append(roi)
            sym_data[sym]["sharpe_values"].append(sharpe)
            sym_data[sym]["signal_count"] += n_sig
            if hyp_id not in sym_data[sym]["hyp_roi"]:
                sym_data[sym]["hyp_roi"][hyp_id] = []
            sym_data[sym]["hyp_roi"][hyp_id].append(roi)

    result = []
    for sym, d in sorted(sym_data.items()):
        roi_vals = d["roi_values"]
        sharpe_vals = d["sharpe_values"]
        avg_roi = sum(roi_vals) / len(roi_vals) if roi_vals else 0.0
        avg_sharpe = sum(sharpe_vals) / len(sharpe_vals) if sharpe_vals else 0.0

        # Best/worst hypothesis for this symbol
        hyp_avgs = {
            h: sum(v) / len(v) for h, v in d["hyp_roi"].items() if v
        }
        best_hyp = max(hyp_avgs, key=hyp_avgs.get) if hyp_avgs else None
        worst_hyp = min(hyp_avgs, key=hyp_avgs.get) if hyp_avgs else None
        best_hyp_roi = hyp_avgs.get(best_hyp, 0.0) if best_hyp else 0.0
        worst_hyp_roi = hyp_avgs.get(worst_hyp, 0.0) if worst_hyp else 0.0

        # Suitability: symbol unsuitable if avg_roi < -0.2 or only DI results
        unsuitable = avg_roi < -0.20 or (not roi_vals and d["data_insufficient_count"] > 0)

        result.append({
            "symbol": sym,
            "symbol_avg_roi": round(avg_roi, 4),
            "symbol_avg_sharpe": round(avg_sharpe, 4),
            "symbol_signal_count": d["signal_count"],
            "best_hypothesis": best_hyp,
            "best_hypothesis_avg_roi": round(best_hyp_roi, 4),
            "worst_hypothesis": worst_hyp,
            "worst_hypothesis_avg_roi": round(worst_hyp_roi, 4),
            "data_insufficient_count": d["data_insufficient_count"],
            "is_unsuitable_for_current_hypotheses": unsuitable,
            "hypothesis_roi_breakdown": {
                h: round(v, 4) for h, v in sorted(hyp_avgs.items())
            },
        })

    return result


# ---------------------------------------------------------------------------
# 3. Feature-level diagnostics
# ---------------------------------------------------------------------------
def build_feature_diagnostics(gate_results: list[dict]) -> list[dict]:
    # Collect per-hypothesis signal stats for feature analysis
    hyp_signals: dict[str, list[int]] = defaultdict(list)
    hyp_di: dict[str, int] = defaultdict(int)
    hyp_ok: dict[str, int] = defaultdict(int)

    for gate in gate_results:
        hyp_id = gate.get("hypothesis_id", "")
        for wr in gate.get("window_results", []):
            if wr.get("status") == "DATA_INSUFFICIENT":
                hyp_di[hyp_id] += 1
            elif wr.get("status") == "OK":
                hyp_ok[hyp_id] += 1
                hyp_signals[hyp_id].append(wr.get("n_signals", 0))

    feature_diagnostics = []
    for feat_key, meta in V2_FEATURE_RULES.items():
        hyp = meta["hypothesis"]
        sigs = hyp_signals.get(hyp, [])
        di = hyp_di.get(hyp, 0)
        ok = hyp_ok.get(hyp, 0)

        avg_sig = sum(sigs) / len(sigs) if sigs else 0
        max_sig = max(sigs) if sigs else 0
        min_sig = min(sigs) if sigs else 0

        # Trigger rate: signals / (window_days * n_windows_ok)
        # Approximate: for 500d window, expect ~500 possible entry days
        trigger_rate = avg_sig / 500.0 if ok > 0 else 0.0

        # Diagnosis
        issues = []
        if di > 0 and ok == 0:
            issues.append("ALL_WINDOWS_DATA_INSUFFICIENT")
        if avg_sig < 5 and ok > 0:
            issues.append("VERY_LOW_TRIGGER_COUNT")
        if avg_sig < 20 and ok > 0:
            issues.append("LOW_TRIGGER_RATE")
        if trigger_rate < 0.05 and ok > 0:
            issues.append("STRICT_FILTER_OVER_PRUNING")
        if "universe" in feat_key and di > 0:
            issues.append("REQUIRES_MULTI_SYMBOL_UNIVERSE")
        if not issues:
            issues.append("ADEQUATE_TRIGGERS_BUT_NO_EDGE")

        feature_diagnostics.append({
            "feature_key": feat_key,
            "related_hypothesis": hyp,
            "condition": meta["condition"],
            "description": meta["description"],
            "potential_issue": meta["potential_issue"],
            "avg_signals_per_window": round(avg_sig, 1),
            "max_signals": max_sig,
            "min_signals": min_sig,
            "trigger_rate_500d": round(trigger_rate, 4),
            "ok_windows": ok,
            "data_insufficient_windows": di,
            "diagnosed_issues": issues,
        })

    return feature_diagnostics


# ---------------------------------------------------------------------------
# 4. Improvement recommendations
# ---------------------------------------------------------------------------
def build_recommendations(
    hyp_diags: list[dict],
    sym_diags: list[dict],
    feat_diags: list[dict],
) -> str:
    lines = [
        "# Hypothesis Improvement Recommendations",
        "",
        f"> Generated: {datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ')}",
        "> ⚠️  This document contains RECOMMENDATIONS ONLY.",
        "> No hypotheses are created, modified, or retired in code.",
        "> All registry files remain unchanged.",
        "",
        "---",
        "",
        "## 1. Hypothesis Status Assessment",
        "",
    ]

    # Group by recommendation category
    keep, refine, retire = [], [], []
    for h in hyp_diags:
        hid = h["hypothesis_id"]
        reason = h["failure_reason"]
        avg_roi = h["avg_roi"]
        bh = h["bh_fdr_pass_count"]
        if reason == "DATA_INSUFFICIENT":
            refine.append((hid, reason, "Needs multi-symbol universe or broader dataset"))
        elif reason in ("NEGATIVE_ROI",) and avg_roi < -0.30:
            retire.append((hid, reason, "Consistently negative ROI across symbols"))
        elif reason in ("LOW_SIGNAL_COUNT", "STRICT_FILTER_OVER_PRUNING"):
            refine.append((hid, reason, "Entry conditions too strict; loosen thresholds"))
        elif reason == "SIGNAL_TOO_NOISY":
            refine.append((hid, reason, "Add confirming filter or extend holding period"))
        elif reason in ("MIXED_WEAK_SIGNAL", "PERMUTATION_FAIL", "BH_FDR_FAIL"):
            keep.append((hid, reason, "Weak but non-negative ROI; worth refining"))
        else:
            refine.append((hid, reason, "Review entry rule constraints"))

    lines += ["### Hypotheses to Keep (non-negative ROI, refine-eligible)", ""]
    if keep:
        for hid, reason, note in keep:
            lines.append(f"- **{hid}** — `{reason}` → {note}")
    else:
        lines.append("- None meet keep threshold yet")

    lines += ["", "### Hypotheses to Refine", ""]
    for hid, reason, note in refine:
        lines.append(f"- **{hid}** — `{reason}` → {note}")

    lines += ["", "### Hypotheses to Consider Retiring", ""]
    if retire:
        for hid, reason, note in retire:
            lines.append(f"- **{hid}** — `{reason}` → {note}")
    else:
        lines.append("- None (all have refinement potential)")

    lines += [
        "",
        "---",
        "",
        "## 2. Feature Condition Analysis",
        "",
    ]
    for fd in feat_diags:
        lines += [
            f"### {fd['feature_key']}",
            f"- **Hypothesis**: {fd['related_hypothesis']}",
            f"- **Condition**: `{fd['condition']}`",
            f"- **Avg signals / window**: {fd['avg_signals_per_window']}",
            f"- **Trigger rate (500d)**: {fd['trigger_rate_500d']:.1%}",
            f"- **Issues**: {', '.join(fd['diagnosed_issues'])}",
            f"- **Potential fix**: {fd['potential_issue']}",
            "",
        ]

    lines += [
        "---",
        "",
        "## 3. Symbol-Level Insights",
        "",
    ]
    suitable = [s for s in sym_diags if not s["is_unsuitable_for_current_hypotheses"]]
    unsuitable = [s for s in sym_diags if s["is_unsuitable_for_current_hypotheses"]]

    lines.append(f"**Suitable symbols** ({len(suitable)}): "
                 + ", ".join(s["symbol"] for s in suitable))
    lines.append(f"**Unsuitable symbols** ({len(unsuitable)}): "
                 + (", ".join(s["symbol"] for s in unsuitable) if unsuitable else "None"))
    lines.append("")

    lines += [
        "---",
        "",
        "## 4. Recommended Next Directions",
        "",
        "1. **Expand symbol universe** — H007 (relative strength) requires ≥5 symbols "
        "on the same date to compute universe median reliably.",
        "2. **Loosen H006 breakout threshold** — try `close > 0.98 × max(high[-20:])` "
        "to capture near-breakouts and increase signal count.",
        "3. **Reduce H004 volume z-score threshold** from >1.0 to >0.5 "
        "to increase trigger frequency on ETFs.",
        "4. **Extend forward window** from 5d to 10d for H005 pullback hypothesis "
        "to allow more time for mean-reversion to manifest.",
        "5. **Add sector/ETF type classification** — H008 fires on all ETFs equally; "
        "defensive (bond/dividend) vs equity ETFs may behave differently.",
        "6. **Collect longer history** — 5 symbols × 500d = 2500 obs may be insufficient "
        "for BH-FDR correction across 8 hypotheses × 2 windows = 80 tests.",
        "",
        "---",
        "",
        "## 5. Prohibited Actions (confirmed)",
        "",
        "- ❌ No new hypotheses added",
        "- ❌ No registry files modified",
        "- ❌ No production system writes",
        "- ❌ No trade execution or live data writes",
        "",
    ]
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main() -> dict:
    # Find latest batch date
    latest = _latest_batch_date(BATCH_DIR)
    if not latest:
        raise FileNotFoundError(f"No batch output found under {BATCH_DIR}")

    batch_root = BATCH_DIR / latest
    print(f"[diagnostics] Using batch: {batch_root}")

    # Load registries
    reg_v1 = _load_json(REGISTRY_V1)
    reg_v2 = _load_json(REGISTRY_V2)

    all_hyp_ids = []
    for h in reg_v1["hypotheses"]:
        all_hyp_ids.append(h["hypothesis_id"].upper())
    for h in reg_v2["hypotheses"]:
        all_hyp_ids.append(h["hypothesis_id"].upper())

    # Collect all gate results
    gate_results = _collect_gate_results(batch_root)
    print(f"[diagnostics] Loaded {len(gate_results)} gate result(s)")

    # Build diagnostics
    hyp_diags = build_hypothesis_diagnostics(gate_results, all_hyp_ids)
    sym_diags = build_symbol_diagnostics(gate_results)
    feat_diags = build_feature_diagnostics(gate_results)
    rec_md = build_recommendations(hyp_diags, sym_diags, feat_diags)

    # Summarize
    failure_summary = {h["hypothesis_id"]: h["failure_reason"] for h in hyp_diags}

    # Main diagnostics JSON
    diag_json = {
        "generated_at": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
        "batch_date": latest,
        "hypotheses_analyzed": len(hyp_diags),
        "symbols_analyzed": len(sym_diags),
        "failure_summary": failure_summary,
        "hypothesis_diagnostics": hyp_diags,
        "safety_confirmations": {
            "no_new_hypothesis": True,
            "no_registry_modification": True,
            "no_production_write": True,
            "no_trade_execution": True,
            "diagnostics_only": True,
        },
    }

    # Main diagnostics markdown
    diag_md_lines = [
        "# Hypothesis Failure Diagnostics",
        "",
        f"> Batch date: {latest}  |  Generated: {diag_json['generated_at']}",
        "",
        "| Hypothesis | Total Signals | Avg ROI | Avg Sharpe | Perm Pass | BH-FDR Pass | DI Count | Failure Reason |",
        "|---|---|---|---|---|---|---|---|",
    ]
    for h in hyp_diags:
        diag_md_lines.append(
            f"| {h['hypothesis_id']} "
            f"| {h['total_signals']} "
            f"| {h['avg_roi']:.3f} "
            f"| {h['avg_sharpe']:.3f} "
            f"| {h['permutation_pass_count']} "
            f"| {h['bh_fdr_pass_count']} "
            f"| {h['data_insufficient_count']} "
            f"| `{h['failure_reason']}` |"
        )
    diag_md_lines += ["", "---", ""]
    diag_md_lines += [
        "## Full Diagnostics",
        "",
        "See `hypothesis_failure_diagnostics.json` for complete per-hypothesis data.",
        "See `symbol_diagnostics.json` for symbol-level breakdown.",
        "See `feature_diagnostics.json` for feature-level analysis.",
        "See `hypothesis_improvement_recommendations.md` for recommendations.",
    ]

    # Write outputs
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    _write_json(OUT_DIR / "hypothesis_failure_diagnostics.json", diag_json)
    (OUT_DIR / "hypothesis_failure_diagnostics.md").write_text(
        "\n".join(diag_md_lines), encoding="utf-8"
    )
    _write_json(OUT_DIR / "symbol_diagnostics.json", {
        "generated_at": diag_json["generated_at"],
        "batch_date": latest,
        "symbol_diagnostics": sym_diags,
    })
    _write_json(OUT_DIR / "feature_diagnostics.json", {
        "generated_at": diag_json["generated_at"],
        "batch_date": latest,
        "feature_diagnostics": feat_diags,
    })
    (OUT_DIR / "hypothesis_improvement_recommendations.md").write_text(
        rec_md, encoding="utf-8"
    )

    print(f"[diagnostics] Outputs written to {OUT_DIR}")
    for fname in [
        "hypothesis_failure_diagnostics.json",
        "hypothesis_failure_diagnostics.md",
        "symbol_diagnostics.json",
        "feature_diagnostics.json",
        "hypothesis_improvement_recommendations.md",
    ]:
        print(f"  ✓ {fname}")

    return diag_json


if __name__ == "__main__":
    result = main()
    print("\n[diagnostics] Failure Summary:")
    for hid, reason in result["failure_summary"].items():
        print(f"  {hid}: {reason}")
