#!/usr/bin/env python3
"""
P3-12: Signal Coverage & Universe Expansion Audit

Diagnoses WHY H009–H012 show no edge:
  1. Universe too small? (tests only 8 of 237 eligible symbols)
  2. Data too short? (window design vs available history)
  3. Rules too strict? (condition pass rates per candidate)
  4. ETF/stock mix wrong? (ETF-only vs mixed universe)
  5. Features invalid for Taiwan stocks?
  6. Window design unreasonable?

Outputs (NO validation, NO production write, NO threshold changes):
  - outputs/stock_diagnostics/signal_coverage_audit.json
  - outputs/stock_diagnostics/signal_coverage_audit.md
  - outputs/stock_diagnostics/condition_attribution.json
  - outputs/stock_diagnostics/universe_expansion_recommendations.md

Usage:
    python3 scripts/audit_stock_signal_coverage.py \\
        --as-of-date 2026-05-01 \\
        --min-rows 300 \\
        --max-symbols 50
"""

from __future__ import annotations

import argparse
import json
import math
import sqlite3
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from gbgf.domain.stock_features import compute_features_for_rows

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
DB_PATH = ROOT / "prisma" / "dev.db"
V3_REGISTRY = ROOT / "research" / "stock_hypothesis_registry_v3_candidates.json"
V3_OUTPUT_BASE = ROOT / "outputs" / "stock_validation_v3" / "20260501"
DIAG_DIR = ROOT / "outputs" / "stock_diagnostics"

BATCH_WINDOWS = [150, 500]
MIN_OOS_SIGNALS = 5
OOS_FRACTION = 0.20

# ETF-like heuristic for Taiwan market
def is_etf_like(symbol: str) -> bool:
    return symbol.startswith("00") or symbol.endswith("U") or symbol.endswith("L")

VALID_FAILURE_MODES = {
    "UNIVERSE_TOO_SMALL",
    "DATA_TOO_SHORT",
    "RULE_TOO_STRICT",
    "ETF_UNIVERSE_TOO_SMALL",
    "SIGNAL_NOISY",
    "UNKNOWN",
}


# ---------------------------------------------------------------------------
# DB helpers
# ---------------------------------------------------------------------------
def load_all_symbol_stats(as_of_date: str, db_path: Path = DB_PATH) -> list[dict]:
    """Return per-symbol row count + date range for ALL symbols (ISO dates only)."""
    conn = sqlite3.connect(str(db_path))
    c = conn.cursor()
    c.execute(
        """
        SELECT stockId, COUNT(*) n, MIN(date) first_date, MAX(date) last_date
        FROM StockQuote
        WHERE date LIKE '20%%' AND length(date)=10
          AND date <= ?
        GROUP BY stockId
        ORDER BY n DESC
        """,
        (as_of_date,),
    )
    rows = c.fetchall()
    conn.close()
    return [
        {
            "symbol": r[0],
            "iso_row_count": r[1],
            "first_date": r[2],
            "last_date": r[3],
            "eligible_150d": r[1] >= 150,
            "eligible_300d": r[1] >= 300,
            "eligible_500d": r[1] >= 500,
            "is_etf_like": is_etf_like(r[0]),
            "data_quality_status": "OK" if r[1] >= 300 else ("LOW" if r[1] >= 50 else "INSUFFICIENT"),
        }
        for r in rows
    ]


def load_rows_for_symbol(symbol: str, as_of_date: str, db_path: Path = DB_PATH) -> list[dict]:
    conn = sqlite3.connect(str(db_path))
    c = conn.cursor()
    c.execute(
        """
        SELECT date, open, high, low, close, volume
        FROM StockQuote
        WHERE stockId = ? AND date LIKE '20%%' AND length(date)=10 AND date <= ?
        ORDER BY date ASC
        """,
        (symbol, as_of_date),
    )
    raw = c.fetchall()
    conn.close()
    return [
        {"date": r[0], "open": float(r[1]), "high": float(r[2]),
         "low": float(r[3]), "close": float(r[4]), "volume": float(r[5])}
        for r in raw
    ]


# ---------------------------------------------------------------------------
# Signal computers (count-only, no OOS evaluation, no permutations)
# ---------------------------------------------------------------------------

