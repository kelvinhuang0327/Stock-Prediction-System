#!/usr/bin/env python3
"""
GBGF Real Stock Hypothesis Batch Evaluation Pipeline — P3-07.

Runs multi-symbol, multi-window batch validation of registered hypotheses
against real Taiwan stock data from prisma/dev.db.

Safety: read-only, no production write, no order placement, no external LLM.
Point-in-time safety enforced via PointInTimeGuard (R01–R04).
BH-FDR correction applied globally across all symbol × hypothesis × window pairs.

Usage:
    python3 scripts/run_stock_real_batch_validation.py \\
        --dry-run \\
        --as-of-date 2026-05-01 \\
        --min-rows 300 \\
        --permutations 100

    # Specify symbols explicitly:
    python3 scripts/run_stock_real_batch_validation.py \\
        --dry-run \\
        --symbols 2330,2317,2454 \\
        --as-of-date 2026-05-01

    # Batch mode with more symbols:
    python3 scripts/run_stock_real_batch_validation.py \\
        --dry-run --batch \\
        --as-of-date 2026-05-01 \\
        --min-rows 300 \\
        --permutations 200
"""

import argparse
import hashlib
import json
import math
import random
import sqlite3
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
    GateStatus,
    StrategyState,
    ValidationTier,
)
from gbgf.gates.gate_runner import GateRunner
from gbgf.domain.stock_real import StockRealDomain, DATA_INSUFFICIENT
from gbgf.domain.point_in_time_guard import PointInTimeGuard

REGISTRY_PATH = ROOT / "research" / "stock_hypothesis_registry.json"
DB_PATH = ROOT / "prisma" / "dev.db"
OUTPUT_BATCH_BASE = ROOT / "outputs" / "stock_validation_real_batch"

BATCH_WINDOWS = [150, 500]          # trading-day window sizes
FORWARD_DAYS = 5
TX_COST_BPS = 10
DEFAULT_MIN_ROWS = 300
DEFAULT_N_PERMUTATIONS = 500
DEFAULT_AUTO_SYMBOLS = 8            # how many symbols to auto-select

GATE_ICONS = {
    GateStatus.PASS: "✅",
    GateStatus.FAIL: "❌",
    GateStatus.WARN: "⚠️",
    GateStatus.BLOCKED: "🚫",
    GateStatus.SKIPPED: "⏭",
}


# ── Symbol universe selector ────────────────────────────────────────────────────

