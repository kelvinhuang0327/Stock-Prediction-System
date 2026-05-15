# P28B: Reason Renderer Path Trace

**Date:** 2026-05-19  
**Phase:** P28B-REASON-TEMPLATE-COVERAGE-HARDRESET

---

## Summary

**Repair target is NOT in the scoring path.** All identified coverage gaps are in the read-time renderer and walkthrough display path (layers 5-6), with an additive passthrough fix in the adapter layer (layer 3).

| Layer | Name | Files | Safe to Modify |
|-------|------|-------|----------------|
| 1 | Scoring Path | RuleBasedStockAnalyzer.ts, SignalFusionEngine.ts | ❌ FORBIDDEN |
| 2 | Snapshot Build Path | ActiveScoringSnapshotBuilder.ts | ❌ FORBIDDEN |
| 3 | Factor Snapshot Path | P26AReasonFactorEnrichmentUtils.ts, P26ACorpusRowAdapter.ts | ✅ Additive only |
| 4 | Reason Snapshot Serialization | corpus .jsonl files | ❌ FROZEN |
| 5 | Read-Time Renderer | P26ACorpusReasonRenderer.ts | ✅ Safe |
| 6 | Walkthrough / Display | P5WalkthroughReviewUtils.ts | ✅ Safe |

---

## Layer 1: Scoring Path ❌ FORBIDDEN

**Files:** `RuleBasedStockAnalyzer.ts`, `SignalFusionEngine.ts`

Computes `alphaScore`, `researchBucket`, `technicalScore`, `chipScore`, `momentumScore`, `revenueScore` from raw market data.

**P28A confirmed scoring is CORRECT.** No modification permitted.

---

## Layer 2: Snapshot Build Path ❌ FORBIDDEN

**File:** `ActiveScoringSnapshotBuilder.ts`

Assembles `ActiveScoringSnapshot` with `alphaScore`, `researchBucket`, `scoreSnapshot`, `factorSnapshot`, `reasonSnapshot`.

The `alphaScore` and `researchBucket` computation is forbidden to modify.

---

## Layer 3: Factor Snapshot Path ✅ Additive only

**Files:** `P26AReasonFactorEnrichmentUtils.ts`, `P26ACorpusRowAdapter.ts`

### Gap G3-1: WalkthroughCaseInput missing scoreSnapshot
`P26ACorpusRowAdapter.corpusRowToWalkthroughCaseInput()` passes `factorSnapshot` correctly but does **not** pass `activeScoringSnapshot.scoreSnapshot`. This causes layer 6 to use all-zero fallback scores.

**Safe fix:** Add optional `scoreSnapshot?: Record<string,number>` to `WalkthroughCaseInput` and pass through from adapter.

### Gap G3-2: No direction inference fallback
`enrichReasonFromExistingFactors()` uses `snapshot.scoreSnapshot.technicalScore` for direction label. If `technicalScore=0`, label = `'偏空'` regardless of actual MA trend.

**Safe fix:** Add `inferDirectionFromMATrend(maContext: string): '偏多'|'偏空'|'中性'` helper that parses the MA 多頭排列/空頭排列 text as fallback.

---

## Layer 4: Reason Snapshot Serialization ❌ FROZEN

**Storage:** corpus .jsonl files (5 files, all frozen)

The corpus stores `activeScoringSnapshot.reasonSnapshot = "技術偏多"` (single token) for 9 cases. This is the source of the underoutput. **Corpus is FROZEN — no writes allowed.**

The corpus also stores `activeScoringSnapshot.scoreSnapshot` with actual scores, but the adapter does not pass them through (Gap G3-1).

---

## Layer 5: Read-Time Renderer ✅ PRIMARY REPAIR TARGET

**File:** `P26ACorpusReasonRenderer.ts`

The renderer fires `ENRICHED` for single-token reasonSnapshot when `factorSnapshot` is present. However:

### Gap G5-1: Direction label inversion
`enrichReasonFromExistingFactors()` calls `scoreSnapshot.technicalScore` which is 0 (from layer 6 zero bug) → `techLabel = '技術面偏空'` even when MA trend is `多頭排列`.

### Gap G5-2: No mixed-signal template
Cases with `MA 空頭排列 + MACD 多方動能` (conflicting signals) have no unified template. Renderer outputs fragmented text without a directional summary.

### Gap G5-3: No NO_TRIGGERED_FACTOR context note
When `factorSnapshotCount=10` but no factors exceeded threshold, renderer should output a neutral explanation that scoring is correct but factor-driven reason text was not produced.

---

## Layer 6: Walkthrough / Display Path ✅ SAFE

**File:** `P5WalkthroughReviewUtils.ts`

### Gap G6-1: All-zero scoreSnapshot in minimalSnapshot (ROOT CAUSE)
```typescript
// Current code (P5WalkthroughReviewUtils.ts):
const minimalSnapshot = {
  ...
  scoreSnapshot: { technicalScore: 0, chipScore: 0, momentumScore: 0, revenueScore: 0 },
  //             ↑ ALWAYS ZERO — never reads from corpus activeScoringSnapshot.scoreSnapshot
};
```

This causes `enrichReasonFromExistingFactors()` to receive `technicalScore=0`, producing inverted direction labels for all 9 cases.

### Gap G6-2: WalkthroughCaseInput missing scoreSnapshot field
The `WalkthroughCaseInput` type has no `scoreSnapshot` field, so even if the adapter could pass it, there is no carrier.

---

## Identified Safe Entry Points for P28C Repair

| # | File | Change | Impact |
|---|------|--------|--------|
| 1 | P5WalkthroughReviewUtils.ts | Add `scoreSnapshot?` to WalkthroughCaseInput; use in minimalSnapshot | Correct direction labels |
| 2 | P26ACorpusRowAdapter.ts | Pass `activeScoringSnapshot.scoreSnapshot` → WalkthroughCaseInput | Actual scores available to renderer |
| 3 | P26AReasonFactorEnrichmentUtils.ts | Add `inferDirectionFromMATrend()` fallback | Direction correct even without passthrough |
| 4 | P26ACorpusReasonRenderer.ts | Add mixed-signal template + NO_TRIGGERED_FACTOR context | All 9 cases render properly |

---

## Forbidden Files (Must NOT be modified)

- `src/lib/analysis/RuleBasedStockAnalyzer.ts`
- `src/lib/alpha/SignalFusionEngine.ts`
- `src/lib/onlineValidation/ActiveScoringSnapshotBuilder.ts`
- Any corpus `.jsonl` file
- `prisma/dev.db`

---

*Observability only. No investment recommendations.*