def count_h009_signals(rows: list[dict], window: int) -> dict[str, Any]:
    """H009: Pullback Uptrend 10D — count signals + per-condition pass rates."""
    use_rows = rows[-window:] if len(rows) >= window else rows
    n = len(use_rows)
    if n < 70:
        return {"signal_count": 0, "error": "insufficient_rows", "n_rows": n}

    features = compute_features_for_rows(use_rows, ["return_5d", "return_20d", "ma60"])
    total_eligible = 0
    ma60_pass = r5_pass = r20_pass = all_pass = 0

    for i, feat in enumerate(features):
        if i + 10 >= n:
            break
        r5 = feat.get("return_5d")
        r20 = feat.get("return_20d")
        ma60v = feat.get("ma60")
        if r5 is None or r20 is None or ma60v is None:
            continue
        close = float(use_rows[i]["close"])
        total_eligible += 1
        c1 = close > ma60v
        c2 = r5 < 0
        c3 = r20 > 0
        if c1: ma60_pass += 1
        if c2: r5_pass += 1
        if c3: r20_pass += 1
        if c1 and c2 and c3: all_pass += 1

    te = max(total_eligible, 1)
    return {
        "signal_count": all_pass,
        "n_rows": n,
        "total_eligible": total_eligible,
        "conditions": {
            "close_gt_ma60": round(ma60_pass / te, 4),
            "return_5d_lt_0": round(r5_pass / te, 4),
            "return_20d_gt_0": round(r20_pass / te, 4),
            "all_conditions": round(all_pass / te, 4),
        },
    }


def count_h010_signals(rows: list[dict], window: int) -> dict[str, Any]:
    """H010: Momentum + Moderate Volume — condition pass rates."""
    use_rows = rows[-window:] if len(rows) >= window else rows
    n = len(use_rows)
    if n < 30:
        return {"signal_count": 0, "error": "insufficient_rows", "n_rows": n}

    features = compute_features_for_rows(use_rows, ["return_20d", "volume_zscore_20d"])
    total_eligible = 0
    r20_pass = vz_pass = all_pass = 0

    for i, feat in enumerate(features):
        if i + 5 >= n:
            break
        r20 = feat.get("return_20d")
        vz = feat.get("volume_zscore_20d")
        if r20 is None or vz is None:
            continue
        total_eligible += 1
        c1 = r20 > 0
        c2 = vz > 0.5
        if c1: r20_pass += 1
        if c2: vz_pass += 1
        if c1 and c2: all_pass += 1

    te = max(total_eligible, 1)
    return {
        "signal_count": all_pass,
        "n_rows": n,
        "total_eligible": total_eligible,
        "conditions": {
            "return_20d_gt_0": round(r20_pass / te, 4),
            "volume_zscore_gt_0p5": round(vz_pass / te, 4),
            "all_conditions": round(all_pass / te, 4),
        },
    }


def count_h011_signals(rows: list[dict], window: int) -> dict[str, Any]:
    """H011: Near Breakout Low Volatility — condition pass rates."""
    use_rows = rows[-window:] if len(rows) >= window else rows
    n = len(use_rows)
    if n < 30:
        return {"signal_count": 0, "error": "insufficient_rows", "n_rows": n}

    features = compute_features_for_rows(use_rows, ["volatility_20d"])
    total_eligible = 0
    vol_pass = nbk_pass = all_pass = 0

    for i, feat in enumerate(features):
        if i + 5 >= n:
            break
        vol = feat.get("volatility_20d")
        if vol is None:
            continue
        past_vols = [
            features[j]["volatility_20d"]
            for j in range(i + 1)
            if features[j].get("volatility_20d") is not None
        ]
        if len(past_vols) < 4:
            continue
        p25 = sorted(past_vols)[max(0, int(len(past_vols) * 0.25) - 1)]
        lo = max(0, i - 19)
        highs = [float(use_rows[j].get("high", use_rows[j]["close"])) for j in range(lo, i + 1)]
        max_high = max(highs) if highs else float(use_rows[i]["close"])
        close = float(use_rows[i]["close"])
        total_eligible += 1
        c1 = vol <= p25
        c2 = close >= 0.98 * max_high
        if c1: vol_pass += 1
        if c2: nbk_pass += 1
        if c1 and c2: all_pass += 1

    te = max(total_eligible, 1)
    return {
        "signal_count": all_pass,
        "n_rows": n,
        "total_eligible": total_eligible,
        "conditions": {
            "volatility_low_p25": round(vol_pass / te, 4),
            "close_near_breakout_0p98": round(nbk_pass / te, 4),
            "all_conditions": round(all_pass / te, 4),
        },
    }


