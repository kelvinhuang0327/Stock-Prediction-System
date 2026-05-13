# P3-13 Expanded Universe Validation — Anti-Overfitting Report

> As-of date: 2026-05-01  |  Generated: 2026-05-05T14:59:53Z
> Symbols evaluated: 50  |  Primary window: 500d  |  Secondary window: 150d

---

## 1. Why Expanded Universe Reduces False Discovery

- P3-11 tested only **8 symbols**, yielding very low statistical power.
  With n=8, a single spurious positive result is sufficient to create
  a false `REVIEW_CANDIDATE`. This expansion to up to 50 symbols substantially
  increases the replication requirement.
- The cross-symbol replication threshold is raised from ≥2 (P3-11) to **≥3 symbols**.
  A candidate must demonstrate positive primary-window metrics on at least
  3 independent symbols before reaching `REVIEW_CANDIDATE`.
- Diverse symbols include different sectors, market caps, and liquidity profiles,
  reducing the likelihood that a single factor (e.g., Taiwan tech cycle) drives
  spurious results across all symbols.

---

## 2. Why Primary and Secondary Windows Are Separated

- **Primary window (500d)**: Contains more data, reducing estimation noise.
  Only primary window results can trigger `REVIEW_CANDIDATE`. This prevents
  a lucky short-window result from creating a false positive.
- **Secondary window (150d)**: Diagnostic only. Results are logged but
  `eligible_for_review = False` is enforced unconditionally.
  If primary shows edge but secondary does not, this is informative about
  how recently the signal appeared.
  If secondary shows edge but primary does not, this is suspicious (may indicate
  a recent data artefact or look-ahead bias).
- Window roles are tagged in every result object: `window_role = primary | secondary`.

---

## 3. Why H012 Remains Observation-Only

- `STOCK_H012_RSI_REVERSION_PROBE` was created by observing positive ROI on
  symbol 2317 in P3-09 batch diagnostics (post-hoc discovery).
- Post-hoc discoveries have inherently inflated Type I error rates —
  even with permutation testing, the null hypothesis was never pre-specified
  before seeing the data.
- `allowed_scope = exploratory_observation_only` and `promotion_allowed = false`
  are permanent policy fields set in P3-10.
- In this pipeline, H012 status is **hard-locked to `OBSERVATION_ONLY`**
  regardless of any metrics: even p=0.001, ROI=+100% would not change this.

---

## 4. Multiple Testing Correction

- **Total primary (500d) window tests: 120**
- **Total diagnostic (all windows) tests: 150**
- BH-FDR alpha: **0.1**

### A. Primary BH-FDR (used for REVIEW_CANDIDATE decisions)
- Tests: 120
- Passing (q < 0.1): **0**

### B. Diagnostic BH-FDR (observation only, not used for promotion)
- Tests: 150
- Passing (q < 0.1): **0**

---

## 5. BH-FDR Results

### Primary BH-FDR Passing Tests
**No primary tests passed BH-FDR correction** (q < 0.10).

### Diagnostic BH-FDR Passing Tests
**No diagnostic tests passed BH-FDR correction** (q < 0.10).

---

## 6. Candidate-Level Diagnostics

### STOCK_H009_PULLBACK_10D_HOLD
- Symbols tested: 50
- Symbols with primary signal: 50
- Primary signal count (total): 2372
- Secondary signal count (total): 103
- Avg primary ROI: +0.5558
- Avg primary Sharpe: -2.0431
- Primary permutation pass count: 0
- Primary BH-FDR pass count: 0
- REVIEW_CANDIDATE symbols: []
- **Final status: `REJECTED`**

### STOCK_H010_MOM_MODERATE_VOLUME
- Symbols tested: 50
- Symbols with primary signal: 50
- Primary signal count (total): 3211
- Secondary signal count (total): 632
- Avg primary ROI: +0.3806
- Avg primary Sharpe: -0.5893
- Primary permutation pass count: 0
- Primary BH-FDR pass count: 0
- REVIEW_CANDIDATE symbols: []
- **Final status: `REJECTED`**

### STOCK_H011_NEAR_BREAKOUT_LOW_VOL
- Symbols tested: 50
- Symbols with primary signal: 19
- Primary signal count (total): 852
- Secondary signal count (total): 57
- Avg primary ROI: +0.0100
- Avg primary Sharpe: -2.2408
- Primary permutation pass count: 0
- Primary BH-FDR pass count: 0
- REVIEW_CANDIDATE symbols: []
- **Final status: `REJECTED`**

### STOCK_H012_RSI_REVERSION_PROBE
- Symbols tested: 50
- Symbols with primary signal: 1
- Primary signal count (total): 263
- Secondary signal count (total): 77
- Avg primary ROI: +0.4242
- Avg primary Sharpe: +1.3134
- Primary permutation pass count: 0
- Primary BH-FDR pass count: 0
- REVIEW_CANDIDATE symbols: []
- **Final status: `OBSERVATION_ONLY`**

---

## 7. Limitations

- **Taiwan market specificity**: All data is from TWS/TSE.
  Results may not generalise to other markets.
- **Survivorship bias**: Symbols in the DB may over-represent survivors.
- **One market regime**: 500 trading days ≈ 2 years. Results reflect
  a single macro environment.
- **OOS sample size**: 20% OOS split; small signal counts inflate variance.
- **H009 forward_days=10**: Non-overlapping OOS periods are fewer,
  potentially inflating Sharpe estimates.
- **No independent holdout set**: There is no completely untouched test set.

---

## 8. No Production Write Confirmation

- ❌ No production strategy created or modified
- ❌ No trade execution triggered
- ❌ No auto-promotion performed
- ❌ No threshold changed
- ❌ No new hypothesis added (H013+ not allowed)
- ✅ All `promotion_allowed = false`
- ✅ `human_review_required = true` for all candidates
- ✅ All outputs are research artifacts only
- ✅ `REVIEW_CANDIDATE` requires human review before any further action
