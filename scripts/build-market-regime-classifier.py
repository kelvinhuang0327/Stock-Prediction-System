#!/usr/bin/env python3
"""
P4-03 PIT-Safe Market Regime Classifier
========================================
Classifies Taiwan market regime based on TAIEX data from dev.db.

Labels: BULL | BEAR | SIDEWAYS | HIGH_VOLATILITY | LOW_CONFIDENCE
Confidence: 0.0 to 1.0

Safety:
- Read-only from prisma/dev.db
- All rolling calculations use date <= asof_date (PIT-safe)
- No chip/revenue/financial features
- No buy/sell signal, no backtest, no ROI
- Missing TAIEX → LOW_CONFIDENCE (no forward-fill)
"""

import argparse
import json
import math
import os
import sqlite3
import sys
from datetime import date, timedelta

DB_PATH = "prisma/dev.db"
SAMPLE_TRADING_DAYS = 300

# Regime thresholds (classifier rules, NOT strategy thresholds)
BULL_BEAR_RATIO_THRESHOLD = 0.70
HIGH_VOL_ANNUALIZED = 0.30  # 30% annualized
MOMENTUM_20D_BULL = 0.02
MOMENTUM_20D_BEAR = -0.02
MOMENTUM_60D_BULL = 0.05
MOMENTUM_60D_BEAR = -0.05
BREADTH_BULL = 0.50
BREADTH_BEAR = 0.45

ALLOWED_LABELS = {"BULL", "BEAR", "SIDEWAYS", "HIGH_VOLATILITY", "LOW_CONFIDENCE"}

PROHIBITED_FIELDS = {
    "foreign_net_buy", "investment_trust_net_buy", "dealer_net_buy",
    "chip_net_buy_5d", "chip_net_buy_20d",
    "revenue_yoy", "revenue_mom", "revenue_growth_trend_3m",
    "eps", "gross_margin", "operating_margin", "roe", "debt_ratio",
    "buy", "sell", "signal", "backtest", "roi", "win_rate"
}


def get_db_conn():
    if not os.path.exists(DB_PATH):
        print(f"ERROR: DB not found at {DB_PATH}", file=sys.stderr)
        sys.exit(1)
    return sqlite3.connect(DB_PATH)


def fetch_taiex_history(conn):
    """Fetch all TAIEX rows sorted ascending."""
    rows = conn.execute(
        "SELECT date, value FROM MarketIndex WHERE name='TAIEX' ORDER BY date ASC"
    ).fetchall()
    return rows  # list of (date_str, value)


def fetch_breadth_for_dates(conn, dates):
    """Fetch market breadth proxy for a list of dates."""
    placeholders = ",".join("?" * len(dates))
    rows = conn.execute(
        f"""SELECT date,
               COUNT(*) AS total,
               SUM(CASE WHEN change > 0 THEN 1 ELSE 0 END) AS up_count
            FROM StockQuote
            WHERE date IN ({placeholders})
            GROUP BY date""",
        dates
    ).fetchall()
    return {r[0]: (r[1], r[2]) for r in rows}


def compute_daily_returns(values):
    """Compute daily returns list from close values."""
    rets = []
    for i in range(1, len(values)):
        if values[i - 1] and values[i - 1] != 0:
            rets.append((values[i] - values[i - 1]) / values[i - 1])
        else:
            rets.append(0.0)
    return rets


def std(values):
    if len(values) < 2:
        return 0.0
    mean = sum(values) / len(values)
    variance = sum((x - mean) ** 2 for x in values) / (len(values) - 1)
    return math.sqrt(variance)