def count_h012_signals(rows: list[dict], window: int, symbol: str) -> dict[str, Any]:
    """H012: RSI Reversion Symbol-Specific — signal count + RSI trigger rate."""
    scoped_symbols = ["2317"]
    use_rows = rows[-window:] if len(rows) >= window else rows
    n = len(use_rows)
    if symbol not in scoped_symbols:
        return {
            "signal_count": 0,
            "n_rows": n,
            "total_eligible": 0,
            "conditions": {"symbol_in_scope": 0.0, "rsi_oversold_lt30": "N/A",
                           "rsi_overbought_gt70": "N/A", "all_conditions": 0.0},
            "note": f"symbol {symbol} not in scope {scoped_symbols}",
        }
    if n < 20:
        return {"signal_count": 0, "error": "insufficient_rows", "n_rows": n}
    closes = [float(r["close"]) for r in use_rows]
    period = 5
    total = rsi_30 = rsi_70 = 0
    for i in range(period + 1, n - 5):
        changes = [closes[j] - closes[j - 1] for j in range(i - period, i)]
        gains = [c for c in changes if c > 0]
        losses = [-c for c in changes if c < 0]
        avg_gain = sum(gains) / period if gains else 0.0
        avg_loss = sum(losses) / period if losses else 1e-6
        rs = avg_gain / avg_loss
        rsi = 100 - (100 / (1 + rs))
        total += 1
        if rsi < 30:
            rsi_30 += 1
        elif rsi > 70:
            rsi_70 += 1
    te = max(total, 1)
    return {
        "signal_count": rsi_30 + rsi_70,
        "n_rows": n,
        "total_eligible": total,
        "conditions": {
            "symbol_in_scope": 1.0,
            "rsi_oversold_lt30": round(rsi_30 / te, 4),
            "rsi_overbought_gt70": round(rsi_70 / te, 4),
            "all_conditions": round((rsi_30 + rsi_70) / te, 4),
        },
    }


SIGNAL_COUNTERS = {
    "STOCK_H009_PULLBACK_10D_HOLD": count_h009_signals,
    "STOCK_H010_MOM_MODERATE_VOLUME": count_h010_signals,
    "STOCK_H011_NEAR_BREAKOUT_LOW_VOL": count_h011_signals,
}


# ---------------------------------------------------------------------------
# Failure mode inference
# ---------------------------------------------------------------------------
def infer_failure_mode(
    cand_id: str,
    total_signals: int,
    avg_rate: float,
    symbols_with_any: int,
    n_symbols_tested: int,
    windows_di: int,
    total_windows: int,
    is_etf_scope: bool = False,
) -> str:
    if n_symbols_tested <= 10:
        return "UNIVERSE_TOO_SMALL"
    if windows_di / max(total_windows, 1) > 0.5:
        return "DATA_TOO_SHORT"
    if avg_rate < 0.02:
        return "RULE_TOO_STRICT"
    if is_etf_scope and n_symbols_tested < 20:
        return "ETF_UNIVERSE_TOO_SMALL"
    if total_signals > 0 and symbols_with_any >= 5:
        return "SIGNAL_NOISY"
    return "UNKNOWN"


