# P26A Renderer Fix Invariance

**Generated:** 2026-05-14

## DB sha256
- sha256: a5cf277182c161dfe97ba05f9b81528d6c8e477dd5ac0bec6810ffbb8711c6f8 -- UNCHANGED

## Corpus (Frozen)
- simulation_snapshot_corpus.jsonl: 60/60 -- OK
- p0hardreset_historical_replay_corpus.jsonl: 4500/4500 -- OK
- p1baseline_historical_replay_corpus.jsonl: 9900/9900 -- OK
- p3active_scoring_historical_replay_corpus.jsonl: 4500/4500 -- OK
- p19active_scoring_pit_replay_corpus.jsonl: 4500/4500 -- OK

## Scoring Formula sha256
- RuleBasedStockAnalyzer.ts: UNCHANGED
- SignalFusionEngine.ts: UNCHANGED
- ActiveScoringSnapshotBuilder.ts: UNCHANGED

## alphaScore / Bucket Invariance
- mismatchedAlphaScoreCount: 0
- mismatchedBucketCount: 0
- allAlphaScoreUnchanged: True
- allBucketUnchanged: True

## Result: ALL PASS

> Does not constitute investment advice.
