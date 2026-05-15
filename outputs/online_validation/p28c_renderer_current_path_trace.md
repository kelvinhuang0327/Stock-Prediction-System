# P28C Renderer Current Path Trace

**Classification:** `P28C_RENDERER_CURRENT_PATH_TRACE`

## Call Chain (BEFORE Repair)

```
corpus row (JSONL)
  → corpusRowToWalkthroughCaseInput()     [P26ACorpusRowAdapter.ts]
    ❌ scoreSnapshot NOT passed through
  → reviewCase(caseRow)                    [P5WalkthroughReviewUtils.ts]
    ❌ minimalSnapshot.scoreSnapshot = all zeros (hardcoded)
  → renderReasonFromCorpusSnapshot()       [P26ACorpusReasonRenderer.ts]
    → enrichReasonFromExistingFactors()    [P26AReasonFactorEnrichmentUtils.ts]
      ❌ techScore=0 → direction = '中性' (WRONG)
      ❌ No mixed-signal template
```

## Root Cause — scoreSnapshot_zero_label

In `reviewCase()` (P5WalkthroughReviewUtils.ts line ~395):
```typescript
scoreSnapshot: { technicalScore: 0, chipScore: 0, momentumScore: 0, revenueScore: 0 },
```

For 00891 (techScore=75 in real corpus), this causes `enrichReasonFromExistingFactors()` to label direction as '中性' instead of '偏多'.

## Root Cause — mixed_signals_no_template

For 00891, the factorSnapshot contains:
- `MA 趨勢: 空頭排列` (MA bearish)
- `MACD: 0.12 (MACD > 0，多方動能)` (MACD bullish)

No template exists to note this contradiction. The enriched reason lists both factors without flagging the conflict.

## Planned Repairs (Renderer-Only)

| ID | File | Change |
|----|------|--------|
| TR-01 | `P5WalkthroughReviewUtils.ts` | Add `scoreSnapshot?` to `WalkthroughCaseInput`; use it in `minimalSnapshot` |
| TR-02 | `P26ACorpusRowAdapter.ts` | Pass `scoreSnapshot` from `activeScoringSnapshot` through |
| TR-03 | `P26AReasonFactorEnrichmentUtils.ts` | Add `inferDirectionFromMATrend()` fallback |
| TR-04 | `P26ACorpusReasonRenderer.ts` | Add `detectMixedSignal()` + mixed-signal annotation |
| TR-05 | `P26ACorpusReasonRenderer.ts` | Bump `CORPUS_REASON_RENDERER_VERSION` to `v2` |

## Invariants
- No scoring formula change
- No alphaScore change
- No DB write
- No corpus mutation
- No new factors introduced (all from factorSnapshot)
