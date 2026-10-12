# P14-HARDRESET: Fixture-Only Dry-Run Validation

> **Disclaimer:** Fixture-only validation. Does not query production DB. Does not constitute investment advice.

**Generated:** 2026-05-12T03:46:01.010Z
**Validation Status:** PASS
**Results:** 11/11 PASS — 0 FAIL

---

## Migration Draft Safety

| Status |
|--------|
| SAFE_DRY_RUN_ONLY |

## Query Gate Contract

**Contract ID:** p14-monthly-revenue-query-gate-contract-v0

## Test Cases

| ID | Description | Status |
|----|-------------|--------|
| TC-01 | explicit releaseDate=2024-02-10, asOf=2024-02-09 → unavailable | ✅ PASS |
| TC-02 | explicit releaseDate=2024-02-10, asOf=2024-02-10 → available | ✅ PASS |
| TC-03 | missing releaseDate, allowInferred=true, year=2024 month=1, asOf=2024-02-10 → available | ✅ PASS |
| TC-04 | missing releaseDate, allowInferred=false → unavailable | ✅ PASS |
| TC-05 | Dec 2024: inferred releaseDate=2025-01-10, asOf=2025-01-10 → available | ✅ PASS |
| TC-06 | missing year/month → unavailable | ✅ PASS |
| TC-07 | invalid releaseDate format → unavailable | ✅ PASS |
| TC-08 | record with forbidden outcome fields → flagged, but gate still evaluates normally | ✅ PASS |
| TC-09 | AUTHORITATIVE releaseDate set → source=AUTHORITATIVE, confidence=HIGH | ✅ PASS |
| TC-09b | inferred releaseDate → source=INFERRED_NEXT_MONTH_10TH, confidence=LOW_TO_MEDIUM | ✅ PASS |
| TC-10 | rollback draft exists and productionApplyAllowed=false | ✅ PASS |



## Non-Goals

- Does not query production DB.
- Does not modify corpus or schema.
- Does not compute ROI, profit, win-rate, or alpha.
- Does not constitute investment advice.
- Fixtures are in-memory only.
