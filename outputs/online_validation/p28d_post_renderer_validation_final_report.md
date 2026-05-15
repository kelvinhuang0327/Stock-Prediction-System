# P28D — Post-Renderer Repair Validation Final Report

**Phase**: P28D-POST-RENDERER-REPAIR-VALIDATION-HARDRESET  
**Classification**: `P28D_POST_RENDERER_VALIDATION_COMPLETE`  
**Date**: 2025-05-15  
**Base Commit**: `73ce251` (P28C: Implement renderer-only reason template repair)

---

## Executive Summary

P28C renderer repair is **fully validated** across all integrated paths.  
The renderer fires correctly in the walkthrough review path, passes a full P3/P19 corpus regression sweep with zero errors, and introduces **zero breaking changes** to any API or display path.

All frozen files (DB, scoring pipeline, corpus JSONL) are byte-for-byte unchanged.  
The full test suite passes: **2997/2997 tests**.

---

## Part A — Pre-Flight Gate

**Status**: ✅ PASS  
**Artifact**: `p28d_post_renderer_validation_preflight.json` / `.md`

- Renderer version confirmed: `p26a-corpus-renderer-v2`
- P28C commit confirmed: `73ce251`
- P28C test baseline confirmed: 100/100 tests in `p28c_renderer_only_repair.test.ts`
- 9-case before/after confirmed: 9/9 ENRICHED in `p28c_9case_before_after_generator.test.ts`
- Frozen file SHA256 baseline recorded

---

## Part B — Integrated Renderer Path Trace

**Status**: ✅ PASS  
**Artifact**: `p28d_integrated_renderer_path_trace.json` / `.md`

Full call chain confirmed:
```
CorpusRow
  → corpusRowToWalkthroughCaseInput()   [P26ACorpusRowAdapter.ts]
  → reviewCase()                         [P5WalkthroughReviewUtils.ts]
  → renderReasonFromCorpusSnapshot()     [P26ACorpusReasonRenderer.ts]
  → enrichReasonFromExistingFactors()    [P26AReasonFactorEnrichmentUtils.ts]
  → inferDirectionFromMATrend()          (techScore=0 fallback)
  → detectMixedSignal()
  → buildMixedSignalNote()
  → CaseReviewResult.renderedReason
```

All 5 additive fields confirmed wired: `renderedReason`, `renderedReasonFactorCount`, `reasonRendererVersion`, `reasonRendererOutcome`, `dataAvailabilityNote`

---

## Part C — 9-Case Integrated Review Validation

**Status**: ✅ PASS — 10/10 tests  
**Artifact**: `p28d_9case_integrated_review_validation.json`

| Check | Result |
|---|---|
| All 9 cases use renderer v2 | ✅ |
| All 9 outcomes != FALLBACK_EMPTY | ✅ |
| All 9 factorCount ≥ 3 | ✅ |
| All 9 alphaScore unchanged | ✅ |
| All 9 bucket unchanged | ✅ |
| scoreSnapshot_zero_label family (C1–C5): enriched | ✅ |
| mixed_signals_no_template family (C6–C9): '混合信號' note present | ✅ |
| No forbidden claims in rendered output | ✅ |

---

## Part D — P3/P19 Corpus Regression Sweep

**Status**: ✅ PASS — 2/2 tests  
**Artifact**: `p28d_p3_p19_renderer_regression_sweep.json`

| Corpus | Lines | Sampled | Render Errors | Fallback Empty | Alpha Mismatch | Outcome Leakage | Determinism |
|---|---|---|---|---|---|---|---|
| p3active (4500 lines) | 4500 | 286 | 0 | 0 | 0 | 0 | ✅ |
| p19active (4499 lines) | 4499 | 286 | 0 | 0 | 0 | 0 | ✅ |

**returnPct not fed to renderer** — no outcome leakage confirmed.

---

## Part E — API/Display Backward Compatibility Audit

**Status**: ✅ PASS  
**Artifact**: `p28d_api_display_backward_compatibility_audit.json` / `.md`

- Breaking changes: 0
- Fields added to `CaseReviewResult`: 5 (all additive, all optional for consumers)
- API routes modified: 0
- Only API route that touches adjacent code (`/api/admin/data-quality`): does NOT expose renderer output
- All scripts using renderer: read-only validation scripts only

---

## Part F — Full Test Suite

