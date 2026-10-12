# P8-PREFLIGHT: Signal / Reason Generic Diagnosis

**Generated:** 2026-05-12  
**Phase:** P8-PREFLIGHT  
**Cases Analyzed:** 24

> **Disclaimer:** Root-cause pre-classification only. No investment recommendations. No reason or signal logic changes. No model changes.

---

## Summary

| Metric | Value |
|--------|-------|
| Total Generic Cases | 24 |
| Single-Token Reason Count | 24 |
| Partial Scoring Count | 13 |
| Dominant Category | **TEMPLATE_TOO_GENERIC** |

### Category Distribution

| Category | Count | % |
|----------|-------|---|
| Template Too Generic | 9 | 38% |
| Snapshot Capture Missing | 2 | 8% |
| Factor Explanation Missing | 4 | 17% |
| Scoring Engine Underoutput | 9 | 38% |
| Unknown — Requires Code Trace | 0 | 0% |

### Factor Type Distribution

| Factor Token | Count |
|-------------|-------|
| `技術偏多` | 13 |
| `技術偏空` | 7 |
| `法人買超` | 4 |

---

## Key Insights

1. 24/24 cases have single-token reason snapshots — insufficient for factor-level explainability.
2. 13/24 cases have PARTIAL scoring completeness — the engine did not output all factor dimensions.
3. Dominant root-cause category: TEMPLATE_TOO_GENERIC (9 cases).
4. No reason or signal logic has been modified during this diagnosis phase.
5. All repair actions are deferred to P8 execution phase (future sprint).

---

## Case-Level Diagnosis


### 1. P5-CASE-003 — 1717

| Field | Value |
|-------|-------|
| Symbol | 1717 |
| As-Of Date | 2025-12-22 |
| Horizon | 5d |
| Reason (Raw) | `技術偏多` |
| Reason (Normalized) | `技術偏多` |
| Factor Count | 1 |
| **Diagnosis Category** | **TEMPLATE_TOO_GENERIC** |
| Recommended Repair | Enrich Reason Template |

**Factor Summary:** Single token: "技術偏多" (technical signal factor). No supporting indicators or data values captured.

**Evidence:** scoringCompletenessStatus=COMPLETE AND reason="技術偏多" is a single generic token. The scoring engine had all required data but the reason template only emitted the category-level signal name. The template needs to be enriched to include supporting indicator values and context (e.g., MA direction, RSI level, volume trend).


### 2. P5-CASE-005 — 00903

| Field | Value |
|-------|-------|
| Symbol | 00903 |
| As-Of Date | 2025-12-03 |
| Horizon | 5d |
| Reason (Raw) | `技術偏空` |
| Reason (Normalized) | `技術偏空` |
| Factor Count | 1 |
| **Diagnosis Category** | **TEMPLATE_TOO_GENERIC** |
| Recommended Repair | Enrich Reason Template |

**Factor Summary:** Single token: "技術偏空" (technical signal factor). No supporting indicators or data values captured.

**Evidence:** scoringCompletenessStatus=COMPLETE AND reason="技術偏空" is a single generic token. The scoring engine had all required data but the reason template only emitted the category-level signal name. The template needs to be enriched to include supporting indicator values and context (e.g., MA direction, RSI level, volume trend).


### 3. P5-CASE-006 — 00712

| Field | Value |
|-------|-------|
| Symbol | 00712 |
| As-Of Date | 2025-11-24 |
| Horizon | 5d |
| Reason (Raw) | `技術偏空` |
| Reason (Normalized) | `技術偏空` |
| Factor Count | 1 |
| **Diagnosis Category** | **SNAPSHOT_CAPTURE_MISSING** |
| Recommended Repair | Fix Snapshot Factor Capture |

**Factor Summary:** Single token: "技術偏空" (technical signal factor). No supporting indicators or data values captured.

**Evidence:** scoreBucketConsistency=INCONSISTENT AND reason="技術偏空" is a single generic token. The snapshot did not capture the factor that triggered the bucket assignment. Without this factor in the snapshot, the reason cannot be more specific. Root cause: snapshot capture pipeline did not persist the bucket-triggering factor.


### 4. P5-CASE-008 — 1717

