# Stock Prediction System — CTO Reprioritized Roadmap

Version 1.4 CTO Reprioritization · 2026-05-12  
Owner: Kelvin Huang  
Prepared by: CTO Agent  
Classification: ROADMAP_REPRIORITIZED_FOR_BUCKET_SCHEMA_REPAIR

> Superseded on 2026-05-13 by `docs/plans/stock_roadmapPlan_20260513_cto_reprioritized.md`. P6-LITE completed with `BY_DESIGN_BOUNDARY`, P8-PREFLIGHT completed, and P25 post-migration observability completed. The current P0 is now `P26-A Prediction Feature Snapshot v1 + Reason / Factor Enrichment`, not bucket schema repair.

> This roadmap is an engineering execution plan for research observability, prediction schema integrity, and simulation-readiness. It is not investment advice, does not authorize automated trading, and does not make performance claims.

---

## 1. Inputs Reviewed

This update supersedes the 2026-05-11 roadmap priority order and is based on:

- `00-StockPlan/stock_roadmapPlan_20260504.md`
- `docs/plans/stock_roadmapPlan_20260504_converged.md`
- `SYSTEM_AUDIT_2026-04-24.md`
- `outputs/online_validation/p5walkthrough_final_report.md`
- `outputs/online_validation/p5walkthrough_review.json`
- `outputs/online_validation/p5walkthrough_repair_backlog.json`
- Current git history through `4c7cab7 P5-HARDRESET PART I: final report`
- Frozen corpus verification on 2026-05-12:
  - `simulation_snapshot_corpus.jsonl` = 60 lines
  - `p0hardreset_historical_replay_corpus.jsonl` = 4,500 lines
  - `p1baseline_historical_replay_corpus.jsonl` = 9,900 lines
  - `p3active_scoring_historical_replay_corpus.jsonl` = 4,500 lines

---

## 2. CTO Decision

The system's two strategic axes remain unchanged:

1. Taiwan stock price prediction research using technical, event/news, fundamental, chip, and market-regime signals.
2. Strategy simulation and optimization using PIT-safe replay, shadow outcomes, calibration audits, and eventually optimizer gates.

The roadmap priority must change. The previous 2026-05-11 roadmap placed `P10 Dashboard-ready Metrics Contract v0` as the next P0. That is now demoted. P5-HARDRESET surfaced a more fundamental blocker: score-to-bucket schema inconsistency in active scoring outputs.

Current CTO classification:

```text
P5_WALKTHROUGH_REVIEW_COMPLETE
P5_REQUIRES_BUCKET_SCHEMA_REPAIR
```

Therefore the next highest-value system optimization is:

```text
P0 = P6-HARDRESET — Bucket Schema Repair Diagnosis
```

Dashboard, UI, corpus expansion, optimizer, and ML baseline work should wait until the score/bucket contract is diagnosable and internally consistent.

---

## 3. Current Implementation Progress

| Track | Status | CTO Read |
| --- | --- | --- |
| P0-HARDRESET historical replay corpus | Complete | Real-price replay corpus established; frozen at 4,500 lines. |
| P1-HARDRESET naive baseline corpus | Complete | Baseline comparison corpus established; frozen at 9,900 lines. |
| P2-HARDRESET spot-check audit | Complete | Earlier audit limited by missing score fields; superseded by P3/P4/P5 observability. |
| P3-HARDRESET active scoring corpus | Complete | 4,500 rows, usable ratio 100%, active scoring snapshot available. |
| P4-HARDRESET full calibration audit | Complete | 58 deterministic walkthrough cases produced. |
| P5-HARDRESET manual walkthrough review | Complete | 58/58 explainability COMPLETE; 5 score/bucket inconsistencies; 24 generic reasons. |
| P6-HARDRESET bucket schema diagnosis | Not started | Current P0. Diagnosis only; no scoring formula change. |
| ManualReview UI track | Frozen | Should remain frozen until scoring schema and explainability quality are repaired. |
| Optimizer / ML baseline | Blocked | Premature while bucket contract and reason traceability are unstable. |

---

## 4. Roadmap Alignment Audit

### 4.1 What Is Aligned

- The project is correctly staying in research/observability mode.
- P0/P1/P3/P4/P5 artifacts form a useful diagnosis chain from historical replay to active scoring walkthrough.
- Frozen corpus discipline is working; validation artifacts can be trusted as fixed inputs.
- The two-axis goal is still correct: prediction research first, simulation optimization second.

### 4.2 What Is Misaligned