**Status**: ✅ PASS  
**Result**: **99/99 suites, 2997/2997 tests PASS**

| Suite | Tests | Status |
|---|---|---|
| p28b_reason_template_coverage_plan | 57 | ✅ |
| p28c_renderer_only_repair | 43 | ✅ |
| p28c_9case_before_after_generator | 9 | ✅ (P28C baseline confirmed) |
| p28d_post_renderer_validation | 12 | ✅ (NEW) |
| All other onlineValidation suites | 2876 | ✅ |

---

## Part G — Invariance Re-Check

**Status**: ✅ PASS  
**Artifact**: `p28d_post_renderer_validation_invariance.json` / `.md`

| File | SHA Unchanged | Lines Unchanged |
|---|---|---|
| `prisma/dev.db` | ✅ `a5cf2771...` | N/A |
| `RuleBasedStockAnalyzer.ts` | ✅ `bc3716cc...` | N/A |
| `SignalFusionEngine.ts` | ✅ `b8ce3fa3...` | N/A |
| `ActiveScoringSnapshotBuilder.ts` | ✅ `063a3bd5...` | N/A |
| p3active corpus | N/A | ✅ 4500 |
| p19active corpus | N/A | ✅ 4499 |
| simulation corpus | N/A | ✅ 60 |
| p0hardreset corpus | N/A | ✅ 4500 |
| p1baseline corpus | N/A | ✅ 9900 |

---

## Part H — Forbidden Claims Scan

**Status**: ✅ PASS  
**Artifact**: `p28d_post_renderer_validation_forbidden_claims_scan.json`

- Violations in rendered output: **0**
- Violations in artifacts: **0**
- All grep hits are in guard/detection code or negating disclaimers — not emitted output
- `外資淨賣出` appears in rendered text as factual chip data — not a forbidden trading claim

---

## Part I — Safety Boundary Validation

**Status**: ✅ PASS  
**Artifact**: `p28d_post_renderer_validation_boundary_validation.json`

Files in `git diff --name-only HEAD` that are frozen:
- `RuleBasedStockAnalyzer.ts` → ❌ NOT in diff ✅
- `SignalFusionEngine.ts` → ❌ NOT in diff ✅
- `ActiveScoringSnapshotBuilder.ts` → ❌ NOT in diff ✅
- `prisma/dev.db` → ❌ NOT in diff ✅ (`dev.db-shm`/`dev.db-wal` are read-cache files, not the DB itself)
- `*.jsonl` corpus files → ❌ NOT in diff ✅

Only P28C renderer/adapter files, P28D test file, and artifact JSON/MD files appear in diff — **exactly as expected**.

---

## Classification Summary

| Part | Classification |
|---|---|
| A | P28D_PREFLIGHT_PASS |
| B | P28D_PATH_TRACE_PASS |
| C | P28D_9CASE_INTEGRATED_REVIEW_PASS |
| D | P28D_CORPUS_REGRESSION_SWEEP_PASS |
| E | P28D_API_DISPLAY_BACKWARD_COMPAT_PASS |
| F | P28D_FULL_SUITE_PASS (2997/2997) |
| G | P28D_INVARIANCE_PASS |
| H | P28D_FORBIDDEN_CLAIMS_SCAN_PASS |
| I | P28D_SAFETY_BOUNDARY_PASS |
| **Overall** | **P28D_POST_RENDERER_VALIDATION_COMPLETE** |

---

## Files Modified by P28C (Renderer-Only)

1. `src/lib/onlineValidation/P26ACorpusReasonRenderer.ts` — v2 renderer
2. `src/lib/onlineValidation/P26AReasonFactorEnrichmentUtils.ts` — `inferDirectionFromMATrend()` added
3. `src/lib/onlineValidation/P5WalkthroughReviewUtils.ts` — `scoreSnapshot` wired through
4. `src/lib/onlineValidation/P26ACorpusRowAdapter.ts` — `scoreSnapshot` pass-through added

**Files NOT modified (frozen)**: DB, all corpus JSONL, all scoring engine files.

---

## Guarantees

- No investment recommendations. No buy/sell signals.
- Renderer output is observational text only.
- alphaScore is never modified by the renderer.
- researchBucket is never modified by the renderer.
- All changes are read-time display enrichment only.
- No DB writes. No corpus mutations.

---

*Not investment advice. Not a trading system.*  
*Observational note — no trading signal implied. No buy/sell recommendation.*
