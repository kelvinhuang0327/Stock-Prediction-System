# P26A Batch Pipeline  Pre-flight CheckWiring 

**Classification**: `P26A_BATCH_PIPELINE_WIRING_PREFLIGHT_PASS`

## Artifact Checks

| Artifact | Status | Notes |
|----------|--------|-------|
| p3active_scoring_historical_replay_corpus. OK | 4500 lines, FROZEN |jsonl | 
| p4calibration_walkthrough_cases. OK | 58 cases, missing factorSnapshot |json | 
| p26a_scoring_underoutput_9case_audit. OK | 9 cases |json | 
| P5WalkthroughReviewUtils. OK | factorSnapshot field present |ts | 
| P26ACorpusReasonRenderer. OK | renderer integrated |ts | 
| sample-p4-calibration-walkthrough-cases. OK | buildScenario() needs update |js | 

## Baseline Checksums

| File | SHA256 |
|------|--------|
| prisma/dev.db | a5cf277182c161dfe97ba05f9b81528d6c8e477dd5ac0bec6810ffbb8711c6f8 |
| RuleBasedStockAnalyzer.ts | bc3716cc8e74be304f2e262aac586a61760bb59d6c95e82a575c38e03ea7373d |
| SignalFusionEngine.ts | b8ce3fa3ae63fd7edf6b6067dd8ccea63c02741454b93792e87bfbc1e95d2bf4 |
| ActiveScoringSnapshotBuilder.ts | 063a3bd524d20e9d0dfc847e342a93b36bd086bab042d9fde88282963156bf5d |

## Corpus Line Counts

| Corpus | Lines |
|--------|-------|
| simulation_snapshot_corpus.jsonl | 60 |
| p0hardreset_historical_replay_corpus.jsonl | 4500 |
| p1baseline_historical_replay_corpus.jsonl | 9900 |
| p3active_scoring_historical_replay_corpus.jsonl | 4500 |
| p19active_scoring_pit_replay_corpus.jsonl | 4499 |

## 9 P26A Underoutput Cases

| Case ID | Symbol | AsOfDate |
|---------|--------|----------|
| P5-CASE-010 | 1710 | 2025-12-15 |
| P5-CASE-011 | 00738U | 2025-12-19 |
| P5-CASE-013 | 1710 | 2025-12-15 |
| P5-CASE-023 | 00891 | 2025-11-12 |
| P5-CASE-026 | 00891 | 2025-11-12 |
| P5-CASE-037 | 00891 | 2025-10-15 |
| P5-CASE-053 | 00738U | 2025-12-19 |
| P5-CASE-054 | 00891 | 2025-12-30 |
| P5-CASE-055 | 1710 | 2025-12-15 |

---
*Not investment advice.*
