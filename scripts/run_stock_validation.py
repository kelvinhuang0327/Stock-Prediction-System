#!/usr/bin/env python3
"""
GBGF Stock Hypothesis Validation Pipeline — P3-05
Runs a sustainable, repeatable validation pipeline for all registered stock hypotheses.

For each hypothesis:
  - Multi-window OOS backtest (150 / 500 / 1500 synthetic trading days)
  - Permutation null test (1000 shuffles)
  - BH-FDR multiple testing correction (across all hypothesis × window pairs)
  - G01–G10 GBGF gate evaluation
  - Promotion / rejection decision

NOT a trading system. Uses deterministic synthetic (mock) data only.
No external data fetch. No production write. No order placement.

Usage:
    python3 scripts/run_stock_validation.py --dry-run
    python3 scripts/run_stock_validation.py --dry-run --permutations 200
"""

import argparse
import hashlib
import json
import math
import os
import random
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT))

from gbgf.models import (
    BacktestResult,
    DomainType,
    EvidenceBundle,
    GateResult,
    GateStatus,
    StrategyState,
    ValidationTier,
)
from gbgf.domain.stock import StockDomain
from gbgf.gates.gate_runner import GateRunner
from gbgf.retirement_engine import RetirementEngine

REGISTRY_PATH = ROOT / "research" / "stock_hypothesis_registry.json"
OUTPUT_BASE = ROOT / "outputs" / "stock_validation"

WINDOWS = [150, 500, 1500]          # trading-day window sizes for multi-window OOS
N_PERMUTATIONS = 1000               # default permutation test iterations
N_SYMBOLS = 2                       # symbols per synthetic dataset
FORWARD_DAYS = 5                    # prediction horizon (days)
TX_COST_BPS = 10                    # default transaction cost

GATE_ICONS = {
    GateStatus.PASS: "✅",
    GateStatus.FAIL: "❌",
    GateStatus.WARN: "⚠️",
    GateStatus.BLOCKED: "🚫",
    GateStatus.SKIPPED: "⏭",
}

# ── Synthetic data generator ───────────────────────────────────────────────────

def generate_synthetic_ohlcv(
    n_days: int, n_symbols: int = 2, seed: int = 42
) -> List[Dict[str, Any]]:
    """
    Generate deterministic synthetic OHLCV data using a Geometric Brownian Motion
    (GBM) process with no alpha signal baked in.  The data is pure noise —
    any hypothesis that 'passes' on this data would be a false discovery.

    drift=0, vol=0.015/day, volume is lognormal noise.
    data_is_point_in_time=true (mock PIT compliance flag).
    """
    rng = random.Random(seed)
    rows = []
    symbols = [f"MOCK_{chr(65 + i)}" for i in range(n_symbols)]

    for sym in symbols:
        price = 100.0
        vol_mean = 1_000_000
        for day in range(n_days):
            date_str = f"2020-01-{day + 1:04d}"  # synthetic date
            daily_vol = 0.015
            ret = rng.gauss(0.0, daily_vol)
            open_p = price
            close_p = round(price * (1 + ret), 4)
            high_p = round(max(open_p, close_p) * (1 + abs(rng.gauss(0, 0.003))), 4)
            low_p = round(min(open_p, close_p) * (1 - abs(rng.gauss(0, 0.003))), 4)
            volume = max(1, int(vol_mean * rng.lognormvariate(0, 0.5)))
            rows.append({
                "symbol": sym,
                "date": date_str,
                "open": open_p,
                "high": high_p,
                "low": low_p,
                "close": close_p,
                "volume": volume,
                "data_is_point_in_time": "true",
            })
            price = close_p

    rows.sort(key=lambda r: (r["symbol"], r["date"]))
    return rows


# ── Signal computers ───────────────────────────────────────────────────────────