def classify_regime(
    taiex_close, taiex_ma50, taiex_ma200, taiex_return_20d, taiex_return_60d,
    taiex_volatility_20d, market_breadth_proxy, n_taiex_rows, ma200_available
):
    """
    Returns (label, confidence, evidence_flags, missing_features, pit_safety_flags).
    Evaluation order: LOW_CONFIDENCE → HIGH_VOLATILITY → scoring → BULL/BEAR/SIDEWAYS
    """
    missing_features = []
    pit_safety_flags = [
        "all_rolling_calculations_use_date_lte_asof",
        "no_future_fill",
        "no_chip_revenue_financial_features",
        "no_buy_sell_signal"
    ]

    # Step 1: LOW_CONFIDENCE
    if taiex_close is None:
        missing_features.append("taiex_close")
        return (
            "LOW_CONFIDENCE", 0.0,
            ["missing_taiex_on_asof_date"],
            missing_features,
            pit_safety_flags + ["low_confidence_no_fill"]
        )
    if n_taiex_rows < 50:
        missing_features.append("taiex_ma50")
        missing_features.append("taiex_ma200")
        return (
            "LOW_CONFIDENCE", 0.0,
            [f"insufficient_taiex_rows: {n_taiex_rows} < 50"],
            missing_features,
            pit_safety_flags + ["low_confidence_insufficient_history"]
        )

    evidence_flags = []

    # Step 2: HIGH_VOLATILITY override
    if taiex_volatility_20d is not None and taiex_volatility_20d > HIGH_VOL_ANNUALIZED:
        conf = min(1.0, taiex_volatility_20d / HIGH_VOL_ANNUALIZED)
        evidence_flags.append(f"vol_20d_annualized={taiex_volatility_20d:.3f}>threshold_{HIGH_VOL_ANNUALIZED}")
        return (
            "HIGH_VOLATILITY", round(conf, 4),
            evidence_flags,
            missing_features,
            pit_safety_flags + ["high_vol_override_applied"]
        )

    # Step 3: Factor scoring
    max_score = 13
    bull_score = 0
    bear_score = 0

    # Factor 1: price vs MA50 (weight 2)
    if taiex_ma50 is not None:
        if taiex_close > taiex_ma50:
            bull_score += 2
            evidence_flags.append("price_above_ma50")
        else:
            bear_score += 2
            evidence_flags.append("price_below_ma50")
    else:
        missing_features.append("taiex_ma50")

    # Factor 2: price vs MA200 (weight 3)
    if taiex_ma200 is not None and ma200_available:
        if taiex_close > taiex_ma200:
            bull_score += 3
            evidence_flags.append("price_above_ma200")
        else:
            bear_score += 3
            evidence_flags.append("price_below_ma200")
    else:
        missing_features.append("taiex_ma200")
        max_score -= 3  # reduce denominator

    # Factor 3: MA50 vs MA200 (weight 2)
    if taiex_ma50 is not None and taiex_ma200 is not None and ma200_available:
        if taiex_ma50 > taiex_ma200:
            bull_score += 2
            evidence_flags.append("golden_cross_ma50_above_ma200")
        else:
            bear_score += 2
            evidence_flags.append("death_cross_ma50_below_ma200")
    elif taiex_ma50 is None or not ma200_available:
        max_score -= 2

    # Factor 4: momentum_20d (weight 2)
    if taiex_return_20d is not None:
        if taiex_return_20d > MOMENTUM_20D_BULL:
            bull_score += 2
            evidence_flags.append(f"momentum_20d_positive={taiex_return_20d:.3f}")
        elif taiex_return_20d < MOMENTUM_20D_BEAR:
            bear_score += 2
            evidence_flags.append(f"momentum_20d_negative={taiex_return_20d:.3f}")
        else:
            evidence_flags.append(f"momentum_20d_neutral={taiex_return_20d:.3f}")
    else:
        missing_features.append("taiex_return_20d")
        max_score -= 2

    # Factor 5: momentum_60d (weight 2)
    if taiex_return_60d is not None:
        if taiex_return_60d > MOMENTUM_60D_BULL:
            bull_score += 2
            evidence_flags.append(f"momentum_60d_positive={taiex_return_60d:.3f}")
        elif taiex_return_60d < MOMENTUM_60D_BEAR:
            bear_score += 2
            evidence_flags.append(f"momentum_60d_negative={taiex_return_60d:.3f}")
        else:
            evidence_flags.append(f"momentum_60d_neutral={taiex_return_60d:.3f}")
    else:
        missing_features.append("taiex_return_60d")
        max_score -= 2

    # Factor 6: breadth (weight 2)
    if market_breadth_proxy is not None:
        if market_breadth_proxy >= BREADTH_BULL:
            bull_score += 2
            evidence_flags.append(f"breadth_bullish={market_breadth_proxy:.3f}")
        elif market_breadth_proxy < BREADTH_BEAR:
            bear_score += 2
            evidence_flags.append(f"breadth_bearish={market_breadth_proxy:.3f}")
        else:
            evidence_flags.append(f"breadth_neutral={market_breadth_proxy:.3f}")
    else:
        missing_features.append("market_breadth_proxy")
        max_score -= 2

    if max_score == 0:
        return (
            "LOW_CONFIDENCE", 0.0,
            ["max_score_zero"],
            missing_features,
            pit_safety_flags
        )

    bull_ratio = bull_score / max_score
    bear_ratio = bear_score / max_score

    # MA200 confidence reduction
    ma200_penalty = not ma200_available
    if ma200_penalty:
        pit_safety_flags.append("ma200_unavailable_confidence_reduced_40pct")

    if bull_ratio >= BULL_BEAR_RATIO_THRESHOLD:
        label = "BULL"
        conf = bull_ratio
    elif bear_ratio >= BULL_BEAR_RATIO_THRESHOLD:
        label = "BEAR"
        conf = bear_ratio
    else:
        label = "SIDEWAYS"
        conf = max(bull_ratio, bear_ratio)

    if ma200_penalty:
        conf = round(conf * 0.60, 4)
    else:
        conf = round(conf, 4)

    evidence_flags.append(f"bull_score={bull_score}_bear_score={bear_score}_max={max_score}")
    return label, conf, evidence_flags, missing_features, pit_safety_flags