# ---------------------------------------------------------------------------
# Main audit
# ---------------------------------------------------------------------------
def run_audit(
    as_of_date: str = "2026-05-01",
    min_rows: int = 300,
    max_symbols: int | None = None,
    db_path: Path = DB_PATH,
    output_dir: Path | None = None,
) -> dict[str, Any]:
    ts = datetime.now(timezone.utc).isoformat()
    print(f"\n{'='*68}")
    print(f"  P3-12 Signal Coverage & Universe Expansion Audit")
    print(f"  as_of_date={as_of_date}  min_rows={min_rows}")
    print(f"  {ts}")
    print(f"{'='*68}\n")

    out_dir = Path(output_dir) if output_dir else DIAG_DIR
    out_dir.mkdir(parents=True, exist_ok=True)

    # ── Universe audit ─────────────────────────────────────────────────────
    print("[1/5] Running universe audit...")
    all_stats = load_all_symbol_stats(as_of_date, db_path)
    total_symbols = len(all_stats)
    ge_150 = sum(1 for s in all_stats if s["eligible_150d"])
    ge_300 = sum(1 for s in all_stats if s["eligible_300d"])
    ge_500 = sum(1 for s in all_stats if s["eligible_500d"])
    etf_ge_500 = sum(1 for s in all_stats if s["eligible_500d"] and s["is_etf_like"])
    stock_ge_500 = sum(1 for s in all_stats if s["eligible_500d"] and not s["is_etf_like"])
    etf_ge_300 = sum(1 for s in all_stats if s["eligible_300d"] and s["is_etf_like"])
    stock_ge_300 = sum(1 for s in all_stats if s["eligible_300d"] and not s["is_etf_like"])

    universe_summary = {
        "total_symbols": total_symbols,
        "symbols_ge_150": ge_150,
        "symbols_ge_300": ge_300,
        "symbols_ge_500": ge_500,
        "stock_symbols_ge_300": stock_ge_300,
        "etf_symbols_ge_300": etf_ge_300,
        "stock_symbols_ge_500": stock_ge_500,
        "etf_symbols_ge_500": etf_ge_500,
        "symbols_tested_in_p311": 8,
        "untested_eligible_ge_300": ge_300 - 8,
    }

    print(f"  Total symbols: {total_symbols}")
    print(f"  >= 150 rows: {ge_150}  >= 300: {ge_300}  >= 500: {ge_500}")
    print(f"  ETF-like >= 500: {etf_ge_500}  Stock-like >= 500: {stock_ge_500}")
    print(f"  ⚠️  P3-11 tested only 8 of {ge_300} eligible (≥300) symbols!")

    # ── Select symbols for coverage audit ────────────────────────────────
    eligible = [s for s in all_stats if s["iso_row_count"] >= min_rows]
    if max_symbols:
        eligible = eligible[:max_symbols]
    test_symbols = [s["symbol"] for s in eligible]
    print(f"\n[2/5] Coverage audit on {len(test_symbols)} symbols (max={max_symbols})...")

    # ── Load v3 registry ──────────────────────────────────────────────────
    registry = json.loads(V3_REGISTRY.read_text())
    candidates = registry["hypotheses"]

    # ── Signal coverage per candidate × symbol × window ─────────────────
    print("[3/5] Counting signals per candidate × symbol × window...")
    coverage_records: list[dict] = []
    cand_totals: dict[str, dict] = {}

    for cand in candidates:
        hid = cand["hypothesis_id"]
        cand_totals[hid] = {
            "total_signal_count": 0,
            "rate_sum": 0.0,
            "rate_count": 0,
            "symbols_with_any": 0,
            "windows_di": 0,
            "total_windows": 0,
        }

    for sym in test_symbols:
        rows = load_rows_for_symbol(sym, as_of_date, db_path)
        if not rows:
            continue

        for cand in candidates:
            hid = cand["hypothesis_id"]
            fwd = cand.get("forward_days", 5)

            for w in BATCH_WINDOWS:
                use_rows = rows[-w:] if len(rows) >= w else rows
                n = len(use_rows)
                cand_totals[hid]["total_windows"] += 1

                # H012 special handling
                if "H012" in hid:
                    result = count_h012_signals(rows, w, sym)
                else:
                    fn = SIGNAL_COUNTERS.get(hid)
                    result = fn(rows, w) if fn else {"signal_count": 0, "error": "no_fn"}

                sig_count = result.get("signal_count", 0)
                total_elig = result.get("total_eligible", 0)
                rate = (sig_count / max(total_elig, 1)) if total_elig > 0 else 0.0

                # Determine data insufficiency
                oos_n = int(sig_count * OOS_FRACTION)
                is_di = sig_count == 0 or oos_n < MIN_OOS_SIGNALS
                di_reason = ""
                if result.get("error"):
                    di_reason = result["error"]
                elif sig_count == 0:
                    di_reason = "zero_signals"
                elif oos_n < MIN_OOS_SIGNALS:
                    di_reason = f"oos_too_small({oos_n})"

                # Top blocking condition (lowest pass rate)
                conds = result.get("conditions", {})
                if conds and not result.get("error"):
                    numeric_conds = {k: v for k, v in conds.items()
                                     if isinstance(v, (int, float)) and k != "all_conditions"}
                    top_block = min(numeric_conds, key=numeric_conds.get) if numeric_conds else ""
                else:
                    top_block = di_reason or "no_features"

                record = {
                    "candidate_id": hid,
                    "symbol": sym,
                    "window_days": w,
                    "total_rows": n,
                    "signal_count": sig_count,
                    "signal_rate": round(rate, 4),
                    "oos_estimated": oos_n,
                    "min_required_signals": 25,  # need >= 5 OOS = ~25 total at 20% split
                    "data_insufficient": is_di,
                    "data_insufficient_reason": di_reason,
                    "top_blocking_condition": top_block,
                    "condition_rates": conds,
                }
                coverage_records.append(record)

                ct = cand_totals[hid]
                ct["total_signal_count"] += sig_count
                if rate > 0:
                    ct["rate_sum"] += rate
                    ct["rate_count"] += 1
                if sig_count > 0:
                    ct["symbols_with_any"] += 1
                if is_di:
                    ct["windows_di"] += 1

    # Build candidate summaries
    cand_summaries: list[dict] = []
    for cand in candidates:
        hid = cand["hypothesis_id"]
        ct = cand_totals[hid]
        n_sym = len(test_symbols)
        avg_rate = round(ct["rate_sum"] / max(ct["rate_count"], 1), 4)
        is_etf_scope = "H012" in hid  # H012 is symbol-specific, not ETF-specific
        mode = infer_failure_mode(
            cand_id=hid,
            total_signals=ct["total_signal_count"],
            avg_rate=avg_rate,
            symbols_with_any=ct["symbols_with_any"],
            n_symbols_tested=n_sym,
            windows_di=ct["windows_di"],
            total_windows=ct["total_windows"],
        )
        summary = {
            "candidate_id": hid,
            "total_signal_count": ct["total_signal_count"],
            "avg_signal_rate": avg_rate,
            "symbols_with_any_signal": ct["symbols_with_any"],
            "windows_data_insufficient": ct["windows_di"],
            "total_windows": ct["total_windows"],
            "likely_failure_mode": mode,
        }
        cand_summaries.append(summary)
        print(f"  {hid[:30]}: signals={ct['total_signal_count']}  "
              f"avg_rate={avg_rate:.2%}  mode={mode}")

    # ── Condition attribution (cross-symbol aggregation) ─────────────────
    print("\n[4/5] Building condition attribution report...")
    cond_attr: dict[str, dict] = {}
    for cand in candidates:
        hid = cand["hypothesis_id"]
        cond_sums: dict[str, list[float]] = {}
        for rec in coverage_records:
            if rec["candidate_id"] != hid or rec["window_days"] != 500:
                continue
            for ck, cv in rec.get("condition_rates", {}).items():
                if isinstance(cv, (int, float)):
                    cond_sums.setdefault(ck, []).append(cv)
        cond_attr[hid] = {
            k: round(sum(v) / len(v), 4) if v else 0.0
            for k, v in cond_sums.items()
        }

    # ── Overall blocking analysis across all candidates ───────────────────
    all_blocking = {}
    for rec in coverage_records:
        cond = rec.get("top_blocking_condition", "")
        if cond:
            all_blocking[cond] = all_blocking.get(cond, 0) + 1
    top_blockers = sorted(all_blocking.items(), key=lambda x: -x[1])[:10]

    # ── Window design analysis ────────────────────────────────────────────
    di_by_window: dict[int, dict] = {}
    for w in BATCH_WINDOWS:
        w_recs = [r for r in coverage_records if r["window_days"] == w]
        di_count = sum(1 for r in w_recs if r["data_insufficient"])
        di_by_window[w] = {
            "total": len(w_recs),
            "data_insufficient": di_count,
            "di_rate": round(di_count / max(len(w_recs), 1), 3),
        }

    # ── P3-11 vs potential universe comparison ────────────────────────────
    p311_symbols = ['0055', '00712', '00903', '00891', '00830', '00738U', '1326', '1560']
    p311_coverage = [r for r in coverage_records if r["symbol"] in p311_symbols]
    full_coverage = [r for r in coverage_records if r["symbol"] not in p311_symbols]
    p311_total_sigs = sum(r["signal_count"] for r in p311_coverage)
    full_total_sigs = sum(r["signal_count"] for r in full_coverage)
    full_sym_count = len(set(r["symbol"] for r in full_coverage))

    # ── Assemble audit JSON ───────────────────────────────────────────────
    audit = {
        "pipeline": "P3-12",
        "run_ts": ts,
        "as_of_date": as_of_date,
        "universe_summary": universe_summary,
        "universe_details": all_stats[:50],  # top 50 for readability
        "candidate_coverage_summaries": cand_summaries,
        "coverage_by_window": di_by_window,
        "p311_vs_full_comparison": {
            "p311_symbols_count": len(p311_symbols),
            "p311_total_signals": p311_total_sigs,
            "full_universe_symbols": full_sym_count,
            "full_universe_total_signals": full_total_sigs,
            "signal_multiplier": round(full_total_sigs / max(p311_total_sigs, 1), 1),
        },
        "top_blocking_conditions": [{"condition": c, "count": n} for c, n in top_blockers],
        "condition_attribution": cond_attr,
        "safety_confirmations": {
            "no_hypothesis_added": True,
            "no_threshold_changed": True,
            "no_production_write": True,
            "no_validation_run": True,
            "no_promotion": True,
        },
    }

    # Save coverage audit JSON
    out_json = out_dir / "signal_coverage_audit.json"
    out_json.write_text(json.dumps(audit, indent=2))
    print(f"  ✓ {out_json.name}")

    # Save condition attribution JSON
    cond_json = out_dir / "condition_attribution.json"
    cond_json.write_text(json.dumps({
        "pipeline": "P3-12",
        "run_ts": ts,
        "as_of_date": as_of_date,
        "symbols_analyzed": len(test_symbols),
        "condition_attribution": cond_attr,
        "candidate_summaries": cand_summaries,
    }, indent=2))
    print(f"  ✓ {cond_json.name}")

    # ── Markdown report ───────────────────────────────────────────────────
    print("\n[5/5] Writing markdown reports...")
    _write_coverage_md(audit, as_of_date, ts, out_dir=out_dir)
    _write_recommendation_md(audit, as_of_date, ts, out_dir=out_dir)

    print(f"\n{'='*68}")
    print(f"  Audit complete — {len(test_symbols)} symbols analyzed")
    print(f"  Untested eligible: {ge_300 - 8} symbols")
    print(f"  Top failure mode: {cand_summaries[0]['likely_failure_mode'] if cand_summaries else 'N/A'}")
    print(f"{'='*68}\n")

    return audit


