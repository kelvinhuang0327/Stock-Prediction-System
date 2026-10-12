# P26B Scoring Invariance Check (PART G)

**Generated:** 2026-05-13
**Verdict:** `SCORING_INVARIANCE_CONFIRMED`

> No investment recommendations. No ROI/win-rate/profit/outperform/buy/sell claims.

## Summary

| Metric | Value |
|--------|-------|
| P3 rows checked | 4500 |
| P19 rows checked | 4500 |
| Total rows | 9000 |
| mismatchedAlphaScoreCount | 0 |
| mismatchedBucketCount | 0 |
| eventNewsContextEntersAlphaScore | false |
| baselineScoringFilesUnchanged | true |

## Proof of Isolation

- P26BEventNewsPitAdapterUtils.ts imports no scoring module
- P26BEventNewsPitContractUtils.ts imports no scoring module
- ActiveScoringSnapshotBuilder.ts sha256 unchanged
- RuleBasedStockAnalyzer.ts sha256 unchanged
- SignalFusionEngine.ts sha256 unchanged
- eventNewsContext not present in P3/P19 scoreSnapshot field set

## Verdict

`SCORING_INVARIANCE_CONFIRMED`
