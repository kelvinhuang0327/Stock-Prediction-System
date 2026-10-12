# Hypothesis Refinement Plan

> **Pipeline Stage**: P3-10 — Controlled Hypothesis Refinement Planning
> **Generated**: 2026-05-05T09:45:00Z
> **Source**: P3-09 `hypothesis_failure_diagnostics.json`

> ⚠️ **This document contains PLANNING ONLY.**
> No hypotheses have been promoted. No validation has been run.
> No production systems have been modified.

---

## Summary Table

| Hypothesis | Failure Reason | Decision | V3 Eligible | Snooping Risk |
|---|---|---|---|---|
| H001 20D Momentum | NEGATIVE_ROI | **RETIRE** | ❌ | LOW |
| H002 RSI Reversion | NEGATIVE_ROI | **OBSERVE** | ✅ probe only | HIGH |
| H003 Volume Breakout | DATA_INSUFFICIENT | **RETIRE_OR_HOLD** | ❌ | MEDIUM |
| H004 Mom+Vol Confirm | DATA_INSUFFICIENT | **REFINE** | ✅ | LOW-MEDIUM |
| H005 Pullback Uptrend | MIXED_WEAK_SIGNAL | **REFINE** | ✅ | LOW |
| H006 Low Vol Breakout | DATA_INSUFFICIENT | **REFINE** | ✅ | MEDIUM |
| H007 Relative Strength | DATA_INSUFFICIENT | **REQUIRES_UNIVERSE_FIX** | ❌ | NONE |
| H008 ETF Def Momentum | DATA_INSUFFICIENT | **REQUIRES_ETF_UNIVERSE** | ❌ | LOW |

---

## Detailed Decisions

### H001 — STOCK_H001_20D_MOMENTUM → 🔴 RETIRE

- **avg_roi**: -0.478 | **avg_sharpe**: -0.682 | **signals**: 3000
- **Rationale**: Consistently negative ROI across all 5 symbols and both windows. High signal count (3000) confirms the strategy fires frequently but loses money reliably. Classic price momentum anti-works in Taiwan market (ETF + large-cap) during this data period.
- **Data snooping risk**: LOW — universal failure, not cherry-picked
- **Action**: Mark `status=retired` in registry on next maintenance cycle

---

### H002 — STOCK_H002_RSI_REVERSION → 🟡 OBSERVE

- **avg_roi**: -0.327 | **avg_sharpe**: -0.534 | **signals**: 1688
- **Rationale**: Overall negative ROI, but symbol 2317 showed locally positive ROI (+0.379). This asymmetry warrants observation. However, deriving a refinement from a single-symbol positive result carries HIGH data snooping risk.
- **Data snooping risk**: HIGH — 2317 positive result may be noise
- **Action**: Create H012 as symbol-specific probe with `promotion_allowed=false` permanently

---

### H003 — STOCK_H003_VOLUME_BREAKOUT → 🟠 RETIRE_OR_HOLD

- **avg_roi**: +0.267 | **avg_sharpe**: +2.61 | **signals**: 168 | **DI windows**: 5
- **Rationale**: Positive ROI and high Sharpe on OK windows, but DATA_INSUFFICIENT across most windows due to low OOS sample count. Cannot trust Sharpe on small n. Hold until universe expands to 10+ symbols.
- **Data snooping risk**: MEDIUM — small sample inflates Sharpe
- **Action**: Hold — re-evaluate when symbol universe expands

---

### H004 — STOCK_H004_MOM_VOL_CONFIRM → 🔵 REFINE

- **avg_roi**: -0.058 | **avg_sharpe**: -0.368 | **signals**: 103 | **DI windows**: 2
- **Root cause**: `volume_zscore_20d > 1.0` fires on ~16% of days structurally. ETFs have stable volume; this filter is too strict.
- **Proposed refinement**: Lower threshold to `> 0.5` → creates **H010**
- **Data snooping risk**: LOW-MEDIUM — threshold relaxation pre-specified in P3-09
- **Anti-snooping**: Change is motivated by structural 16%-trigger-rate analysis, not by optimising on observed ROI