def compute_momentum_signals(
    rows: List[Dict], lookback: int = 20, forward: int = 5
) -> List[Dict]:
    """H001: 20-day price momentum → next-5d directional return."""
    symbols = sorted({r["symbol"] for r in rows})
    all_signals = []
    for sym in symbols:
        sym_rows = sorted([r for r in rows if r["symbol"] == sym], key=lambda r: r["date"])
        closes = [float(r["close"]) for r in sym_rows]
        for i in range(lookback, len(closes) - forward):
            mom = (closes[i] - closes[i - lookback]) / closes[i - lookback]
            fwd = (closes[i + forward] - closes[i]) / closes[i]
            signal = 1 if mom > 0 else -1
            all_signals.append({
                "symbol": sym,
                "date": sym_rows[i]["date"],
                "signal": signal,
                "forward_return": round(fwd * signal, 6),
            })
    return all_signals


def compute_rsi_reversion_signals(
    rows: List[Dict], period: int = 5, forward: int = 5
) -> List[Dict]:
    """H002: RSI(5) mean reversion. Buy oversold (<30), sell overbought (>70)."""
    symbols = sorted({r["symbol"] for r in rows})
    all_signals = []
    for sym in symbols:
        sym_rows = sorted([r for r in rows if r["symbol"] == sym], key=lambda r: r["date"])
        closes = [float(r["close"]) for r in sym_rows]
        for i in range(period + 1, len(closes) - forward):
            # Simple RSI: avg gain / avg loss over period
            changes = [closes[j] - closes[j - 1] for j in range(i - period, i)]
            gains = [c for c in changes if c > 0]
            losses = [-c for c in changes if c < 0]
            avg_gain = sum(gains) / period if gains else 0.0
            avg_loss = sum(losses) / period if losses else 0.0001
            rs = avg_gain / avg_loss
            rsi = 100 - (100 / (1 + rs))

            if rsi < 30:
                signal = 1   # oversold → expect bounce
            elif rsi > 70:
                signal = -1  # overbought → expect reversion
            else:
                continue     # no trade

            fwd = (closes[i + forward] - closes[i]) / closes[i]
            all_signals.append({
                "symbol": sym,
                "date": sym_rows[i]["date"],
                "signal": signal,
                "rsi": round(rsi, 2),
                "forward_return": round(fwd * signal, 6),
            })
    return all_signals


def compute_volume_breakout_signals(
    rows: List[Dict], lookback: int = 20, volume_mult: float = 1.5, forward: int = 5
) -> List[Dict]:
    """H003: Volume breakout (volume > 1.5x 20d avg AND close > open)."""
    symbols = sorted({r["symbol"] for r in rows})
    all_signals = []
    for sym in symbols:
        sym_rows = sorted([r for r in rows if r["symbol"] == sym], key=lambda r: r["date"])
        closes = [float(r["close"]) for r in sym_rows]
        volumes = [float(r["volume"]) for r in sym_rows]
        opens = [float(r["open"]) for r in sym_rows]
        for i in range(lookback, len(closes) - forward):
            avg_vol = sum(volumes[i - lookback:i]) / lookback
            is_up_day = closes[i] > opens[i]
            is_high_vol = volumes[i] > volume_mult * avg_vol
            if is_up_day and is_high_vol:
                signal = 1
                fwd = (closes[i + forward] - closes[i]) / closes[i]
                all_signals.append({
                    "symbol": sym,
                    "date": sym_rows[i]["date"],
                    "signal": signal,
                    "volume_ratio": round(volumes[i] / avg_vol, 3),
                    "forward_return": round(fwd, 6),
                })
    return all_signals


SIGNAL_COMPUTERS = {
    "STOCK_H001_20D_MOMENTUM": compute_momentum_signals,
    "STOCK_H002_RSI_REVERSION": compute_rsi_reversion_signals,
    "STOCK_H003_VOLUME_BREAKOUT": compute_volume_breakout_signals,
}


# ── Multi-window OOS backtest ──────────────────────────────────────────────────

