# Stock Prediction System — CTO Reprioritized Roadmap

Version 1.5 CTO Reprioritization · 2026-05-13  
Owner: Kelvin Huang  
Prepared by: CTO Agent  
Classification: ROADMAP_REPRIORITIZED_FOR_PREDICTION_FEATURE_INTEGRATION

> This roadmap is an engineering execution plan for Taiwan stock research, prediction-snapshot integrity, and simulation-readiness. It is not investment advice, does not authorize automated trading, and does not make performance claims.

---

## 1. Inputs Reviewed

This 2026-05-13 update supersedes the 2026-05-12 CTO reprioritization and is based on:

- `00-StockPlan/stock_roadmapPlan_20260504.md`
- `00-StockPlan/20260513/20260513.md`
- `00-StockPlan/20260513/cto_analysis_20260513.md`
- `docs/plans/stock_roadmapPlan_20260512_cto_reprioritized.md`
- `outputs/online_validation/p6lite_p8preflight_final_report.md`
- `outputs/online_validation/p12pit_feature_contract_final_report.md`
- `outputs/online_validation/p17monthly_revenue_final_report.md`
- `outputs/online_validation/p20pit_impact_final_report.md`
- `outputs/online_validation/p25post_migration_observability_final_report.md`
- Current git history through `330b8ea P25: Add final report — P25_POST_MIGRATION_OBSERVABILITY_COMPLETE`
- Current code modules in `src/lib/analysis`, `src/lib/alpha`, `src/lib/screen`, `src/lib/events`, `src/lib/fundamental`, `src/lib/fundamentals`, `src/lib/backtest`, and `src/lib/onlineValidation`

---

## 2. CTO Decision

The system has two product/technical axes:

1. **Taiwan stock prediction research** using technical, event/news, fundamental, chip, and market-regime signals.
2. **Strategy simulation and optimization** using PIT-safe snapshots, shadow outcomes, walk-forward replay, cost/slippage assumptions, and optimizer gates.

The next highest-value optimization is no longer bucket schema diagnosis and no longer MonthlyRevenue migration safety. Both have completed enough to move on:

- P6-LITE verdict = `BY_DESIGN_BOUNDARY`; bucket mismatch is a documented Watch low-score boundary, not a P0 schema bug.
- P8-PREFLIGHT identified 24 generic reason cases; no scoring formula changed.
- P17/P24/P25 completed MonthlyRevenue `releaseDate` schema, production migration, backfill, query gate smoke, and active scoring smoke.
- P25 final classification = `P25_POST_MIGRATION_OBSERVABILITY_COMPLETE`.

Therefore the new P0 is:

```text
P0 = P26-ACTIVE-SCORING-FEATURE-SNAPSHOT-V1
     Prediction Feature Snapshot v1 + Reason / Factor Enrichment
```

The system should stop spending the next phase on migration observability unless a regression appears. P26 replay comparison remains useful, but it is not P0 because P20 already showed zero scoring deltas across the P3/P19 corpus and P25 already passed active scoring smoke.

---

## 3. Current Implementation Progress

| Track | Status | CTO Read |
| --- | --- | --- |
| As-of / PIT safety | Strong foundation | MVP API as-of gates, MarketRegime as-of gates, MonthlyRevenue releaseDate gate, and P25 post-migration smoke are in place. |
| Bucket schema | Unblocked | P6-LITE classified 5/58 mismatches as `BY_DESIGN_BOUNDARY`; freeze contract exists. No scoring change needed. |
| Reason quality | Blocker | P8 found 24/58 generic reason cases: 9 template, 9 scoring underoutput, 4 factor explanation, 2 snapshot capture. This directly weakens product trust. |
| Technical prediction | Implemented | `RuleBasedStockAnalyzer` and `SignalFusionEngine` compute technical and momentum scores with PIT quote gates. |
| Chip prediction | Implemented but explanation-light | `InstitutionalChip` is used in scoring, but factor explanations are still too generic for some cases. |
| Fundamental prediction | Partially implemented | MonthlyRevenue PIT gate is fixed and migrated; FinancialReport remains inactive for scoring and still needs availability-date governance before activation. |
| Event/news prediction | Built but not scoring-integrated | Event/topic/relevance modules exist, but NewsEvent is not active in scoring; if activated, it must gate by `publishedAt <= asOf`, never `ingestedAt`. |
| Market regime | Implemented | `MarketRegimeEngine` is integrated into fusion and screen thresholds. |
| Active scoring corpus | Stable but not feature-rich | P3/P19 corpora have 4,500 rows and no leakage, but MonthlyRevenue was absent in all P3/P19 rows and reason/factor snapshots remain shallow. |
| Simulation corpus | Blocked for optimizer | `simulation_snapshot_corpus.jsonl` has 60 entries, 10 dates, 2 symbols, qualityStatus `BLOCKED`, coverageRatio 0.2333. |
| Backtest / walk-forward | Foundation exists | `StrategyBacktestEngine`, walk-forward skeleton, trading calendar, candidate adapter, and observability runner exist, but simulation contract is not unified for optimizer use. |
| Dashboard | Exists but not the bottleneck | P10 contract exists; dashboarding should wait until feature/reason contracts improve. |
| Autonomous learning | Risky for production promotion | Prior audit flags timezone, double execution, zombie state, and broken outcome-to-insight loop. Keep out of optimizer path until repaired. |