| Field | Value |
|-------|-------|
| Symbol | 1717 |
| As-Of Date | 2025-12-04 |
| Horizon | 5d |
| Reason (Raw) | `技術偏多` |
| Reason (Normalized) | `技術偏多` |
| Factor Count | 1 |
| **Diagnosis Category** | **TEMPLATE_TOO_GENERIC** |
| Recommended Repair | Enrich Reason Template |

**Factor Summary:** Single token: "技術偏多" (technical signal factor). No supporting indicators or data values captured.

**Evidence:** scoringCompletenessStatus=COMPLETE AND reason="技術偏多" is a single generic token. The scoring engine had all required data but the reason template only emitted the category-level signal name. The template needs to be enriched to include supporting indicator values and context (e.g., MA direction, RSI level, volume trend).


### 5. P5-CASE-010 — 1710

| Field | Value |
|-------|-------|
| Symbol | 1710 |
| As-Of Date | 2025-12-15 |
| Horizon | 5d |
| Reason (Raw) | `技術偏多` |
| Reason (Normalized) | `技術偏多` |
| Factor Count | 1 |
| **Diagnosis Category** | **SCORING_ENGINE_UNDEROUTPUT** |
| Recommended Repair | Fix Scoring Engine Output Completeness |

**Factor Summary:** Single token: "技術偏多" (technical signal factor). No supporting indicators or data values captured.

**Evidence:** scoringCompletenessStatus=PARTIAL AND reason="技術偏多" is a single generic token. The scoring engine did not fully compute all factor dimensions, leaving the reason with only the top-level signal label. Supporting factor data was not available at capture time.


### 6. P5-CASE-011 — 00738U

| Field | Value |
|-------|-------|
| Symbol | 00738U |
| As-Of Date | 2025-12-19 |
| Horizon | 5d |
| Reason (Raw) | `技術偏多` |
| Reason (Normalized) | `技術偏多` |
| Factor Count | 1 |
| **Diagnosis Category** | **SCORING_ENGINE_UNDEROUTPUT** |
| Recommended Repair | Fix Scoring Engine Output Completeness |

**Factor Summary:** Single token: "技術偏多" (technical signal factor). No supporting indicators or data values captured.

**Evidence:** scoringCompletenessStatus=PARTIAL AND reason="技術偏多" is a single generic token. The scoring engine did not fully compute all factor dimensions, leaving the reason with only the top-level signal label. Supporting factor data was not available at capture time.


### 7. P5-CASE-013 — 1710

| Field | Value |
|-------|-------|
| Symbol | 1710 |
| As-Of Date | 2025-12-15 |
| Horizon | 5d |
| Reason (Raw) | `技術偏多` |
| Reason (Normalized) | `技術偏多` |
| Factor Count | 1 |
| **Diagnosis Category** | **SCORING_ENGINE_UNDEROUTPUT** |
| Recommended Repair | Fix Scoring Engine Output Completeness |

**Factor Summary:** Single token: "技術偏多" (technical signal factor). No supporting indicators or data values captured.

**Evidence:** scoringCompletenessStatus=PARTIAL AND reason="技術偏多" is a single generic token. The scoring engine did not fully compute all factor dimensions, leaving the reason with only the top-level signal label. Supporting factor data was not available at capture time.


### 8. P5-CASE-019 — 0055

| Field | Value |
|-------|-------|
| Symbol | 0055 |
| As-Of Date | 2025-12-08 |
| Horizon | 20d |
| Reason (Raw) | `技術偏空` |
| Reason (Normalized) | `技術偏空` |
| Factor Count | 1 |
| **Diagnosis Category** | **TEMPLATE_TOO_GENERIC** |
| Recommended Repair | Enrich Reason Template |

**Factor Summary:** Single token: "技術偏空" (technical signal factor). No supporting indicators or data values captured.

**Evidence:** scoringCompletenessStatus=COMPLETE AND reason="技術偏空" is a single generic token. The scoring engine had all required data but the reason template only emitted the category-level signal name. The template needs to be enriched to include supporting indicator values and context (e.g., MA direction, RSI level, volume trend).


### 9. P5-CASE-022 — 1717

| Field | Value |
|-------|-------|
| Symbol | 1717 |
| As-Of Date | 2025-12-26 |
| Horizon | 20d |
| Reason (Raw) | `技術偏多` |
| Reason (Normalized) | `技術偏多` |
| Factor Count | 1 |
| **Diagnosis Category** | **TEMPLATE_TOO_GENERIC** |
| Recommended Repair | Enrich Reason Template |

