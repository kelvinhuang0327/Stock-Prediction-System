#!/usr/bin/env python3
"""
T-05 Portfolio Walk-Forward Skeleton
=====================================
PIT-safe portfolio-level walk-forward evaluation framework skeleton.

SAFETY CONTRACT:
- Default dry-run (does NOT write any file without --output flag)
- Reads prisma/dev.db only (no writes)
- Does NOT generate buy/sell/signal output
- Does NOT compute ROI or win-rate
- Does NOT use H001-H012 retired hypotheses
- Does NOT use chip/revenue/financial production features
- All data selection: date <= asof_date (PIT-safe)
- Regime: asof_date or earlier only
- Sample: last 120 trading days max
- Portfolio candidates: max 10 per day (deterministic alphabetical mock)
"""

import argparse
import json
import math
import os
import sqlite3
import sys
from datetime import date, timedelta

DB_PATH = os.path.join(os.path.dirname(__file__), "..", "prisma", "dev.db")
MAX_SAMPLE_DAYS = 120
MAX_CANDIDATES = 10
FEATURE_WINDOW_DAYS = 60
TODAY_CAP = "2026-05-06"  # TAIEX max available date

# P4_03_READY features (from p4_02_feature_contract.json)
P4_03_READY_FEATURES = [
    "close_price", "open_price", "high_price", "low_price", "volume",
    "price_change_pct", "ma_5d", "ma_20d", "ma_60d",
    "volume_ma_5d", "volume_ma_20d",
    "regime_label", "regime_confidence",
    "price_vs_ma20", "price_vs_ma60", "volatility_20d"
]

# Chip/revenue/financial features - MUST NOT USE as production
FORBIDDEN_CHIP_FEATURES = ["net_buy_foreign", "net_buy_trust", "net_buy_dealer", "margin_balance", "short_balance"]
FORBIDDEN_REVENUE_FEATURES = ["monthly_revenue", "revenue_yoy", "revenue_mom", "revenue_3ma"]
FORBIDDEN_FINANCIAL_FEATURES = ["eps", "roe", "debt_ratio", "gross_margin", "operating_margin", "net_margin"]


def get_taiex_dates(conn, cap_date: str, limit: int):
    """Get last N TAIEX trading dates up to cap_date (PIT-safe)."""
    rows = conn.execute(
        "SELECT date FROM MarketIndex WHERE name='TAIEX' AND date <= ? ORDER BY date DESC LIMIT ?",
        (cap_date, limit)
    ).fetchall()
    dates = [r[0] for r in rows]
    dates.sort()
    return dates


