#!/usr/bin/env python3
"""
P3-11: V3 Candidate Validation (Controlled)

Runs batch validation for H009–H012 v3 candidates with:
  - Refinement guard pre-check (blocks if any rule fails)
  - PIT-safe feature computation
  - Permutation test (n_permutations)
  - Global BH-FDR correction
  - H012 hard-locked to OBSERVATION_ONLY
  - H009/H010/H011 may reach REVIEW_CANDIDATE (human review gate, no auto-promote)
  - Anti-overfitting report

Usage:
    python3 scripts/run_stock_v3_candidate_validation.py \\
        --registry research/stock_hypothesis_registry_v3_candidates.json \\
        --candidate-mode v3 \\
        --as-of-date 2026-05-01 \\
        --min-rows 300 \\
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
OUTPUT_BASE = ROOT / "outputs" / "stock_validation_v3"

BATCH_WINDOWS = [150, 500]
TX_COST_BPS = 10
BH_FDR_ALPHA = 0.10
DEFAULT_MIN_ROWS = 300
DEFAULT_N_PERMS = 500
DEFAULT_AUTO_SYMBOLS = 8

OBSERVATION_ONLY_SCOPE = "exploratory_observation_only"

# Final status values
STATUS_REVIEW = "REVIEW_CANDIDATE"
STATUS_REJECTED = "REJECTED"
STATUS_DATA_INSUF = "DATA_INSUFFICIENT"
STATUS_OBS_ONLY = "OBSERVATION_ONLY"


# ---------------------------------------------------------------------------
# Symbol selection (copied pattern from P3-07 script)
# ---------------------------------------------------------------------------
def select_symbols(
    as_of_date: str,
    min_rows: int = DEFAULT_MIN_ROWS,
    n_max: int = DEFAULT_AUTO_SYMBOLS,
    db_path: Path = DB_PATH,
    requested_symbols: list[str] | None = None,
) -> list[str]:
    if not db_path.exists():
        return []
    try:
        conn = sqlite3.connect(str(db_path))
        c = conn.cursor()
        if requested_symbols:
            ph = ",".join("?" * len(requested_symbols))
            c.execute(
                f"""
                SELECT stockId, COUNT(*) AS n
                FROM StockQuote
                WHERE stockId IN ({ph})
                  AND date LIKE '20%' AND length(date)=10
                  AND date <= ?
                GROUP BY stockId
                HAVING n >= ?
                ORDER BY n DESC
                """,
                (*requested_symbols, as_of_date, min_rows),
            )
        else:
            c.execute(
                """
                SELECT stockId, COUNT(*) AS n
                FROM StockQuote
                WHERE date LIKE '20%' AND length(date)=10
                  AND date <= ?
                GROUP BY stockId
                HAVING n >= ?
                ORDER BY n DESC
                LIMIT ?
                """,
                (as_of_date, min_rows, n_max),
            )
        rows = c.fetchall()
        conn.close()
        return [r[0] for r in rows]
    except sqlite3.Error:
        return []


# ---------------------------------------------------------------------------
# V3 Signal computers
# ---------------------------------------------------------------------------

def compute_h009_signals(
    rows: list[dict], forward: int = 10, extra_context: dict | None = None, **kwargs
) -> list[dict]:
    """H009: Pullback Uptrend 10D Hold (base=H005, forward_days extended to 10)."""
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
                "return_5d": round(r5, 4),
                "return_20d": round(r20, 4),
                "forward_return": round(fwd, 6),
            })
    return signals


def compute_h010_signals(
    rows: list[dict], forward: int = 5, extra_context: dict | None = None, **kwargs
) -> list[dict]:
    """H010: Momentum + Moderate Volume (base=H004, volume_zscore > 0.5 relaxed)."""
    features = compute_features_for_rows(rows, ["return_20d", "volume_zscore_20d"])
    signals = []
    for i, feat in enumerate(features):
        if i + forward >= len(rows):
            break
        r20 = feat.get("return_20d")
        vz = feat.get("volume_zscore_20d")
        if r20 is None or vz is None:
            continue
        if r20 > 0 and vz > 0.5:  # relaxed from 1.0
            fwd = (float(rows[i + forward]["close"]) - float(rows[i]["close"])) / float(rows[i]["close"])
            signals.append({
                "date": rows[i]["date"],
                "signal": 1,
                "vol_zscore": round(vz, 3),
                "forward_return": round(fwd, 6),
            })
    return signals


def compute_h011_signals(
    rows: list[dict], forward: int = 5, extra_context: dict | None = None, **kwargs
) -> list[dict]:
    """H011: Near Breakout Low Volatility (base=H006, close >= 0.98 * 20d high)."""
    features = compute_features_for_rows(rows, ["volatility_20d"])
    signals = []
    for i, feat in enumerate(features):
        if i + forward >= len(rows):
            break
        vol = feat.get("volatility_20d")
        if vol is None:
            continue
        # Rolling p25 of volatility up to i (PIT-safe)
        past_vols = [
            features[j]["volatility_20d"]
            for j in range(i + 1)
            if features[j].get("volatility_20d") is not None
        ]
        if len(past_vols) < 4:
            continue
        p25_val = sorted(past_vols)[max(0, int(len(past_vols) * 0.25) - 1)]
        if vol > p25_val:
            continue
        # Near-breakout: close >= 0.98 * max(high[-20:]) — relaxed from strict > max
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
    """H012: RSI Reversion Symbol-Specific Probe (base=H002, exploratory only)."""
    # Only runs on symbols in candidate's symbol_scope
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


V3_SIGNAL_COMPUTERS: dict[str, Any] = {
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
    signal_fn = V3_SIGNAL_COMPUTERS.get(hid)
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
        return {"status": DATA_INSUFFICIENT, "window_days": window_days,
                "error": "no_signals", "actual_rows": len(use_rows)}

    oos_cutoff = int(len(all_sigs) * 0.80)
    oos = all_sigs[oos_cutoff:]
    if len(oos) < 5:
        return {"status": DATA_INSUFFICIENT, "window_days": window_days,
                "error": "insufficient_oos", "n_oos": len(oos)}

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
# BH-FDR correction
# ---------------------------------------------------------------------------
def bh_fdr_correction(
    tests: list[dict[str, Any]], alpha: float = BH_FDR_ALPHA
) -> list[dict[str, Any]]:
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


# ---------------------------------------------------------------------------
# Promotion decision (v3 — stricter, no REAL_EDGE_CANDIDATE label)
# ---------------------------------------------------------------------------
def decide_v3_status(
    candidate: dict[str, Any],
    window_results: list[dict[str, Any]],
    pit_passed: bool,
    has_leakage: bool,
    cross_symbol_count: int = 1,
    cross_window_count: int = 1,
) -> str:
    """Return one of: REVIEW_CANDIDATE | REJECTED | DATA_INSUFFICIENT | OBSERVATION_ONLY."""
    # Hard lock for observation-only scope
    if candidate.get("allowed_scope") == OBSERVATION_ONLY_SCOPE:
        return STATUS_OBS_ONLY
    if candidate.get("promotion_allowed") is False and \
            candidate.get("allowed_scope") == OBSERVATION_ONLY_SCOPE:
        return STATUS_OBS_ONLY

    valid = [wr for wr in window_results if wr.get("status") == "OK"]
    if not valid:
        return STATUS_DATA_INSUF

    if not pit_passed or has_leakage:
        return STATUS_REJECTED

    roi_ok = all(wr.get("roi_annualized", 0) > 0 for wr in valid)
    sharpe_ok = any(wr.get("sharpe_annualized", 0) > 0 for wr in valid)
    perm_ok = any(wr.get("raw_p_value", 1.0) < 0.05 for wr in valid)
    bh_ok = any(wr.get("bh_fdr_pass", False) for wr in valid)
    replication_ok = cross_symbol_count >= 2 or cross_window_count >= 2
    human_review = candidate.get("human_review_required", False)

    if roi_ok and sharpe_ok and perm_ok and bh_ok and replication_ok and human_review:
        return STATUS_REVIEW

    return STATUS_REJECTED


# ---------------------------------------------------------------------------
# Anti-overfitting report
# ---------------------------------------------------------------------------
def build_anti_overfitting_report(
    candidates: list[dict],
    symbols: list[str],
    all_tests: list[dict],
    bh_corrected: list[dict],
    final_statuses: dict[str, dict[str, str]],  # sym → hid → status
    as_of_date: str,
) -> str:
    total_tests = len([t for t in all_tests if t.get("status") == "OK"])
    bh_pass_count = sum(1 for t in bh_corrected if t.get("bh_fdr_pass", False))
    obs_only = [c for c in candidates if c.get("allowed_scope") == OBSERVATION_ONLY_SCOPE]
    promotable = [c for c in candidates if c.get("allowed_scope") != OBSERVATION_ONLY_SCOPE]

    review_found = []
    for hid, sym_map in {
        hid: {sym: final_statuses[sym][hid] for sym in symbols if hid in final_statuses.get(sym, {})}
        for hid in [c["hypothesis_id"] for c in candidates]
    }.items():
        if any(s == STATUS_REVIEW for s in sym_map.values()):
            review_found.append(hid)

    lines = [
        "# V3 Candidate Validation — Anti-Overfitting Report",
        "",
        f"> As-of date: {as_of_date}  |  Generated: {datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')}",
        "",
        "---",
        "",
        "## 1. Candidates Tested",
        "",
        f"- Total v3 candidates: **{len(candidates)}**",
        f"- Promotion-eligible: **{len(promotable)}** ({', '.join(c['hypothesis_id'] for c in promotable)})",
        f"- Observation-only: **{len(obs_only)}** ({', '.join(c['hypothesis_id'] for c in obs_only)})",
        f"- Symbols evaluated: **{len(symbols)}** ({', '.join(symbols)})",
        "",
        "---",
        "",
        "## 2. Why This Is NOT Auto-Promotion",
        "",
        "- All `promotion_allowed` fields in this registry are set to **`false`**.",
        "  Even if a candidate reaches `REVIEW_CANDIDATE` status, no production",
        "  strategy is created, modified, or activated.",
        "- `REVIEW_CANDIDATE` means: *a human reviewer must evaluate this result*",
        "  before any further action. It does not indicate a confirmed edge.",
        "- The P3-10 refinement guard enforces these rules before any validation runs.",
        "- This pipeline output is logged as a research artifact only.",
        "",
        "---",
        "",
        "## 3. Multiple Testing Correction",
        "",
        f"- Total valid (OK) window tests: **{total_tests}**",
        f"- BH-FDR alpha: **{BH_FDR_ALPHA}**",
        f"- Tests passing BH-FDR (q < {BH_FDR_ALPHA}): **{bh_pass_count}**",
        "- BH-FDR is applied globally across ALL symbol × candidate × window pairs.",
        "- A single passing test after BH-FDR is not sufficient for promotion;",
        "  replication across ≥2 symbols OR ≥2 windows is also required.",
        "",
        "---",
        "",
        "## 4. BH-FDR Results",
        "",
    ]
    if bh_pass_count == 0:
        lines.append("**No tests passed BH-FDR correction** (q < 0.10).")
    else:
        lines.append(f"**{bh_pass_count} test(s) passed BH-FDR correction** (q < 0.10):")
        for t in bh_corrected:
            if t.get("bh_fdr_pass"):
                lines.append(
                    f"  - {t.get('symbol','?')} × {t.get('hypothesis_id','?')} "
                    f"× {t.get('window_days','?')}d  "
                    f"p={t.get('raw_p_value','?')}  q={t.get('bh_fdr_q_value','?')}"
                )
    lines += ["", "---", ""]

    lines += [
        "## 5. Symbol-Level Consistency",
        "",
        "A candidate is only `REVIEW_CANDIDATE` if ROI > 0 across all valid windows",
        "AND replicated on ≥2 symbols or ≥2 windows.",
        "",
    ]
    for cand in candidates:
        hid = cand["hypothesis_id"]
        sym_statuses = {sym: final_statuses.get(sym, {}).get(hid, "?") for sym in symbols}
        lines.append(f"**{hid}**:")
        for sym, st in sym_statuses.items():
            lines.append(f"  - {sym}: `{st}`")
    lines += ["", "---", ""]

    lines += [
        "## 6. H012 — Why Observation-Only",
        "",
        "- `H012_RSI_REVERSION_PROBE` was motivated by observing positive ROI",
        "  on symbol 2317 in P3-09 batch diagnostics.",
        "- This is a **post-hoc discovery** — the hypothesis was created because",
        "  a specific symbol showed positive results, not from prior theory.",
        "- Post-hoc discoveries have high data snooping risk and cannot be promoted.",
        "- `allowed_scope = exploratory_observation_only`",
        "- `promotion_allowed = false` (permanent, regardless of metrics)",
        "- Even if H012 shows p < 0.05 and positive ROI, status remains `OBSERVATION_ONLY`.",
        "",
        "---",
        "",
        "## 7. Limitations",
        "",
        "- **Small universe**: Only 5 symbols with sufficient history.",
        "  Statistical power is limited; cross-symbol replication is hard to achieve.",
        "- **Short history**: 500 trading days ≈ 2 years. One market regime.",
        "- **Taiwan market specificity**: Results may not generalise beyond TWS/TSE.",
        "- **OOS sample size**: Permutation tests use 20% OOS split; small n inflates",
        "  variance of permutation distribution.",
        "- **No out-of-sample holdout**: There is no completely held-out test set.",
        "  All results should be treated as in-distribution estimates.",
        "- **H009 forward_days=10**: Longer holding period means fewer non-overlapping",
        "  OOS periods and potentially inflated Sharpe.",
        "",
        "---",
        "",
        "## 8. Safety Confirmations",
        "",
        "- ❌ No production strategy created or modified",
        "- ❌ No trade execution triggered",
        "- ❌ No auto-promotion performed",
        "- ❌ No parameter re-tuning based on these results",
        "- ✅ All `promotion_allowed = false`",
        "- ✅ `human_review_required = true` for all candidates",
        "- ✅ This report is a research artifact only",
        "",
    ]
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Main pipeline
# ---------------------------------------------------------------------------
def run_v3_pipeline(args: argparse.Namespace) -> dict[str, Any]:
    ts_start = datetime.now(timezone.utc)
    as_of_date = getattr(args, "as_of_date", None) or ts_start.strftime("%Y-%m-%d")
    min_rows = getattr(args, "min_rows", DEFAULT_MIN_ROWS)
    n_perms = getattr(args, "permutations", DEFAULT_N_PERMS)
    dry_run = getattr(args, "dry_run", False)

    registry_path = Path(getattr(args, "registry", DEFAULT_REGISTRY))
    if not registry_path.is_absolute():
        registry_path = ROOT / registry_path

    print("\n" + "=" * 72)
    print("  GBGF V3 Candidate Validation — P3-11")
    print(f"  {ts_start.isoformat()}")
    print(f"  as_of_date={as_of_date}  min_rows={min_rows}  perms={n_perms}")
    print(f"  registry={registry_path.name}")
    print(f"  {'[DRY RUN] ' if dry_run else ''}⚠️  REAL DATA — READ-ONLY — NOT TRADING ADVICE")
    print("=" * 72 + "\n")

    # ── Step 0: Load & guard-check registry ───────────────────────────────────
    print("[0/9] Loading v3 candidate registry & running refinement guard...")
    if not registry_path.exists():
        print(f"ERROR: registry not found at {registry_path}")
        return {"final_classification": "V3_VALIDATION_BLOCKED",
                "reason": f"registry not found: {registry_path}"}

    registry = json.loads(registry_path.read_text())
    candidates = registry.get("hypotheses", [])

    guard_results = validate_v3_registry(registry)
    guard_failures = [r for r in guard_results if not r.passed]
    if guard_failures:
        print("  ❌ GUARD FAILED — validation blocked:")
        for r in guard_failures:
            for v in r.violations:
                print(f"     [{v.rule}] {v.candidate_id}: {v.detail}")
        return {
            "final_classification": "V3_VALIDATION_BLOCKED",
            "guard_failures": [
                {"candidate_id": r.candidate_id,
                 "violations": [{"rule": v.rule, "detail": v.detail} for v in r.violations]}
                for r in guard_failures
            ],
        }
    print(f"  ✅ Guard PASS — {len(candidates)} candidates validated")

    # Partition candidates
    promotion_eligible = [c for c in candidates if c.get("allowed_scope") != OBSERVATION_ONLY_SCOPE]
    observation_only = [c for c in candidates if c.get("allowed_scope") == OBSERVATION_ONLY_SCOPE]
    print(f"  Promotion-eligible: {[c['hypothesis_id'] for c in promotion_eligible]}")
    print(f"  Observation-only:   {[c['hypothesis_id'] for c in observation_only]}")

    # Forward days per candidate
    def get_forward_days(cand: dict) -> int:
        return cand.get("forward_days", 5)

    # ── Step 1: Select symbols ─────────────────────────────────────────────────
    print(f"\n[1/9] Selecting symbols (min_rows={min_rows}, as_of_date={as_of_date})...")
    req_syms_str = getattr(args, "symbols", None)
    requested = [s.strip() for s in req_syms_str.split(",") if s.strip()] if req_syms_str else None
    symbols = select_symbols(as_of_date, min_rows=min_rows, requested_symbols=requested)
    if not symbols:
        print(f"  ⚠️  No symbols with >= {min_rows} rows. Trying with fewer rows...")
        symbols = select_symbols(as_of_date, min_rows=150, requested_symbols=requested)
    if not symbols:
        print(f"  ERROR: No symbols available.")
        return {"final_classification": "V3_DATA_INSUFFICIENT", "symbols": []}
    print(f"  Symbols: {symbols}")

    # Output directory
    date_str = as_of_date.replace("-", "")
    out_dir = OUTPUT_BASE / date_str
    out_dir.mkdir(parents=True, exist_ok=True)

    # ── Step 2: Load symbol rows ────────────────────────────────────────────────
    print("\n[2/9] Loading symbol rows & running PIT checks...")
    pit_guard = PointInTimeGuard(as_of_date=as_of_date, forward_days=10)  # max forward=10 for H009
    all_rows: dict[str, Any] = {}
    all_pit: dict[str, Any] = {}
    for sym in symbols:
        domain = StockRealDomain(
            symbol=sym, as_of_date=as_of_date,
            window_days=500, db_path=DB_PATH, min_rows=min_rows,
        )
        rows = domain._load_rows()
        if rows == DATA_INSUFFICIENT or not rows:
            all_rows[sym] = None
            all_pit[sym] = None
        else:
            all_rows[sym] = rows
            pit_result = pit_guard.check(rows, split_type="time_based")
            all_pit[sym] = pit_result
            print(f"  {sym}: {len(rows)} rows  PIT={'PASS' if pit_result.passed else 'FAIL'}")

    # ── Step 3: Run window-level OOS tests ─────────────────────────────────────
    print("\n[3/9] Running window-level OOS + permutation tests...")
    all_tests: list[dict] = []
    raw_results: dict[str, dict[str, list[dict]]] = {}

    for sym in symbols:
        raw_results[sym] = {}
        rows = all_rows.get(sym)
        pit_result = all_pit.get(sym)

        for cand in candidates:
            hid = cand["hypothesis_id"]
            fwd = get_forward_days(cand)
            # H012: only run on its symbol_scope
            sym_scope = cand.get("symbol_scope", None)
            if sym_scope and sym not in sym_scope:
                # Produce DI results for non-scoped symbols
                raw_results[sym][hid] = [
                    {"status": DATA_INSUFFICIENT, "window_days": w,
                     "symbol": sym, "hypothesis_id": hid,
                     "error": "symbol_not_in_scope",
                     "pit_passed": False, "pit_leakage": False,
                     "raw_p_value": 1.0, "bh_fdr_q_value": 1.0, "bh_fdr_pass": False}
                    for w in BATCH_WINDOWS
                ]
                continue

            if not rows:
                raw_results[sym][hid] = [
                    {"status": DATA_INSUFFICIENT, "window_days": w,
                     "symbol": sym, "hypothesis_id": hid,
                     "pit_passed": False, "pit_leakage": False,
                     "raw_p_value": 1.0, "bh_fdr_q_value": 1.0, "bh_fdr_pass": False}
                    for w in BATCH_WINDOWS
                ]
                continue

            hyp_windows = []
            extra_ctx = {"symbol": sym, "symbol_scope": cand.get("symbol_scope", [sym])}
            for w in BATCH_WINDOWS:
                seed = abs(hash(f"v3:{sym}:{hid}:{w}")) % (2 ** 31)
                wr = eval_window(hid, rows, w, fwd, n_perms, seed, extra_context=extra_ctx)
                wr["symbol"] = sym
                wr["hypothesis_id"] = hid
                wr["window_days"] = w
                wr["pit_passed"] = pit_result.passed if pit_result else False
                wr["pit_leakage"] = pit_result.has_leakage if pit_result else False
                hyp_windows.append(wr)
                all_tests.append(wr)

                if wr.get("status") == "OK":
                    print(f"  {sym} × {hid[:22]} × {w}d: "
                          f"sharpe={wr['sharpe_annualized']:+.3f} "
                          f"roi={wr['roi_annualized']:+.4f} "
                          f"p={wr['p_value']:.3f}")
                else:
                    print(f"  {sym} × {hid[:22]} × {w}d: {wr.get('status')} "
                          f"({wr.get('error', '')})")

            raw_results[sym][hid] = hyp_windows

    # ── Step 4: BH-FDR correction ───────────────────────────────────────────────
    ok_tests = [t for t in all_tests if t.get("status") == "OK"]
    print(f"\n[4/9] BH-FDR correction over {len(ok_tests)} OK tests (alpha={BH_FDR_ALPHA})...")
    bh_corrected_ok = bh_fdr_correction(ok_tests, alpha=BH_FDR_ALPHA)
    bh_pass_count = sum(1 for t in bh_corrected_ok if t.get("bh_fdr_pass", False))
    print(f"  BH-FDR passing tests: {bh_pass_count}")

    # Merge BH results back
    bh_idx = 0
    for sym in symbols:
        for cand in candidates:
            hid = cand["hypothesis_id"]
            for i, wr in enumerate(raw_results[sym][hid]):
                if wr.get("status") == "OK":
                    if bh_idx < len(bh_corrected_ok):
                        bh = bh_corrected_ok[bh_idx]
                        raw_results[sym][hid][i]["raw_p_value"] = bh.get("raw_p_value", 1.0)
                        raw_results[sym][hid][i]["bh_fdr_q_value"] = bh.get("bh_fdr_q_value", 1.0)
                        raw_results[sym][hid][i]["bh_fdr_pass"] = bh.get("bh_fdr_pass", False)
                    bh_idx += 1
                else:
                    raw_results[sym][hid][i].setdefault("raw_p_value", 1.0)
                    raw_results[sym][hid][i].setdefault("bh_fdr_q_value", 1.0)
                    raw_results[sym][hid][i].setdefault("bh_fdr_pass", False)

    # ── Step 5: Cross-symbol / cross-window counts ─────────────────────────────
    print("\n[5/9] Computing cross-symbol replication counts...")
    hyp_cross_symbol: dict[str, int] = {}
    for cand in candidates:
        hid = cand["hypothesis_id"]
        count = sum(
            1 for sym in symbols
            if any(
                wr.get("status") == "OK" and wr.get("roi_annualized", 0) > 0
                for wr in raw_results[sym][hid]
                if wr.get("window_days") == 500
            )
        )
        hyp_cross_symbol[hid] = count

    def cross_window_roi_count(sym: str, hid: str) -> int:
        return sum(
            1 for wr in raw_results[sym][hid]
            if wr.get("status") == "OK" and wr.get("roi_annualized", 0) > 0
        )

    # ── Step 6: Promotion decisions ─────────────────────────────────────────────
    print("\n[6/9] V3 promotion decisions...")
    final_statuses: dict[str, dict[str, str]] = {}
    review_candidates: list[dict] = []
    rejected_list: list[dict] = []
    di_list: list[dict] = []
    obs_only_results: list[dict] = []

    for sym in symbols:
        final_statuses[sym] = {}
        for cand in candidates:
            hid = cand["hypothesis_id"]
            windows = raw_results[sym][hid]
            valid_windows = [w for w in windows if w.get("status") == "OK"]

            pit_passed = any(w.get("pit_passed", False) for w in windows)
            has_leakage = any(w.get("pit_leakage", False) for w in windows)

            status = decide_v3_status(
                candidate=cand,
                window_results=valid_windows,
                pit_passed=pit_passed,
                has_leakage=has_leakage,
                cross_symbol_count=hyp_cross_symbol.get(hid, 1),
                cross_window_count=cross_window_roi_count(sym, hid),
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

            icon = {"REVIEW_CANDIDATE": "🔬", "REJECTED": "❌",
                    "DATA_INSUFFICIENT": "⚠️", "OBSERVATION_ONLY": "👁️"}.get(status, "?")
            print(f"  {icon} {sym} × {hid[:30]}: {status}")

    # ── Step 7: Write per-candidate × symbol outputs ────────────────────────────
    print("\n[7/9] Writing per-candidate outputs...")
    ts = ts_start.isoformat()

    if not dry_run:
        for sym in symbols:
            for cand in candidates:
                hid = cand["hypothesis_id"]
                cand_dir = out_dir / sym / hid.lower()
                cand_dir.mkdir(parents=True, exist_ok=True)

                windows = raw_results[sym][hid]
                status = final_statuses[sym][hid]

                # gate_result.json
                (cand_dir / "gate_result.json").write_text(json.dumps({
                    "hypothesis_id": hid,
                    "base_hypothesis_id": cand.get("base_hypothesis_id"),
                    "symbol": sym,
                    "as_of_date": as_of_date,
                    "status": status,
                    "allowed_scope": cand.get("allowed_scope"),
                    "promotion_allowed": cand.get("promotion_allowed", False),
                    "window_results": windows,
                    "run_ts": ts,
                }, indent=2))

                # validation_metrics.json
                valid = [w for w in windows if w.get("status") == "OK"]
                avg_sharpe = round(sum(w.get("sharpe_annualized", 0) for w in valid) / max(len(valid), 1), 4)
                avg_roi = round(sum(w.get("roi_annualized", 0) for w in valid) / max(len(valid), 1), 4)
                (cand_dir / "validation_metrics.json").write_text(json.dumps({
                    "hypothesis_id": hid,
                    "symbol": sym,
                    "as_of_date": as_of_date,
                    "windows_tested": BATCH_WINDOWS,
                    "windows_ok": [w["window_days"] for w in valid],
                    "avg_sharpe_annualized": avg_sharpe,
                    "avg_roi_annualized": avg_roi,
                    "bh_fdr_pass_count": sum(1 for w in windows if w.get("bh_fdr_pass", False)),
                    "status": status,
                    "run_ts": ts,
                }, indent=2))

                # data_lineage.json
                (cand_dir / "data_lineage.json").write_text(json.dumps({
                    "hypothesis_id": hid,
                    "base_hypothesis_id": cand.get("base_hypothesis_id"),
                    "symbol": sym,
                    "as_of_date": as_of_date,
                    "db_source": str(DB_PATH),
                    "pit_enforced": True,
                    "random_split_used": False,
                    "time_based_split": True,
                    "pipeline_version": "P3-11",
                    "run_ts": ts,
                }, indent=2))

                # reproducibility_pack.json
                seed_val = abs(hash(f"v3:{sym}:{hid}:{as_of_date}")) % (2 ** 31)
                (cand_dir / "reproducibility_pack.json").write_text(json.dumps({
                    "hypothesis_id": hid,
                    "symbol": sym,
                    "as_of_date": as_of_date,
                    "pipeline_version": "P3-11",
                    "seed": seed_val,
                    "n_permutations": n_perms,
                    "bh_fdr_alpha": BH_FDR_ALPHA,
                    "tx_cost_bps": TX_COST_BPS,
                    "safety_confirmations": {
                        "no_production_write": True,
                        "no_trade_execution": True,
                        "not_trading_advice": True,
                        "real_data_read_only": True,
                        "bh_fdr_corrected": True,
                        "pit_guard_enforced": True,
                        "no_random_split": True,
                        "no_auto_promotion": True,
                        "refinement_guard_passed": True,
                    },
                    "run_ts": ts,
                }, indent=2))
                print(f"  ✓ {sym}/{hid.lower()}/")

    # ── Step 8: Summary JSON + MD ───────────────────────────────────────────────
    print("\n[8/9] Writing v3 validation summary...")

    # Final classification
    if review_candidates:
        final_class = "STOCK_V3_REVIEW_CANDIDATE_FOUND"
    elif all(
        all(final_statuses[sym][c["hypothesis_id"]] == STATUS_DATA_INSUF
            for sym in symbols)
        for c in promotion_eligible
    ):
        final_class = "STOCK_V3_DATA_INSUFFICIENT"
    else:
        final_class = "STOCK_V3_NO_EDGE_FOUND"

    summary = {
        "pipeline_version": "P3-11",
        "run_ts": ts,
        "as_of_date": as_of_date,
        "symbols_evaluated": symbols,
        "candidates_evaluated": [c["hypothesis_id"] for c in candidates],
        "promotion_eligible_candidates": [c["hypothesis_id"] for c in promotion_eligible],
        "observation_only_candidates": [c["hypothesis_id"] for c in observation_only],
        "total_tests": len(all_tests),
        "ok_tests": len(ok_tests),
        "bh_fdr_alpha": BH_FDR_ALPHA,
        "bh_fdr_pass_count": bh_pass_count,
        "review_candidates": review_candidates,
        "rejected": rejected_list,
        "data_insufficient": di_list,
        "observation_only_results": obs_only_results,
        "final_classification": final_class,
        "safety_confirmations": {
            "no_production_write": True,
            "no_trade_execution": True,
            "not_trading_advice": True,
            "real_data_read_only": True,
            "bh_fdr_corrected": True,
            "pit_guard_enforced": True,
            "no_random_split": True,
            "no_auto_promotion": True,
            "refinement_guard_passed": True,
        },
    }

    if not dry_run:
        (out_dir / "v3_validation_summary.json").write_text(
            json.dumps(summary, indent=2)
        )

        # Summary markdown
        md_lines = [
            "# V3 Candidate Validation Summary",
            "",
            f"> Pipeline: P3-11  |  as_of_date: {as_of_date}  |  Run: {ts}",
            "",
            f"**Final Classification: `{final_class}`**",
            "",
            "| Candidate | Symbol | Status | Avg ROI | Avg Sharpe | BH-FDR Pass |",
            "|---|---|---|---|---|---|",
        ]
        for sym in symbols:
            for cand in candidates:
                hid = cand["hypothesis_id"]
                status = final_statuses[sym][hid]
                valid = [w for w in raw_results[sym][hid] if w.get("status") == "OK"]
                avg_roi = round(sum(w.get("roi_annualized", 0) for w in valid) / max(len(valid), 1), 4) if valid else "N/A"
                avg_sh = round(sum(w.get("sharpe_annualized", 0) for w in valid) / max(len(valid), 1), 4) if valid else "N/A"
                bh_c = sum(1 for w in raw_results[sym][hid] if w.get("bh_fdr_pass", False))
                md_lines.append(f"| {hid} | {sym} | `{status}` | {avg_roi} | {avg_sh} | {bh_c} |")

        md_lines += ["", "---", "See `anti_overfitting_report.md` for full analysis."]
        (out_dir / "v3_validation_summary.md").write_text("\n".join(md_lines))

    # ── Step 9: Anti-overfitting report ─────────────────────────────────────────
    print("\n[9/9] Writing anti-overfitting report...")
    anti_report = build_anti_overfitting_report(
        candidates=candidates,
        symbols=symbols,
        all_tests=all_tests,
        bh_corrected=bh_corrected_ok,
        final_statuses=final_statuses,
        as_of_date=as_of_date,
    )
    if not dry_run:
        (out_dir / "anti_overfitting_report.md").write_text(anti_report)
        print(f"  ✓ anti_overfitting_report.md")

    print(f"\n{'=' * 72}")
    print(f"  Final Classification: {final_class}")
    print(f"  Review candidates: {len(review_candidates)}")
    print(f"  Rejected: {len(rejected_list)}")
    print(f"  Data insufficient: {len(di_list)}")
    print(f"  Observation-only: {len(obs_only_results)}")
    print(f"  BH-FDR passing: {bh_pass_count}")
    print(f"{'=' * 72}\n")

    return summary


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------
def _build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(description="P3-11 V3 Candidate Validation")
    p.add_argument("--registry", default=str(DEFAULT_REGISTRY))
    p.add_argument("--candidate-mode", default="v3")
    p.add_argument("--as-of-date", dest="as_of_date", default="2026-05-01")
    p.add_argument("--min-rows", dest="min_rows", type=int, default=DEFAULT_MIN_ROWS)
    p.add_argument("--permutations", type=int, default=DEFAULT_N_PERMS)
    p.add_argument("--symbols", default=None)
    p.add_argument("--dry-run", dest="dry_run", action="store_true")
    return p


if __name__ == "__main__":
    parser = _build_parser()
    args = parser.parse_args()
    result = run_v3_pipeline(args)
    sys.exit(0 if result.get("final_classification") != "V3_VALIDATION_BLOCKED" else 1)