---

## 4. Roadmap Alignment Audit

### 4.1 What Is Aligned

- The safety-first sequence was correct: as-of gates, shadow logs, replay corpora, and MonthlyRevenue PIT repair reduced look-ahead risk.
- The project avoided optimizer work before data/corpus maturity, which is still the correct posture.
- MonthlyRevenue production migration is now verified rather than just planned.
- Bucket schema ambiguity is no longer allowed to block all progress.

### 4.2 What Is Misaligned

| Previous Roadmap Direction | Current Reality | CTO Adjustment |
| --- | --- | --- |
| P6/P7 bucket repair as near-term blocker | P6-LITE classified issue as by-design boundary | Close bucket issue; no P7 code trace unless new mismatches appear. |
| P25 handoff suggests P26 replay comparison | P20 already showed zero scoring change; P25 smoke passed | Demote replay comparison to P3 and make it targeted, not broad. |
| P12 contract says MonthlyRevenue is high-risk pending repair | P17/P24/P25 completed schema, migration, backfill, and smoke | P0 must include P12 v1 refresh so the contract stops describing a fixed risk as active. |
| Dashboard / corpus expansion keep resurfacing | Prediction snapshot still lacks rich evidence and event/fundamental breadth | Product trust comes before UI scale. |
| Optimizer sandbox remains tempting | Simulation corpus is `BLOCKED`, two symbols only, and 60D maturity is weak | Keep optimizer behind machine-readable readiness gate. |

---

## 5. Highest-Value Optimization Direction

The next optimization should make each prediction snapshot more decision-auditable without changing the scoring formula:

```text
Prediction Feature Snapshot v1:
technical + chip + MonthlyRevenue + market regime + event context,
with factor direction, numeric evidence, source freshness, PIT status,
and richer human-readable reason text.
```

Why this is P0:

- It directly advances axis A, the Taiwan stock prediction product.
- It resolves the largest remaining active-scoring quality issue: 24/58 generic reason cases.
- It uses existing assets instead of building new platform layers: RuleBased, SignalFusion, EventSourceQuality, RelevanceOverlay, FundamentalResearchService, ActiveScoringSnapshotBuilder.
- It creates the stable feature/reason contract that axis B needs before simulation optimization.
- It avoids score tuning, realized-return fitting, and premature optimizer claims.

---

## 6. Reordered P0-P10 Execution Plan

These are roadmap priorities as of 2026-05-13. They do not rename historical HARDRESET phases.

| Priority | Task | Goal | Gate / Definition of Done |
| --- | --- | --- | --- |
| **P0** | **P26-A Prediction Feature Snapshot v1 + Reason / Factor Enrichment** | Make active scoring snapshots useful for prediction review: richer reason text, factor direction/weight/evidence, MonthlyRevenue PIT status, and refreshed P12 v1 contract. | Generic reason cases reduced from 24/58 to <=6 or all remaining explicitly classified; no score/bucket changes; P25 smoke remains PASS; focused tests pass. |
| **P1** | **P26-B Event / News PIT Context Adapter v0** | Bring時事面 into prediction snapshots as read-only context before scoring. | NewsEvent gated by `publishedAt <= asOf`; `ingestedAt` forbidden for PIT; relatedSymbols parsed safely; SourceTrust/Relevance overlay visible in snapshot; no scoring formula change. |
| **P2** | **P26-C FinancialReport Availability Contract + Fixture Dry Run** | Prepare deeper fundamental integration beyond MonthlyRevenue. | `availabilityDate` contract drafted and fixture-tested; FinancialReport remains inactive in scoring until PIT gate passes. |
| **P3** | **P26-D Targeted Post-Migration Replay / Coverage Comparison** | Measure MonthlyRevenue availability on real rows where data exists, not just P3/P19 rows where it was absent. | Compare live asOf samples around releaseDate boundaries; report dataCoverage and revenueYoY availability changes; no corpus overwrite. |
| **P4** | **Data Coverage and Corpus Expansion Gate v2** | Move from tiny fixture-driven corpora toward representative Taiwan stock research samples. | Symbol/date/horizon plan with PIT safety; no optimizer input until qualityStatus exits BLOCKED; 60D maturity tracked explicitly. |
| **P5** | **Simulation Engine Contract Unification** | Unify StrategyBacktest, shadow ledger replay, walk-forward skeleton, costs, slippage, position caps, liquidity assumptions. | One simulation contract; old simplified endpoints wrapped or deprecated; no production write; no performance claim. |
| **P6** | **Optimizer Sandbox Readiness Gate v1** | Define when strategy parameter search is allowed. | Machine-readable gates: minimum corpus size, train/test split, horizon maturity, feature coverage, bucket/reason integrity, anti-overfit checks. |
| **P7** | **Dashboard Contract v1 for Prediction Snapshot Health** | Surface feature freshness, PIT status, reason quality, and DATA_LIMITED warnings after P0-P4 are stable. | Dashboard schema consumes feature snapshot v1; shows limitations and blocked reasons; no production/optimizer readiness claim. |
| **P8** | **Autonomous Scheduler / Learning Safety Repair** | Prevent autonomous loops from corrupting future optimization. | Taiwan timezone scheduling, double-execution guard, job timeout, zombie recovery, outcome-to-insight persistence validated. |
| **P9** | **ML Baseline / Ensemble Research v0** | Start only after feature snapshot and outcome/corpus coverage mature. | Holdout-aware baseline; calibration report; no automatic production scoring mutation. |
| **P10** | **ManualReview / Operator Approval Surface v2** | Bring human review back after prediction evidence and simulation gates are stable. | Review UI reads stable contracts only; approval actions audited; no scoring mutation without explicit gate. |

