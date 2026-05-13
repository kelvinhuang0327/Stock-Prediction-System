# Universe Expansion Recommendations

> P3-12  |  as_of_date: 2026-05-01  |  2026-05-05T10:30:38.683221+00:00

> ⚠️ These are research diagnostics only.
> No hypothesis added. No threshold changed. No production write.

---

## Core Finding

P3-11 validated H009–H012 on **8 symbols** out of **237 eligible** (≥300 rows). This is **3.4%** of the available universe.

Signal multiplication potential: **1.9×** more signals available from the remaining 22 untested symbols.

**The primary diagnosis is `UNIVERSE_TOO_SMALL`** — the hypothesis rules are not demonstrably broken; they simply have not been tested against enough data.

---

## 1. How Many Symbols Are Needed

- **Current**: 8 symbols tested
- **Available**: 237 symbols with ≥300 rows
- **Recommended minimum**: 30–50 symbols for BH-FDR-corrected testing to have meaningful statistical power
- **Ideal**: All 118 symbols with ≥500 rows (112 stocks + 6 ETFs)

---

## 2. How Much History Is Needed

- **Current**: 500d window (≈2 years)
- **Problem**: 150d window has >50% DI rate (OOS < 5 signals)
- **Recommended**: ≥600 rows (≈2.4 years) as minimum threshold
- **Ideal for H009** (10d hold): ≥700 rows to get ≥25 non-overlapping OOS periods

---

## 3. Candidates to Pause vs Keep

### Keep (pending universe expansion)

- **STOCK_H009_PULLBACK_10D_HOLD**: Keep — blocked by window size, not rule quality (mode=DATA_TOO_SHORT)
- **STOCK_H010_MOM_MODERATE_VOLUME**: Conditional — monitor after universe expansion (mode=SIGNAL_NOISY)
- **STOCK_H011_NEAR_BREAKOUT_LOW_VOL**: Keep — blocked by window size, not rule quality (mode=DATA_TOO_SHORT)
- **STOCK_H012_RSI_REVERSION_PROBE**: OBSERVATION_ONLY — symbol-specific probe, already locked

---

## 4. Priority Recommendation

### Should Next Step Be Data Expansion, Not Strategy Design?

**Yes — strongly recommended.**

Reasons:
1. **229 untested symbols** available with ≥300 rows
2. **Signal multiplication**: Running H009–H011 on all eligible symbols would yield ~1.9× more signals — sufficient for BH-FDR correction to have real power
3. **Framework is sound**: P3-11 validation pipeline, PIT guard, BH-FDR correction, guard pre-check all working correctly
4. **Do NOT design new hypotheses** until the existing ones have been tested on the full universe — this avoids data snooping

### Recommended Action for P3-13

- Remove `DEFAULT_AUTO_SYMBOLS = 8` cap in `run_stock_v3_candidate_validation.py`
- Set `--symbols` to include all 118 symbols with ≥500 rows (or at least 30 symbols)
- Re-run P3-11 validation on full universe
- Only then evaluate whether any hypothesis has real cross-symbol edge

---

## 5. ETF vs Stock Mix

- ETF-like symbols (starts with '00'): 6 with ≥500 rows
- Stock-like symbols: 112 with ≥500 rows
- P3-11 tested 6 ETFs + 2 stocks — heavily ETF-biased
- H009/H010 momentum hypotheses may behave differently for individual stocks
- **Recommendation**: Test stocks and ETFs separately in P3-13

---

## 6. Safety Confirmation

- ❌ No hypothesis added
- ❌ No threshold changed
- ❌ No production write
- ❌ No validation run in this audit
- ❌ No promotion decision
- ✅ All recommendations are for data collection only
