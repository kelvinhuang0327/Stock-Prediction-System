# P28C Renderer-Only Repair — Final Report

**Phase**: P28C-RENDERER-ONLY-REPAIR-HARDRESET  
**Classification**: `P28C_RENDERER_ONLY_REPAIR_COMPLETE`  
**Date**: 2026-05-15

---

## Summary

P28C implemented renderer-only reason template repairs for the 9 NO_TRIGGERED_FACTOR underoutput cases found in P28A. All 9 cases now produce `ENRICHED` multi-factor rendered text. No scoring formula, alphaScore, bucket, DB, or corpus file was changed.

---

## Repair Families

### Family 1: `scoreSnapshot_zero_label` (5 cases — symbols 1710, 00738U)

**Root Cause**: In `reviewCase()` (P5WalkthroughReviewUtils.ts), `minimalSnapshot.scoreSnapshot` was hardcoded to all-zeros. When `enrichReasonFromExistingFactors()` ran with `technicalScore=0`, the direction label was computed as '中性' even when the real techScore was 68 or 75.

**Fix**:
- Added `scoreSnapshot?` field to `WalkthroughCaseInput` interface
- `P26ACorpusRowAdapter` now passes real `scoreSnapshot` from corpus activeScoringSnapshot
- `reviewCase()` uses `caseRow.scoreSnapshot ?? { technicalScore: 0, ... }` as fallback
- Added `inferDirectionFromMATrend(factors)` in `P26AReasonFactorEnrichmentUtils.ts` as fallback when `technicalScore=0` — reads MA 趨勢 factor to determine '偏多' / '偏空' / '中性'

### Family 2: `mixed_signals_no_template` (4 cases — symbol 00891)

**Root Cause**: For 00891, `factorSnapshot` contained `MA 趨勢: 空頭排列` (bearish) + `MACD: 0.12 (MACD > 0，多方動能)` (bullish). No template annotated this contradiction.

**Fix**:
- Added `detectMixedSignal(factors: string[]): boolean` to `P26ACorpusReasonRenderer.ts`
- Added `buildMixedSignalNote(factors: string[]): string` — generates contextual mixed-signal annotation
- `renderReasonFromCorpusSnapshot()` appends the mixed-signal note when detected
- `CORPUS_REASON_RENDERER_VERSION` bumped from `p26a-corpus-renderer-v1` to `p26a-corpus-renderer-v2`

---

## Test Results

| Suite | Tests | Result |
|-------|-------|--------|
| p28c_renderer_only_repair.test.ts | 43/43 | ✅ PASS |
| p28c_9case_before_after_generator.test.ts | 9/9 | ✅ PASS |
| All onlineValidation __tests__ | 2976/2976 | ✅ PASS |

---

## 9-Case Before/After Summary

| Case | Symbol | Family | Before | After Outcome |
|------|--------|--------|--------|---------------|
| 1 | 1710 | scoreSnapshot_zero_label | 技術偏多 (single token) | ENRICHED |
| 2 | 00738U | scoreSnapshot_zero_label | 技術偏空 (single token) | ENRICHED |
| 3 | 00738U | scoreSnapshot_zero_label | 法人賣超 (single token) | ENRICHED |
| 4 | 1710 | scoreSnapshot_zero_label | 動能轉強 (single token) | ENRICHED |
| 5 | 00738U | scoreSnapshot_zero_label | 動能走弱 (single token) | ENRICHED |
| 6 | 00891 | mixed_signals_no_template | 技術偏多 (single token) | ENRICHED |
| 7 | 00891 | mixed_signals_no_template | 技術偏多 (single token) | ENRICHED |
| 8 | 00891 | mixed_signals_no_template | 技術偏多 (single token) | ENRICHED |
| 9 | 00891 | mixed_signals_no_template | 技術偏多 (single token) | ENRICHED |

**All 9/9 cases: ENRICHED. alphaScoreUnchanged=true. bucketUnchanged=true.**

---

## Invariance Check

- `prisma/dev.db`: ✅ SHA256 unchanged
- `RuleBasedStockAnalyzer.ts`: ✅ SHA256 unchanged
- `SignalFusionEngine.ts`: ✅ SHA256 unchanged
- `ActiveScoringSnapshotBuilder.ts`: ✅ SHA256 unchanged
- Corpus JSONL files: ✅ All row counts match P28B baseline

---

## Forbidden Claims Scan

**Result: CLEAN**

All matches found during scan were regex pattern definitions in the files' own forbidden-claims scanners, not emitted text. No buy/sell/ROI/win-rate/profit/outperform/guaranteed strings in any rendered output.

---

## Files Modified (Renderer-Only)

1. `src/lib/onlineValidation/P26ACorpusReasonRenderer.ts` — detectMixedSignal, buildMixedSignalNote, version bump to v2
2. `src/lib/onlineValidation/P26AReasonFactorEnrichmentUtils.ts` — inferDirectionFromMATrend, techLabel fallback
3. `src/lib/onlineValidation/P5WalkthroughReviewUtils.ts` — scoreSnapshot? field in WalkthroughCaseInput
4. `src/lib/onlineValidation/P26ACorpusRowAdapter.ts` — scoreSnapshot pass-through

**No scoring files, DB, or corpus files were modified.**

---

## No Investment Claim

This system produces observational analysis only. No buy/sell signals, no ROI claims, no trading recommendations.