def run_classifier(taiex_rows, breadth_map, target_dates=None):
    """
    Build regime records for target_dates (or last SAMPLE_TRADING_DAYS rows).
    Returns list of dicts.
    """
    if not taiex_rows:
        return []

    taiex_by_date = {r[0]: r[1] for r in taiex_rows}
    all_taiex_dates = [r[0] for r in taiex_rows]

    if target_dates is None:
        target_dates = all_taiex_dates[-SAMPLE_TRADING_DAYS:]

    results = []
    for asof_date in target_dates:
        # PIT: only rows <= asof_date
        historical = [(d, v) for d, v in taiex_rows if d <= asof_date]
        n = len(historical)
        values = [v for _, v in historical]

        taiex_close = taiex_by_date.get(asof_date)

        # MA50
        taiex_ma50 = None
        if n >= 50:
            taiex_ma50 = round(sum(values[-50:]) / 50, 2)

        # MA200
        taiex_ma200 = None
        ma200_available = False
        if n >= 200:
            taiex_ma200 = round(sum(values[-200:]) / 200, 2)
            ma200_available = True
        elif n >= 50:
            # partial estimate but flag as unavailable
            taiex_ma200 = None

        # Returns
        daily_returns = compute_daily_returns(values)

        taiex_return_1d = None
        if len(daily_returns) >= 1:
            taiex_return_1d = round(daily_returns[-1], 6)

        taiex_return_20d = None
        if len(values) >= 21:
            taiex_return_20d = round((values[-1] - values[-21]) / values[-21], 6) if values[-21] else None

        taiex_return_60d = None
        if len(values) >= 61:
            taiex_return_60d = round((values[-1] - values[-61]) / values[-61], 6) if values[-61] else None

        # Volatility 20d annualized
        taiex_volatility_20d = None
        if len(daily_returns) >= 20:
            vol_std = std(daily_returns[-20:])
            taiex_volatility_20d = round(vol_std * math.sqrt(252), 6)

        # Breadth
        market_breadth_proxy = None
        if asof_date in breadth_map:
            total, up_count = breadth_map[asof_date]
            if total > 0:
                market_breadth_proxy = round(up_count / total, 4)

        label, confidence, evidence_flags, missing_features, pit_safety_flags = classify_regime(
            taiex_close, taiex_ma50, taiex_ma200,
            taiex_return_20d, taiex_return_60d,
            taiex_volatility_20d, market_breadth_proxy,
            n, ma200_available
        )

        results.append({
            "asof_date": asof_date,
            "taiex_close": taiex_close,
            "taiex_ma50": taiex_ma50,
            "taiex_ma200": taiex_ma200,
            "taiex_return_1d": taiex_return_1d,
            "taiex_return_20d": taiex_return_20d,
            "taiex_volatility_20d": taiex_volatility_20d,
            "market_breadth_proxy": market_breadth_proxy,
            "regime_label": label,
            "regime_confidence": confidence,
            "evidence_flags": evidence_flags,
            "missing_features": missing_features,
            "pit_safety_flags": pit_safety_flags
        })

    return results


