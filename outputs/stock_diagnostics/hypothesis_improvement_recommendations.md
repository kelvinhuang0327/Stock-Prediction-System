# Hypothesis Improvement Recommendations

> Generated: 2026-05-05T09:58:35Z
> ⚠️  This document contains RECOMMENDATIONS ONLY.
> No hypotheses are created, modified, or retired in code.
> All registry files remain unchanged.

---

## 1. Hypothesis Status Assessment

### Hypotheses to Keep (non-negative ROI, refine-eligible)

- **STOCK_H005_PULLBACK_UPTREND** — `MIXED_WEAK_SIGNAL` → Weak but non-negative ROI; worth refining

### Hypotheses to Refine

- **STOCK_H003_VOLUME_BREAKOUT** — `DATA_INSUFFICIENT` → Needs multi-symbol universe or broader dataset
- **STOCK_H004_MOM_VOL_CONFIRM** — `DATA_INSUFFICIENT` → Needs multi-symbol universe or broader dataset
- **STOCK_H006_LOW_VOL_BREAKOUT** — `DATA_INSUFFICIENT` → Needs multi-symbol universe or broader dataset
- **STOCK_H007_RELATIVE_STRENGTH** — `DATA_INSUFFICIENT` → Needs multi-symbol universe or broader dataset
- **STOCK_H008_ETF_DEF_MOMENTUM** — `DATA_INSUFFICIENT` → Needs multi-symbol universe or broader dataset

### Hypotheses to Consider Retiring

- **STOCK_H001_20D_MOMENTUM** — `NEGATIVE_ROI` → Consistently negative ROI across symbols
- **STOCK_H002_RSI_REVERSION** — `NEGATIVE_ROI` → Consistently negative ROI across symbols

---

## 2. Feature Condition Analysis

### volume_zscore_20d
- **Hypothesis**: STOCK_H004_MOM_VOL_CONFIRM
- **Condition**: `volume_zscore_20d > 1.0`
- **Avg signals / window**: 51.5
- **Trigger rate (500d)**: 10.3%
- **Issues**: ADEQUATE_TRIGGERS_BUT_NO_EDGE
- **Potential fix**: Only ~16% of days exceed +1σ in normal distribution; ETFs with stable volume may rarely trigger

### breakout_20d_high
- **Hypothesis**: STOCK_H006_LOW_VOL_BREAKOUT
- **Condition**: `close > max(high[-20:]) AND volatility_20d <= p25(volatility_20d)`
- **Avg signals / window**: 24.0
- **Trigger rate (500d)**: 4.8%
- **Issues**: STRICT_FILTER_OVER_PRUNING
- **Potential fix**: Low-vol periods rarely coincide with fresh 20d highs; Taiwan ETFs have smooth price curves

### universe_relative_strength
- **Hypothesis**: STOCK_H007_RELATIVE_STRENGTH
- **Condition**: `return_20d > universe_median_return_20d`
- **Avg signals / window**: 0
- **Trigger rate (500d)**: 0.0%
- **Issues**: ALL_WINDOWS_DATA_INSUFFICIENT, REQUIRES_MULTI_SYMBOL_UNIVERSE
- **Potential fix**: Single-symbol validation cannot compute universe median → DATA_INSUFFICIENT for all windows

### pullback_rule
- **Hypothesis**: STOCK_H005_PULLBACK_UPTREND
- **Condition**: `close > ma60 AND return_5d < 0 AND return_20d > 0`
- **Avg signals / window**: 60.7
- **Trigger rate (500d)**: 12.1%
- **Issues**: ADEQUATE_TRIGGERS_BUT_NO_EDGE
- **Potential fix**: Three simultaneous conditions may over-filter; ETFs often lack clear 60d trend + pullback combo

### etf_defensive_momentum
- **Hypothesis**: STOCK_H008_ETF_DEF_MOMENTUM
- **Condition**: `is_etf AND return_20d > 0 AND drawdown_20d > -0.05`
- **Avg signals / window**: 195.5
- **Trigger rate (500d)**: 39.1%
- **Issues**: ADEQUATE_TRIGGERS_BUT_NO_EDGE
- **Potential fix**: Non-ETF symbols return 0 signals; 5% drawdown threshold may exclude many valid ETF periods

---

## 3. Symbol-Level Insights

**Suitable symbols** (3): 0055, 2317, 2330
**Unsuitable symbols** (2): 00712, 2454

---

## 4. Recommended Next Directions

1. **Expand symbol universe** — H007 (relative strength) requires ≥5 symbols on the same date to compute universe median reliably.
2. **Loosen H006 breakout threshold** — try `close > 0.98 × max(high[-20:])` to capture near-breakouts and increase signal count.
3. **Reduce H004 volume z-score threshold** from >1.0 to >0.5 to increase trigger frequency on ETFs.
4. **Extend forward window** from 5d to 10d for H005 pullback hypothesis to allow more time for mean-reversion to manifest.
5. **Add sector/ETF type classification** — H008 fires on all ETFs equally; defensive (bond/dividend) vs equity ETFs may behave differently.
6. **Collect longer history** — 5 symbols × 500d = 2500 obs may be insufficient for BH-FDR correction across 8 hypotheses × 2 windows = 80 tests.

---

## 5. Prohibited Actions (confirmed)

- ❌ No new hypotheses added
- ❌ No registry files modified
- ❌ No production system writes
- ❌ No trade execution or live data writes