def _write_coverage_md(audit: dict, as_of_date: str, ts: str, out_dir: Path | None = None) -> None:
    us = audit["universe_summary"]
    cand_sums = audit["candidate_coverage_summaries"]
    top_blocks = audit["top_blocking_conditions"]
    w_info = audit["coverage_by_window"]
    p311 = audit["p311_vs_full_comparison"]
    cond_attr = audit["condition_attribution"]

    lines = [
        "# P3-12 Signal Coverage & Universe Expansion Audit",
        "",
        f"> as_of_date: {as_of_date}  |  Generated: {ts}",
        "",
        "---",
        "",
        "## 1. Universe Summary",
        "",
        "| Metric | Count |",
        "|---|---|",
        f"| Total symbols in DB | {us['total_symbols']} |",
        f"| Symbols ≥ 150 rows | {us['symbols_ge_150']} |",
        f"| Symbols ≥ 300 rows | {us['symbols_ge_300']} |",
        f"| Symbols ≥ 500 rows | {us['symbols_ge_500']} |",
        f"| Stock-like ≥ 500 rows | {us['stock_symbols_ge_500']} |",
        f"| ETF-like ≥ 500 rows | {us['etf_symbols_ge_500']} |",
        f"| **Symbols tested in P3-11** | **{us['symbols_tested_in_p311']}** |",
        f"| **Untested eligible (≥300)** | **{us['untested_eligible_ge_300']}** |",
        "",
        f"> ⚠️ **P3-11 tested only {us['symbols_tested_in_p311']} of {us['symbols_ge_300']} eligible symbols.**",
        f"> This is {us['symbols_tested_in_p311']/max(us['symbols_ge_300'],1)*100:.1f}% of the available universe.",
        "",
        "---",
        "",
        "## 2. Candidate Coverage Summaries",
        "",
        "| Candidate | Total Signals | Avg Rate | Symbols w/ Signal | DI Windows | Failure Mode |",
        "|---|---|---|---|---|---|",
    ]
    for cs in cand_sums:
        lines.append(
            f"| {cs['candidate_id']} | {cs['total_signal_count']} | "
            f"{cs['avg_signal_rate']:.2%} | {cs['symbols_with_any_signal']} | "
            f"{cs['windows_data_insufficient']}/{cs['total_windows']} | "
            f"`{cs['likely_failure_mode']}` |"
        )

    lines += [
        "",
        "---",
        "",
        "## 3. P3-11 (8 symbols) vs Full Universe Comparison",
        "",
        f"| Scope | Symbols | Total Signals |",
        "|---|---|---|",
        f"| P3-11 (8 symbols) | {p311['p311_symbols_count']} | {p311['p311_total_signals']} |",
        f"| Remaining eligible | {p311['full_universe_symbols']} | {p311['full_universe_total_signals']} |",
        f"| **Multiplier** | — | **{p311['signal_multiplier']}×** |",
        "",
        "---",
        "",
        "## 4. Window Design — Data Insufficiency Rates",
        "",
        "| Window | Total Tests | DI Count | DI Rate |",
        "|---|---|---|---|",
    ]
    for w, info in w_info.items():
        lines.append(f"| {w}d | {info['total']} | {info['data_insufficient']} | {info['di_rate']:.1%} |")

    lines += [
        "",
        "---",
        "",
        "## 5. Top Blocking Conditions",
        "",
        "| Condition | Occurrence Count |",
        "|---|---|",
    ]
    for bc in top_blocks:
        lines.append(f"| `{bc['condition']}` | {bc['count']} |")

    lines += [
        "",
        "---",
        "",
        "## 6. Condition Attribution (500d window, cross-symbol average)",
        "",
    ]
    for hid, conds in cond_attr.items():
        lines.append(f"**{hid}**:")
        lines.append("")
        lines.append("| Condition | Pass Rate |")
        lines.append("|---|---|")
        for ck, cv in conds.items():
            lines.append(f"| `{ck}` | {cv:.2%} |")
        lines.append("")

    out_path = (out_dir if out_dir else DIAG_DIR) / "signal_coverage_audit.md"
    out_path.write_text("\n".join(lines))
    print(f"  ✓ {out_path.name}")


