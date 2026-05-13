# V3 Candidate Validation — Anti-Overfitting Report

> As-of date: 2026-05-01  |  Generated: 2026-05-05T09:56:41Z

---

## 1. Candidates Tested

- Total v3 candidates: **4**
- Promotion-eligible: **3** (STOCK_H009_PULLBACK_10D_HOLD, STOCK_H010_MOM_MODERATE_VOLUME, STOCK_H011_NEAR_BREAKOUT_LOW_VOL)
- Observation-only: **1** (STOCK_H012_RSI_REVERSION_PROBE)
- Symbols evaluated: **8** (0055, 00712, 00903, 00891, 00830, 00738U, 1326, 1560)

---

## 2. Why This Is NOT Auto-Promotion

- All `promotion_allowed` fields in this registry are set to **`false`**.
  Even if a candidate reaches `REVIEW_CANDIDATE` status, no production
  strategy is created, modified, or activated.
- `REVIEW_CANDIDATE` means: *a human reviewer must evaluate this result*
  before any further action. It does not indicate a confirmed edge.
- The P3-10 refinement guard enforces these rules before any validation runs.
- This pipeline output is logged as a research artifact only.

---

## 3. Multiple Testing Correction

- Total valid (OK) window tests: **28**
- BH-FDR alpha: **0.1**
- Tests passing BH-FDR (q < 0.1): **0**
- BH-FDR is applied globally across ALL symbol × candidate × window pairs.
- A single passing test after BH-FDR is not sufficient for promotion;
  replication across ≥2 symbols OR ≥2 windows is also required.

---

## 4. BH-FDR Results

**No tests passed BH-FDR correction** (q < 0.10).

---

## 5. Symbol-Level Consistency

A candidate is only `REVIEW_CANDIDATE` if ROI > 0 across all valid windows
AND replicated on ≥2 symbols or ≥2 windows.

**STOCK_H009_PULLBACK_10D_HOLD**:
  - 0055: `REJECTED`
  - 00712: `REJECTED`
  - 00903: `REJECTED`
  - 00891: `REJECTED`
  - 00830: `REJECTED`
  - 00738U: `REJECTED`
  - 1326: `REJECTED`
  - 1560: `REJECTED`
**STOCK_H010_MOM_MODERATE_VOLUME**:
  - 0055: `REJECTED`
  - 00712: `REJECTED`
  - 00903: `REJECTED`
  - 00891: `REJECTED`
  - 00830: `REJECTED`
  - 00738U: `REJECTED`
  - 1326: `REJECTED`
  - 1560: `REJECTED`
**STOCK_H011_NEAR_BREAKOUT_LOW_VOL**:
  - 0055: `REJECTED`
  - 00712: `REJECTED`
  - 00903: `REJECTED`
  - 00891: `REJECTED`
  - 00830: `REJECTED`
  - 00738U: `REJECTED`
  - 1326: `DATA_INSUFFICIENT`
  - 1560: `DATA_INSUFFICIENT`
**STOCK_H012_RSI_REVERSION_PROBE**:
  - 0055: `OBSERVATION_ONLY`
  - 00712: `OBSERVATION_ONLY`
  - 00903: `OBSERVATION_ONLY`
  - 00891: `OBSERVATION_ONLY`
  - 00830: `OBSERVATION_ONLY`
  - 00738U: `OBSERVATION_ONLY`
  - 1326: `OBSERVATION_ONLY`
  - 1560: `OBSERVATION_ONLY`

---

## 6. H012 — Why Observation-Only

- `H012_RSI_REVERSION_PROBE` was motivated by observing positive ROI
  on symbol 2317 in P3-09 batch diagnostics.
- This is a **post-hoc discovery** — the hypothesis was created because
  a specific symbol showed positive results, not from prior theory.
- Post-hoc discoveries have high data snooping risk and cannot be promoted.
- `allowed_scope = exploratory_observation_only`
- `promotion_allowed = false` (permanent, regardless of metrics)
- Even if H012 shows p < 0.05 and positive ROI, status remains `OBSERVATION_ONLY`.

---

## 7. Limitations

- **Small universe**: Only 5 symbols with sufficient history.
  Statistical power is limited; cross-symbol replication is hard to achieve.
- **Short history**: 500 trading days ≈ 2 years. One market regime.
- **Taiwan market specificity**: Results may not generalise beyond TWS/TSE.
- **OOS sample size**: Permutation tests use 20% OOS split; small n inflates
  variance of permutation distribution.
- **No out-of-sample holdout**: There is no completely held-out test set.
  All results should be treated as in-distribution estimates.
- **H009 forward_days=10**: Longer holding period means fewer non-overlapping
  OOS periods and potentially inflated Sharpe.

---

## 8. Safety Confirmations

- ❌ No production strategy created or modified
- ❌ No trade execution triggered
- ❌ No auto-promotion performed
- ❌ No parameter re-tuning based on these results
- ✅ All `promotion_allowed = false`
- ✅ `human_review_required = true` for all candidates
- ✅ This report is a research artifact only