---

### H005 — STOCK_H005_PULLBACK_UPTREND → 🔵 REFINE (Best Candidate)

- **avg_roi**: +0.132 | **avg_sharpe**: +0.603 | **signals**: 182 | **DI windows**: 1
- **Root cause**: Positive ROI but permutation p-value > 0.05 due to small OOS sample (5d hold = fewer non-overlapping periods). Extending hold to 10d creates more signal per trade and allows mean-reversion to fully manifest.
- **Proposed refinement**: Change `forward_days=5` to `forward_days=10` → creates **H009**
- **Data snooping risk**: LOW — hold-period extension is pre-specified theory-driven change
- **Anti-snooping**: Change made before any v3 validation run

---

### H006 — STOCK_H006_LOW_VOL_BREAKOUT → 🔵 REFINE (Caution)

- **avg_roi**: +1.164 | **avg_sharpe**: +6.52 | **signals**: 48 | **DI windows**: 2
- **Root cause**: Dual filter (low-vol AND strict new-high) yields only 48 signals total. Sharpe of 6.5 on n=48 is statistically unreliable.
- **Proposed refinement**: Relax breakout from `close > max(high[-20:])` to `close >= 0.98 × max(high[-20:])` → creates **H011**
- **Data snooping risk**: MEDIUM — relaxation motivated by structural signal-count analysis, not by chasing high Sharpe
- **⚠️ Warning**: High Sharpe on small n is not evidence of edge. Must not be used to justify promotion.

---

### H007 — STOCK_H007_RELATIVE_STRENGTH → 🔒 REQUIRES_UNIVERSE_FIX

- **avg_roi**: 0.0 | **signals**: 0 | **DI windows**: 4 (all)
- **Root cause**: Computing `universe_median_return_20d` requires all symbols loaded simultaneously. Current single-symbol pipeline cannot provide this.
- **This is a pipeline architecture gap, not a hypothesis flaw.**
- **Action**: Block from v3 until multi-symbol pipeline is implemented

---

### H008 — STOCK_H008_ETF_DEF_MOMENTUM → 🔒 REQUIRES_ETF_UNIVERSE

- **avg_roi**: -0.033 | **avg_sharpe**: -0.155 | **signals**: 391 | **DI windows**: 2
- **Root cause**: `is_etf` filter means only 0055 has sufficient data. N=1 ETF makes BH-FDR correction meaningless.
- **Action**: Hold — re-evaluate when ETF universe has 3+ symbols

---

## V3 Candidate Registry

See: `research/stock_hypothesis_registry_v3_candidates.json`

| ID | Base | Change | Scope | Promotable |
|---|---|---|---|---|
| H009 | H005 | forward_days 5→10 | full_validation | ❌ (pending validation) |
| H010 | H004 | volume_zscore 1.0→0.5 | full_validation | ❌ (pending validation) |
| H011 | H006 | breakout strict→0.98x | full_validation | ❌ (pending validation) |
| H012 | H002 | symbol=2317 probe | exploratory_observation | ❌ **permanent** |

**Total candidates: 4 / 4 (limit)**

---

## Anti-Data-Snooping Rules

See: `gbgf/domain/hypothesis_refinement_guard.py`

1. Every v3 candidate **must** reference a `base_hypothesis_id`
2. Each base hypothesis generates at most **1 promotion-eligible refinement**
3. `exploratory_observation` candidates: `promotion_allowed` must be `false`
4. Symbol-specific candidates: `promotion_allowed` must be `false` (permanent)
5. Threshold relaxations must carry `threshold_relaxation=true` flag
6. Total candidate count must not exceed **4**
7. No direct promotion from single batch result

---

## Safety Confirmations

- ❌ No new hypotheses added to production registries
- ❌ No validation run triggered
- ❌ No auto-promotion executed
- ❌ No production system writes
- ✅ All decisions documented with rationale and snooping risk