def compute_regime_for_date(conn, asof_date: str):
    """
    Compute market regime for asof_date using only TAIEX data <= asof_date.
    Inlines PIT-safe regime logic from build-market-regime-classifier.py.
    """
    # Fetch TAIEX data up to asof_date
    rows = conn.execute(
        "SELECT date, value FROM MarketIndex WHERE name='TAIEX' AND date <= ? ORDER BY date DESC LIMIT 250",
        (asof_date,)
    ).fetchall()
    if len(rows) < 20:
        return "LOW_CONFIDENCE", 0.0

    rows.sort(key=lambda x: x[0])
    values = [r[1] for r in rows]
    dates = [r[0] for r in rows]

    current = values[-1]

    def ma(vals, n):
        if len(vals) < n:
            return None
        return sum(vals[-n:]) / n

    ma50 = ma(values, 50)
    ma200 = ma(values, 200)

    # Volatility (annualized, 20-day)
    if len(values) >= 21:
        returns = [math.log(values[i] / values[i-1]) for i in range(len(values)-20, len(values)) if values[i-1] > 0]
        if len(returns) >= 2:
            avg_r = sum(returns) / len(returns)
            variance = sum((r - avg_r)**2 for r in returns) / (len(returns) - 1)
            vol_20d = math.sqrt(variance) * math.sqrt(252)
        else:
            vol_20d = 0.0
    else:
        vol_20d = 0.0

    if vol_20d > 0.30:
        return "HIGH_VOLATILITY", round(min(vol_20d / 0.30, 1.0) * 0.8, 4)

    # Scoring
    score = 0
    max_score = 13
    ma200_available = ma200 is not None

    if ma50 is not None:
        score += 2 if current > ma50 else 0
    if ma200 is not None:
        score += 3 if current > ma200 else 0
    if ma50 is not None and ma200 is not None:
        score += 2 if ma50 > ma200 else 0

    # Momentum 20d
    if len(values) >= 21:
        prev20 = values[-21]
        if prev20 > 0:
            mom20 = (current - prev20) / prev20
            if mom20 >= 0.02:
                score += 2
            elif mom20 <= -0.02:
                score += 0
            else:
                score += 1

    # Momentum 60d
    if len(values) >= 61:
        prev60 = values[-61]
        if prev60 > 0:
            mom60 = (current - prev60) / prev60
            if mom60 >= 0.05:
                score += 2
            elif mom60 <= -0.05:
                score += 0
            else:
                score += 1

    # Market breadth proxy
    breadth_row = conn.execute(
        """SELECT COUNT(*) as total,
           SUM(CASE WHEN change > 0 THEN 1 ELSE 0 END) as up
           FROM StockQuote WHERE date = ?""",
        (asof_date,)
    ).fetchone()
    if breadth_row and breadth_row[0] > 0:
        breadth = breadth_row[1] / breadth_row[0]
        if breadth >= 0.50:
            score += 2
        elif breadth >= 0.45:
            score += 1

    ratio = score / max_score
    if not ma200_available:
        ratio = ratio * 0.60

    if ratio >= 0.70:
        label = "BULL"
    elif ratio <= 0.30:
        label = "BEAR"
    else:
        label = "SIDEWAYS"

    confidence = round(ratio, 4)
    return label, confidence


def get_candidates_for_date(conn, asof_date: str, max_n: int = MAX_CANDIDATES):
    """
    Get deterministic mock portfolio candidates for asof_date.
    Selection: StockQuote symbols present on asof_date, excl ETFs (id LIKE '00%'),
    alphabetical order, top max_n. PIT-safe: only data from that date.
    """
    rows = conn.execute(
        """SELECT sq.stockId
           FROM StockQuote sq
           WHERE sq.date = ?
             AND sq.stockId NOT LIKE '00%'
           ORDER BY sq.stockId ASC
           LIMIT ?""",
        (asof_date, max_n)
    ).fetchall()
    return [r[0] for r in rows]


def get_coverage_for_date(conn, asof_date: str):
    """Count total stocks (incl ETF) in StockQuote for asof_date."""
    row = conn.execute(
        "SELECT COUNT(DISTINCT stockId) FROM StockQuote WHERE date = ?",
        (asof_date,)
    ).fetchone()
    return row[0] if row else 0


def compute_available_features(conn, asof_date: str, window_start: str):
    """Count P4_03_READY features available (price features always available if data exists)."""
    # Check TAIEX for regime features
    taiex_ok = conn.execute(
        "SELECT COUNT(*) FROM MarketIndex WHERE name='TAIEX' AND date <= ? AND date >= ?",
        (asof_date, window_start)
    ).fetchone()[0] >= 20

    # Check stock quote for price features
    sq_ok = conn.execute(
        "SELECT COUNT(*) FROM StockQuote WHERE date = ?",
        (asof_date,)
    ).fetchone()[0] > 0

    available = 0
    missing = 0

    # Price/OHLCV features (9 features: close,open,high,low,volume,change_pct,ma5,ma20,ma60)
    price_features = ["close_price", "open_price", "high_price", "low_price", "volume",
                      "price_change_pct", "ma_5d", "ma_20d", "ma_60d"]
    if sq_ok:
        available += len(price_features)
    else:
        missing += len(price_features)

    # Volume MA features (2)
    vol_features = ["volume_ma_5d", "volume_ma_20d"]
    if sq_ok:
        available += len(vol_features)
    else:
        missing += len(vol_features)

    # Regime features (2)
    regime_features = ["regime_label", "regime_confidence"]
    if taiex_ok:
        available += len(regime_features)
    else:
        missing += len(regime_features)

    # Technical features (3: price_vs_ma20, price_vs_ma60, volatility_20d)
    tech_features = ["price_vs_ma20", "price_vs_ma60", "volatility_20d"]
    if sq_ok:
        available += len(tech_features)
    else:
        missing += len(tech_features)

    return available, missing