**Factor Summary:** Single token: "技術偏多" (technical signal factor). No supporting indicators or data values captured.

**Evidence:** scoringCompletenessStatus=COMPLETE AND reason="技術偏多" is a single generic token. The scoring engine had all required data but the reason template only emitted the category-level signal name. The template needs to be enriched to include supporting indicator values and context (e.g., MA direction, RSI level, volume trend).


### 10. P5-CASE-023 — 00891

| Field | Value |
|-------|-------|
| Symbol | 00891 |
| As-Of Date | 2025-11-12 |
| Horizon | 20d |
| Reason (Raw) | `技術偏多` |
| Reason (Normalized) | `技術偏多` |
| Factor Count | 1 |
| **Diagnosis Category** | **SCORING_ENGINE_UNDEROUTPUT** |
| Recommended Repair | Fix Scoring Engine Output Completeness |

**Factor Summary:** Single token: "技術偏多" (technical signal factor). No supporting indicators or data values captured.

**Evidence:** scoringCompletenessStatus=PARTIAL AND reason="技術偏多" is a single generic token. The scoring engine did not fully compute all factor dimensions, leaving the reason with only the top-level signal label. Supporting factor data was not available at capture time.


### 11. P5-CASE-024 — 2317

| Field | Value |
|-------|-------|
| Symbol | 2317 |
| As-Of Date | 2025-11-06 |
| Horizon | 20d |
| Reason (Raw) | `法人買超` |
| Reason (Normalized) | `法人買超` |
| Factor Count | 1 |
| **Diagnosis Category** | **FACTOR_EXPLANATION_MISSING** |
| Recommended Repair | Add Factor Explanation Layer |

**Factor Summary:** Single token: "法人買超" (institutional/chip factor). No supporting indicators or data values captured.

**Evidence:** reason="法人買超" identifies an institutional/chip factor but provides no detail (e.g., which institutions, net volume, date range). scoringCompletenessStatus=PARTIAL. The factor label is captured but the underlying data explaining it is absent.


### 12. P5-CASE-026 — 00891

| Field | Value |
|-------|-------|
| Symbol | 00891 |
| As-Of Date | 2025-11-12 |
| Horizon | 20d |
| Reason (Raw) | `技術偏多` |
| Reason (Normalized) | `技術偏多` |
| Factor Count | 1 |
| **Diagnosis Category** | **SCORING_ENGINE_UNDEROUTPUT** |
| Recommended Repair | Fix Scoring Engine Output Completeness |

**Factor Summary:** Single token: "技術偏多" (technical signal factor). No supporting indicators or data values captured.

**Evidence:** scoringCompletenessStatus=PARTIAL AND reason="技術偏多" is a single generic token. The scoring engine did not fully compute all factor dimensions, leaving the reason with only the top-level signal label. Supporting factor data was not available at capture time.


### 13. P5-CASE-027 — 1308

| Field | Value |
|-------|-------|
| Symbol | 1308 |
| As-Of Date | 2026-01-28 |
| Horizon | 60d |
| Reason (Raw) | `技術偏多` |
| Reason (Normalized) | `技術偏多` |
| Factor Count | 1 |
| **Diagnosis Category** | **TEMPLATE_TOO_GENERIC** |
| Recommended Repair | Enrich Reason Template |

**Factor Summary:** Single token: "技術偏多" (technical signal factor). No supporting indicators or data values captured.

**Evidence:** scoringCompletenessStatus=COMPLETE AND reason="技術偏多" is a single generic token. The scoring engine had all required data but the reason template only emitted the category-level signal name. The template needs to be enriched to include supporting indicator values and context (e.g., MA direction, RSI level, volume trend).


### 14. P5-CASE-030 — 0055

| Field | Value |
|-------|-------|
| Symbol | 0055 |
| As-Of Date | 2025-11-03 |
| Horizon | 60d |
| Reason (Raw) | `技術偏空` |
| Reason (Normalized) | `技術偏空` |
| Factor Count | 1 |
| **Diagnosis Category** | **TEMPLATE_TOO_GENERIC** |
| Recommended Repair | Enrich Reason Template |

**Factor Summary:** Single token: "技術偏空" (technical signal factor). No supporting indicators or data values captured.

