# P28 Reason Underoutput Track Timeline

**Track:** P26A → P28A → P28B → P28C → P28D Reason Underoutput Renderer Repair
**Verdict:** EVIDENCE_CHAIN_COHERENT_AND_SCORING_INVARIANT

## Phase Chain

| Phase | Commit | Date | Classification | Key Finding | Tests | Invariance |
| --- | --- | --- | --- | --- | --- | --- |
| P26A | `b330b42` / `3411614` / `a0145fa` / `ba39187` | 2026-05-13 | P26A_FEATURE_SNAPSHOT_V1_COMPLETE | 9 SCORING_UNDEROUTPUT residuals identified | Full suite PASS | UNCHANGED |
| P28A | `1cf0252` | 2026-05-15 | P28A_SCORING_UNDEROUTPUT_AUDIT_COMPLETE | All 9 cases = NO_TRIGGERED_FACTOR (scoring correct; serialization is the issue) | 2885/2885 | UNCHANGED |
| P28B | `0ca055b` | 2026-05-15 | P28B_REASON_TEMPLATE_COVERAGE_PLAN_READY | 2 families (scoreSnapshot_zero_label=5, mixed_signals_no_template=4); 4 template rules TR-01..TR-04 | Plan-only | UNCHANGED |
| P28C | `73ce251` | 2026-05-15 | P28C_RENDERER_ONLY_REPAIR_COMPLETE | Renderer v2; 4 files patched (none in scoring path); 9/9 ENRICHED | 2976/2976 | UNCHANGED |
| P28D | `6801e0e` | 2026-05-15 | P28D_POST_RENDERER_VALIDATION_COMPLETE | 9/9 integrated ENRICHED; P3+P19 sweep 572 sampled rows / 0 errors; 0 breaking changes | 2997/2997 | UNCHANGED |

## Repair Families (from P28B / P28C)

### Family 1: `scoreSnapshot_zero_label` — 5 cases
- **Cases:** P5-CASE-010, 011, 013, 053, 055
- **Symbols:** 1710, 00738U
- **Root cause:** `reviewCase()` constructed `minimalSnapshot` with hardcoded zero `scoreSnapshot`, causing `enrichReasonFromExistingFactors()` to infer direction = '偏空' even when MA showed '多頭排列'.
- **Fix:** `WalkthroughCaseInput.scoreSnapshot?` passthrough + `inferDirectionFromMATrend(factors)` fallback when `technicalScore=0`.

### Family 2: `mixed_signals_no_template` — 4 cases
- **Cases:** P5-CASE-023, 026, 037, 054
- **Symbol:** 00891
- **Root cause:** MA 空頭排列 + MACD 多方動能 contradiction with no unified template.
- **Fix:** `detectMixedSignal()` + `buildMixedSignalNote()` annotated as suffix.

## Renderer Version Trail

- P26A start: `p26a-corpus-renderer-v1`
- P28C bump: `p26a-corpus-renderer-v2` ← current production renderer
- P28D confirmed in integrated path on 9-case + P3/P19 sweep

## Evidence Consistency

| Metric | Value |
| --- | ---: |
| Cases identified in P28A | 9 |
| Cases repair-planned in P28B | 9 |
| Cases repaired in P28C | 9 |
| Cases integrated-validated in P28D | 9 |
| Scoring files touched | **0** |
| DB writes | **0** |
| Corpus mutations | **0** |

## What P28E Closes

- Confirms P26A→P28D timeline is coherent
- Confirms scoring invariance held across all 5 phases
- Confirms repair scope == repair execution == repair validation == 9 cases
- Allows formal closure of the reason underoutput track
- Pre-commits Route D for next round: P29-A PIT-safe Feature Availability Registry v1
