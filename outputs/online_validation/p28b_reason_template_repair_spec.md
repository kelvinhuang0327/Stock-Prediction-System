# P28B: No-Scoring-Change Renderer Repair Specification

**Date:** 2026-05-19  
**Phase:** P28B-REASON-TEMPLATE-COVERAGE-HARDRESET  
**Version:** 1.0.0

---

## Repair Principle

> **All repairs are renderer-only, additive, backward-compatible, deterministic, and do not change the scoring formula.**

| Principle | Enforcement |
|-----------|-------------|
| RENDERER_ONLY | No change to alphaScore, bucket, or any score computation |
| ADDITIVE | New type fields must be optional with backward-compatible defaults |
| BACKWARD_COMPATIBLE | Existing tests must pass unchanged |
| DETERMINISTIC | Same input → same renderedReason (no randomness, no timestamps in text) |
| NO_SCORING_CHANGE | scoreSnapshot used only for direction labels in renderedReason text |
| NO_CORPUS_WRITE | Corpus JSONL files must not be written |
| NO_DB_WRITE | prisma/dev.db must not be written |
| NO_INVESTMENT_CLAIM | No ROI, win-rate, alpha, edge, profit, buy, sell language |
| NO_SCORING_FILE_MODIFY | RuleBasedStockAnalyzer.ts, SignalFusionEngine.ts, ActiveScoringSnapshotBuilder.ts frozen |

---

## Input Contract

### Required Fields
| Field | Type | Description |
|-------|------|-------------|
| `reasonSnapshot` | `string` | Collapsed reason text from corpus (e.g. `'技術偏多'`) |
| `factorSnapshot` | `string[]` | Factor evidence strings from corpus |

### Optional Fields (New in P28C)
| Field | Type | Description |
|-------|------|-------------|
| `scoreSnapshot?` | `{ technicalScore, chipScore, momentumScore, revenueScore }` | **NEW** — actual scores from activeScoringSnapshot; used only for direction labels. Default: all zeros |
| `usedSources?` | `string[]` | Data sources used in scoring |
| `missingSources?` | `string[]` | Data sources missing at score time |
| `alphaScore?` | `number` | READ-ONLY reference — renderer must not modify |
| `researchBucket?` | `string` | READ-ONLY reference — renderer must not modify |
| `asOfDate?` | `string` | Date for data coverage note |

### Invariants
- `alphaScore` must equal corpus `activeScoringSnapshot.alphaScore` at all times
- `researchBucket` must equal corpus `activeScoringSnapshot.researchBucket` at all times
- `scoreSnapshot` values used only for direction label text — never for computing alphaScore or bucket

---

## Output Contract

### Primary Output Fields
| Field | Type | Description |
|-------|------|-------------|
| `renderedReason` | `string` | Enriched multi-factor reason text for display |
| `outcome` | `RendererOutcome` | `'ENRICHED' \| 'ALREADY_RICH' \| 'FALLBACK_EMPTY' \| 'FALLBACK_NO_SNAPSHOT'` |
| `rendererVersion` | `string` | Version string — bumped on each repair |
| `alphaScoreUnchanged` | `true` | Always true |
| `bucketUnchanged` | `true` | Always true |

### Additive Output Fields
| Field | Type | Description |
|-------|------|-------------|
| `renderedReasonFactorCount` | `number` | Count of factor evidence blocks in renderedReason |
| `dataAvailabilityNote` | `string \| null` | Note about missing data sources |
| `reasonRendererOutcome` | `string` | Same as outcome (for CaseReviewResult compatibility) |
| `reasonRendererVersion` | `string` | Same as rendererVersion (for CaseReviewResult compatibility) |

---

## Template Rules

### TR-01: scoreSnapshot Passthrough
- **Trigger:** `WalkthroughCaseInput.scoreSnapshot` present (non-null, not all-zero)
- **Action:** Use actual scoreSnapshot values for direction labels in renderedReason
- **Fallback:** If scoreSnapshot absent or all-zero, infer direction from factorSnapshot MA trend text
- **Files:** `P5WalkthroughReviewUtils.ts`, `P26ACorpusRowAdapter.ts`