def compute_window_start(asof_date: str, days: int = FEATURE_WINDOW_DAYS) -> str:
    """Compute window start date (asof_date minus days)."""
    from datetime import datetime
    d = datetime.strptime(asof_date, "%Y-%m-%d")
    start = d - timedelta(days=days)
    return start.strftime("%Y-%m-%d")


def get_regime_context_from_db(conn, asof_date: str) -> dict:
    """
    Read-only lookup of persisted MarketRegimeResult for asof_date.
    PIT-safe: only rows WHERE date <= asof_date, ordered DESC, take 1.
    Never writes to DB. Never uses future regime data.
    """
    row = conn.execute(
        """SELECT date, regimeLabel, confidence, taiexClose, source, version
           FROM MarketRegimeResult
           WHERE date <= ?
           ORDER BY date DESC
           LIMIT 1""",
        (asof_date,)
    ).fetchone()

    if row is None:
        return {
            "asofDate": asof_date,
            "regimeDate": None,
            "regimeLabel": "LOW_CONFIDENCE",
            "confidence": 0,
            "freshnessStatus": "MISSING",
            "freshnessLagDays": None,
            "source": None,
            "version": None,
            "isAvailable": False,
            "warning": "No persisted MarketRegimeResult found for asof_date or prior date"
        }

    regime_date = row[0]
    # Guardrail: regime_date must be <= asof_date (should always hold due to WHERE clause)
    if regime_date > asof_date:
        return {
            "asofDate": asof_date,
            "regimeDate": regime_date,
            "regimeLabel": "LOW_CONFIDENCE",
            "confidence": 0,
            "freshnessStatus": "FUTURE_DATE_ERROR",
            "freshnessLagDays": None,
            "source": row[4],
            "version": row[5],
            "isAvailable": False,
            "warning": f"GUARDRAIL VIOLATION: regime_date {regime_date} > asof_date {asof_date}"
        }

    from datetime import datetime as dt
    d_asof = dt.strptime(asof_date, "%Y-%m-%d")
    d_regime = dt.strptime(regime_date, "%Y-%m-%d")
    lag = (d_asof - d_regime).days

    freshness = "FRESH" if lag <= 3 else "STALE"

    return {
        "asofDate": asof_date,
        "regimeDate": regime_date,
        "regimeLabel": row[1],
        "confidence": row[2],
        "freshnessStatus": freshness,
        "freshnessLagDays": lag,
        "source": row[4],
        "version": row[5],
        "isAvailable": True,
        "warning": f"Regime data is {lag} calendar days old" if freshness == "STALE" else None
    }


