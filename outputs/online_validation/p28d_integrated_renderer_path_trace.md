# P28D Integrated Renderer Path Trace

**Phase**: P28D-POST-RENDERER-REPAIR-VALIDATION-HARDRESET  
**Part**: B — Integrated Renderer Path Trace  
**Date**: 2026-05-15

## Renderer Version Confirmed

`CORPUS_REASON_RENDERER_VERSION = 'p26a-corpus-renderer-v2'`

## End-to-End Path

```
Corpus Row (JSONL read-only)
  │  activeScoringSnapshot.factorSnapshot
  │  activeScoringSnapshot.scoreSnapshot   ← P28C addition
  │  activeScoringSnapshot.reasonSnapshot
  │  activeScoringSnapshot.usedSources
  │  activeScoringSnapshot.missingSources
  ▼
P26ACorpusRowAdapter.corpusRowToWalkthroughCaseInput()
  │  factorSnapshot  → WalkthroughCaseInput.factorSnapshot
  │  scoreSnapshot   → WalkthroughCaseInput.scoreSnapshot   ← P28C pass-through
  │  reasonSnapshot  → WalkthroughCaseInput.reasonSnapshot
  │  usedSources     → WalkthroughCaseInput.usedSources
  │  missingSources  → WalkthroughCaseInput.missingSources
  ▼
P5WalkthroughReviewUtils.reviewCase()
  │  builds minimalSnapshot with:
  │    scoreSnapshot = caseRow.scoreSnapshot ?? { technicalScore: 0, ... }  ← P28C
  │  calls renderReasonFromCorpusSnapshot(minimalSnapshot)
  │  builds dataAvailabilityNote(usedSources, missingSources)
  │  returns CaseReviewResult with ADDITIVE fields:
  │    renderedReason, renderedReasonFactorCount,
  │    reasonRendererVersion, reasonRendererOutcome,
  │    dataAvailabilityNote
  ▼
P26ACorpusReasonRenderer.renderReasonFromCorpusSnapshot()
  │  version: p26a-corpus-renderer-v2
  │  if factorCount == 0 → FALLBACK_EMPTY
  │  if reasonSnapshot already rich (len > 20 and not single-token) → ALREADY_RICH
  │  else → call enrichReasonFromExistingFactors() → ENRICHED
  │    then: if detectMixedSignal() → append buildMixedSignalNote()  ← P28C
  ▼
P26AReasonFactorEnrichmentUtils.enrichReasonFromExistingFactors()
  │  reads snapshot.scoreSnapshot.technicalScore
  │  if techScore == 0 → inferDirectionFromMATrend()  ← P28C fallback
  │  reads factorSnapshot factors (MA, RSI, MACD, momentum, chip, revenue)
  │  returns enriched multi-dimensional reason string
  ▼
CaseReviewResult.renderedReason  (display-time only, read-only path)
```

## Validation Results

| Check | Result |
|-------|--------|
| renderReasonFromCorpusSnapshot uses v2 | ✓ PASS |
| scoreSnapshot pass-through corpus → WalkthroughCaseInput | ✓ PASS |
| mixed-signal note only in display/renderer path | ✓ PASS |
| reasonSnapshot backward compatible | ✓ PASS |
| alphaScore read-only throughout path | ✓ PASS |
| bucket read-only throughout path | ✓ PASS |
| API/display path additive, not breaking | ✓ PASS |
| No existing field removed | ✓ PASS |
| No DB write | ✓ PASS |
| No corpus mutation | ✓ PASS |

## P28C Case Summary

- 9/9 cases ENRICHED (outcome = `ENRICHED`)
- 9/9 rendererVersion = `p26a-corpus-renderer-v2`
- 9/9 alphaScore unchanged
- 9/9 bucket unchanged
- `scoreSnapshot_zero_label` family: 5 cases (1710, 00738U)
- `mixed_signals_no_template` family: 4 cases (00891)