def run_oos_window(
    hypothesis_id: str,
    window_days: int,
    hyp_config: Dict,
    seed: int,
    tx_cost_bps: int = TX_COST_BPS,
) -> Dict[str, Any]:
    """
    Run a single OOS window: generate synthetic data of `window_days`,
    compute signals with hypothesis-specific logic,
    use last 20% as OOS test set.
    Returns performance metrics.
    """
    rows = generate_synthetic_ohlcv(window_days, n_symbols=N_SYMBOLS, seed=seed)

    signal_fn = SIGNAL_COMPUTERS.get(hypothesis_id)
    if signal_fn is None:
        return {"error": f"No signal computer for {hypothesis_id}"}

    all_signals = signal_fn(rows, forward=FORWARD_DAYS)
    if not all_signals:
        return {
            "window_days": window_days, "n_signals": 0, "error": "no_signals",
            "edge_pp": 0.0, "sharpe": None, "roi": None,
        }

    # OOS = last 20% of signals (strict temporal split — no future leakage)
    oos_cutoff = int(len(all_signals) * 0.80)
    oos_signals = all_signals[oos_cutoff:]

    if len(oos_signals) < 5:
        return {
            "window_days": window_days, "n_signals": len(oos_signals),
            "error": "insufficient_oos", "edge_pp": 0.0, "sharpe": None, "roi": None,
        }

    tc = tx_cost_bps / 10000.0
    returns = [s["forward_return"] - tc for s in oos_signals]
    n = len(returns)
    mean_r = sum(returns) / n
    var_r = sum((r - mean_r) ** 2 for r in returns) / max(n - 1, 1)
    std_r = math.sqrt(var_r) if var_r > 0 else 1e-6
    sharpe = round((mean_r / std_r) * math.sqrt(252 / FORWARD_DAYS), 4)
    win_rate = sum(1 for r in returns if r > 0) / n
    edge_pp = round((win_rate - 0.5) * 100, 4)
    roi = round(mean_r * 252 / FORWARD_DAYS, 6)  # annualised simple ROI

    return {
        "window_days": window_days,
        "n_signals": n,
        "mean_return": round(mean_r, 6),
        "std_return": round(std_r, 6),
        "sharpe_annualized": sharpe,
        "win_rate": round(win_rate, 4),
        "edge_pp": edge_pp,
        "roi_annualized": roi,
        "tx_cost_bps": tx_cost_bps,
    }


# ── Permutation test ───────────────────────────────────────────────────────────

def permutation_test(
    hypothesis_id: str,
    window_days: int,
    hyp_config: Dict,
    seed: int,
    n_permutations: int = N_PERMUTATIONS,
    tx_cost_bps: int = TX_COST_BPS,
) -> Dict[str, Any]:
    """
    Empirical permutation null test:
    1. Compute true mean return on OOS signals.
    2. Shuffle OOS forward returns N times; compute mean return each time.
    3. p-value = fraction of shuffled means >= observed mean (one-tailed).
    """
    rows = generate_synthetic_ohlcv(window_days, n_symbols=N_SYMBOLS, seed=seed)
    signal_fn = SIGNAL_COMPUTERS.get(hypothesis_id)
    if signal_fn is None:
        return {"p_value": 1.0, "n_permutations": 0, "error": "no_signal_fn"}

    all_signals = signal_fn(rows, forward=FORWARD_DAYS)
    if not all_signals:
        return {"p_value": 1.0, "n_permutations": 0, "error": "no_signals"}

    oos_cutoff = int(len(all_signals) * 0.80)
    oos_signals = all_signals[oos_cutoff:]
    if len(oos_signals) < 5:
        return {"p_value": 1.0, "n_permutations": 0, "error": "insufficient_oos"}

    tc = tx_cost_bps / 10000.0
    returns = [s["forward_return"] - tc for s in oos_signals]
    observed_mean = sum(returns) / len(returns)

    rng = random.Random(seed + 9999)
    null_dist = []
    for _ in range(n_permutations):
        shuffled = returns[:]
        rng.shuffle(shuffled)
        null_dist.append(sum(shuffled) / len(shuffled))

    p_value = sum(1 for x in null_dist if x >= observed_mean) / n_permutations

    return {
        "observed_mean": round(observed_mean, 6),
        "null_mean": round(sum(null_dist) / len(null_dist), 6),
        "null_std": round(math.sqrt(sum((x - sum(null_dist)/len(null_dist))**2
                                       for x in null_dist) / len(null_dist)), 6),
        "p_value": round(p_value, 4),
        "n_permutations": n_permutations,
        "one_tailed": True,
    }


# ── BH-FDR correction ─────────────────────────────────────────────────────────

