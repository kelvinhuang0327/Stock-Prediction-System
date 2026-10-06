#!/usr/bin/env python3
"""
P3-13: Expanded Universe Validation

Re-validates H009–H012 on an expanded symbol universe (up to 50 symbols)
to determine whether the earlier no-edge results from P3-11 (8 symbols)
were artefacts of an under-powered test or reflect genuine absence of edge.

Key differences from P3-11:
  - Universe: up to 50 symbols (vs 8 in P3-11)
  - Primary window: 500d  →  used for REVIEW_CANDIDATE decisions
  - Secondary window: 150d →  diagnostic only, cannot trigger REVIEW_CANDIDATE
  - Two-tier BH-FDR: primary (500d) + diagnostic (all windows)
  - REVIEW_CANDIDATE requires ≥3 symbols primary-window support
  - DATA_INSUFFICIENT reported if < 30 symbols available (no crash)
  - ETF-like symbols kept in a separate bucket

Candidate scope (P3-10/P3-11 approved, no new hypotheses allowed):
  - H009  Pullback Uptrend 10D Hold         → may reach REVIEW_CANDIDATE
  - H010  Momentum + Moderate Volume        → may reach REVIEW_CANDIDATE
  - H011  Near Breakout Low Volatility      → may reach REVIEW_CANDIDATE
  - H012  RSI Reversion Symbol-Specific     → always OBSERVATION_ONLY

Usage:
    python3 scripts/run_stock_expanded_universe_validation.py \\
        --registry research/stock_hypothesis_registry_v3_candidates.json \\
        --as-of-date 2026-05-01 \\
        --min-rows 500 \\
        --max-symbols 50 \\
        --primary-window 500 \\
        --secondary-window 150 \\
        --permutations 500 \\
        --dry-run

Safety:
  - Read-only; no production write, no order placement.
  - All results require human_review_required=true before any use.
  - This is NOT a trading recommendation.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import random
import sqlite3
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from gbgf.domain.hypothesis_refinement_guard import (
    HypothesisRefinementGuard,
    validate_v3_registry,
)
from gbgf.domain.point_in_time_guard import PointInTimeGuard
from gbgf.domain.stock_features import compute_features_for_rows
from gbgf.domain.stock_real import StockRealDomain, DATA_INSUFFICIENT

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
DEFAULT_REGISTRY = ROOT / "research" / "stock_hypothesis_registry_v3_candidates.json"
DB_PATH = ROOT / "prisma" / "dev.db"
OUTPUT_BASE = ROOT / "outputs" / "stock_validation_expanded"

PRIMARY_WINDOW = 500      # used for promotion / review candidate decisions
SECONDARY_WINDOW = 150    # diagnostic only, cannot trigger REVIEW_CANDIDATE

TX_COST_BPS = 10
BH_FDR_ALPHA = 0.10

DEFAULT_MIN_ROWS = 500
DEFAULT_MAX_SYMBOLS = 50
DEFAULT_N_PERMS = 500
MIN_SYMBOLS_REQUIRED = 30   # below this → DATA_INSUFFICIENT

OBSERVATION_ONLY_SCOPE = "exploratory_observation_only"
APPROVED_CANDIDATES = {
    "STOCK_H009_PULLBACK_10D_HOLD",
    "STOCK_H010_MOM_MODERATE_VOLUME",
    "STOCK_H011_NEAR_BREAKOUT_LOW_VOL",
    "STOCK_H012_RSI_REVERSION_PROBE",
}
REVIEW_ELIGIBLE = {
    "STOCK_H009_PULLBACK_10D_HOLD",
    "STOCK_H010_MOM_MODERATE_VOLUME",
    "STOCK_H011_NEAR_BREAKOUT_LOW_VOL",
}

# Final status values
STATUS_REVIEW = "REVIEW_CANDIDATE"
STATUS_REJECTED = "REJECTED"
STATUS_DATA_INSUF = "DATA_INSUFFICIENT"
STATUS_OBS_ONLY = "OBSERVATION_ONLY"


# ---------------------------------------------------------------------------
# ETF heuristic
# ---------------------------------------------------------------------------
def is_etf_like(symbol: str) -> bool:
    """Taiwan market ETF-like heuristic: starts with '00' or ends with 'U'/'L'."""
    return symbol.startswith("00") or symbol.endswith("U") or symbol.endswith("L")


# ---------------------------------------------------------------------------
# Universe selection
# ---------------------------------------------------------------------------
def select_expanded_universe(
    as_of_date: str,
    min_rows: int = DEFAULT_MIN_ROWS,
    max_symbols: int = DEFAULT_MAX_SYMBOLS,
    db_path: Path = DB_PATH,
) -> dict[str, Any]:
    """
    Select up to max_symbols eligible symbols from dev.db.

    Priority:
      1. stock-like symbols (non-ETF) with >= min_rows ISO rows
      2. ETF-like symbols as a separate bucket
    Returns dict with keys: stock_symbols, etf_symbols, all_symbols, stats.
    """
    if not db_path.exists():
        return {
            "stock_symbols": [],
            "etf_symbols": [],
            "all_symbols": [],
            "stats": {"total_in_db": 0, "eligible": 0, "selected": 0},
        }

    try:
        conn = sqlite3.connect(str(db_path))
        c = conn.cursor()
        c.execute(
            """
            SELECT stockId, COUNT(*) AS n, MAX(date) AS last_date
            FROM StockQuote
            WHERE date LIKE '20%' AND length(date)=10
              AND date <= ?
            GROUP BY stockId
            HAVING n >= ?
            ORDER BY n DESC
            """,
            (as_of_date, min_rows),
        )
        rows = c.fetchall()

        c.execute("SELECT COUNT(DISTINCT stockId) FROM StockQuote")
        total_in_db = c.fetchone()[0]
        conn.close()
    except sqlite3.Error:
        return {
            "stock_symbols": [],
            "etf_symbols": [],
            "all_symbols": [],
            "stats": {"total_in_db": 0, "eligible": 0, "selected": 0},
        }

    eligible = [(r[0], r[1], r[2]) for r in rows]
    stock_like = [(sym, n, ld) for sym, n, ld in eligible if not is_etf_like(sym)]
    etf_like = [(sym, n, ld) for sym, n, ld in eligible if is_etf_like(sym)]

    selected_stocks = [sym for sym, _, _ in stock_like[:max_symbols]]
    selected_etfs = [sym for sym, _, _ in etf_like]

    all_selected = selected_stocks + [
        s for s in selected_etfs if s not in selected_stocks
    ]

    return {
        "stock_symbols": selected_stocks,
        "etf_symbols": selected_etfs,
        "all_symbols": all_selected,
        "stats": {
            "total_in_db": total_in_db,
            "eligible_total": len(eligible),
            "eligible_stock_like": len(stock_like),
            "eligible_etf_like": len(etf_like),
            "selected_stock": len(selected_stocks),
            "selected_etf": len(selected_etfs),
            "selected_total": len(all_selected),
        },
    }


# ---------------------------------------------------------------------------
# Signal computers (same logic as P3-11 / V3)
# ---------------------------------------------------------------------------

def compute_h009_signals(
    rows: list[dict], forward: int = 10, extra_context: dict | None = None, **kwargs
) -> list[dict]:
    """H009: Pullback Uptrend 10D Hold."""
    features = compute_features_for_rows(rows, ["return_5d", "return_20d", "ma60"])
    signals = []
    for i, feat in enumerate(features):
        if i + forward >= len(rows):
            break
        r5 = feat.get("return_5d")
        r20 = feat.get("return_20d")
        ma60_val = feat.get("ma60")
        if r5 is None or r20 is None or ma60_val is None:
            continue
        close = float(rows[i]["close"])
        if close > ma60_val and r5 < 0 and r20 > 0:
            fwd = (float(rows[i + forward]["close"]) - close) / close
            signals.append({
                "date": rows[i]["date"],
                "signal": 1,
                "return_5d": round(r5, 6),
                "return_20d": round(r20, 6),
                "close_vs_ma60": round(close / ma60_val, 4),
                "forward_return": round(fwd, 6),
            })
    return signals


def compute_h010_signals(
    rows: list[dict], forward: int = 5, extra_context: dict | None = None, **kwargs
) -> list[dict]:
    """H010: Momentum + Moderate Volume (volume_zscore > 0.5)."""
    features = compute_features_for_rows(
        rows, ["return_20d", "volume_zscore_20d"]
    )
    signals = []
    for i, feat in enumerate(features):
        if i + forward >= len(rows):
            break
        r20 = feat.get("return_20d")
        vz = feat.get("volume_zscore_20d")
        if r20 is None or vz is None:
            continue
        if r20 > 0 and vz > 0.5:
            close = float(rows[i]["close"])
            fwd = (float(rows[i + forward]["close"]) - close) / close
            signals.append({
                "date": rows[i]["date"],
                "signal": 1,
                "return_20d": round(r20, 6),
                "volume_zscore_20d": round(vz, 4),
                "forward_return": round(fwd, 6),
            })
    return signals


def compute_h011_signals(
    rows: list[dict], forward: int = 5, extra_context: dict | None = None, **kwargs
) -> list[dict]:
    """H011: Near-Breakout after Volatility Squeeze (close >= 0.98 × 20d high)."""
    signals = []
    for i in range(20, len(rows) - forward):
        past = [float(rows[j]["close"]) for j in range(max(0, i - 19), i + 1)]
        returns = [
            (past[k] - past[k - 1]) / past[k - 1]
            for k in range(1, len(past))
            if past[k - 1] != 0
        ]
        if len(returns) < 4:
            continue
        mean_ret = sum(returns) / len(returns)
        vol = math.sqrt(
            sum((r - mean_ret) ** 2 for r in returns) / max(len(returns) - 1, 1)
        )

        past_vols = []
        for j in range(max(0, i - 39), i):
            sl = [float(rows[k]["close"]) for k in range(max(0, j - 19), j + 1)]
            if len(sl) < 4:
                continue
            sr = [(sl[k] - sl[k - 1]) / sl[k - 1] for k in range(1, len(sl)) if sl[k - 1] != 0]
            if len(sr) < 3:
                continue
            mr = sum(sr) / len(sr)
            v = math.sqrt(sum((r - mr) ** 2 for r in sr) / max(len(sr) - 1, 1))
            past_vols.append(v)

        if len(past_vols) < 4:
            continue
        p25_val = sorted(past_vols)[max(0, int(len(past_vols) * 0.25) - 1)]
        if vol > p25_val:
            continue

        lo = max(0, i - 19)
        highs_window = [float(rows[j].get("high", rows[j]["close"])) for j in range(lo, i + 1)]
        if not highs_window:
            continue
        max_high = max(highs_window)
        close = float(rows[i]["close"])
        if close >= 0.98 * max_high:
            fwd = (float(rows[i + forward]["close"]) - close) / close
            signals.append({
                "date": rows[i]["date"],
                "signal": 1,
                "volatility_20d": round(vol, 6),
                "near_breakout_ratio": round(close / max_high, 4),
                "forward_return": round(fwd, 6),
            })
    return signals


def compute_h012_signals(
    rows: list[dict], forward: int = 5, extra_context: dict | None = None, **kwargs
) -> list[dict]:
    """H012: RSI Reversion Symbol-Specific Probe (observation-only, symbol-scoped)."""
    allowed_symbols = (extra_context or {}).get("symbol_scope", ["2317"])
    current_symbol = (extra_context or {}).get("symbol", "")
    if current_symbol not in allowed_symbols:
        return []

    closes = [float(r["close"]) for r in rows]
    signals = []
    period = 5
    for i in range(period + 1, len(closes) - forward):
        changes = [closes[j] - closes[j - 1] for j in range(i - period, i)]
        gains = [c for c in changes if c > 0]
        losses = [-c for c in changes if c < 0]
        avg_gain = sum(gains) / period if gains else 0.0
        avg_loss = sum(losses) / period if losses else 0.0001
        rs = avg_gain / avg_loss
        rsi = 100 - (100 / (1 + rs))
        if rsi < 30:
            sig = 1
        elif rsi > 70:
            sig = -1
        else:
            continue
        fwd = (closes[i + forward] - closes[i]) / closes[i]
        signals.append({
            "date": rows[i]["date"],
            "signal": sig,
            "rsi": round(rsi, 2),
            "forward_return": round(fwd * sig, 6),
        })
    return signals


EXPANDED_SIGNAL_COMPUTERS: dict[str, Any] = {
    "STOCK_H009_PULLBACK_10D_HOLD": compute_h009_signals,
    "STOCK_H010_MOM_MODERATE_VOLUME": compute_h010_signals,
    "STOCK_H011_NEAR_BREAKOUT_LOW_VOL": compute_h011_signals,
    "STOCK_H012_RSI_REVERSION_PROBE": compute_h012_signals,
}


# ---------------------------------------------------------------------------
# Per-window OOS evaluation
# ---------------------------------------------------------------------------
def eval_window(
    hid: str,
    rows: list[dict],
    window_days: int,
    forward_days: int,
    n_permutations: int,
    seed: int,
    extra_context: dict | None = None,
) -> dict[str, Any]:
    signal_fn = EXPANDED_SIGNAL_COMPUTERS.get(hid)
    if signal_fn is None:
        return {"status": DATA_INSUFFICIENT, "error": f"no signal fn for {hid}"}

    use_rows = rows[-window_days:] if len(rows) >= window_days else rows
    if len(use_rows) < window_days:
        return {
            "status": DATA_INSUFFICIENT,
            "window_days": window_days,
            "actual_rows": len(use_rows),
            "error": f"only {len(use_rows)} rows < {window_days}",
        }

    all_sigs = signal_fn(use_rows, forward=forward_days, extra_context=extra_context)
    if not all_sigs:
        return {
            "status": DATA_INSUFFICIENT,
            "window_days": window_days,
            "error": "no_signals",
            "actual_rows": len(use_rows),
        }

    oos_cutoff = int(len(all_sigs) * 0.80)
    oos = all_sigs[oos_cutoff:]
    if len(oos) < 5:
        return {
            "status": DATA_INSUFFICIENT,
            "window_days": window_days,
            "error": "insufficient_oos",
            "n_oos": len(oos),
        }

    tc = TX_COST_BPS / 10000.0
    returns = [s["forward_return"] - tc for s in oos]
    n = len(returns)
    mean_r = sum(returns) / n
    var_r = sum((r - mean_r) ** 2 for r in returns) / max(n - 1, 1)
    std_r = math.sqrt(var_r) if var_r > 0 else 1e-6
    trading_periods_per_year = 252 / forward_days
    sharpe = round((mean_r / std_r) * math.sqrt(trading_periods_per_year), 4)
    win_rate = round(sum(1 for r in returns if r > 0) / n, 4)
    roi = round(mean_r * trading_periods_per_year, 6)
    edge_pp = round((win_rate - 0.5) * 100, 4)

    rng = random.Random(seed)
    null_dist = []
    for _ in range(n_permutations):
        shuffled = returns[:]
        rng.shuffle(shuffled)
        null_dist.append(sum(shuffled) / len(shuffled))
    p_value = round(sum(1 for x in null_dist if x >= mean_r) / n_permutations, 4)

    return {
        "status": "OK",
        "window_days": window_days,
        "actual_rows": len(use_rows),
        "n_signals": len(all_sigs),
        "n_oos": n,
        "mean_return": round(mean_r, 6),
        "std_return": round(std_r, 6),
        "sharpe_annualized": sharpe,
        "roi_annualized": roi,
        "win_rate": win_rate,
        "edge_pp": edge_pp,
        "tx_cost_bps": TX_COST_BPS,
        "p_value": p_value,
        "n_permutations": n_permutations,
        "one_tailed": True,
        "forward_days": forward_days,
    }


# ---------------------------------------------------------------------------
# Two-tier BH-FDR
# ---------------------------------------------------------------------------
def bh_fdr_correction(
    tests: list[dict[str, Any]], alpha: float = BH_FDR_ALPHA
) -> list[dict[str, Any]]:
    """Apply Benjamini-Hochberg FDR correction to a list of test dicts."""
    m = len(tests)
    if m == 0:
        return []
    results = [dict(t) for t in tests]
    for r in results:
        r["raw_p_value"] = r.get("p_value", 1.0)
        r["bh_fdr_q_value"] = 1.0
        r["bh_fdr_pass"] = False

    sorted_idx = sorted(range(m), key=lambda i: results[i].get("raw_p_value", 1.0))
    for rank, orig_i in enumerate(sorted_idx, start=1):
        pv = results[orig_i].get("raw_p_value", 1.0)
        q = min(pv * m / rank, 1.0)
        results[orig_i]["bh_fdr_q_value"] = round(q, 6)
        results[orig_i]["bh_fdr_pass"] = q < alpha

    return results


def apply_two_tier_bh_fdr(
    all_tests: list[dict[str, Any]],
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """
    Returns (primary_corrected, diagnostic_corrected).

    Primary BH-FDR:   only 500d window tests  → used for REVIEW_CANDIDATE
    Diagnostic BH-FDR: all window tests       → observation only
    """
    primary_tests = [t for t in all_tests if t.get("window_days") == PRIMARY_WINDOW]
    primary_corrected = bh_fdr_correction(primary_tests)

    diagnostic_corrected = bh_fdr_correction(all_tests)

    return primary_corrected, diagnostic_corrected


def _merge_bh_fields(
    result: dict[str, Any],
    primary_map: dict[tuple, dict],
    diagnostic_map: dict[tuple, dict],
) -> dict[str, Any]:
    """Merge two-tier BH-FDR fields into a result dict."""
    key = (result.get("symbol"), result.get("hypothesis_id"), result.get("window_days"))
    pr = primary_map.get(key, {})
    dr = diagnostic_map.get(key, {})

    result["primary_raw_p_value"] = pr.get("raw_p_value", result.get("p_value", 1.0))
    result["primary_bh_fdr_q_value"] = pr.get("bh_fdr_q_value", 1.0)
    result["primary_bh_fdr_pass"] = pr.get("bh_fdr_pass", False)
    result["diagnostic_bh_fdr_q_value"] = dr.get("bh_fdr_q_value", 1.0)
    result["diagnostic_bh_fdr_pass"] = dr.get("bh_fdr_pass", False)
    return result


# ---------------------------------------------------------------------------
# Window-role annotation
# ---------------------------------------------------------------------------
def annotate_window_role(wr: dict[str, Any]) -> dict[str, Any]:
    """Tag each window result with window_role and eligible_for_review."""
    w = wr.get("window_days", 0)
    if w == PRIMARY_WINDOW:
        wr["window_role"] = "primary"
        # Eligible for review only if it's an OK result with positive metrics
        wr["eligible_for_review"] = (
            wr.get("status") == "OK"
            and wr.get("roi_annualized", 0) > 0
            and wr.get("sharpe_annualized", 0) > 0
            and wr.get("primary_bh_fdr_pass", False)
        )
    else:
        wr["window_role"] = "secondary"
        wr["eligible_for_review"] = False  # secondary can never trigger REVIEW
    return wr


# ---------------------------------------------------------------------------
# Promotion decision (expanded universe — requires ≥3 symbols)
# ---------------------------------------------------------------------------
def decide_expanded_status(
    candidate: dict[str, Any],
    window_results: list[dict[str, Any]],
    pit_passed: bool,
    has_leakage: bool,
    primary_cross_symbol_count: int,
) -> str:
    """
    REVIEW_CANDIDATE criteria (H009–H011 only):
      - refinement guard PASS (enforced before calling this)
      - PIT guard PASS
      - no leakage
      - no random split (enforced globally)
      - primary window ROI > 0
      - primary window Sharpe > 0
      - primary permutation p < 0.05
      - primary BH-FDR q < 0.10
      - ≥ 3 symbols primary window support this candidate

    H012 → always OBSERVATION_ONLY.
    Secondary window (150d) results are never used for promotion.
    """
    hid = candidate.get("hypothesis_id", "")

    # Hard lock: H012 or any observation-only scope
    if (
        candidate.get("allowed_scope") == OBSERVATION_ONLY_SCOPE
        or hid not in REVIEW_ELIGIBLE
    ):
        return STATUS_OBS_ONLY

    valid_primary = [
        wr for wr in window_results
        if wr.get("status") == "OK" and wr.get("window_days") == PRIMARY_WINDOW
    ]
    if not valid_primary:
        return STATUS_DATA_INSUF

    if not pit_passed or has_leakage:
        return STATUS_REJECTED

    roi_ok = all(wr.get("roi_annualized", 0) > 0 for wr in valid_primary)
    sharpe_ok = all(wr.get("sharpe_annualized", 0) > 0 for wr in valid_primary)
    perm_ok = any(wr.get("primary_raw_p_value", 1.0) < 0.05 for wr in valid_primary)
    bh_ok = any(wr.get("primary_bh_fdr_pass", False) for wr in valid_primary)
    replication_ok = primary_cross_symbol_count >= 3
    human_review = candidate.get("human_review_required", False)

    if roi_ok and sharpe_ok and perm_ok and bh_ok and replication_ok and human_review:
        return STATUS_REVIEW

    return STATUS_REJECTED


# ---------------------------------------------------------------------------
# Candidate-level aggregate diagnostics
# ---------------------------------------------------------------------------
def compute_candidate_diagnostics(
    hid: str,
    candidates: list[dict],
    symbols: list[str],
    raw_results: dict[str, dict[str, list[dict]]],
    final_statuses: dict[str, dict[str, str]],
) -> dict[str, Any]:
    cand = next((c for c in candidates if c["hypothesis_id"] == hid), None)
    if not cand:
        return {}

    symbols_tested = []
    symbols_with_signal = []
    primary_signal_counts = []
    secondary_signal_counts = []
    primary_rois = []
    primary_sharpes = []
    primary_perm_pass = 0
    primary_bh_pass = 0
    review_candidate_symbols = []

    for sym in symbols:
        windows = raw_results.get(sym, {}).get(hid, [])
        if not windows:
            continue
        symbols_tested.append(sym)
        primary_ws = [w for w in windows if w.get("window_days") == PRIMARY_WINDOW]
        secondary_ws = [w for w in windows if w.get("window_days") == SECONDARY_WINDOW]

        p_ok = [w for w in primary_ws if w.get("status") == "OK"]
        s_ok = [w for w in secondary_ws if w.get("status") == "OK"]

        if p_ok:
            symbols_with_signal.append(sym)
            primary_signal_counts.extend([w.get("n_signals", 0) for w in p_ok])
            primary_rois.extend([w.get("roi_annualized", 0) for w in p_ok])
            primary_sharpes.extend([w.get("sharpe_annualized", 0) for w in p_ok])
            if any(w.get("primary_raw_p_value", 1.0) < 0.05 for w in p_ok):
                primary_perm_pass += 1
            if any(w.get("primary_bh_fdr_pass", False) for w in p_ok):
                primary_bh_pass += 1

        secondary_signal_counts.extend([w.get("n_signals", 0) for w in s_ok])

        if final_statuses.get(sym, {}).get(hid) == STATUS_REVIEW:
            review_candidate_symbols.append(sym)

    n_primary = len(primary_rois)

    # Determine final candidate-level status
    obs_only = cand.get("allowed_scope") == OBSERVATION_ONLY_SCOPE or hid not in REVIEW_ELIGIBLE
    if obs_only:
        final_status = STATUS_OBS_ONLY
    elif len(symbols_tested) < MIN_SYMBOLS_REQUIRED:
        final_status = STATUS_DATA_INSUF
    elif review_candidate_symbols:
        final_status = STATUS_REVIEW
    elif not symbols_with_signal:
        final_status = STATUS_DATA_INSUF
    else:
        final_status = STATUS_REJECTED

    return {
        "hypothesis_id": hid,
        "symbols_tested": symbols_tested,
        "symbols_with_signal": symbols_with_signal,
        "primary_signal_count": sum(primary_signal_counts),
        "secondary_signal_count": sum(secondary_signal_counts),
        "avg_primary_roi": round(sum(primary_rois) / max(n_primary, 1), 6),
        "avg_primary_sharpe": round(sum(primary_sharpes) / max(n_primary, 1), 4),
        "primary_permutation_pass_count": primary_perm_pass,
        "primary_bh_fdr_pass_count": primary_bh_pass,
        "review_candidate_symbols": review_candidate_symbols,
        "final_status": final_status,
    }


# ---------------------------------------------------------------------------
# Anti-overfitting report
# ---------------------------------------------------------------------------
def build_expanded_anti_overfitting_report(
    candidates: list[dict],
    symbols: list[str],
    all_tests: list[dict],
    primary_corrected: list[dict],
    diagnostic_corrected: list[dict],
    final_statuses: dict[str, dict[str, str]],
    candidate_diagnostics: list[dict],
    as_of_date: str,
    primary_window: int,
    secondary_window: int,
) -> str:
    primary_ok = [t for t in primary_corrected if t.get("status") == "OK"]
    primary_bh_pass = sum(1 for t in primary_ok if t.get("bh_fdr_pass", False))
    diag_ok = [t for t in diagnostic_corrected if t.get("status") == "OK"]
    diag_bh_pass = sum(1 for t in diag_ok if t.get("bh_fdr_pass", False))
    total_primary_tests = len(primary_ok)
    total_diag_tests = len(diag_ok)

    obs_only_cands = [c for c in candidates if c.get("allowed_scope") == OBSERVATION_ONLY_SCOPE]
    promotable = [c for c in candidates if c.get("allowed_scope") != OBSERVATION_ONLY_SCOPE]

    lines = [
        "# P3-13 Expanded Universe Validation — Anti-Overfitting Report",
        "",
        f"> As-of date: {as_of_date}  |  Generated: {datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')}",
        f"> Symbols evaluated: {len(symbols)}  |  Primary window: {primary_window}d  |  Secondary window: {secondary_window}d",
        "",
        "---",
        "",
        "## 1. Why Expanded Universe Reduces False Discovery",
        "",
        "- P3-11 tested only **8 symbols**, yielding very low statistical power.",
        "  With n=8, a single spurious positive result is sufficient to create",
        "  a false `REVIEW_CANDIDATE`. This expansion to up to 50 symbols substantially",
        "  increases the replication requirement.",
        "- The cross-symbol replication threshold is raised from ≥2 (P3-11) to **≥3 symbols**.",
        "  A candidate must demonstrate positive primary-window metrics on at least",
        "  3 independent symbols before reaching `REVIEW_CANDIDATE`.",
        "- Diverse symbols include different sectors, market caps, and liquidity profiles,",
        "  reducing the likelihood that a single factor (e.g., Taiwan tech cycle) drives",
        "  spurious results across all symbols.",
        "",
        "---",
        "",
        "## 2. Why Primary and Secondary Windows Are Separated",
        "",
        f"- **Primary window ({primary_window}d)**: Contains more data, reducing estimation noise.",
        "  Only primary window results can trigger `REVIEW_CANDIDATE`. This prevents",
        "  a lucky short-window result from creating a false positive.",
        f"- **Secondary window ({secondary_window}d)**: Diagnostic only. Results are logged but",
        "  `eligible_for_review = False` is enforced unconditionally.",
        "  If primary shows edge but secondary does not, this is informative about",
        "  how recently the signal appeared.",
        "  If secondary shows edge but primary does not, this is suspicious (may indicate",
        "  a recent data artefact or look-ahead bias).",
        "- Window roles are tagged in every result object: `window_role = primary | secondary`.",
        "",
        "---",
        "",
        "## 3. Why H012 Remains Observation-Only",
        "",
        "- `STOCK_H012_RSI_REVERSION_PROBE` was created by observing positive ROI on",
        "  symbol 2317 in P3-09 batch diagnostics (post-hoc discovery).",
        "- Post-hoc discoveries have inherently inflated Type I error rates —",
        "  even with permutation testing, the null hypothesis was never pre-specified",
        "  before seeing the data.",
        "- `allowed_scope = exploratory_observation_only` and `promotion_allowed = false`",
        "  are permanent policy fields set in P3-10.",
        "- In this pipeline, H012 status is **hard-locked to `OBSERVATION_ONLY`**",
        "  regardless of any metrics: even p=0.001, ROI=+100% would not change this.",
        "",
        "---",
        "",
        "## 4. Multiple Testing Correction",
        "",
        f"- **Total primary (500d) window tests: {total_primary_tests}**",
        f"- **Total diagnostic (all windows) tests: {total_diag_tests}**",
        f"- BH-FDR alpha: **{BH_FDR_ALPHA}**",
        "",
        "### A. Primary BH-FDR (used for REVIEW_CANDIDATE decisions)",
        f"- Tests: {total_primary_tests}",
        f"- Passing (q < {BH_FDR_ALPHA}): **{primary_bh_pass}**",
        "",
        "### B. Diagnostic BH-FDR (observation only, not used for promotion)",
        f"- Tests: {total_diag_tests}",
        f"- Passing (q < {BH_FDR_ALPHA}): **{diag_bh_pass}**",
        "",
        "---",
        "",
        "## 5. BH-FDR Results",
        "",
        "### Primary BH-FDR Passing Tests",
    ]

    primary_passes = [t for t in primary_ok if t.get("bh_fdr_pass", False)]
    if not primary_passes:
        lines.append("**No primary tests passed BH-FDR correction** (q < 0.10).")
    else:
        for t in primary_passes:
            lines.append(
                f"  - {t.get('symbol','?')} × {t.get('hypothesis_id','?')} "
                f"× {t.get('window_days','?')}d  "
                f"p={t.get('raw_p_value','?')}  q={t.get('bh_fdr_q_value','?')}"
            )

    lines += ["", "### Diagnostic BH-FDR Passing Tests"]
    diag_passes = [t for t in diag_ok if t.get("bh_fdr_pass", False)]
    if not diag_passes:
        lines.append("**No diagnostic tests passed BH-FDR correction** (q < 0.10).")
    else:
        for t in diag_passes[:20]:  # cap display at 20
            lines.append(
                f"  - {t.get('symbol','?')} × {t.get('hypothesis_id','?')} "
                f"× {t.get('window_days','?')}d  "
                f"p={t.get('raw_p_value','?')}  q={t.get('bh_fdr_q_value','?')}"
            )
        if len(diag_passes) > 20:
            lines.append(f"  ... and {len(diag_passes) - 20} more")

    lines += [
        "",
        "---",
        "",
        "## 6. Candidate-Level Diagnostics",
        "",
    ]
    for cd in candidate_diagnostics:
        hid = cd["hypothesis_id"]
        lines += [
            f"### {hid}",
            f"- Symbols tested: {len(cd['symbols_tested'])}",
            f"- Symbols with primary signal: {len(cd['symbols_with_signal'])}",
            f"- Primary signal count (total): {cd['primary_signal_count']}",
            f"- Secondary signal count (total): {cd['secondary_signal_count']}",
            f"- Avg primary ROI: {cd['avg_primary_roi']:+.4f}",
            f"- Avg primary Sharpe: {cd['avg_primary_sharpe']:+.4f}",
            f"- Primary permutation pass count: {cd['primary_permutation_pass_count']}",
            f"- Primary BH-FDR pass count: {cd['primary_bh_fdr_pass_count']}",
            f"- REVIEW_CANDIDATE symbols: {cd['review_candidate_symbols']}",
            f"- **Final status: `{cd['final_status']}`**",
            "",
        ]

    lines += [
        "---",
        "",
        "## 7. Limitations",
        "",
        "- **Taiwan market specificity**: All data is from TWS/TSE.",
        "  Results may not generalise to other markets.",
        "- **Survivorship bias**: Symbols in the DB may over-represent survivors.",
        "- **One market regime**: 500 trading days ≈ 2 years. Results reflect",
        "  a single macro environment.",
        "- **OOS sample size**: 20% OOS split; small signal counts inflate variance.",
        "- **H009 forward_days=10**: Non-overlapping OOS periods are fewer,",
        "  potentially inflating Sharpe estimates.",
        "- **No independent holdout set**: There is no completely untouched test set.",
        "",
        "---",
        "",
        "## 8. No Production Write Confirmation",
        "",
        "- ❌ No production strategy created or modified",
        "- ❌ No trade execution triggered",
        "- ❌ No auto-promotion performed",
        "- ❌ No threshold changed",
        "- ❌ No new hypothesis added (H013+ not allowed)",
        "- ✅ All `promotion_allowed = false`",
        "- ✅ `human_review_required = true` for all candidates",
        "- ✅ All outputs are research artifacts only",
        "- ✅ `REVIEW_CANDIDATE` requires human review before any further action",
        "",
    ]
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Main pipeline
# ---------------------------------------------------------------------------
def run_expanded_pipeline(args: argparse.Namespace) -> dict[str, Any]:
    ts_start = datetime.now(timezone.utc)
    as_of_date = getattr(args, "as_of_date", None) or ts_start.strftime("%Y-%m-%d")
    min_rows = getattr(args, "min_rows", DEFAULT_MIN_ROWS)
    max_symbols = getattr(args, "max_symbols", DEFAULT_MAX_SYMBOLS)
    primary_window = getattr(args, "primary_window", PRIMARY_WINDOW)
    secondary_window = getattr(args, "secondary_window", SECONDARY_WINDOW)
    n_perms = getattr(args, "permutations", DEFAULT_N_PERMS)
    dry_run = getattr(args, "dry_run", False)

    registry_path = Path(getattr(args, "registry", DEFAULT_REGISTRY))
    if not registry_path.is_absolute():
        registry_path = ROOT / registry_path

    batch_windows = [primary_window, secondary_window]

    print("\n" + "=" * 72)
    print("  GBGF Expanded Universe Validation — P3-13")
    print(f"  {ts_start.isoformat()}")
    print(f"  as_of_date={as_of_date}  min_rows={min_rows}  max_symbols={max_symbols}")
    print(f"  primary_window={primary_window}d  secondary_window={secondary_window}d  perms={n_perms}")
    print(f"  registry={registry_path.name}")
    print(f"  {'[DRY RUN] ' if dry_run else ''}⚠️  REAL DATA — READ-ONLY — NOT TRADING ADVICE")
    print("=" * 72 + "\n")

    # ── Step 0: Load & guard-check registry ───────────────────────────────────
    print("[0/10] Loading v3 candidate registry & running refinement guard...")
    if not registry_path.exists():
        print(f"ERROR: registry not found at {registry_path}")
        return {
            "final_classification": "EXPANDED_UNIVERSE_BLOCKED",
            "reason": f"registry not found: {registry_path}",
        }

    registry = json.loads(registry_path.read_text())
    all_candidates = registry.get("hypotheses", [])

    # Only run approved candidates
    candidates = [
        c for c in all_candidates
        if c.get("hypothesis_id") in APPROVED_CANDIDATES
    ]

    guard_results = validate_v3_registry(registry)
    guard_failures = [r for r in guard_results if not r.passed]
    if guard_failures:
        print("  ❌ GUARD FAILED — validation blocked:")
        for r in guard_failures:
            for v in r.violations:
                print(f"     [{v.rule}] {v.candidate_id}: {v.detail}")
        return {
            "final_classification": "EXPANDED_UNIVERSE_BLOCKED",
            "guard_failures": [
                {
                    "candidate_id": r.candidate_id,
                    "violations": [{"rule": v.rule, "detail": v.detail} for v in r.violations],
                }
                for r in guard_failures
            ],
        }
    print(f"  ✅ Guard PASS — {len(candidates)} approved candidates")

    promotion_eligible = [c for c in candidates if c.get("allowed_scope") != OBSERVATION_ONLY_SCOPE]
    observation_only = [c for c in candidates if c.get("allowed_scope") == OBSERVATION_ONLY_SCOPE]
    print(f"  Review-eligible: {[c['hypothesis_id'] for c in promotion_eligible]}")
    print(f"  Observation-only: {[c['hypothesis_id'] for c in observation_only]}")

    # ── Step 1: Select expanded universe ───────────────────────────────────────
    print(f"\n[1/10] Selecting expanded universe (min_rows={min_rows}, max_symbols={max_symbols})...")
    universe = select_expanded_universe(
        as_of_date=as_of_date,
        min_rows=min_rows,
        max_symbols=max_symbols,
        db_path=DB_PATH,
    )
    stock_symbols = universe["stock_symbols"]
    etf_symbols = universe["etf_symbols"]
    all_symbols = universe["all_symbols"]

    print(f"  Stock-like symbols: {len(stock_symbols)}")
    print(f"  ETF-like symbols:   {len(etf_symbols)}")
    print(f"  Total selected:     {len(all_symbols)}")
    print(f"  Universe stats:     {universe['stats']}")

    if len(stock_symbols) < MIN_SYMBOLS_REQUIRED:
        msg = (
            f"DATA_INSUFFICIENT: only {len(stock_symbols)} stock-like symbols "
            f"(need ≥{MIN_SYMBOLS_REQUIRED})"
        )
        print(f"  ⚠️  {msg}")
        return {
            "final_classification": "EXPANDED_UNIVERSE_DATA_INSUFFICIENT",
            "reason": msg,
            "symbols_found": len(stock_symbols),
            "min_required": MIN_SYMBOLS_REQUIRED,
        }

    # Primary validation symbols = stock-like; ETFs in separate bucket
    primary_symbols = stock_symbols
    print(f"  Primary symbols (stock-like): {primary_symbols[:10]}{'...' if len(primary_symbols) > 10 else ''}")

    # Output directory
    date_str = as_of_date.replace("-", "")
    out_dir = OUTPUT_BASE / date_str
    out_dir.mkdir(parents=True, exist_ok=True)

    # ── Step 2: Load symbol rows & PIT checks ─────────────────────────────────
    print("\n[2/10] Loading symbol rows & running PIT checks...")
    pit_guard = PointInTimeGuard(as_of_date=as_of_date, forward_days=10)
    all_rows: dict[str, Any] = {}
    all_pit: dict[str, Any] = {}
    for sym in primary_symbols:
        domain = StockRealDomain(
            symbol=sym,
            as_of_date=as_of_date,
            window_days=max(primary_window, secondary_window) + 50,
            db_path=DB_PATH,
            min_rows=min_rows,
        )
        rows = domain._load_rows()
        if rows == DATA_INSUFFICIENT or not rows:
            all_rows[sym] = None
            all_pit[sym] = None
        else:
            all_rows[sym] = rows
            pit_result = pit_guard.check(rows, split_type="time_based")
            all_pit[sym] = pit_result

    loaded_count = sum(1 for v in all_rows.values() if v is not None)
    print(f"  Loaded rows for {loaded_count}/{len(primary_symbols)} symbols")

    # ── Step 3: Run window-level OOS tests ─────────────────────────────────────
    print("\n[3/10] Running expanded window-level OOS + permutation tests...")
    all_tests: list[dict] = []
    raw_results: dict[str, dict[str, list[dict]]] = {}

    for sym in primary_symbols:
        raw_results[sym] = {}
        rows = all_rows.get(sym)
        pit_result = all_pit.get(sym)

        for cand in candidates:
            hid = cand["hypothesis_id"]
            fwd = cand.get("forward_days", 5)
            sym_scope = cand.get("symbol_scope", None)

            # H012: only run on its symbol_scope
            if sym_scope and sym not in sym_scope:
                raw_results[sym][hid] = [
                    {
                        "status": DATA_INSUFFICIENT,
                        "window_days": w,
                        "symbol": sym,
                        "hypothesis_id": hid,
                        "error": "symbol_not_in_scope",
                        "pit_passed": False,
                        "pit_leakage": False,
                        "p_value": 1.0,
                        "primary_raw_p_value": 1.0,
                        "primary_bh_fdr_q_value": 1.0,
                        "primary_bh_fdr_pass": False,
                        "diagnostic_bh_fdr_q_value": 1.0,
                        "diagnostic_bh_fdr_pass": False,
                    }
                    for w in batch_windows
                ]
                continue

            if not rows:
                raw_results[sym][hid] = [
                    {
                        "status": DATA_INSUFFICIENT,
                        "window_days": w,
                        "symbol": sym,
                        "hypothesis_id": hid,
                        "pit_passed": False,
                        "pit_leakage": False,
                        "p_value": 1.0,
                        "primary_raw_p_value": 1.0,
                        "primary_bh_fdr_q_value": 1.0,
                        "primary_bh_fdr_pass": False,
                        "diagnostic_bh_fdr_q_value": 1.0,
                        "diagnostic_bh_fdr_pass": False,
                    }
                    for w in batch_windows
                ]
                continue

            hyp_windows = []
            extra_ctx = {"symbol": sym, "symbol_scope": cand.get("symbol_scope", [sym])}
            for w in batch_windows:
                seed = abs(hash(f"p3-13:{sym}:{hid}:{w}:{as_of_date}")) % (2 ** 31)
                wr = eval_window(hid, rows, w, fwd, n_perms, seed, extra_context=extra_ctx)
                wr["symbol"] = sym
                wr["hypothesis_id"] = hid
                wr["window_days"] = w
                wr["pit_passed"] = pit_result.passed if pit_result else False
                wr["pit_leakage"] = pit_result.has_leakage if pit_result else False
                hyp_windows.append(wr)
                all_tests.append(wr)

                if wr.get("status") == "OK":
                    print(
                        f"  {sym} × {hid[:22]} × {w}d: "
                        f"sharpe={wr['sharpe_annualized']:+.3f} "
                        f"roi={wr['roi_annualized']:+.4f} "
                        f"p={wr['p_value']:.3f}"
                    )
                else:
                    print(
                        f"  {sym} × {hid[:22]} × {w}d: {wr.get('status')} "
                        f"({wr.get('error', '')})"
                    )

            raw_results[sym][hid] = hyp_windows

    # ── Step 4: Two-tier BH-FDR correction ────────────────────────────────────
    ok_tests = [t for t in all_tests if t.get("status") == "OK"]
    print(f"\n[4/10] Two-tier BH-FDR correction over {len(ok_tests)} OK tests...")

    primary_corrected, diagnostic_corrected = apply_two_tier_bh_fdr(ok_tests)

    primary_bh_pass_count = sum(1 for t in primary_corrected if t.get("bh_fdr_pass", False))
    diag_bh_pass_count = sum(1 for t in diagnostic_corrected if t.get("bh_fdr_pass", False))
    print(f"  Primary BH-FDR (500d) passing: {primary_bh_pass_count}")
    print(f"  Diagnostic BH-FDR (all) passing: {diag_bh_pass_count}")

    # Build lookup maps by (symbol, hypothesis_id, window_days)
    primary_map = {
        (t["symbol"], t["hypothesis_id"], t["window_days"]): t
        for t in primary_corrected
    }
    diagnostic_map = {
        (t["symbol"], t["hypothesis_id"], t["window_days"]): t
        for t in diagnostic_corrected
    }

    # Merge BH fields back into raw_results
    for sym in primary_symbols:
        for cand in candidates:
            hid = cand["hypothesis_id"]
            for i, wr in enumerate(raw_results[sym][hid]):
                if wr.get("status") == "OK":
                    raw_results[sym][hid][i] = _merge_bh_fields(wr, primary_map, diagnostic_map)
                    raw_results[sym][hid][i] = annotate_window_role(raw_results[sym][hid][i])
                else:
                    wr.setdefault("primary_raw_p_value", 1.0)
                    wr.setdefault("primary_bh_fdr_q_value", 1.0)
                    wr.setdefault("primary_bh_fdr_pass", False)
                    wr.setdefault("diagnostic_bh_fdr_q_value", 1.0)
                    wr.setdefault("diagnostic_bh_fdr_pass", False)
                    wr["window_role"] = "primary" if wr.get("window_days") == primary_window else "secondary"
                    wr["eligible_for_review"] = False

    # ── Step 5: Cross-symbol primary-window counts ────────────────────────────
    print("\n[5/10] Computing cross-symbol primary-window replication counts...")
    hyp_primary_cross_symbol: dict[str, int] = {}
    for cand in candidates:
        hid = cand["hypothesis_id"]
        count = sum(
            1 for sym in primary_symbols
            if any(
                wr.get("status") == "OK"
                and wr.get("window_days") == primary_window
                and wr.get("roi_annualized", 0) > 0
                for wr in raw_results[sym][hid]
            )
        )
        hyp_primary_cross_symbol[hid] = count
        print(f"  {hid}: {count} symbols with positive primary ROI")

    # ── Step 6: Promotion decisions ────────────────────────────────────────────
    print("\n[6/10] Expanded promotion decisions...")
    final_statuses: dict[str, dict[str, str]] = {}
    review_candidates: list[dict] = []
    rejected_list: list[dict] = []
    di_list: list[dict] = []
    obs_only_results: list[dict] = []

    for sym in primary_symbols:
        final_statuses[sym] = {}
        for cand in candidates:
            hid = cand["hypothesis_id"]
            windows = raw_results[sym][hid]
            valid_windows = [w for w in windows if w.get("status") == "OK"]

            pit_passed = any(w.get("pit_passed", False) for w in windows)
            has_leakage = any(w.get("pit_leakage", False) for w in windows)

            status = decide_expanded_status(
                candidate=cand,
                window_results=valid_windows,
                pit_passed=pit_passed,
                has_leakage=has_leakage,
                primary_cross_symbol_count=hyp_primary_cross_symbol.get(hid, 0),
            )
            final_statuses[sym][hid] = status

            entry = {"symbol": sym, "hypothesis_id": hid, "status": status}
            if status == STATUS_REVIEW:
                review_candidates.append(entry)
            elif status == STATUS_DATA_INSUF:
                di_list.append(entry)
            elif status == STATUS_OBS_ONLY:
                obs_only_results.append(entry)
            else:
                rejected_list.append(entry)

            icon = {
                STATUS_REVIEW: "🔬",
                STATUS_REJECTED: "❌",
                STATUS_DATA_INSUF: "⚠️",
                STATUS_OBS_ONLY: "👁️",
            }.get(status, "?")
            print(f"  {icon} {sym} × {hid[:30]}: {status}")

    # ── Step 7: Candidate-level diagnostics ────────────────────────────────────
    print("\n[7/10] Computing candidate-level diagnostics...")
    candidate_diagnostics = []
    for cand in candidates:
        diag = compute_candidate_diagnostics(
            hid=cand["hypothesis_id"],
            candidates=candidates,
            symbols=primary_symbols,
            raw_results=raw_results,
            final_statuses=final_statuses,
        )
        candidate_diagnostics.append(diag)
        print(
            f"  {diag['hypothesis_id']}: "
            f"final_status={diag['final_status']} "
            f"primary_signals={diag['primary_signal_count']} "
            f"avg_roi={diag['avg_primary_roi']:+.4f}"
        )

    # ── Step 8: Write per-symbol × candidate outputs ───────────────────────────
    print("\n[8/10] Writing per-symbol × candidate outputs...")
    ts = ts_start.isoformat()

    if not dry_run:
        for sym in primary_symbols:
            for cand in candidates:
                hid = cand["hypothesis_id"]
                cand_dir = out_dir / sym / hid.lower()
                cand_dir.mkdir(parents=True, exist_ok=True)

                windows = raw_results[sym][hid]
                status = final_statuses[sym][hid]
                valid = [w for w in windows if w.get("status") == "OK"]
                primary_valid = [w for w in valid if w.get("window_days") == primary_window]
                secondary_valid = [w for w in valid if w.get("window_days") == secondary_window]

                # gate_result.json
                (cand_dir / "gate_result.json").write_text(
                    json.dumps(
                        {
                            "hypothesis_id": hid,
                            "base_hypothesis_id": cand.get("base_hypothesis_id"),
                            "symbol": sym,
                            "as_of_date": as_of_date,
                            "status": status,
                            "allowed_scope": cand.get("allowed_scope"),
                            "promotion_allowed": cand.get("promotion_allowed", False),
                            "primary_window": primary_window,
                            "secondary_window": secondary_window,
                            "window_results": windows,
                            "run_ts": ts,
                            "pipeline_version": "P3-13",
                        },
                        indent=2,
                    )
                )

                # validation_metrics.json
                def _avg(lst: list, key: str) -> float:
                    vals = [v.get(key, 0) for v in lst]
                    return round(sum(vals) / max(len(vals), 1), 4)

                (cand_dir / "validation_metrics.json").write_text(
                    json.dumps(
                        {
                            "hypothesis_id": hid,
                            "symbol": sym,
                            "as_of_date": as_of_date,
                            "primary_window": primary_window,
                            "secondary_window": secondary_window,
                            "primary_ok": len(primary_valid),
                            "secondary_ok": len(secondary_valid),
                            "avg_primary_sharpe": _avg(primary_valid, "sharpe_annualized"),
                            "avg_primary_roi": _avg(primary_valid, "roi_annualized"),
                            "avg_secondary_sharpe": _avg(secondary_valid, "sharpe_annualized"),
                            "avg_secondary_roi": _avg(secondary_valid, "roi_annualized"),
                            "primary_bh_fdr_pass_count": sum(
                                1 for w in windows if w.get("primary_bh_fdr_pass", False)
                            ),
                            "diagnostic_bh_fdr_pass_count": sum(
                                1 for w in windows if w.get("diagnostic_bh_fdr_pass", False)
                            ),
                            "status": status,
                            "run_ts": ts,
                        },
                        indent=2,
                    )
                )

                # data_lineage.json
                (cand_dir / "data_lineage.json").write_text(
                    json.dumps(
                        {
                            "hypothesis_id": hid,
                            "base_hypothesis_id": cand.get("base_hypothesis_id"),
                            "symbol": sym,
                            "as_of_date": as_of_date,
                            "db_source": str(DB_PATH),
                            "pit_enforced": True,
                            "random_split_used": False,
                            "time_based_split": True,
                            "primary_window": primary_window,
                            "secondary_window": secondary_window,
                            "pipeline_version": "P3-13",
                            "run_ts": ts,
                        },
                        indent=2,
                    )
                )

                # reproducibility_pack.json
                seed_val = abs(hash(f"p3-13:{sym}:{hid}:{as_of_date}")) % (2 ** 31)
                (cand_dir / "reproducibility_pack.json").write_text(
                    json.dumps(
                        {
                            "hypothesis_id": hid,
                            "symbol": sym,
                            "as_of_date": as_of_date,
                            "pipeline_version": "P3-13",
                            "seed": seed_val,
                            "n_permutations": n_perms,
                            "bh_fdr_alpha": BH_FDR_ALPHA,
                            "tx_cost_bps": TX_COST_BPS,
                            "primary_window": primary_window,
                            "secondary_window": secondary_window,
                            "safety_confirmations": {
                                "no_production_write": True,
                                "no_trade_execution": True,
                                "not_trading_advice": True,
                                "real_data_read_only": True,
                                "primary_bh_fdr_corrected": True,
                                "diagnostic_bh_fdr_corrected": True,
                                "pit_guard_enforced": True,
                                "no_random_split": True,
                                "no_auto_promotion": True,
                                "refinement_guard_passed": True,
                            },
                            "run_ts": ts,
                        },
                        indent=2,
                    )
                )

        print(f"  ✓ Per-symbol outputs written to {out_dir}/")

    # ── Step 9: Summary files ──────────────────────────────────────────────────
    print("\n[9/10] Writing expanded validation summary files...")

    # Determine final classification
    if review_candidates:
        final_class = "EXPANDED_UNIVERSE_REVIEW_CANDIDATE_FOUND"
    elif len(primary_symbols) < MIN_SYMBOLS_REQUIRED:
        final_class = "EXPANDED_UNIVERSE_DATA_INSUFFICIENT"
    else:
        final_class = "EXPANDED_UNIVERSE_NO_EDGE_FOUND"

    summary = {
        "pipeline_version": "P3-13",
        "run_ts": ts,
        "as_of_date": as_of_date,
        "primary_window": primary_window,
        "secondary_window": secondary_window,
        "symbols_evaluated": primary_symbols,
        "etf_symbols_skipped": etf_symbols,
        "symbol_count": len(primary_symbols),
        "candidates_evaluated": [c["hypothesis_id"] for c in candidates],
        "review_eligible_candidates": [c["hypothesis_id"] for c in promotion_eligible],
        "observation_only_candidates": [c["hypothesis_id"] for c in observation_only],
        "universe_stats": universe["stats"],
        "total_tests": len(all_tests),
        "ok_tests": len(ok_tests),
        "bh_fdr_alpha": BH_FDR_ALPHA,
        "primary_bh_fdr_pass_count": primary_bh_pass_count,
        "diagnostic_bh_fdr_pass_count": diag_bh_pass_count,
        "review_candidates": review_candidates,
        "rejected": rejected_list,
        "data_insufficient": di_list,
        "observation_only_results": obs_only_results,
        "candidate_diagnostics": candidate_diagnostics,
        "final_classification": final_class,
        "safety_confirmations": {
            "no_production_write": True,
            "no_trade_execution": True,
            "not_trading_advice": True,
            "real_data_read_only": True,
            "primary_bh_fdr_corrected": True,
            "diagnostic_bh_fdr_corrected": True,
            "pit_guard_enforced": True,
            "no_random_split": True,
            "no_auto_promotion": True,
            "refinement_guard_passed": True,
            "h012_observation_only": True,
            "secondary_window_not_used_for_promotion": True,
        },
    }

    if not dry_run:
        # expanded_validation_summary.json
        (out_dir / "expanded_validation_summary.json").write_text(
            json.dumps(summary, indent=2)
        )

        # expanded_validation_summary.md
        md_lines = [
            "# P3-13 Expanded Universe Validation Summary",
            "",
            f"> Pipeline: P3-13  |  as_of_date: {as_of_date}  |  Run: {ts}",
            f"> Symbols: {len(primary_symbols)}  |  Primary: {primary_window}d  |  Secondary: {secondary_window}d",
            "",
            f"**Final Classification: `{final_class}`**",
            "",
            "## Candidate-Level Results",
            "",
        ]
        for cd in candidate_diagnostics:
            md_lines += [
                f"### {cd['hypothesis_id']}",
                f"- Final status: `{cd['final_status']}`",
                f"- Symbols tested: {len(cd['symbols_tested'])}",
                f"- Symbols with primary signal: {len(cd['symbols_with_signal'])}",
                f"- Avg primary ROI: {cd['avg_primary_roi']:+.4f}",
                f"- Avg primary Sharpe: {cd['avg_primary_sharpe']:+.4f}",
                f"- Primary BH-FDR pass count: {cd['primary_bh_fdr_pass_count']}",
                f"- REVIEW_CANDIDATE symbols: {cd['review_candidate_symbols']}",
                "",
            ]

        md_lines += [
            "## Symbol × Candidate Matrix",
            "",
            "| Candidate | Symbol | Status | Primary ROI | Primary Sharpe | Pri BH-FDR |",
            "|---|---|---|---|---|---|",
        ]
        for sym in primary_symbols:
            for cand in candidates:
                hid = cand["hypothesis_id"]
                status = final_statuses[sym][hid]
                p_valid = [
                    w for w in raw_results[sym][hid]
                    if w.get("status") == "OK" and w.get("window_days") == primary_window
                ]
                p_roi = round(sum(w.get("roi_annualized", 0) for w in p_valid) / max(len(p_valid), 1), 4) if p_valid else "N/A"
                p_sh = round(sum(w.get("sharpe_annualized", 0) for w in p_valid) / max(len(p_valid), 1), 4) if p_valid else "N/A"
                bh_c = sum(1 for w in raw_results[sym][hid] if w.get("primary_bh_fdr_pass", False))
                md_lines.append(f"| {hid} | {sym} | `{status}` | {p_roi} | {p_sh} | {bh_c} |")

        md_lines += ["", "---", "See `expanded_anti_overfitting_report.md` for full analysis."]
        (out_dir / "expanded_validation_summary.md").write_text("\n".join(md_lines))

        # expanded_bh_fdr_summary.json
        bh_summary = {
            "pipeline_version": "P3-13",
            "as_of_date": as_of_date,
            "run_ts": ts,
            "primary_bh_fdr": {
                "window": primary_window,
                "total_tests": len(primary_corrected),
                "alpha": BH_FDR_ALPHA,
                "pass_count": primary_bh_pass_count,
                "results": [
                    {
                        "symbol": t.get("symbol"),
                        "hypothesis_id": t.get("hypothesis_id"),
                        "window_days": t.get("window_days"),
                        "raw_p_value": t.get("raw_p_value"),
                        "bh_fdr_q_value": t.get("bh_fdr_q_value"),
                        "bh_fdr_pass": t.get("bh_fdr_pass"),
                    }
                    for t in primary_corrected
                    if t.get("status") == "OK"
                ],
            },
            "diagnostic_bh_fdr": {
                "windows": [primary_window, secondary_window],
                "total_tests": len(diagnostic_corrected),
                "alpha": BH_FDR_ALPHA,
                "pass_count": diag_bh_pass_count,
                "note": "diagnostic only — cannot trigger REVIEW_CANDIDATE",
            },
        }
        (out_dir / "expanded_bh_fdr_summary.json").write_text(
            json.dumps(bh_summary, indent=2)
        )

        # expanded_universe_lineage.json
        lineage = {
            "pipeline_version": "P3-13",
            "as_of_date": as_of_date,
            "run_ts": ts,
            "db_source": str(DB_PATH),
            "registry_source": str(registry_path),
            "min_rows": min_rows,
            "max_symbols": max_symbols,
            "primary_window": primary_window,
            "secondary_window": secondary_window,
            "universe": {
                "stock_symbols": stock_symbols,
                "etf_symbols": etf_symbols,
                "stats": universe["stats"],
            },
            "data_integrity": {
                "pit_enforced": True,
                "random_split_used": False,
                "time_based_split": True,
                "iso_dates_only": True,
                "no_future_data": True,
            },
            "safety_confirmations": summary["safety_confirmations"],
        }
        (out_dir / "expanded_universe_lineage.json").write_text(
            json.dumps(lineage, indent=2)
        )

        print(f"  ✓ expanded_validation_summary.json")
        print(f"  ✓ expanded_validation_summary.md")
        print(f"  ✓ expanded_bh_fdr_summary.json")
        print(f"  ✓ expanded_universe_lineage.json")

    # ── Step 10: Anti-overfitting report ──────────────────────────────────────
    print("\n[10/10] Writing expanded anti-overfitting report...")
    anti_report = build_expanded_anti_overfitting_report(
        candidates=candidates,
        symbols=primary_symbols,
        all_tests=ok_tests,
        primary_corrected=primary_corrected,
        diagnostic_corrected=diagnostic_corrected,
        final_statuses=final_statuses,
        candidate_diagnostics=candidate_diagnostics,
        as_of_date=as_of_date,
        primary_window=primary_window,
        secondary_window=secondary_window,
    )
    if not dry_run:
        (out_dir / "expanded_anti_overfitting_report.md").write_text(anti_report)
        print(f"  ✓ expanded_anti_overfitting_report.md")

    print(f"\n{'=' * 72}")
    print(f"  Final Classification: {final_class}")
    print(f"  Symbols evaluated:    {len(primary_symbols)}")
    print(f"  Review candidates:    {len(review_candidates)}")
    print(f"  Rejected:             {len(rejected_list)}")
    print(f"  Data insufficient:    {len(di_list)}")
    print(f"  Observation-only:     {len(obs_only_results)}")
    print(f"  Primary BH-FDR pass:  {primary_bh_pass_count}")
    print(f"  Diag BH-FDR pass:     {diag_bh_pass_count}")
    print(f"{'=' * 72}\n")

    return summary


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------
def _build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(description="P3-13 Expanded Universe Validation")
    p.add_argument("--registry", default=str(DEFAULT_REGISTRY))
    p.add_argument("--as-of-date", dest="as_of_date", default="2026-05-01")
    p.add_argument("--min-rows", dest="min_rows", type=int, default=DEFAULT_MIN_ROWS)
    p.add_argument("--max-symbols", dest="max_symbols", type=int, default=DEFAULT_MAX_SYMBOLS)
    p.add_argument("--primary-window", dest="primary_window", type=int, default=PRIMARY_WINDOW)
    p.add_argument("--secondary-window", dest="secondary_window", type=int, default=SECONDARY_WINDOW)
    p.add_argument("--permutations", type=int, default=DEFAULT_N_PERMS)
    p.add_argument("--dry-run", dest="dry_run", action="store_true")
    return p


if __name__ == "__main__":
    parser = _build_parser()
    args = parser.parse_args()
    result = run_expanded_pipeline(args)
    sys.exit(0 if result.get("final_classification") != "EXPANDED_UNIVERSE_BLOCKED" else 1)
