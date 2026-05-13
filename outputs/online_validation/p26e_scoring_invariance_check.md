# P26E Scoring Invariance Check

**Phase**: P26E-HARDRESET  
**Date**: 2026-05-13  
**Status**: SCORING_INVARIANCE_PASS

## Corpus

| Corpus | Rows |
|--------|------|
| P3 | 4500 |
| P19 | 4500 |
| **Total** | **9000** |

Rows with alphaScore: 0

## SHA256 Invariance

| File | Matches Frozen |
|------|---------------|
| ActiveScoringSnapshotBuilder.ts | ✅ MATCH |
| RuleBasedStockAnalyzer.ts | ✅ MATCH |
| SignalFusionEngine.ts | ✅ MATCH |

- **scoringPathSha256Unchanged**: true ✅

## Mismatch Counts

- mismatchedAlphaScoreCount: **0** ✅
- mismatchedBucketCount: **0** ✅
- readOnlyContextsEnterAlphaScore: **false** ✅