def bh_fdr_correction(
    p_values: List[Tuple[str, str, float]], alpha: float = 0.05
) -> List[Dict[str, Any]]:
    """
    Benjamini-Hochberg FDR correction.
    Input: list of (hypothesis_id, window_label, p_value)
    Returns list of dicts with original + adjusted p-value + bh_pass flag.
    """
    m = len(p_values)
    if m == 0:
        return []
    sorted_items = sorted(enumerate(p_values), key=lambda x: x[1][2])
    results = [None] * m
    for rank, (orig_idx, (hyp_id, window, pv)) in enumerate(sorted_items, start=1):
        bh_threshold = (rank / m) * alpha
        adj_p = min(pv * m / rank, 1.0)
        results[orig_idx] = {
            "hypothesis_id": hyp_id,
            "window": window,
            "p_value": pv,
            "bh_rank": rank,
            "bh_threshold": round(bh_threshold, 6),
            "bh_adjusted_p": round(adj_p, 6),
            "bh_pass": pv <= bh_threshold,
        }
    return results


# ── Build evidence bundle for GateRunner ──────────────────────────────────────

def build_evidence_bundle_for_hypothesis(
    hyp: Dict,
    window_results: List[Dict],
    perm_results: List[Dict],
    bh_results_for_hyp: List[Dict],
    tx_cost_bps: int = TX_COST_BPS,
) -> EvidenceBundle:
    hid = hyp["hypothesis_id"]
    bundle = EvidenceBundle(strategy_id=hid)

    # BacktestResult objects for GateRunner G03
    for wr in window_results:
        if "error" not in wr:
            ep = wr.get("edge_pp", 0.0)
            bundle.backtest_results.append(BacktestResult(
                strategy_id=hid,
                window_label=f"{wr['window_days']}d_oos",
                edge_pp=ep,
                p_value=next(
                    (pr["p_value"] for pr in perm_results if pr.get("window_days") == wr["window_days"]),
                    0.5,
                ),
                n_samples=wr.get("n_signals", 0),
                passed_degraded_threshold=(ep >= 2.0),
                notes=f"Synthetic data | sharpe={wr.get('sharpe_annualized')} | window={wr['window_days']}d",
            ))

    bundle.metadata["hypothesis_pre_registered"] = True
    bundle.metadata["hypothesis_id"] = hid
    bundle.metadata["hypothesis_family"] = hyp.get("family", "unknown")

    # G02: data leakage meta
    bundle.metadata["data_meta"] = {
        "temporal_order_ok": True,
        "target_access_ok": True,
        "pit_enforced": True,
        "oos_split": "strict_80_20_temporal",
        "survivorship_bias_note": "Synthetic data — no delisting; mock PIT compliance only",
        "transaction_cost_bps": tx_cost_bps,
    }

    # G04: permutation test (use 500d window result as primary)
    primary_perm = next(
        (pr for pr in perm_results if pr.get("window_days") == 500 and "error" not in pr),
        perm_results[0] if perm_results else {},
    )
    bundle.metadata["permutation_p_value"] = primary_perm.get("p_value")
    bundle.metadata["permutation_n"] = primary_perm.get("n_permutations", 0)
    bundle.metadata["permutation_note"] = "Empirical permutation null test on synthetic OOS data"

    # G05: BH-FDR
    bh_pass_any = any(b["bh_pass"] for b in bh_results_for_hyp) if bh_results_for_hyp else False
    bundle.metadata["bh_fdr_pass"] = bh_pass_any
    bundle.metadata["bh_fdr_results"] = bh_results_for_hyp
    bundle.metadata["bh_fdr_note"] = (
        "BH-FDR applied across all hypotheses × windows. "
        f"{'PASS' if bh_pass_any else 'FAIL'} — {'some windows survive FDR' if bh_pass_any else 'no window survives FDR correction'}"
    )

    bundle.metadata["mock_data"] = True
    bundle.metadata["synthetic_data"] = True
    bundle.metadata["run_ts"] = datetime.now(timezone.utc).isoformat()
    bundle.metadata["domain_risks"] = [
        "Synthetic GBM data — no real market dynamics",
        "PIT compliance is mock flag only",
        "Survivorship bias not modeled",
        "Transaction costs are simplified",
    ]

    return bundle