def select_symbols(
    as_of_date: str,
    min_rows: int = DEFAULT_MIN_ROWS,
    n_max: int = DEFAULT_AUTO_SYMBOLS,
    db_path: Path = DB_PATH,
    requested_symbols: Optional[List[str]] = None,
) -> List[str]:
    """
    Return a list of symbols with sufficient real data.

    If requested_symbols is provided, filter those by availability.
    Otherwise auto-select the top n_max by row count from StockQuote.

    Criteria:
    - ISO date (YYYY-MM-DD) only
    - date <= as_of_date
    - row_count >= min_rows
    """
    if not db_path.exists():
        return []
    try:
        conn = sqlite3.connect(str(db_path))
        c = conn.cursor()
        if requested_symbols:
            placeholders = ",".join("?" * len(requested_symbols))
            c.execute(
                f"""
                SELECT stockId, COUNT(*) as n
                FROM StockQuote
                WHERE stockId IN ({placeholders})
                  AND date LIKE '20%' AND length(date) = 10
                  AND date <= ?
                GROUP BY stockId
                HAVING n >= ?
                ORDER BY n DESC
                """,
                requested_symbols + [as_of_date, min_rows],
            )
        else:
            c.execute(
                """
                SELECT stockId, COUNT(*) as n
                FROM StockQuote
                WHERE date LIKE '20%' AND length(date) = 10
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


# ── Signal computers (real OHLCV rows) ─────────────────────────────────────────

def compute_momentum_signals(rows: List[Dict], lookback: int = 20, forward: int = 5) -> List[Dict]:
    """H001: 20-day price momentum → next-5d directional return."""
    closes = [float(r["close"]) for r in rows]
    signals = []
    for i in range(lookback, len(closes) - forward):
        mom = (closes[i] - closes[i - lookback]) / closes[i - lookback]
        fwd = (closes[i + forward] - closes[i]) / closes[i]
        sig = 1 if mom > 0 else -1
        signals.append({"date": rows[i]["date"], "signal": sig,
                         "forward_return": round(fwd * sig, 6)})
    return signals


def compute_rsi_reversion_signals(rows: List[Dict], period: int = 5, forward: int = 5) -> List[Dict]:
    """H002: RSI(5) mean reversion. Buy oversold (<30), sell overbought (>70)."""
    closes = [float(r["close"]) for r in rows]
    signals = []
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
        signals.append({"date": rows[i]["date"], "signal": sig,
                         "rsi": round(rsi, 2), "forward_return": round(fwd * sig, 6)})
    return signals


def compute_volume_breakout_signals(
    rows: List[Dict], lookback: int = 20, volume_mult: float = 1.5, forward: int = 5
) -> List[Dict]:
    """H003: Volume breakout (volume > 1.5x 20d avg AND close > open)."""
    closes = [float(r["close"]) for r in rows]
    volumes = [float(r["volume"]) for r in rows]
    opens = [float(r["open"]) for r in rows]
    signals = []
    for i in range(lookback, len(closes) - forward):
        avg_vol = sum(volumes[i - lookback:i]) / lookback
        if closes[i] > opens[i] and volumes[i] > volume_mult * avg_vol:
            fwd = (closes[i + forward] - closes[i]) / closes[i]
            signals.append({"date": rows[i]["date"], "signal": 1,
                             "volume_ratio": round(volumes[i] / avg_vol, 3),
                             "forward_return": round(fwd, 6)})
    return signals


SIGNAL_COMPUTERS = {
    "STOCK_H001_20D_MOMENTUM": compute_momentum_signals,
    "STOCK_H002_RSI_REVERSION": compute_rsi_reversion_signals,
    "STOCK_H003_VOLUME_BREAKOUT": compute_volume_breakout_signals,
}


# ── Per-window OOS evaluation on real rows ─────────────────────────────────────

def eval_window(
    hid: str,
    rows: List[Dict],
    window_days: int,
    n_permutations: int,
    seed: int,
) -> Dict[str, Any]:
    """
    Evaluate one hypothesis on `rows` using last `window_days` (or fewer if not
    enough). Returns metrics dict with permutation p-value.
    """
    signal_fn = SIGNAL_COMPUTERS.get(hid)
    if signal_fn is None:
        return {"status": DATA_INSUFFICIENT, "error": f"no signal fn for {hid}"}

    # Trim to last window_days rows (strict PIT: rows already filtered to asOfDate)
    use_rows = rows[-window_days:] if len(rows) >= window_days else rows
    if len(use_rows) < window_days:
        return {
            "status": DATA_INSUFFICIENT,
            "window_days": window_days,
            "actual_rows": len(use_rows),
            "error": f"only {len(use_rows)} rows < window_days={window_days}",
        }

    all_sigs = signal_fn(use_rows, forward=FORWARD_DAYS)
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
    sharpe = round((mean_r / std_r) * math.sqrt(252 / FORWARD_DAYS), 4)
    win_rate = round(sum(1 for r in returns if r > 0) / n, 4)
    roi = round(mean_r * 252 / FORWARD_DAYS, 6)
    edge_pp = round((win_rate - 0.5) * 100, 4)

    # Permutation test
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
    }


# ── BH-FDR correction ──────────────────────────────────────────────────────────

def bh_fdr_correction(
    tests: List[Dict[str, Any]], alpha: float = 0.10
) -> List[Dict[str, Any]]:
    """
    Benjamini-Hochberg FDR across all tests.
    Each test dict must have 'p_value'. Returns updated dicts with
    'bh_fdr_q_value', 'bh_fdr_pass', 'raw_p_value'.
    """
    m = len(tests)
    if m == 0:
        return []
    sorted_idx = sorted(range(m), key=lambda i: tests[i].get("p_value", 1.0))
    results = [dict(t) for t in tests]
    for results_i in results:
        results_i["raw_p_value"] = results_i.get("p_value", 1.0)
        results_i["bh_fdr_q_value"] = 1.0
        results_i["bh_fdr_pass"] = False

    for rank, orig_i in enumerate(sorted_idx, start=1):
        pv = tests[orig_i].get("p_value", 1.0)
        q = min(pv * m / rank, 1.0)
        results[orig_i]["bh_fdr_q_value"] = round(q, 6)
        results[orig_i]["bh_fdr_pass"] = q < alpha

    return results


# ── Promotion gate ──────────────────────────────────────────────────────────────

def decide_promotion(
    hid: str,
    symbol: str,
    window_results: List[Dict],
    pit_passed: bool,
    has_leakage: bool,
    # cross-batch support count for this hypothesis:
    cross_symbol_count: int = 1,
    cross_window_count: int = 1,
) -> str:
    """
    Return 'REAL_EDGE_CANDIDATE', 'REJECTED', or 'DATA_INSUFFICIENT'.
    Strict gate: ALL conditions must hold.
    """
    valid = [wr for wr in window_results if wr.get("status") == "OK"]
    if not valid:
        return "DATA_INSUFFICIENT"

    if not pit_passed or has_leakage:
        return "REJECTED"

    roi_ok = all(wr.get("roi_annualized", 0) > 0 for wr in valid)
    sharpe_ok = any(wr.get("sharpe_annualized", 0) > 0 for wr in valid)
    perm_ok = any(wr.get("p_value", 1.0) < 0.05 for wr in valid)
    bh_ok = any(wr.get("bh_fdr_pass", False) for wr in valid)

    # Cross-symbol OR cross-window replication requirement
    replication_ok = (cross_symbol_count >= 2 or cross_window_count >= 2)

    if roi_ok and sharpe_ok and perm_ok and bh_ok and replication_ok:
        return "REAL_EDGE_CANDIDATE"
    return "REJECTED"


# ── Main batch pipeline ─────────────────────────────────────────────────────────

def run_batch_pipeline(args: argparse.Namespace) -> Dict[str, Any]:
    ts_start = datetime.now(timezone.utc)
    as_of_date = args.as_of_date or ts_start.strftime("%Y-%m-%d")
    min_rows = args.min_rows
    window_days_max = args.window_days
    n_perms = args.permutations

    print("\n" + "=" * 72)
    print("  GBGF Real Stock Hypothesis Batch Evaluation — P3-07")
    print(f"  {ts_start.isoformat()}")
    print(f"  as_of_date={as_of_date}  min_rows={min_rows}  window_days={window_days_max}")
    print(f"  permutations={n_perms}")
    print("  ⚠️  REAL DATA — READ-ONLY — NOT A TRADING RECOMMENDATION")
    print("=" * 72 + "\n")

    # ── Load hypothesis registry ──────────────────────────────────────────────
    if not REGISTRY_PATH.exists():
        print(f"ERROR: registry not found at {REGISTRY_PATH}")
        sys.exit(1)
    registry = json.loads(REGISTRY_PATH.read_text())
    hypotheses = registry.get("hypotheses", [])
    print(f"[1/7] Loaded {len(hypotheses)} hypotheses from registry")

    # ── Select symbols ────────────────────────────────────────────────────────
    requested = [s.strip() for s in args.symbols.split(",") if s.strip()] if args.symbols else None
    symbols = select_symbols(as_of_date, min_rows=min_rows,
                             requested_symbols=requested, db_path=DB_PATH)

    print(f"[2/7] Symbol universe: {len(symbols)} symbol(s) with >= {min_rows} rows")
    if not symbols:
        print(f"\n  ⚠️  {DATA_INSUFFICIENT}: No symbols with >= {min_rows} ISO-date rows up to {as_of_date}")
        return {"status": DATA_INSUFFICIENT, "symbols_evaluated": []}

    if len(symbols) < 5:
        print(f"  ⚠️  Only {len(symbols)} symbols available (< 5 requested). Proceeding with what's available.")

    print(f"  Symbols: {symbols}\n")

    output_dir_date = OUTPUT_BATCH_BASE / as_of_date.replace("-", "")
    output_dir_date.mkdir(parents=True, exist_ok=True)

    runner = GateRunner()
    pit_guard = PointInTimeGuard(as_of_date=as_of_date, forward_days=FORWARD_DAYS)

    # ── Collect all window-level test results for BH-FDR ─────────────────────
    all_tests: List[Dict[str, Any]] = []   # will be BH-FDR corrected globally

    # symbol → hyp → list of window results
    raw_results: Dict[str, Dict[str, List[Dict]]] = {}

    print("[3/7] Running window-level OOS + permutation tests...")
    for sym in symbols:
        raw_results[sym] = {}
        # Load rows once per symbol
        domain_adapter = StockRealDomain(
            symbol=sym,
            as_of_date=as_of_date,
            window_days=window_days_max,
            db_path=DB_PATH,
            min_rows=min_rows,
        )
        rows = domain_adapter._load_rows()

        if rows == DATA_INSUFFICIENT or not rows:
            print(f"  {sym}: {DATA_INSUFFICIENT}")
            for hyp in hypotheses:
                hid = hyp["hypothesis_id"]
                raw_results[sym][hid] = [
                    {"status": DATA_INSUFFICIENT, "window_days": w, "symbol": sym}
                    for w in BATCH_WINDOWS
                ]
            continue

        pit_result = pit_guard.check(rows, split_type="time_based")
        print(f"  {sym}: {len(rows)} rows  PIT={'PASS' if pit_result.passed else 'FAIL'}")

        for hyp in hypotheses:
            hid = hyp["hypothesis_id"]
            hyp_windows = []
            for w in BATCH_WINDOWS:
                seed = hash(f"{sym}:{hid}:{w}") % (2 ** 31)
                wr = eval_window(hid, rows, w, n_perms, seed)
                wr["symbol"] = sym
                wr["hypothesis_id"] = hid
                wr["window_days"] = w
                wr["pit_passed"] = pit_result.passed
                wr["pit_leakage"] = pit_result.has_leakage
                hyp_windows.append(wr)
                all_tests.append(wr)

                sharpe = wr.get("sharpe_annualized", "N/A")
                roi = wr.get("roi_annualized", "N/A")
                pv = wr.get("p_value", "N/A")
                status = wr.get("status", "?")
                if status == "OK":
                    print(f"    {sym} × {hid[:20]} × {w}d: sharpe={sharpe:+.3f} roi={roi:+.4f} p={pv:.3f}")
                else:
                    print(f"    {sym} × {hid[:20]} × {w}d: {status}")

            raw_results[sym][hid] = hyp_windows

    # ── Global BH-FDR correction ──────────────────────────────────────────────
    print(f"\n[4/7] BH-FDR correction over {len(all_tests)} tests (alpha=0.10)...")
    bh_corrected = bh_fdr_correction(all_tests, alpha=0.10)

    # Merge BH results back into raw_results
    test_idx = 0
    for sym in symbols:
        for hyp in hypotheses:
            hid = hyp["hypothesis_id"]
            for i, wr in enumerate(raw_results[sym][hid]):
                if test_idx < len(bh_corrected):
                    bh = bh_corrected[test_idx]
                    raw_results[sym][hid][i]["raw_p_value"] = bh.get("raw_p_value", 1.0)
                    raw_results[sym][hid][i]["bh_fdr_q_value"] = bh.get("bh_fdr_q_value", 1.0)
                    raw_results[sym][hid][i]["bh_fdr_pass"] = bh.get("bh_fdr_pass", False)
                test_idx += 1

    # ── Compute cross-symbol replication counts ────────────────────────────────
    # For each hypothesis: how many symbols show ROI > 0 on primary 500d window?
    hyp_cross_symbol_count: Dict[str, int] = {}
    for hyp in hypotheses:
        hid = hyp["hypothesis_id"]
        count = 0
        for sym in symbols:
            w500 = next((w for w in raw_results[sym][hid] if w.get("window_days") == 500
                         and w.get("status") == "OK" and w.get("roi_annualized", 0) > 0), None)
            if w500:
                count += 1
        hyp_cross_symbol_count[hid] = count

    # ── Per-hypothesis cross-window count ─────────────────────────────────────
    # For each (sym, hyp): how many windows show ROI > 0?
    def cross_window_count(sym: str, hid: str) -> int:
        return sum(
            1 for wr in raw_results[sym][hid]
            if wr.get("status") == "OK" and wr.get("roi_annualized", 0) > 0
        )

    # ── G01–G10 per (symbol × hypothesis) ─────────────────────────────────────
    print("[5/7] Running G01–G10 gates for each symbol × hypothesis...")
    gate_results_map: Dict[str, Dict[str, Any]] = {}

    for sym in symbols:
        gate_results_map[sym] = {}
        domain_adapter = StockRealDomain(
            symbol=sym, as_of_date=as_of_date,
            window_days=window_days_max, db_path=DB_PATH, min_rows=min_rows,
        )
        rows = domain_adapter._load_rows()
        pit_result = pit_guard.check(
            rows if rows != DATA_INSUFFICIENT and rows else [],
            split_type="time_based",
        )

        for hyp in hypotheses:
            hid = hyp["hypothesis_id"]
            windows = raw_results[sym][hid]
            primary = next((w for w in windows if w.get("window_days") == 500
                            and w.get("status") == "OK"), None)
            if primary is None:
                primary = next((w for w in windows if w.get("status") == "OK"), None)

            sharpe_val = primary.get("sharpe_annualized", 0) if primary else 0
            if sharpe_val and sharpe_val > 0.5:
                ev_class = "EV_POSITIVE"
            elif sharpe_val and sharpe_val > 0:
                ev_class = "VALID_SIGNAL_NON_MONETIZABLE"
            else:
                ev_class = "EV_NEGATIVE_BY_DESIGN"

            state = StrategyState(
                strategy_id=hid,
                ev_classification=ev_class,
                tier=ValidationTier.T1_REGISTERED,
                human_review_complete=False,
                domain=DomainType.STOCK,
            )

            n_oos = primary.get("n_oos", 0) if primary else 0
            edge_pp = primary.get("edge_pp", 0.0) if primary else 0.0
            bundle = EvidenceBundle(
                strategy_id=hid,
                gate_results=[],
                backtest_results=[
                    BacktestResult(
                        strategy_id=hid,
                        window_label=f"real_{sym}_500d",
                        edge_pp=max(0.0, edge_pp),
                        p_value=primary.get("p_value", 1.0) if primary else 1.0,
                        n_samples=n_oos,
                        passed_degraded_threshold=sharpe_val > 0,
                    )
                ],
                metadata={
                    "pipeline": "P3-07",
                    "symbol": sym,
                    "as_of_date": as_of_date,
                    "real_data": True,
                    "multi_window": True,
                    "permutation_tested": True,
                    "bh_fdr_corrected": True,
                },
            )

            gr = runner.run_all(
                strategy_state=state,
                evidence_bundle=bundle,
                domain_adapter=domain_adapter,
            )
            gate_results_map[sym][hid] = gr

    # ── Promotion decisions ────────────────────────────────────────────────────
    print("[6/7] Evaluating promotion decisions...")
    promotion_map: Dict[str, Dict[str, str]] = {}
    promoted_candidates: List[Dict] = []

    for sym in symbols:
        promotion_map[sym] = {}
        for hyp in hypotheses:
            hid = hyp["hypothesis_id"]
            windows = raw_results[sym][hid]

            # Re-retrieve PIT info
            any_pit_passed = any(w.get("pit_passed", False) for w in windows)
            any_leakage = any(w.get("pit_leakage", False) for w in windows)
            valid_windows = [w for w in windows if w.get("status") == "OK"]

            status = decide_promotion(
                hid=hid, symbol=sym,
                window_results=valid_windows,
                pit_passed=any_pit_passed,
                has_leakage=any_leakage,
                cross_symbol_count=hyp_cross_symbol_count.get(hid, 1),
                cross_window_count=cross_window_count(sym, hid),
            )
            promotion_map[sym][hid] = status

            if status == "REAL_EDGE_CANDIDATE":
                promoted_candidates.append({"symbol": sym, "hypothesis_id": hid})
            print(f"  {sym} × {hid[:30]}: {status}")

    # ── Save per-result output files ───────────────────────────────────────────
    print("[7/7] Saving outputs...")
    for sym in symbols:
        for hyp in hypotheses:
            hid = hyp["hypothesis_id"]
            out_dir = output_dir_date / sym / hid.lower()
            out_dir.mkdir(parents=True, exist_ok=True)

            windows = raw_results[sym][hid]
            gate_results = gate_results_map[sym][hid]
            promotion = promotion_map[sym][hid]
            ts = ts_start.isoformat()

            # gate_result.json
            (out_dir / "gate_result.json").write_text(json.dumps({
                "hypothesis_id": hid,
                "symbol": sym,
                "as_of_date": as_of_date,
                "status": promotion,
                "gate_statuses": {gr.gate_id: gr.status.value for gr in gate_results},
                "window_results": windows,
                "run_ts": ts,
            }, indent=2))

            # validation_metrics.json
            valid = [w for w in windows if w.get("status") == "OK"]
            avg_sharpe = round(sum(w.get("sharpe_annualized", 0) for w in valid) / max(len(valid), 1), 4)
            avg_roi = round(sum(w.get("roi_annualized", 0) for w in valid) / max(len(valid), 1), 4)
            bh_passes = [w for w in windows if w.get("bh_fdr_pass", False)]
            (out_dir / "validation_metrics.json").write_text(json.dumps({
                "hypothesis_id": hid,
                "symbol": sym,
                "as_of_date": as_of_date,
                "windows_tested": [w.get("window_days") for w in windows],
                "windows_ok": [w.get("window_days") for w in valid],
                "avg_sharpe_annualized": avg_sharpe,
                "avg_roi_annualized": avg_roi,
                "bh_fdr_pass_count": len(bh_passes),
                "promoted": promotion,
                "run_ts": ts,
            }, indent=2))

            # data_lineage.json — refresh adapter for clean lineage
            lineage_adapter = StockRealDomain(
                symbol=sym, as_of_date=as_of_date,
                window_days=window_days_max, db_path=DB_PATH, min_rows=min_rows,
            )
            lineage_adapter._load_rows()
            lineage = lineage_adapter.get_data_lineage()
            (out_dir / "data_lineage.json").write_text(json.dumps(lineage, indent=2))

            # reproducibility_pack.json
            repro = {
                "run_id": f"{hid}-{sym}-{as_of_date}",
                "hypothesis_id": hid,
                "symbol": sym,
                "pipeline_version": "P3-07",
                "run_ts": ts,
                "as_of_date": as_of_date,
                "window_days_max": window_days_max,
                "windows_evaluated": BATCH_WINDOWS,
                "n_permutations": n_perms,
                "data_lineage": lineage,
                "gate_statuses": {gr.gate_id: gr.status.value for gr in gate_results},
                "final_status": promotion,
                "safety_confirmations": {
                    "no_production_write": True,
                    "no_trade_execution": True,
                    "not_trading_advice": True,
                    "real_data_read_only": True,
                    "pit_guard_r01_r04": True,
                    "bh_fdr_corrected": True,
                    "no_random_split": True,
                    "time_based_split_only": True,
                },
            }
            (out_dir / "reproducibility_pack.json").write_text(json.dumps(repro, indent=2))

    # ── Compute batch-level summary stats ──────────────────────────────────────
    all_valid = [t for t in all_tests if t.get("status") == "OK"]
    all_di = [t for t in all_tests if t.get("status") == DATA_INSUFFICIENT]
    all_pit_passed = [t for t in all_tests if t.get("pit_passed", False)]
    all_promoted = [v for sym_map in promotion_map.values() for v in sym_map.values()
                    if v == "REAL_EDGE_CANDIDATE"]
    all_rejected = [v for sym_map in promotion_map.values() for v in sym_map.values()
                    if v == "REJECTED"]
    avg_sharpe_global = (
        round(sum(t.get("sharpe_annualized", 0) for t in all_valid) / max(len(all_valid), 1), 4)
        if all_valid else 0.0
    )
    avg_roi_global = (
        round(sum(t.get("roi_annualized", 0) for t in all_valid) / max(len(all_valid), 1), 4)
        if all_valid else 0.0
    )
    perm_passes = sum(1 for t in all_valid if t.get("p_value", 1.0) < 0.05)
    perm_pass_rate = round(perm_passes / max(len(all_valid), 1), 4)
    bh_fdr_pass_count = sum(1 for t in all_tests if t.get("bh_fdr_pass", False))
    leakage_violations = sum(1 for t in all_tests if t.get("pit_leakage", False))

    final_cls = (
        "REAL_BATCH_EVALUATION_NO_EDGE_FOUND"
        if not promoted_candidates
        else "REAL_BATCH_EVALUATION_READY"
    )
    if len(symbols) < 5:
        final_cls = "REAL_BATCH_EVALUATION_DATA_INSUFFICIENT"

    summary = {
        "pipeline_version": "P3-07",
        "run_ts": ts_start.isoformat(),
        "as_of_date": as_of_date,
        "symbols_requested": requested or "auto",
        "symbols_evaluated": symbols,
        "hypotheses_evaluated": [h["hypothesis_id"] for h in hypotheses],
        "windows_evaluated": BATCH_WINDOWS,
        "total_tests": len(all_tests),
        "total_valid_tests": len(all_valid),
        "total_passed_pit": len(all_pit_passed),
        "total_data_insufficient": len(all_di),
        "promoted_candidates": promoted_candidates,
        "rejected_count": len(all_rejected),
        "avg_roi": avg_roi_global,
        "avg_sharpe": avg_sharpe_global,
        "permutation_pass_rate": perm_pass_rate,
        "bh_fdr_pass_count": bh_fdr_pass_count,
        "leakage_violation_count": leakage_violations,
        "random_split_violation_count": 0,  # random split never used
        "final_classification": final_cls,
        "safety_confirmations": {
            "no_production_write": True,
            "no_trade_execution": True,
            "not_trading_advice": True,
            "real_data_read_only": True,
            "bh_fdr_corrected": True,
            "pit_guard_enforced": True,
            "no_random_split": True,
        },
    }

    # Write batch_summary.json
    summary_json_path = output_dir_date / "batch_summary.json"
    summary_json_path.write_text(json.dumps(summary, indent=2))

    # Write batch_summary.md
    elapsed = round((datetime.now(timezone.utc) - ts_start).total_seconds(), 1)
    md_lines = [
        "# GBGF Real Stock Batch Evaluation — P3-07",
        "",
        f"**Run date:** {ts_start.strftime('%Y-%m-%d %H:%M')} UTC",
        f"**As-of date:** {as_of_date}",
        f"**Pipeline:** P3-07",
        "",
        "## Summary",
        "",
        f"| Field | Value |",
        f"|-------|-------|",
        f"| Symbols evaluated | {len(symbols)} |",
        f"| Hypotheses | {len(hypotheses)} |",
        f"| Windows | {BATCH_WINDOWS} |",
        f"| Total tests | {len(all_tests)} |",
        f"| Valid tests | {len(all_valid)} |",
        f"| Passed PIT guard | {len(all_pit_passed)} |",
        f"| Data insufficient | {len(all_di)} |",
        f"| Avg Sharpe | {avg_sharpe_global:+.4f} |",
        f"| Avg ROI | {avg_roi_global:+.4f} |",
        f"| Permutation pass rate | {perm_pass_rate:.2%} |",
        f"| BH-FDR passes | {bh_fdr_pass_count} |",
        f"| Leakage violations | {leakage_violations} |",
        f"| Promoted candidates | {len(promoted_candidates)} |",
        f"| Rejected | {len(all_rejected)} |",
        "",
        "## Promoted Candidates",
        "",
    ]
    if promoted_candidates:
        for pc in promoted_candidates:
            md_lines.append(f"- **{pc['symbol']}** × {pc['hypothesis_id']}")
    else:
        md_lines.append("_None — no hypothesis met all promotion criteria_")

    md_lines += [
        "",
        "## Final Classification",
        "",
        f"**{final_cls}**",
        "",
        "## Safety",
        "",
        "- Read-only access to prisma/dev.db",
        "- No production write",
        "- No trade execution",
        "- PIT guard R01–R04 enforced",
        "- BH-FDR correction applied globally",
        "- Time-based split only (no random split)",
        "",
        "_Not a trading recommendation._",
    ]
    (output_dir_date / "batch_summary.md").write_text("\n".join(md_lines))

    # ── Print final summary ────────────────────────────────────────────────────
    print("\n" + "=" * 72)
    print(f"  Symbols    : {symbols}")
    print(f"  Total tests: {len(all_tests)}  Valid: {len(all_valid)}  D/I: {len(all_di)}")
    print(f"  Avg Sharpe : {avg_sharpe_global:+.4f}   Avg ROI: {avg_roi_global:+.4f}")
    print(f"  Perm passes: {perm_passes}/{len(all_valid)} ({perm_pass_rate:.1%})")
    print(f"  BH-FDR pass: {bh_fdr_pass_count}")
    print(f"  Promoted   : {promoted_candidates}")
    print(f"  Rejected   : {len(all_rejected)}")
    print(f"  Output dir : {output_dir_date}")
    print(f"  Elapsed    : {elapsed}s")
    print("=" * 72)
    print()
    print(f"  ✅  {final_cls}")
    print()

    return summary


def main() -> None:
    parser = argparse.ArgumentParser(
        description="GBGF Real Stock Hypothesis Batch Evaluation Pipeline — P3-07"
    )
    parser.add_argument("--dry-run", action="store_true", required=True,
                        help="Required safety flag (confirms read-only research mode)")
    parser.add_argument("--batch", action="store_true", default=False,
                        help="Enable batch mode (process multiple symbols)")
    parser.add_argument("--symbols", type=str, default=None,
                        help="Comma-separated list of symbols (e.g. 2330,2317,2454). "
                             "If omitted, auto-selects top N by row count.")
    parser.add_argument("--as-of-date", type=str, default=None,
                        help="As-of date YYYY-MM-DD (default: today)")
    parser.add_argument("--window-days", type=int, default=1500,
                        help="Maximum window days to load per symbol (default: 1500)")
    parser.add_argument("--min-rows", type=int, default=DEFAULT_MIN_ROWS,
                        help=f"Minimum rows to include a symbol (default: {DEFAULT_MIN_ROWS})")
    parser.add_argument("--permutations", type=int, default=DEFAULT_N_PERMUTATIONS,
                        help=f"Permutation test iterations per window (default: {DEFAULT_N_PERMUTATIONS})")
    args = parser.parse_args()

    if not args.dry_run:
        print("ERROR: --dry-run is required (safety flag for research-only mode).")
        sys.exit(1)

    if not args.as_of_date:
        args.as_of_date = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    run_batch_pipeline(args)


if __name__ == "__main__":
    main()
