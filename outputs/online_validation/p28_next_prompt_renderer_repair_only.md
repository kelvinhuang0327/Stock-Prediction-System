# P28C — Renderer Repair Only — Next Prompt

**Prompt ID**: P28C-RENDERER-REPAIR-ONLY  
**Based on**: P28B-REASON-TEMPLATE-COVERAGE-HARDRESET  
**Classification ready**: `P28B_REASON_TEMPLATE_COVERAGE_PLAN_READY`

---

## Mission

Implement the renderer repairs specified in P28B repair spec.  
**Renderer-only / template-only**. No scoring formula change permitted.

---

## Patch Boundary (allowed to modify)

| File | Change |
|---|---|
| `src/lib/onlineValidation/P26AReasonFactorEnrichmentUtils.ts` | Add `inferDirectionFromMATrend(factorSnapshot)` pure function as fallback when `technicalScore === 0` |
| `src/lib/onlineValidation/P26ACorpusReasonRenderer.ts` | Add TR-03 mixed-signal template, TR-04 NO_TRIGGERED_FACTOR note, TR-05 revenue missing note; bump `rendererVersion` |
| `src/lib/onlineValidation/P26ACorpusRowAdapter.ts` | Pass `activeScoringSnapshot.scoreSnapshot` through to `WalkthroughCaseInput.scoreSnapshot` |
| `src/lib/onlineValidation/P5WalkthroughReviewUtils.ts` | Add optional `scoreSnapshot?` to `WalkthroughCaseInput` interface; use in `minimalSnapshot` construction |

---

## FROZEN Files (must NOT be modified)

- `src/lib/analysis/RuleBasedStockAnalyzer.ts`
- `src/lib/alpha/SignalFusionEngine.ts`
- `src/lib/onlineValidation/ActiveScoringSnapshotBuilder.ts`
- Any corpus `.jsonl` file
- `prisma/dev.db`

---

## Template Rules to Implement

### TR-01: scoreSnapshot passthrough (P26ACorpusRowAdapter.ts)
```ts
// In buildWalkthroughCaseInputFromCorpusRow():
scoreSnapshot: activeScoringSnapshot?.scoreSnapshot,
```

### TR-02: inferDirectionFromMATrend fallback (P26AReasonFactorEnrichmentUtils.ts)
```ts
export function inferDirectionFromMATrend(factorSnapshot: string[]): '偏多' | '偏空' | '中性' {
  const ma = factorSnapshot.find(f => f.includes('MA 趨勢'));
  if (!ma) return '中性';
  if (ma.includes('多頭排列')) return '偏多';
  if (ma.includes('空頭排列')) return '偏空';
  return '中性';
}
// Use as fallback in enrichReasonFromExistingFactors() when technicalScore === 0
```

### TR-03: Mixed-signal template (P26ACorpusReasonRenderer.ts)
- Detect: MA `空頭排列` + MACD `多方動能`, or MA `多頭排列` + MACD `空方動能`
- Output: Neutral context note — e.g. `【技術訊號分歧】MA 趨勢偏空，但 MACD 顯示多方動能，訊號方向尚未一致，建議持續觀察。`
- Must NOT contain buy/sell/ROI language

### TR-04: NO_TRIGGERED_FACTOR note (P26ACorpusReasonRenderer.ts)
- When `factorSnapshot.length > 0` but no individual factor exceeded threshold
- Append: `（系統偵測 N 項因子，但各項訊號強度均未達閾值，暫以技術面概覽呈現）`

### TR-05: Monthly revenue missing note (P26ACorpusReasonRenderer.ts)
- When `missingSources` includes `MonthlyRevenue`
- Append: `月營收資料暫缺（截至 <date>），待資料更新後補充`

### TR-06: Bump rendererVersion
- After implementing all above, bump from current version to `P26A-v3` or next in sequence

---

## Success Criteria

1. P5-CASE-010, 011, 013, 053, 055: Direction label shows `技術面偏多` (not `技術面偏空`) for MA 多頭排列 cases
2. P5-CASE-023, 026, 037, 054: Mixed-signal template fires; output contains signal conflict note
3. All 9 cases: `ENRICHED` outcome (not `FALLBACK_EMPTY`)
4. All frozen file SHA256 hashes unchanged
5. All existing tests still pass (`npx jest src/lib/onlineValidation/__tests__ --no-coverage`)
6. `npx jest src/lib/onlineValidation/__tests__/p28b_reason_template_coverage_plan.test.ts --no-coverage` → 48/48 PASS

---

## Invariance Requirements

- alphaScore for all 9 cases: **unchanged**
- bucket for all 9 cases: **unchanged**
- DB SHA256: `a5cf277182c161dfe97ba05f9b81528d6c8e477dd5ac0bec6810ffbb8711c6f8` — **unchanged**
- No corpus file writes

---

*Observability only. No investment recommendations.*