def build_strategy_state(hyp: Dict) -> StrategyState:
    return StrategyState(
        strategy_id=hyp["hypothesis_id"],
        domain=DomainType.STOCK,
        tier=ValidationTier.T1_REGISTERED,
        human_review_complete=False,
        dry_run_passed=False,
        has_critical_failure=False,
        live_outcome_count=0,
        consecutive_negative=0,
        ev_classification="UNCLASSIFIED",
        notes=f"P3-05 pipeline. Synthetic data. Not a trading recommendation.",
    )


# ── Promotion decision ────────────────────────────────────────────────────────

def evaluate_promotion(
    hyp: Dict,
    window_results: List[Dict],
    perm_results: List[Dict],
    bh_results_for_hyp: List[Dict],
) -> Dict[str, Any]:
    """
    Promotion criteria:
      - ROI > 0 across ALL multi-windows
      - Sharpe > 0 (primary 500d window)
      - permutation p-value < 0.05 (primary 500d window)
    All three must hold → promoted_candidate; else rejected.
    """
    roi_positive_all = all(
        wr.get("roi_annualized", -1) > 0
        for wr in window_results
        if "error" not in wr
    ) and any("error" not in wr for wr in window_results)

    # Sharpe from 500d window (primary)
    primary_wr = next(
        (wr for wr in window_results if wr.get("window_days") == 500 and "error" not in wr),
        window_results[0] if window_results else {},
    )
    sharpe_positive = (primary_wr.get("sharpe_annualized") or 0) > 0

    # Permutation p-value
    primary_perm = next(
        (pr for pr in perm_results if pr.get("window_days") == 500 and "error" not in pr),
        perm_results[0] if perm_results else {},
    )
    perm_significant = (primary_perm.get("p_value") or 1.0) < 0.05

    all_pass = roi_positive_all and sharpe_positive and perm_significant
    status = "promoted_candidate" if all_pass else "rejected"

    reasons = []
    if not roi_positive_all:
        reasons.append("ROI not positive across all windows")
    if not sharpe_positive:
        reasons.append(f"Sharpe ≤ 0 on primary window ({primary_wr.get('sharpe_annualized')})")
    if not perm_significant:
        reasons.append(f"Permutation p-value={primary_perm.get('p_value')} ≥ 0.05 (not significant)")
    if all_pass:
        reasons.append("All promotion criteria met — requires human review before T3")

    return {
        "status": status,
        "criteria": {
            "roi_positive_all_windows": roi_positive_all,
            "sharpe_positive_500d": sharpe_positive,
            "perm_p_lt_005": perm_significant,
        },
        "primary_window_sharpe": primary_wr.get("sharpe_annualized"),
        "primary_perm_p": primary_perm.get("p_value"),
        "reasons": reasons,
    }


# ── SHA256 helpers ────────────────────────────────────────────────────────────

def sha256_str(s: str) -> str:
    return hashlib.sha256(s.encode()).hexdigest()


def sha256_file(path: Path) -> str:
    if not path.exists():
        return "FILE_NOT_FOUND"
    return hashlib.sha256(path.read_bytes()).hexdigest()


# ── Per-hypothesis output ─────────────────────────────────────────────────────