### TR-02: MA Direction Inference Fallback
- **Trigger:** `scoreSnapshot.technicalScore === 0` AND factorSnapshot contains MA trend text
- **Action:** Call `inferDirectionFromMATrend(factorText)` → `'偏多' | '偏空' | '中性'`
- **Inference Logic:**
  - MA text contains `'多頭排列'` → `'偏多'`
  - MA text contains `'空頭排列'` → `'偏空'`
  - Otherwise → `'中性'`
- **Files:** `P26AReasonFactorEnrichmentUtils.ts`

### TR-03: Mixed-Signal Template
- **Trigger:** MA direction = `'空頭排列'` AND MACD direction = `'多方動能'` (or vice versa)
- **Action:** Output mixed-signal template:
  ```
  技術面呈現分歧訊號：{MA context}，但 MACD 顯示{MACD context}。整體訊號中性，建議觀察後續動向。
  ```
- **Constraints:** No buy/sell recommendation; use `'建議觀察'` not `'建議買入/賣出'`
- **Files:** `P26ACorpusReasonRenderer.ts`

### TR-04: NO_TRIGGERED_FACTOR Context Note
- **Trigger:** `factorSnapshotCount > 0` AND reasonSnapshot is single-token generic
- **Action:** Append:
  ```
  （系統偵測 {factorSnapshotCount} 項因子，但各項訊號強度均未達閾值，暫以技術面概覽呈現）
  ```
- **Constraints:** Must not claim scoring was wrong; must be observational only
- **Files:** `P26ACorpusReasonRenderer.ts`

### TR-05: Monthly Revenue Missing Note
- **Trigger:** `missingSources` contains `'MonthlyRevenue'`
- **Action:** Add inline note:
  ```
  月營收資料暫缺（截至 {asOfDate}），待資料更新後補充
  ```
- **Files:** `P26ACorpusReasonRenderer.ts`

### TR-06: Chip Direction Passthrough
- **Trigger:** `scoreSnapshot.chipScore` present (non-zero)
- **Action:** Use actual chipScore for chip direction label
- **Fallback:** If `chipScore=0`, use `'籌碼面中性'` as default chip label
- **Files:** `P26AReasonFactorEnrichmentUtils.ts`

---

## Safety Rules

| Rule | Description |
|------|-------------|
| SR-01 | Renderer output must NEVER be stored back to corpus or DB |
| SR-02 | renderedReason is display-only — must never influence alphaScore or bucket |
| SR-03 | All template strings must pass forbidden-claims regex scan before deploy |
| SR-04 | Renderer must be idempotent — calling twice produces identical output |
| SR-05 | New optional fields on WalkthroughCaseInput must not break existing callers |
| SR-06 | rendererVersion must be bumped when output format changes |

---

## Patch Boundary

### Allowed to Modify in P28C

| File | Allowed Changes |
|------|----------------|
| `P26AReasonFactorEnrichmentUtils.ts` | Add `inferDirectionFromMATrend()` pure function; use as fallback in `enrichReasonFromExistingFactors()` |
| `P26ACorpusReasonRenderer.ts` | Add mixed-signal template (TR-03); NO_TRIGGERED_FACTOR note (TR-04); revenue missing note (TR-05); bump rendererVersion |
| `P26ACorpusRowAdapter.ts` | Pass `activeScoringSnapshot.scoreSnapshot` → `WalkthroughCaseInput.scoreSnapshot` (optional field) |
| `P5WalkthroughReviewUtils.ts` | Add optional `scoreSnapshot?` to `WalkthroughCaseInput`; use in `minimalSnapshot` construction |

### Forbidden (Must NOT be modified)

- `src/lib/analysis/RuleBasedStockAnalyzer.ts`
- `src/lib/alpha/SignalFusionEngine.ts`
- `src/lib/onlineValidation/ActiveScoringSnapshotBuilder.ts`
- Any corpus `.jsonl` file
- `prisma/dev.db`

---

*Observability only. No investment recommendations.*
