# P26B-HARDRESET: Pre-flight Gate (PART A)

**Generated:** 2026-05-13
**Classification:** `P26B_PREFLIGHT_PASS`

## A.1 P26A Artifact Checks

All 7 required P26A artifacts present: **PASS**

## A.2 P26A Final Classification

`P26A_FEATURE_SNAPSHOT_V1_COMPLETE`

## A.3 Frozen Corpus Line Check

| Corpus | Lines | Status |
|--------|-------|--------|
| simulation_snapshot_corpus.jsonl | 60 | PASS |
| p0hardreset_historical_replay_corpus.jsonl | 4500 | PASS |
| p1baseline_historical_replay_corpus.jsonl | 9900 | PASS |
| p3active_scoring_historical_replay_corpus.jsonl | 4500 | PASS |
| p19active_scoring_pit_replay_corpus.jsonl | 4500 (wc-l=4499; non-empty parser=4500) | PASS |

## A.4 Code Baseline Snapshot

| File | SHA256 |
|------|--------|
| ActiveScoringSnapshotBuilder.ts | 063a3bd524d20e9d0dfc847e342a93b36bd086bab042d9fde88282963156bf5d |
| RuleBasedStockAnalyzer.ts | bc3716cc8e74be304f2e262aac586a61760bb59d6c95e82a575c38e03ea7373d |
| SignalFusionEngine.ts | b8ce3fa3ae63fd7edf6b6067dd8ccea63c02741454b93792e87bfbc1e95d2bf4 |
| P26AReasonFactorEnrichmentUtils.ts | b1d8323b399b3bde012aacb8b50a9bed1a0a91eb4f88724b5cc1fa1d89ba46ef |
| P12FeatureContractV1Utils.ts | eed17a32458b255ae04525b6bb3ad6bf3585199282f77271e79898a9fce5f2a3 |

## Verdict: `P26B_PREFLIGHT_PASS`