| Roadmap Item | Previous Priority | CTO Adjustment |
| --- | --- | --- |
| Dashboard-ready metrics contract | P0 | Demote to P4. A dashboard before schema repair can make inconsistent buckets look authoritative. |
| Corpus expansion | Near-term | Demote to P5. Expanding data before fixing bucket schema expands noise. |
| Optimizer sandbox | Mid-term | Demote to P9. Optimizer cannot be meaningful before score/bucket/reason contracts stabilize. |
| ML baseline / ensemble | P10-ish | Keep late. It needs PIT feature coverage and reliable labels/contracts first. |
| ManualReview UI workflow | Previously active through P15-P17 | Keep frozen. UI is not the current bottleneck. |

### 4.3 Key Roadmap Gap

The old roadmap emphasized platform/UI readiness after corpus quality gates. P5 shows the more urgent layer is prediction-schema trust: the system can produce readable active scoring outputs, but five deterministic cases show score and bucket disagree. That directly affects both strategic axes:

- Prediction axis: bucket labels are the human-readable expression of the scoring model.
- Simulation axis: bucket-level calibration and future optimizer gates depend on stable bucket semantics.

---

## 5. Highest-Value Optimization Direction

The most valuable next optimization is not model tuning, not UI, and not larger corpus coverage. It is:

```text
Bucket schema diagnosis and repair planning for active scoring output consistency.
```

Why this is P0:

- The affected field is central to every downstream readiness decision.
- P5 found 5 deterministic mismatches, all in `Watch` bucket cases with low scores.
- P5 also found 24 generic reason snapshots, but generic reasons are second-order until bucket semantics are trustworthy.
- Simulation optimization relies on stable score/bucket mapping; otherwise calibration by bucket may be misleading.
- The correct repair sequence is diagnosis first, schema/code-trace second, implementation third.

Representative P5 inconsistent cases:

| Case | Symbol | asOf | Horizon | Bucket | Score | Decile | Reason Status |
| --- | --- | --- | --- | --- | ---: | ---: | --- |
| P5-CASE-004 | 1536 | 2025-12-02 | 5d | Watch | 21 | 1 | CONSISTENT |
| P5-CASE-006 | 00712 | 2025-11-24 | 5d | Watch | 29 | 1 | GENERIC |
| P5-CASE-012 | 1536 | 2025-12-02 | 5d | Watch | 21 | 1 | CONSISTENT |
| P5-CASE-040 | 1536 | 2025-12-02 | 5d | Watch | 21 | 1 | CONSISTENT |
| P5-CASE-041 | 00712 | 2025-12-02 | 20d | Watch | 29 | 1 | GENERIC |

---

## 6. Reordered P0-P10 Execution Plan

These priorities are roadmap priorities as of 2026-05-12. They do not rename historical HARDRESET phases.

| Priority | Task | Goal | Gate / Definition of Done |
| --- | --- | --- | --- |
| P0 | P6-HARDRESET Bucket Schema Repair Diagnosis | Diagnose the five P5 score/bucket inconsistent cases and identify whether the cause is mapping, threshold, normalization, snapshot capture, aggregation, or unknown code path. | `p6bucket_schema_preflight_audit`, `p6bucket_schema_diagnosis`, and `p6bucket_schema_contract_proposal` exist; all JSON parse; frozen corpus unchanged; no scoring formula change. |
| P1 | P7 Bucket Assignment Code Trace or Safe Repair Implementation | If P6 finds a schema-safe fix, implement it; if not, trace the exact assignment path before repair. | 58/58 P5 walkthrough cases become score/bucket CONSISTENT or every remaining exception has an explicit code-trace explanation; tests pass; no outcome-based tuning. |
| P2 | P8 Signal / Reason Snapshot Quality Repair | Reduce generic reason snapshots by improving reason capture/format without changing score calculation. | Generic reason rate decreases from 24/58; reason output includes structured factor context; no bullish/bearish conflict introduced. |
| P3 | P9 Data Coverage and Snapshot Field Population Audit | Explain why Neutral/partial rows and data coverage gaps occur; separate true missing data from capture omissions. | Coverage gap report lists missing fields by source and bucket; PIT availability rules documented; no corpus mutation. |
| P4 | P10 Dashboard-ready Calibration Metrics Contract | Reintroduce dashboard contract only after schema/reason repair is understood. | UI-ready contract includes schema health, reason quality, data coverage, corpus maturity, and explicit DATA_LIMITED style warnings. |
| P5 | P11 Corpus Expansion Gate v1 | Expand symbols/dates/horizons only after bucket schema is stable. | Expansion plan defines symbol basket, date grid, horizon maturity, duplicate guard, and frozen-corpus policy. |
| P6 | P12 Technical/Event/Fundamental PIT Feature Contract | Align technical, news/event, fundamental, chip, and regime signals into one as-of-safe feature contract. | `publishedAt <= asOf`, financial availability lag, monthly revenue lag, chip-data availability, and missing-source semantics are enforced. |
| P7 | P13 Factor Attribution and Aggregation Explainability | Make factor-to-score and factor-to-bucket attribution auditable. | Each active scoring snapshot has factor direction, weight/source, normalized contribution, and bucket assignment evidence. |
| P8 | P14 Simulation Engine Contract Unification | Unify replay/backtest/simulation semantics before optimizer work. | Cost/slippage/position cap/liquidity assumptions are explicit; simplified backtest paths are wrapped or deprecated. |
| P9 | P15 Optimizer Sandbox Readiness Gate | Define exact conditions under which parameter search may run. | Minimum sample size, train/test split, horizon maturity, bucket consistency, and feature coverage gates are machine-readable. |
| P10 | P16 Strategy Optimizer Sandbox v0 / ML Baseline Research | Start optimizer or ML baseline only after P0-P9 gates pass. | Sandbox output is approval-required, holdout-aware, and cannot write production scoring behavior automatically. |