**Evidence:** scoringCompletenessStatus=COMPLETE AND reason="技術偏空" is a single generic token. The scoring engine had all required data but the reason template only emitted the category-level signal name. The template needs to be enriched to include supporting indicator values and context (e.g., MA direction, RSI level, volume trend).


### 15. P5-CASE-036 — 1402

| Field | Value |
|-------|-------|
| Symbol | 1402 |
| As-Of Date | 2025-11-10 |
| Horizon | 60d |
| Reason (Raw) | `法人買超` |
| Reason (Normalized) | `法人買超` |
| Factor Count | 1 |
| **Diagnosis Category** | **FACTOR_EXPLANATION_MISSING** |
| Recommended Repair | Add Factor Explanation Layer |

**Factor Summary:** Single token: "法人買超" (institutional/chip factor). No supporting indicators or data values captured.

**Evidence:** reason="法人買超" identifies an institutional/chip factor but provides no detail (e.g., which institutions, net volume, date range). scoringCompletenessStatus=PARTIAL. The factor label is captured but the underlying data explaining it is absent.


### 16. P5-CASE-037 — 00891

| Field | Value |
|-------|-------|
| Symbol | 00891 |
| As-Of Date | 2025-10-15 |
| Horizon | 60d |
| Reason (Raw) | `技術偏多` |
| Reason (Normalized) | `技術偏多` |
| Factor Count | 1 |
| **Diagnosis Category** | **SCORING_ENGINE_UNDEROUTPUT** |
| Recommended Repair | Fix Scoring Engine Output Completeness |

**Factor Summary:** Single token: "技術偏多" (technical signal factor). No supporting indicators or data values captured.

**Evidence:** scoringCompletenessStatus=PARTIAL AND reason="技術偏多" is a single generic token. The scoring engine did not fully compute all factor dimensions, leaving the reason with only the top-level signal label. Supporting factor data was not available at capture time.


### 17. P5-CASE-039 — 1402

| Field | Value |
|-------|-------|
| Symbol | 1402 |
| As-Of Date | 2025-11-10 |
| Horizon | 60d |
| Reason (Raw) | `法人買超` |
| Reason (Normalized) | `法人買超` |
| Factor Count | 1 |
| **Diagnosis Category** | **FACTOR_EXPLANATION_MISSING** |
| Recommended Repair | Add Factor Explanation Layer |

**Factor Summary:** Single token: "法人買超" (institutional/chip factor). No supporting indicators or data values captured.

**Evidence:** reason="法人買超" identifies an institutional/chip factor but provides no detail (e.g., which institutions, net volume, date range). scoringCompletenessStatus=PARTIAL. The factor label is captured but the underlying data explaining it is absent.


### 18. P5-CASE-041 — 00712

| Field | Value |
|-------|-------|
| Symbol | 00712 |
| As-Of Date | 2025-12-02 |
| Horizon | 20d |
| Reason (Raw) | `技術偏空` |
| Reason (Normalized) | `技術偏空` |
| Factor Count | 1 |
| **Diagnosis Category** | **SNAPSHOT_CAPTURE_MISSING** |
| Recommended Repair | Fix Snapshot Factor Capture |

**Factor Summary:** Single token: "技術偏空" (technical signal factor). No supporting indicators or data values captured.

**Evidence:** scoreBucketConsistency=INCONSISTENT AND reason="技術偏空" is a single generic token. The snapshot did not capture the factor that triggered the bucket assignment. Without this factor in the snapshot, the reason cannot be more specific. Root cause: snapshot capture pipeline did not persist the bucket-triggering factor.


### 19. P5-CASE-045 — 00903

| Field | Value |
|-------|-------|
| Symbol | 00903 |
| As-Of Date | 2025-12-03 |
| Horizon | 5d |
| Reason (Raw) | `技術偏空` |
| Reason (Normalized) | `技術偏空` |
| Factor Count | 1 |
| **Diagnosis Category** | **TEMPLATE_TOO_GENERIC** |
| Recommended Repair | Enrich Reason Template |

**Factor Summary:** Single token: "技術偏空" (technical signal factor). No supporting indicators or data values captured.

**Evidence:** scoringCompletenessStatus=COMPLETE AND reason="技術偏空" is a single generic token. The scoring engine had all required data but the reason template only emitted the category-level signal name. The template needs to be enriched to include supporting indicator values and context (e.g., MA direction, RSI level, volume trend).


### 20. P5-CASE-046 — 00903