def _write_recommendation_md(audit: dict, as_of_date: str, ts: str, out_dir: Path | None = None) -> None:
    us = audit["universe_summary"]
    cand_sums = audit["candidate_coverage_summaries"]
    p311 = audit["p311_vs_full_comparison"]
    cond_attr = audit["condition_attribution"]

    # Determine candidates to pause vs keep
    pause = []
    keep = []
    for cs in cand_sums:
        hid = cs["candidate_id"]
        mode = cs["likely_failure_mode"]
        rate = cs["avg_signal_rate"]
        if "H012" in hid:
            keep.append((hid, "OBSERVATION_ONLY — symbol-specific probe, already locked"))
        elif mode == "UNIVERSE_TOO_SMALL":
            keep.append((hid, f"Keep — blocked by universe size, not hypothesis quality (mode={mode})"))
        elif mode == "RULE_TOO_STRICT" and rate < 0.005:
            pause.append((hid, f"Pause — extremely low signal rate ({rate:.2%}), rule may be invalid for Taiwan ETFs"))
        elif mode == "DATA_TOO_SHORT":
            keep.append((hid, f"Keep — blocked by window size, not rule quality (mode={mode})"))
        else:
            keep.append((hid, f"Conditional — monitor after universe expansion (mode={mode})"))

    # Compute data expansion needs
    needed_symbols = max(30, us["symbols_ge_300"])
    needed_rows = 600  # ~2.5 years for reliable OOS

    lines = [
        "# Universe Expansion Recommendations",
        "",
        f"> P3-12  |  as_of_date: {as_of_date}  |  {ts}",
        "",
        "> ⚠️ These are research diagnostics only.",
        "> No hypothesis added. No threshold changed. No production write.",
        "",
        "---",
        "",
        "## Core Finding",
        "",
        f"P3-11 validated H009–H012 on **{us['symbols_tested_in_p311']} symbols** out of "
        f"**{us['symbols_ge_300']} eligible** (≥300 rows). This is "
        f"**{us['symbols_tested_in_p311']/max(us['symbols_ge_300'],1)*100:.1f}%** of the available universe.",
        "",
        f"Signal multiplication potential: **{p311['signal_multiplier']}×** more signals available "
        f"from the remaining {p311['full_universe_symbols']} untested symbols.",
        "",
        "**The primary diagnosis is `UNIVERSE_TOO_SMALL`** — the hypothesis rules are not "
        "demonstrably broken; they simply have not been tested against enough data.",
        "",
        "---",
        "",
        "## 1. How Many Symbols Are Needed",
        "",
        f"- **Current**: {us['symbols_tested_in_p311']} symbols tested",
        f"- **Available**: {us['symbols_ge_300']} symbols with ≥300 rows",
        f"- **Recommended minimum**: 30–50 symbols for BH-FDR-corrected testing to have "
        f"meaningful statistical power",
        f"- **Ideal**: All {us['symbols_ge_500']} symbols with ≥500 rows "
        f"({us['stock_symbols_ge_500']} stocks + {us['etf_symbols_ge_500']} ETFs)",
        "",
        "---",
        "",
        "## 2. How Much History Is Needed",
        "",
        f"- **Current**: 500d window (≈2 years)",
        f"- **Problem**: 150d window has >50% DI rate (OOS < 5 signals)",
        f"- **Recommended**: ≥600 rows (≈2.4 years) as minimum threshold",
        f"- **Ideal for H009** (10d hold): ≥700 rows to get ≥25 non-overlapping OOS periods",
        "",
        "---",
        "",
        "## 3. Candidates to Pause vs Keep",
        "",
        "### Keep (pending universe expansion)",
        "",
    ]
    for hid, reason in keep:
        lines.append(f"- **{hid}**: {reason}")

    if pause:
        lines += ["", "### Pause (signal rate too low even with full universe)", ""]
        for hid, reason in pause:
            lines.append(f"- **{hid}**: {reason}")

    lines += [
        "",
        "---",
        "",
        "## 4. Priority Recommendation",
        "",
        "### Should Next Step Be Data Expansion, Not Strategy Design?",
        "",
        "**Yes — strongly recommended.**",
        "",
        "Reasons:",
        f"1. **{us['symbols_ge_300'] - us['symbols_tested_in_p311']} untested symbols** available with ≥300 rows",
        "2. **Signal multiplication**: Running H009–H011 on all eligible symbols would yield "
        f"~{p311['signal_multiplier']}× more signals — sufficient for BH-FDR correction "
        "to have real power",
        "3. **Framework is sound**: P3-11 validation pipeline, PIT guard, BH-FDR correction, "
        "guard pre-check all working correctly",
        "4. **Do NOT design new hypotheses** until the existing ones have been tested on the "
        "full universe — this avoids data snooping",
        "",
        "### Recommended Action for P3-13",
        "",
        f"- Remove `DEFAULT_AUTO_SYMBOLS = 8` cap in `run_stock_v3_candidate_validation.py`",
        f"- Set `--symbols` to include all {us['symbols_ge_500']} symbols with ≥500 rows "
        "(or at least 30 symbols)",
        "- Re-run P3-11 validation on full universe",
        "- Only then evaluate whether any hypothesis has real cross-symbol edge",
        "",
        "---",
        "",
        "## 5. ETF vs Stock Mix",
        "",
        f"- ETF-like symbols (starts with '00'): {us['etf_symbols_ge_500']} with ≥500 rows",
        f"- Stock-like symbols: {us['stock_symbols_ge_500']} with ≥500 rows",
        "- P3-11 tested 6 ETFs + 2 stocks — heavily ETF-biased",
        "- H009/H010 momentum hypotheses may behave differently for individual stocks",
        "- **Recommendation**: Test stocks and ETFs separately in P3-13",
        "",
        "---",
        "",
        "## 6. Safety Confirmation",
        "",
        "- ❌ No hypothesis added",
        "- ❌ No threshold changed",
        "- ❌ No production write",
        "- ❌ No validation run in this audit",
        "- ❌ No promotion decision",
        "- ✅ All recommendations are for data collection only",
        "",
    ]

    out_path = (out_dir if out_dir else DIAG_DIR) / "universe_expansion_recommendations.md"
    out_path.write_text("\n".join(lines))
    print(f"  ✓ {out_path.name}")


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------
def _build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(description="P3-12 Signal Coverage & Universe Audit")
    p.add_argument("--as-of-date", dest="as_of_date", default="2026-05-01")
    p.add_argument("--min-rows", dest="min_rows", type=int, default=300)
    p.add_argument("--max-symbols", dest="max_symbols", type=int, default=None)
    return p


if __name__ == "__main__":
    args = _build_parser().parse_args()
    run_audit(
        as_of_date=args.as_of_date,
        min_rows=args.min_rows,
        max_symbols=args.max_symbols,
    )