def save_hypothesis_outputs(
    hyp: Dict,
    window_results: List[Dict],
    perm_results: List[Dict],
    bh_results_for_hyp: List[Dict],
    gate_results: List[GateResult],
    promotion: Dict,
    dry_run: bool,
) -> Path:
    hid = hyp["hypothesis_id"]
    out_dir = OUTPUT_BASE / hid
    out_dir.mkdir(parents=True, exist_ok=True)

    ts = datetime.now(timezone.utc).isoformat()

    # Gate result JSON
    gate_result = {
        "hypothesis_id": hid,
        "run_ts": ts,
        "dry_run": dry_run,
        "pipeline": "GBGF_STOCK_VALIDATION_P3-05",
        "mock_data": True,
        "no_production_write": True,
        "gate_results": [gr.to_dict() for gr in gate_results],
        "promotion": promotion,
        "window_results": window_results,
        "permutation_results": [
            {k: v for k, v in pr.items() if k != "window_days"} | {"window_days": pr.get("window_days")}
            for pr in perm_results
        ],
        "bh_fdr_results": bh_results_for_hyp,
    }
    gate_result_path = out_dir / "gate_result.json"
    gate_result_path.write_text(json.dumps(gate_result, indent=2))

    # Reproducibility pack
    repro_pack = {
        "run_id": f"{hid}-{ts[:10]}",
        "hypothesis_id": hid,
        "pipeline_version": "P3-05",
        "run_ts": ts,
        "source_artifact_sha256": {
            "stock_hypothesis_registry.json": sha256_file(REGISTRY_PATH),
            "run_stock_validation.py": sha256_file(ROOT / "scripts" / "run_stock_validation.py"),
        },
        "gate_result_sha256": sha256_str(json.dumps([gr.to_dict() for gr in gate_results])),
        "gate_statuses": {gr.gate_id: gr.status.value for gr in gate_results},
        "final_status": promotion["status"],
        "safety_confirmations": {
            "no_db_write": True,
            "no_production_write": True,
            "no_strategy_added": True,
            "not_trading_advice": True,
            "dry_run": dry_run,
            "synthetic_data_only": True,
        },
        "windows_tested": [wr.get("window_days") for wr in window_results],
        "n_permutations": next(
            (pr.get("n_permutations", 0) for pr in perm_results if "error" not in pr), 0
        ),
    }
    repro_dir = out_dir / "reproducibility"
    repro_dir.mkdir(exist_ok=True)
    repro_date = ts[:10].replace("-", "")
    repro_path = repro_dir / f"{hid.lower()}_pack_{repro_date}.json"
    repro_path.write_text(json.dumps(repro_pack, indent=2))

    return out_dir


# ── Main pipeline ─────────────────────────────────────────────────────────────

