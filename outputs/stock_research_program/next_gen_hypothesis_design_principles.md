# Next-Gen Hypothesis Design Principles

**Task:** P3- Research Program Reset  14 
**Version:** 1.0

---

## Core Principles

###  No Pure Technical Indicator RulesP001 
Single OHLCV threshold rules are not sufficient. H012 proved this conclusively. Every hypothesis needs structural economic rationale beyond price patterns.H001

###  Stronger Prior RequiredP002 
At least one structural prior required per hypothesis:
- Market regime (bull/bear/sideways, volatility regime)
- Sector / industry relative strength
- Liquidity regime (turnover, liquidity percentile)
- Volatility regime (compression / expansion)
- Event context (earnings, dividend, ex-right, monthly revenue)
- Foreign investor / institutional flow
- Macro / index regime (TAIEX trend)
- Cross-sectional ranking (universe rank, sector rank)
- Risk-adjusted relative return

###  Economic Rationale FirstP003 
Write WHY the signal should exist before designing features. Rationale must precede feature design, not follow from observed results.

###  PIT-Safe Feature Definition RequiredP004 
All features must be provably computable from information available at signal time. Enforced by `point_in_time_guard`. No exceptions.

###  Minimum Sample Size Before TestingP005 
Minimum 50 signals required for promotion decisions. If expected signal density  eligible universe < 50 signals, hypothesis cannot be tested.

###  Required OOS Windows SpecifiedP006 
Minimum OOS window: 250 days. In-sample results cannot be used for promotion decisions.

###  Permutation + BH-FDR RequiredP007 
500 permutations per test. BH-FDR 
###  Retirement Rule Specified UpfrontP008 
Define retirement conditions before testing begins. If conditions met, retire regardless of partial positive results.

###  No Threshold Change From ResultsP009 
Thresholds set from economic rationale only. Never from observed p-values or ROI. Enforced by `hypothesis_refinement_guard`.

###  Human Review Required Before ProductionP010 
`human_review_required=true` enforced in registry. No automated production promotion.

---

## Hypothesis Quality Score (100)0

**Minimum 70/100 required to enter validation.**

| Dimension | Max Points | Description |
|-----------|-----------|-------------|
| Economic rationale strength | 20 | Clear testable rationale explaining WHY signal exists |
| Feature PIT safety | 20 | All features provably computable at signal time |
| Universe suitability | 15 | Eligible 30 symbols with sufficient history |universe 
| Expected signal density | 2 signals/symbol/year = full 15 points |15 | 
| Testability / reproducibility | 15 | All parameters precisely defined, reproducible |
| Overfitting risk control | 15 | OOS defined, BH-FDR planned, retirement rule written |
| **Total** | **100** | |

---

## Required Fields Per Hypothesis

`hypothesis_id`, `name`, `economic_rationale`, `expected_failure_mode`, `stronger_prior`, `pit_safe_features`, `eligible_universe`, `minimum_sample_size`, `required_oos_windows`, `permutation_plan`, `bh_fdr_plan`, `retirement_rule`, `human_review_required`, `promotion_allowed`, `quality_score`

---

## Forbidden Actions

- Using single OHLCV threshold as entire hypothesis
- Adjusting thresholds based on observed p-values
- Promoting based on positive ROI alone
- Skipping permutation or BH-FDR
- Adding hypothesis with quality_score < 70
- Auto-promoting without human review
- Future data leakage or random split