def validate_results(results):
    """Basic validation of output records."""
    errors = []
    for r in results:
        if r["regime_label"] not in ALLOWED_LABELS:
            errors.append(f"{r['asof_date']}: invalid label {r['regime_label']}")
        if not (0.0 <= r["regime_confidence"] <= 1.0):
            errors.append(f"{r['asof_date']}: confidence out of range {r['regime_confidence']}")
        if "evidence_flags" not in r or r["evidence_flags"] is None:
            errors.append(f"{r['asof_date']}: missing evidence_flags")
        if "pit_safety_flags" not in r or r["pit_safety_flags"] is None:
            errors.append(f"{r['asof_date']}: missing pit_safety_flags")
        for prohibited in PROHIBITED_FIELDS:
            if prohibited in r:
                errors.append(f"{r['asof_date']}: prohibited field found: {prohibited}")
    return errors


def main():
    parser = argparse.ArgumentParser(description="P4-03 PIT-Safe Market Regime Classifier")
    parser.add_argument("--dry-run", action="store_true", default=True,
                        help="Print summary without writing file (default)")
    parser.add_argument("--output", type=str, default=None,
                        help="Write JSON output to this path (disables dry-run)")
    args = parser.parse_args()

    dry_run = args.dry_run
    if args.output:
        dry_run = False

    conn = get_db_conn()

    print("=== P4-03 Market Regime Classifier ===")
    print(f"DB: {DB_PATH}")

    taiex_rows = fetch_taiex_history(conn)
    print(f"TAIEX rows loaded: {len(taiex_rows)}")

    if not taiex_rows:
        print("ERROR: No TAIEX data found", file=sys.stderr)
        sys.exit(1)

    target_dates = [r[0] for r in taiex_rows[-SAMPLE_TRADING_DAYS:]]
    print(f"Processing {len(target_dates)} trading days: {target_dates[0]} to {target_dates[-1]}")

    breadth_map = fetch_breadth_for_dates(conn, target_dates)
    print(f"Breadth data available for {len(breadth_map)} of {len(target_dates)} dates")

    results = run_classifier(taiex_rows, breadth_map, target_dates)

    errors = validate_results(results)
    if errors:
        print(f"\nVALIDATION ERRORS ({len(errors)}):")
        for e in errors[:10]:
            print(f"  {e}")
    else:
        print("\nValidation: PASS — all regime_labels valid, confidence in [0,1]")

    # Summary
    label_counts = {}
    for r in results:
        lbl = r["regime_label"]
        label_counts[lbl] = label_counts.get(lbl, 0) + 1
    print("\nRegime distribution:")
    for lbl, cnt in sorted(label_counts.items()):
        print(f"  {lbl}: {cnt} days ({100*cnt/len(results):.1f}%)")

    latest = results[-1] if results else None
    if latest:
        print(f"\nLatest: {latest['asof_date']} → {latest['regime_label']} (confidence={latest['regime_confidence']})")

    output = {
        "task": "P4-03 Market Regime Classifier",
        "generated_at": "2026-05-06",
        "pit_safe": True,
        "db_path": DB_PATH,
        "taiex_total_rows": len(taiex_rows),
        "sample_size": len(results),
        "sample_date_range": {
            "start": target_dates[0] if target_dates else None,
            "end": target_dates[-1] if target_dates else None
        },
        "regime_distribution": label_counts,
        "latest_regime": latest,
        "prohibited_features_used": [],
        "records": results
    }

    if dry_run:
        print("\n[DRY-RUN] Not writing output. Use --output <path> to write.")
    else:
        os.makedirs(os.path.dirname(args.output) if os.path.dirname(args.output) else ".", exist_ok=True)
        with open(args.output, "w") as f:
            json.dump(output, f, indent=2, ensure_ascii=False)
        print(f"\nOutput written to: {args.output}")
        print(f"Records: {len(results)}")

    conn.close()


if __name__ == "__main__":
    main()