def build_walk_forward_record(conn, asof_date: str, include_regime_context: bool = False) -> dict:
    """Build one walk-forward record for asof_date. Fully PIT-safe."""
    window_start = compute_window_start(asof_date, FEATURE_WINDOW_DAYS)

    # Regime
    regime_label, regime_confidence = compute_regime_for_date(conn, asof_date)

    # Candidates
    candidates = get_candidates_for_date(conn, asof_date, MAX_CANDIDATES)
    coverage = get_coverage_for_date(conn, asof_date)
    available_feat, missing_feat = compute_available_features(conn, asof_date, window_start)

    # Data quality flags
    dq_flags = []
    if coverage == 0:
        dq_flags.append("no_stock_data_on_asof_date")
    if regime_label == "regime_missing":
        dq_flags.append("regime_data_missing")
    if regime_label == "LOW_CONFIDENCE":
        dq_flags.append("low_taiex_history")
    if missing_feat > 0:
        dq_flags.append(f"missing_features:{missing_feat}")

    # PIT safety flags
    pit_flags = ["pit_safe:date_lte_asof_date"]
    if asof_date > TODAY_CAP:
        pit_flags.append("VIOLATION:future_date_used")
    else:
        pit_flags.append("asof_date_within_cap")

    # Forbidden logic flags (all false = clean)
    forbidden = {
        "uses_h001_h012": False,
        "uses_buy_sell_signal": False,
        "uses_roi_optimization": False,
        "uses_future_data": asof_date > TODAY_CAP,
        "uses_chip_production_features": False,
        "uses_revenue_financial_production_features": False
    }

    record = {
        "asof_date": asof_date,
        "regime_label": regime_label,
        "regime_confidence": regime_confidence,
        "portfolio_size": len(candidates),
        "coverage_count": coverage,
        "candidate_symbols": candidates,
        "candidate_selection_method": "deterministic_alphabetical_mock",
        "evaluation_window_start": window_start,
        "evaluation_window_end": asof_date,
        "available_feature_count": available_feat,
        "missing_feature_count": missing_feat,
        "data_quality_flags": dq_flags,
        "pit_safety_flags": pit_flags,
        "forbidden_logic_flags": forbidden,
        "placeholder_metrics": {
            "forward_return_placeholder": None,
            "benchmark_return_placeholder": None,
            "drawdown_placeholder": None,
            "note": "Skeleton only. No performance conclusions."
        }
    }

    if include_regime_context:
        record["regimeContext"] = get_regime_context_from_db(conn, asof_date)

    return record


