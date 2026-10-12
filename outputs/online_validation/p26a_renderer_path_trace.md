# P26A Renderer Path Trace

**Generated:** 2026-05-14

## Root Cause

P3 corpus was built before P26A enrichment was added to ActiveScoringSnapshotBuilder.
factorSnapshot was always rich. reasonSnapshot stored as pre-enrichment single token.

## Data Flow

- RuleBasedStockAnalyzer: computes 10+ factors + single-token reason
- ActiveScoringSnapshotBuilder (line 294-296): factorSnapshot = factors
- ActiveScoringSnapshotBuilder (line 316): reasonSnapshot = result.reason (single token)
- ActiveScoringSnapshotBuilder (line 333-335): P26A enrichment runs for NEW builds
- P3 Corpus (frozen): stored before P26A, so reasonSnapshot = single token
- P5WalkthroughReviewUtils: reads caseRow.reasonSnapshot directly -> UNDEROUTPUT

## Fix Point

New file: src/lib/onlineValidation/P26ACorpusReasonRenderer.ts
- renderReasonFromCorpusSnapshot(snapshot): reads factorSnapshot, enriches at read time
- Pure function, deterministic, no DB write, no alphaScore change, no corpus change

## Scoring Path (UNCHANGED)

RuleBasedStockAnalyzer -> alphaScore / recommendationBucket -- NOT touched by renderer

> Does not constitute investment advice.