---

## 7. Critical Blockers

1. **Reason quality is still too generic**: P8 found 24/58 generic reason cases, including 13 partial-scoring cases. This blocks user trust in prediction outputs.
2. **P12 is stale after P25**: it still describes MonthlyRevenue as a pending high-risk repair, but P17/P24/P25 fixed and validated the migration path. The contract must be refreshed to v1.
3. **Event/news is not in scoring**:時事面 modules exist, but they are not yet PIT-safe active-scoring context. This leaves one of the two strategic prediction inputs unfulfilled.
4. **FinancialReport is not PIT-ready**: deeper fundamentals need `availabilityDate` governance before they can safely influence scoring.
5. **MonthlyRevenue is safe but underused in historical corpus**: P3/P19 had `NOT_APPLICABLE_NO_DATA` for all 4,500 rows, so the system still needs a real availability coverage sample.
6. **Simulation quality is blocked**: 60-entry simulation corpus, two-symbol universe, coverageRatio 0.2333, and qualityStatus `BLOCKED` are not optimizer-grade.
7. **Autonomous learning remains unsafe for promotion**: timezone, double execution, zombie job, and learning-loop issues must stay outside optimizer promotion until repaired.
8. **Pre-existing TypeScript errors exist**: `src/app/api/admin/data-quality/route.ts` has unrelated TS errors noted in P17/P25 reports; do not let them hide new errors.

---

## 8. Execution Policy for the Next Phase

P0/P1/P2 must be prediction-evidence work, not model tuning.

Allowed:

- Enrich reason templates and factor snapshots.
- Add read-only event/news PIT context.
- Refresh PIT feature contract from v0 to v1.
- Add tests and validation artifacts.
- Run smoke tests against active scoring.

Not allowed:

- Change scoring weights or thresholds.
- Tune from realized returns.
- Claim ROI, win-rate, edge, profit, alpha, or predictive certainty.
- Write optimizer outputs into production scoring.
- Overwrite frozen corpora.
- Activate NewsEvent or FinancialReport as score inputs before their PIT gates pass.

---

## 9. Concrete Next Execution Order

1. Refresh `p12pit_feature_contract_v1` to mark MonthlyRevenue as repaired and identify remaining HIGH/MEDIUM sources.
2. Patch reason/factor output path without changing score calculation.
3. Rerun P5-style walkthrough review and compare reason quality only.
4. Validate active scoring smoke still passes and score/bucket distributions are unchanged.
5. Add event/news PIT context adapter as read-only snapshot metadata.
6. Validate `publishedAt <= asOf` and forbid `ingestedAt` for historical gating.
7. Draft FinancialReport availability-date contract and fixture validation.
8. Only then run targeted post-migration coverage comparison using real MonthlyRevenue-available rows.

---

## 10. CEO Goal Contribution

### Axis A — Taiwan Stock Prediction Research

Direct contribution. P0-P2 convert the existing scoring engine from a mostly numeric / generic reason output into a PIT-safe, evidence-rich prediction snapshot across technical, chip, monthly revenue, event context, and regime dimensions.

### Axis B — Strategy Simulation and Optimization

Mandatory upstream contribution. Optimizer work should consume stable feature snapshots and explainable factors, not shallow bucket labels or generic reason strings. P4-P6 define the bridge from prediction snapshots to simulation-readiness.

---

## 11. Final CTO Recommendation

Do **P26-A Prediction Feature Snapshot v1 + Reason / Factor Enrichment** now.

Do not spend the next phase primarily on P26 broad replay comparison. Keep that as a targeted P3 after the prediction snapshot contract is refreshed.

Final classification:

```text
ROADMAP_REPRIORITIZED_FOR_PREDICTION_FEATURE_INTEGRATION
NEXT_PHASE_P0_IS_P26_ACTIVE_SCORING_FEATURE_SNAPSHOT_V1
```