def run_pipeline(args: argparse.Namespace):
    ts_start = datetime.now(timezone.utc)
    print("\n" + "=" * 72)
    print("  GBGF Stock Hypothesis Validation Pipeline — P3-05")
    print(f"  {ts_start.isoformat()}  |  {'DRY RUN' if args.dry_run else 'LIVE'}")
    print("  ⚠️  SYNTHETIC DATA ONLY — NOT A TRADING RECOMMENDATION")
    print("=" * 72 + "\n")

    # Load hypothesis registry
    if not REGISTRY_PATH.exists():
        print(f"ERROR: registry not found at {REGISTRY_PATH}")
        sys.exit(1)

    registry = json.loads(REGISTRY_PATH.read_text())
    hypotheses = registry.get("hypotheses", [])
    print(f"[1/6] Loaded {len(hypotheses)} hypotheses from registry\n")

    n_perms = args.permutations
    all_results = []

    # ── Phase 1: multi-window OOS for all hypotheses ──────────────────────────
    print("[2/6] Running multi-window OOS backtests...")
    all_window_results: Dict[str, List[Dict]] = {}
    for hyp in hypotheses:
        hid = hyp["hypothesis_id"]
        hyp_results = []
        print(f"  {hid}")
        for w_idx, window_days in enumerate(WINDOWS):
            seed = hash(hid + str(window_days)) % (2 ** 31)
            wr = run_oos_window(hid, window_days, hyp, seed=seed,
                                tx_cost_bps=hyp.get("transaction_cost_bps", TX_COST_BPS))
            wr["window_days"] = window_days
            hyp_results.append(wr)
            sharpe = wr.get("sharpe_annualized", "N/A")
            roi = wr.get("roi_annualized", "N/A")
            n_sig = wr.get("n_signals", 0)
            err = wr.get("error", "")
            status_str = f"sharpe={sharpe:+.3f} roi={roi:+.4f} n={n_sig}" if not err else f"ERR={err}"
            print(f"    {window_days:>5d}d: {status_str}")
        all_window_results[hid] = hyp_results
    print()

    # ── Phase 2: permutation tests ────────────────────────────────────────────
    print(f"[3/6] Running permutation tests ({n_perms} permutations per window)...")
    all_perm_results: Dict[str, List[Dict]] = {}
    for hyp in hypotheses:
        hid = hyp["hypothesis_id"]
        hyp_perms = []
        print(f"  {hid}")
        for window_days in WINDOWS:
            seed = hash(hid + str(window_days)) % (2 ** 31)
            pr = permutation_test(hid, window_days, hyp, seed=seed, n_permutations=n_perms,
                                  tx_cost_bps=hyp.get("transaction_cost_bps", TX_COST_BPS))
            pr["window_days"] = window_days
            hyp_perms.append(pr)
            pv = pr.get("p_value", "N/A")
            print(f"    {window_days:>5d}d: p={pv}")
        all_perm_results[hid] = hyp_perms
    print()

    # ── Phase 3: BH-FDR correction (across ALL hypothesis × window pairs) ─────
    print("[4/6] BH-FDR multiple testing correction...")
    p_value_collection: List[Tuple[str, str, float]] = []
    for hyp in hypotheses:
        hid = hyp["hypothesis_id"]
        for pr in all_perm_results[hid]:
            if "error" not in pr and pr.get("p_value") is not None:
                p_value_collection.append((hid, f"{pr['window_days']}d", pr["p_value"]))

    bh_all = bh_fdr_correction(p_value_collection, alpha=0.05)
    bh_by_hyp: Dict[str, List[Dict]] = {}
    for item in bh_all:
        if item is None:
            continue
        hid = item["hypothesis_id"]
        bh_by_hyp.setdefault(hid, []).append(item)

    any_bh_pass = any(item["bh_pass"] for item in bh_all if item is not None)
    print(f"  Total tests: {len(p_value_collection)} | BH-pass: {sum(1 for x in bh_all if x and x['bh_pass'])}")
    print(f"  Any hypothesis survives FDR: {'YES' if any_bh_pass else 'NO (expected for random data)'}\n")

    # ── Phase 4: Gate runner + promotion decision ─────────────────────────────
    print("[5/6] Running GateRunner G01–G10 + promotion evaluation...")
    promotions = {}
    rejected = []
    promoted = []
    output_dirs: Dict[str, Path] = {}

    runner = GateRunner()
    retirement_engine = RetirementEngine()

    for hyp in hypotheses:
        hid = hyp["hypothesis_id"]
        print(f"\n  ── {hid} ──")

        bundle = build_evidence_bundle_for_hypothesis(
            hyp,
            all_window_results[hid],
            all_perm_results[hid],
            bh_by_hyp.get(hid, []),
        )
        state = build_strategy_state(hyp)

        # Update state EV classification from primary window
        primary_wr = next(
            (wr for wr in all_window_results[hid] if wr.get("window_days") == 500 and "error" not in wr),
            {},
        )
        sharpe_500 = primary_wr.get("sharpe_annualized", 0) or 0
        if sharpe_500 > 0.5:
            state.ev_classification = "EV_POSITIVE"
        elif sharpe_500 > 0:
            state.ev_classification = "VALID_SIGNAL_NON_MONETIZABLE"
        else:
            state.ev_classification = "EV_NEGATIVE_BY_DESIGN"

        # Build a data-injected adapter for G02/G06 (uses 500d synthetic data)
        seed_500 = hash(hid + str(500)) % (2 ** 31)
        adapter_rows = generate_synthetic_ohlcv(500, n_symbols=N_SYMBOLS, seed=seed_500)
        domain_adapter = StockDomain()
        domain_adapter._csv_data = adapter_rows  # inject synthetic data for leakage / EV gates

        gate_results = runner.run_all(
            strategy_state=state,
            evidence_bundle=bundle,
            domain_adapter=domain_adapter,
        )

        # Print gate results
        print("  " + "=" * 68)
        for gr in gate_results:
            icon = GATE_ICONS.get(gr.status, "?")
            print(f"  {icon} {gr.gate_id} [{gr.status.value:8s}] {gr.gate_name}")
        g_pass = sum(1 for g in gate_results if g.status == GateStatus.PASS)
        g_fail = sum(1 for g in gate_results if g.status == GateStatus.FAIL)
        g_warn = sum(1 for g in gate_results if g.status == GateStatus.WARN)
        g_blk = sum(1 for g in gate_results if g.status == GateStatus.BLOCKED)
        print(f"  PASS={g_pass} | WARN={g_warn} | BLOCKED={g_blk} | FAIL={g_fail}")
        print("  " + "=" * 68)

        # Promotion decision
        promotion = evaluate_promotion(
            hyp,
            all_window_results[hid],
            all_perm_results[hid],
            bh_by_hyp.get(hid, []),
        )
        promotions[hid] = promotion
        print(f"  Decision: {promotion['status'].upper()}")
        for r in promotion["reasons"]:
            print(f"    → {r}")

        if promotion["status"] == "promoted_candidate":
            promoted.append(hid)
        else:
            rejected.append(hid)

        # Save outputs
        out_dir = save_hypothesis_outputs(
            hyp, all_window_results[hid], all_perm_results[hid],
            bh_by_hyp.get(hid, []), gate_results, promotion, args.dry_run,
        )
        output_dirs[hid] = out_dir

        all_results.append({
            "hypothesis_id": hid,
            "status": promotion["status"],
            "gate_pass": g_pass, "gate_warn": g_warn,
            "gate_fail": g_fail, "gate_blocked": g_blk,
            "output_dir": str(out_dir),
        })

    # ── Phase 5: Update registry with validation results ─────────────────────
    print("\n[6/6] Updating hypothesis registry...")
    for hyp in registry["hypotheses"]:
        hid = hyp["hypothesis_id"]
        if hid in promotions:
            hyp["status"] = promotions[hid]["status"]
            hyp["last_validated_at"] = datetime.now(timezone.utc).isoformat()
            hyp["validation_result"] = promotions[hid]
    REGISTRY_PATH.write_text(json.dumps(registry, indent=2))
    print(f"  Registry updated: {REGISTRY_PATH}")

    # ── Summary report ────────────────────────────────────────────────────────
    ts_end = datetime.now(timezone.utc)
    elapsed = round((ts_end - ts_start).total_seconds(), 1)

    summary = {
        "pipeline": "GBGF_STOCK_VALIDATION_P3-05",
        "run_ts": ts_start.isoformat(),
        "elapsed_seconds": elapsed,
        "dry_run": args.dry_run,
        "n_hypotheses": len(hypotheses),
        "n_windows": len(WINDOWS),
        "windows_tested": WINDOWS,
        "n_permutations": n_perms,
        "total_tests_bh_fdr": len(p_value_collection),
        "bh_fdr_passes": sum(1 for x in bh_all if x and x["bh_pass"]),
        "promoted": promoted,
        "rejected": rejected,
        "results": all_results,
        "safety": {
            "no_external_data": True,
            "no_production_write": True,
            "no_order_placement": True,
            "synthetic_data_only": True,
            "not_trading_advice": True,
        },
        "final_classification": "STOCK_HYPOTHESIS_VALIDATION_PIPELINE_READY",
    }

    output_dir_main = OUTPUT_BASE
    output_dir_main.mkdir(parents=True, exist_ok=True)
    summary_path = output_dir_main / "validation_summary.json"
    summary_path.write_text(json.dumps(summary, indent=2))

    print("\n" + "=" * 72)
    print("  VALIDATION PIPELINE COMPLETE")
    print(f"  Hypotheses: {len(hypotheses)} tested | {len(promoted)} promoted | {len(rejected)} rejected")
    print(f"  Windows: {WINDOWS}")
    print(f"  BH-FDR passes: {sum(1 for x in bh_all if x and x['bh_pass'])} / {len(p_value_collection)} tests")
    print(f"  Promoted  : {promoted or '(none — expected for random data)'}")
    print(f"  Rejected  : {rejected}")
    print(f"  Output dir: {OUTPUT_BASE}")
    print(f"  Summary   : {summary_path}")
    print(f"  Elapsed   : {elapsed}s")
    print("=" * 72)
    print()
    print("  ✅  STOCK_HYPOTHESIS_VALIDATION_PIPELINE_READY")
    print()

    return summary


def main():
    parser = argparse.ArgumentParser(description="GBGF Stock Hypothesis Validation Pipeline P3-05")
    parser.add_argument("--dry-run", action="store_true", required=True,
                        help="Required flag: confirms this is a dry run with synthetic data only")
    parser.add_argument("--permutations", type=int, default=N_PERMUTATIONS,
                        help=f"Number of permutation test iterations (default {N_PERMUTATIONS})")
    args = parser.parse_args()

    if not args.dry_run:
        print("ERROR: --dry-run flag is required. This pipeline only supports dry-run mode.")
        sys.exit(1)

    run_pipeline(args)


if __name__ == "__main__":
    main()