---

## 7. Critical Blockers

1. Bucket schema inconsistency: 5/58 cases have low scores assigned to `Watch`; this blocks reliable bucket-level calibration.
2. Generic reason snapshots: 24/58 cases are structurally present but not semantically rich enough for strong human audit.
3. Snapshot/source ambiguity: P6 must determine whether mismatches are top-level bucket issues, active scoring snapshot issues, scoreSnapshot issues, or schema drift.
4. Corpus expansion risk: expanding before schema repair will increase diagnostic volume without improving correctness.
5. Dashboard interpretation risk: dashboarding inconsistent bucket data may create false confidence.
6. Feature breadth gap: the long-term product goal requires technical/event/fundamental/chip/regime inputs, but current validated active-scoring audit is still mostly schema/explainability work.
7. Simulation optimizer blocker: optimizer cannot start until score/bucket contracts, feature contracts, and simulation assumptions are stable.

---

## 8. Execution Policy for the Next Phase

P6 must be diagnosis-only.

Allowed:

- Add diagnosis utilities.
- Add root-cause artifacts.
- Add bucket schema contract proposal.
- Add tests.
- Produce repair proposal.

Not allowed:

- Modify production scoring formula.
- Tune thresholds from realized returns.
- Rewrite active scoring behavior.
- Modify frozen P0/P1/P3/P4/simulation corpus.
- Resume ManualReview UI work.
- Start optimizer or ML baseline.
- Produce investment instructions or performance claims.

---

## 9. Concrete Next Execution Order

1. Run P6 preflight and verify all P5/P4/P3 artifacts exist.
2. Extract exactly the five P5 `BUCKET_SCHEMA_REVIEW` cases.
3. Build bucket normalization and expected-bucket utilities.
4. Compare top-level bucket, active scoring snapshot bucket, scoreSnapshot fields, and reason/factor summaries.
5. Classify root cause into mapping mismatch, threshold mismatch, normalization gap, snapshot capture mismatch, factor aggregation ambiguity, or unknown requiring code trace.
6. Generate `p6bucket_schema_diagnosis.json/.md`.
7. Generate canonical bucket contract proposal.
8. Add unit tests for normalization, boundary behavior, diagnosis categories, summary, proposal non-goals, forbidden-claim scanner, and corpus immutability.
9. Run focused and regression tests.
10. Produce P6 final report and classification.

---

## 10. CEO Goal Contribution

### Axis A — Taiwan Stock Prediction Research

Direct contribution. Bucket schema consistency is the contract that turns raw score into a readable prediction state. P6/P7 improve whether technical, event, fundamental, chip, and regime factors can be explained coherently later.

### Axis B — Strategy Simulation and Optimization

Indirect but mandatory contribution. Simulation optimization uses score buckets for grouping, calibration, and readiness decisions. If bucket semantics are unstable, optimizer conclusions may be built on inconsistent labels.

---

## 11. Final CTO Recommendation

Do P6 now.

The correct near-term sequence is:

```text
P6 diagnosis -> P7 safe schema/code-trace repair -> P8 reason quality -> P9 data coverage -> P10 dashboard contract -> P11 corpus expansion -> P15/P16 optimizer readiness
```

The system has made real progress through P5: it now has a deterministic, auditable scoring walkthrough layer. The next step is to make that layer internally trustworthy before increasing scale or adding presentation/UI surfaces.

Final classification:

```text
ROADMAP_REPRIORITIZED_FOR_BUCKET_SCHEMA_REPAIR
NEXT_PHASE_P0_IS_P6_BUCKET_SCHEMA_DIAGNOSIS
```
