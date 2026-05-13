# P26A-RENDERER-FIX-HARDRESET Final Report

**Date:** 2026-05-14
**Commit:** TBD

> Does not constitute investment advice.

## 1. Goals

- Trace reasonSnapshot/factorSnapshot rendering path
- Implement read-time renderer that uses factorSnapshot for multi-factor reason
- No scoring formula change, no alphaScore change, no DB write
- Confirm 9 UNDEROUTPUT cases are improved

## 2. P26A 9-Case Audit Recap

- 9 cases, 3 symbols (1710/00738U/00891), 5 unique (symbol,asOfDate)
- All had reasonSnapshot = single-token string (e.g. "technicalBullish")
- All had factorSnapshot with 10+ rich signals
- Root cause: SNAPSHOT_FIELD_PRESENT_BUT_REASON_NOT_RENDERED

## 3. Rendering Path Trace

- factorSnapshot: produced by ActiveScoringSnapshotBuilder from RuleBasedStockAnalyzer.factors
- reasonSnapshot: set at line 316 from result.reason (single token); P26A enrichment at 333-335 runs for NEW builds
- Corpus data (frozen): built before P26A enrichment -> single-token stored
- P5WalkthroughReviewUtils: reads caseRow.reasonSnapshot directly -> UNDEROUTPUT
- Fix: P26ACorpusReasonRenderer.renderReasonFromCorpusSnapshot - applies enrichment at READ time

## 4. Renderer Fix

- New file: src/lib/onlineValidation/P26ACorpusReasonRenderer.ts
- renderReasonFromCorpusSnapshot: pure function, no DB write, no alphaScore change
- isSingleTokenGenericReason: detects pre-enrichment patterns
- buildDataCoverageNote: neutral data availability note (no investment claim)
- SINGLE_TOKEN_GENERIC_REASONS: 16 known pre-enrichment patterns

## 5. Modified/New Files

- NEW: src/lib/onlineValidation/P26ACorpusReasonRenderer.ts
- NEW: src/lib/onlineValidation/__tests__/p26a_renderer_fix.test.ts
- NEW: outputs/online_validation/p26a_renderer_fix_preflight.json/.md
- NEW: outputs/online_validation/p26a_renderer_path_trace.json/.md
- NEW: outputs/online_validation/p26a_renderer_fix_spec.json/.md
- NEW: outputs/online_validation/p26a_renderer_fix_9case_before_after.json/.md
- NEW: outputs/online_validation/p26a_renderer_fix_invariance.json/.md
- NEW: outputs/online_validation/p26a_renderer_fix_forbidden_claims_scan.json/.md
- UNCHANGED: src/lib/analysis/RuleBasedStockAnalyzer.ts
- UNCHANGED: src/lib/alpha/SignalFusionEngine.ts
- UNCHANGED: src/lib/onlineValidation/ActiveScoringSnapshotBuilder.ts
- UNCHANGED: prisma/dev.db
- UNCHANGED: all corpus files (60/4500/9900/4500/4500)

## 6. 9-Case Before/After

| caseId | symbol | alpha | oldReason | newFactors | class |
|--------|--------|-------|-----------|------------|-------|
| P5-CASE-010 | 1710 | 68 | 技術偏多 | 4 | PARTIAL_FIX_SOURCE_STILL_MISSING |
| P5-CASE-011 | 00738U | 63 | 技術偏多 | 4 | PARTIAL_FIX_SOURCE_STILL_MISSING |
| P5-CASE-013 | 1710 | 68 | 技術偏多 | 4 | PARTIAL_FIX_SOURCE_STILL_MISSING |
| P5-CASE-023 | 00891 | 63 | 技術偏多 | 4 | PARTIAL_FIX_SOURCE_STILL_MISSING |
| P5-CASE-026 | 00891 | 63 | 技術偏多 | 4 | PARTIAL_FIX_SOURCE_STILL_MISSING |
| P5-CASE-037 | 00891 | 63 | 技術偏多 | 4 | PARTIAL_FIX_SOURCE_STILL_MISSING |
| P5-CASE-053 | 00738U | 63 | 技術偏多 | 4 | PARTIAL_FIX_SOURCE_STILL_MISSING |
| P5-CASE-054 | 00891 | 63 | 技術偏多 | 4 | PARTIAL_FIX_SOURCE_STILL_MISSING |
| P5-CASE-055 | 1710 | 68 | 技術偏多 | 4 | PARTIAL_FIX_SOURCE_STILL_MISSING |

- All 9 cases: newReasonFactorCount = 4 (from 1 single-token)
- All 9: PARTIAL_FIX_SOURCE_STILL_MISSING (renderer fixed; MonthlyRevenue source still absent)

## 7. alphaScore / Bucket Invariance

- mismatchedAlphaScoreCount: 0
- mismatchedBucketCount: 0
- Renderer is pure function; does NOT mutate input snapshot

## 8. DB / Corpus / Scoring Invariance

- prisma/dev.db sha256: UNCHANGED
- Corpus 60/4500/9900/4500/4500: UNCHANGED
- Scoring formula sha256: all UNCHANGED

## 9. Tests

- New tests (p26a_renderer_fix.test.ts): 44 PASS
- Full onlineValidation suite: 2758 PASS

## 10. Forbidden Claims Scan

- Result: CLEAN
- Hits: test pattern definitions only (allowed)

## 11. Unresolved Items

- MonthlyRevenue source still missing (operator action required)
- P26F4 still blocked until operator provides source + approval token

## 12. Risks

- If renderer is applied to live API output, UI must use renderReasonFromCorpusSnapshot instead of raw reasonSnapshot field
- TWSE/MOPS URLs in handoff packet: URL TBD, CTO must verify

## 13. Next Round

- P26F4: operator provides real TWSE/MOPS source files + approval token
- P26A-RENDERER-INTEGRATION: integrate P26ACorpusReasonRenderer into P5WalkthroughReviewUtils and API display path

## 14. Final Classification

**P26A_RENDERER_FIX_PARTIAL_SOURCE_STILL_MISSING**

Renderer underoutput fixed for all 9 cases (single-token -> 4-factor output).
MonthlyRevenue source gap remains (operator must provide files for P26F4).
No scoring change. No DB write. No corpus change.

---
> Does not constitute investment advice.