| Field | Value |
|-------|-------|
| Symbol | 00903 |
| As-Of Date | 2025-10-31 |
| Horizon | 5d |
| Reason (Raw) | `技術偏空` |
| Reason (Normalized) | `技術偏空` |
| Factor Count | 1 |
| **Diagnosis Category** | **TEMPLATE_TOO_GENERIC** |
| Recommended Repair | Enrich Reason Template |

**Factor Summary:** Single token: "技術偏空" (technical signal factor). No supporting indicators or data values captured.

**Evidence:** scoringCompletenessStatus=COMPLETE AND reason="技術偏空" is a single generic token. The scoring engine had all required data but the reason template only emitted the category-level signal name. The template needs to be enriched to include supporting indicator values and context (e.g., MA direction, RSI level, volume trend).


### 21. P5-CASE-051 — 1402

| Field | Value |
|-------|-------|
| Symbol | 1402 |
| As-Of Date | 2025-10-30 |
| Horizon | 5d |
| Reason (Raw) | `法人買超` |
| Reason (Normalized) | `法人買超` |
| Factor Count | 1 |
| **Diagnosis Category** | **FACTOR_EXPLANATION_MISSING** |
| Recommended Repair | Add Factor Explanation Layer |

**Factor Summary:** Single token: "法人買超" (institutional/chip factor). No supporting indicators or data values captured.

**Evidence:** reason="法人買超" identifies an institutional/chip factor but provides no detail (e.g., which institutions, net volume, date range). scoringCompletenessStatus=PARTIAL. The factor label is captured but the underlying data explaining it is absent.


### 22. P5-CASE-053 — 00738U

| Field | Value |
|-------|-------|
| Symbol | 00738U |
| As-Of Date | 2025-12-19 |
| Horizon | 5d |
| Reason (Raw) | `技術偏多` |
| Reason (Normalized) | `技術偏多` |
| Factor Count | 1 |
| **Diagnosis Category** | **SCORING_ENGINE_UNDEROUTPUT** |
| Recommended Repair | Fix Scoring Engine Output Completeness |

**Factor Summary:** Single token: "技術偏多" (technical signal factor). No supporting indicators or data values captured.

**Evidence:** scoringCompletenessStatus=PARTIAL AND reason="技術偏多" is a single generic token. The scoring engine did not fully compute all factor dimensions, leaving the reason with only the top-level signal label. Supporting factor data was not available at capture time.


### 23. P5-CASE-054 — 00891

| Field | Value |
|-------|-------|
| Symbol | 00891 |
| As-Of Date | 2025-12-30 |
| Horizon | 5d |
| Reason (Raw) | `技術偏多` |
| Reason (Normalized) | `技術偏多` |
| Factor Count | 1 |
| **Diagnosis Category** | **SCORING_ENGINE_UNDEROUTPUT** |
| Recommended Repair | Fix Scoring Engine Output Completeness |

**Factor Summary:** Single token: "技術偏多" (technical signal factor). No supporting indicators or data values captured.

**Evidence:** scoringCompletenessStatus=PARTIAL AND reason="技術偏多" is a single generic token. The scoring engine did not fully compute all factor dimensions, leaving the reason with only the top-level signal label. Supporting factor data was not available at capture time.


### 24. P5-CASE-055 — 1710

| Field | Value |
|-------|-------|
| Symbol | 1710 |
| As-Of Date | 2025-12-15 |
| Horizon | 5d |
| Reason (Raw) | `技術偏多` |
| Reason (Normalized) | `技術偏多` |
| Factor Count | 1 |
| **Diagnosis Category** | **SCORING_ENGINE_UNDEROUTPUT** |
| Recommended Repair | Fix Scoring Engine Output Completeness |

**Factor Summary:** Single token: "技術偏多" (technical signal factor). No supporting indicators or data values captured.

**Evidence:** scoringCompletenessStatus=PARTIAL AND reason="技術偏多" is a single generic token. The scoring engine did not fully compute all factor dimensions, leaving the reason with only the top-level signal label. Supporting factor data was not available at capture time.


---

## What Is Not Changed

- No reason / signal generation logic modified
- No scoring engine changes
- No snapshot capture logic changes
- No corpus modifications
- All repair actions deferred to P8 execution phase (future sprint)

---

*End of P8-PREFLIGHT Signal / Reason Generic Diagnosis*
