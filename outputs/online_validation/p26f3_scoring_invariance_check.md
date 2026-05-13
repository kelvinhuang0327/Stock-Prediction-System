# P26F3-HARDRESET — Scoring Invariance Check

**Date**: 2026-05-13  
**Status**: SCORING_INVARIANCE_PASS

## Results
| Check | Result |
|---|---|
| mismatchedAlphaScoreCount | 0 |
| mismatchedBucketCount | 0 |
| scoringPathSha256Unchanged | true |
| frozenCorpusSha256Unchanged | true |
| historicalSourceEntersScoring | false |

## Scoring File sha256
- src/lib/onlineValidation/ActiveScoringSnapshotBuilder.ts: UNCHANGED
- src/lib/analysis/RuleBasedStockAnalyzer.ts: UNCHANGED
- src/lib/alpha/SignalFusionEngine.ts: UNCHANGED

## Frozen Corpus Line Counts
- simulation_snapshot_corpus.jsonl: 60/60 (UNCHANGED)
- p0hardreset_historical_replay_corpus.jsonl: 4500/4500 (UNCHANGED)
- p1baseline_historical_replay_corpus.jsonl: 9900/9900 (UNCHANGED)
- p3active_scoring_historical_replay_corpus.jsonl: 4500/4500 (UNCHANGED)
- p19active_scoring_pit_replay_corpus.jsonl: 4500/4500 (UNCHANGED)