def run(dry_run: bool, output_path: str | None, regime_context: bool = False):
    conn = sqlite3.connect(DB_PATH)

    print(f"[T-05] Portfolio Walk-Forward Skeleton")
    print(f"[T-05] DB: {DB_PATH}")
    print(f"[T-05] Mode: {'DRY-RUN' if dry_run else 'OUTPUT'}")
    print(f"[T-05] Regime context: {'ENABLED (--regime-context)' if regime_context else 'DISABLED (default)'}")
    print(f"[T-05] TAIEX cap date: {TODAY_CAP}")
    print(f"[T-05] Max sample days: {MAX_SAMPLE_DAYS}")
    print()

    # Get last 120 TAIEX trading dates
    trading_dates = get_taiex_dates(conn, TODAY_CAP, MAX_SAMPLE_DAYS)
    print(f"[T-05] Found {len(trading_dates)} trading dates from {trading_dates[0]} to {trading_dates[-1]}")

    records = []
    for i, asof_date in enumerate(trading_dates):
        rec = build_walk_forward_record(conn, asof_date, include_regime_context=regime_context)
        records.append(rec)
        if i % 20 == 0 or i == len(trading_dates) - 1:
            print(f"[T-05] Processed {i+1}/{len(trading_dates)} dates... latest: {asof_date} regime={rec['regime_label']} candidates={rec['portfolio_size']}")

    conn.close()

    # Compute summary
    regime_dist = {}
    for r in records:
        lbl = r["regime_label"]
        regime_dist[lbl] = regime_dist.get(lbl, 0) + 1

    avg_size = sum(r["portfolio_size"] for r in records) / max(len(records), 1)
    low_conf_days = sum(1 for r in records if r["regime_confidence"] < 0.5)
    missing_regime = sum(1 for r in records if r["regime_label"] == "regime_missing")
    dq_flag_days = sum(1 for r in records if r["data_quality_flags"])
    forbidden_flag_days = sum(1 for r in records if any(r["forbidden_logic_flags"].values()))

    output = {
        "task": "T-05 Portfolio Walk-Forward Skeleton",
        "generated_at": "2026-05-06T13:58:00+08:00",
        "dry_run": dry_run,
        "regime_context_enabled": regime_context,
        "safety_contract": {
            "no_production_write": True,
            "no_buy_sell_signal": True,
            "no_roi_calculation": True,
            "no_h001_h012": True,
            "no_future_dates": True,
            "pit_safe": True
        },
        "summary": {
            "total_asof_dates": len(records),
            "date_range_start": trading_dates[0] if trading_dates else None,
            "date_range_end": trading_dates[-1] if trading_dates else None,
            "regime_distribution": regime_dist,
            "average_portfolio_size": round(avg_size, 2),
            "low_confidence_days": low_conf_days,
            "missing_regime_days": missing_regime,
            "dates_with_data_quality_flags": dq_flag_days,
            "dates_with_forbidden_logic_flags": forbidden_flag_days
        },
        "records": records
    }

    if regime_context:
        # Add regime context summary
        rc_available = sum(1 for r in records if r.get("regimeContext", {}).get("isAvailable", False))
        rc_missing = len(records) - rc_available
        rc_label_dist = {}
        rc_freshness_dist = {}
        rc_lags = [r["regimeContext"]["freshnessLagDays"] for r in records
                   if r.get("regimeContext", {}).get("freshnessLagDays") is not None]
        for r in records:
            rc = r.get("regimeContext", {})
            lbl = rc.get("regimeLabel", "UNKNOWN")
            rc_label_dist[lbl] = rc_label_dist.get(lbl, 0) + 1
            fs = rc.get("freshnessStatus", "UNKNOWN")
            rc_freshness_dist[fs] = rc_freshness_dist.get(fs, 0) + 1
        rc_dates = [r["regimeContext"]["regimeDate"] for r in records
                    if r.get("regimeContext", {}).get("regimeDate") is not None]
        output["regime_context_summary"] = {
            "records_with_regime_context": rc_available,
            "records_missing_regime_context": rc_missing,
            "regime_label_distribution": rc_label_dist,
            "freshness_status_distribution": rc_freshness_dist,
            "max_freshness_lag_days": max(rc_lags) if rc_lags else None,
            "min_regime_date": min(rc_dates) if rc_dates else None,
            "max_regime_date": max(rc_dates) if rc_dates else None,
            "pit_safe": all(
                r["regimeContext"]["regimeDate"] <= r["asof_date"]
                for r in records
                if r.get("regimeContext", {}).get("regimeDate") is not None
            )
        }

    print()
    print(f"[T-05] Summary:")
    print(f"  total_asof_dates: {len(records)}")
    print(f"  regime_distribution: {regime_dist}")
    print(f"  average_portfolio_size: {round(avg_size, 2)}")
    print(f"  low_confidence_days: {low_conf_days}")
    print(f"  missing_regime_days: {missing_regime}")
    print(f"  dates_with_data_quality_flags: {dq_flag_days}")
    print(f"  dates_with_forbidden_logic_flags: {forbidden_flag_days}")

    if dry_run:
        print()
        print("[T-05] DRY-RUN complete. No file written. Use --output <path> to write.")
    else:
        os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
        with open(output_path, "w") as f:
            json.dump(output, f, indent=2)
        print(f"\n[T-05] Written to: {output_path}")

    return output


def main():
    parser = argparse.ArgumentParser(
        description="T-05 Portfolio Walk-Forward Skeleton (PIT-safe, no production writes)"
    )
    parser.add_argument("--dry-run", action="store_true", default=True,
                        help="Dry run (default: enabled). Does not write output.")
    parser.add_argument("--output", type=str, default=None,
                        help="Output file path. If specified, disables dry-run and writes JSON.")
    parser.add_argument("--regime-context", action="store_true", default=False,
                        help="Enrich each record with persisted MarketRegimeResult context (read-only).")
    args = parser.parse_args()

    dry_run = args.output is None
    run(dry_run=dry_run, output_path=args.output, regime_context=args.regime_context)


if __name__ == "__main__":
    main()
