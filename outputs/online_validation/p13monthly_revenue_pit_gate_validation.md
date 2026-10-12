# P13-HARDRESET: MonthlyRevenue PIT Gate Validation

> Disclaimer: No production DB writes. No investment recommendations. No ROI/alpha/profit claims.

**Status:** PASS  
**Generated:** 2026-05-12T03:25:26.090Z  
**Total:** 35 | **Passed:** 35 | **Failed:** 0 | **Warnings:** 1

## Test Results

| Case | Description | Status |
|------|-------------|--------|
| C1-001 | Jan 2024 inferred releaseDate = 2024-02-10 | PASS |
| C1-002 | Jan 2024 releaseDateSource = INFERRED_NEXT_MONTH_10TH | PASS |
| C1-003 | Jan 2024 repairNeeded = true | PASS |
| C1-004 | Jan 2024 confidence = LOW_TO_MEDIUM | PASS |
| C1-005 | asOfDate=2024-02-09 → unavailable (before release) | PASS |
| C1-006 | asOfDate=2024-02-10 → available (on release day) | PASS |
| C1-007 | asOfDate=2024-02-15 → available (after release day) | PASS |
| C2-001 | Explicit releaseDate uses AUTHORITATIVE source | PASS |
| C2-002 | Explicit releaseDate is returned as-is | PASS |
| C2-003 | Explicit releaseDate repairNeeded = false | PASS |
| C2-004 | Explicit releaseDate confidence = HIGH | PASS |
| C2-005 | asOf before explicit releaseDate → unavailable | PASS |
| C2-006 | asOf = explicit releaseDate → available | PASS |
| C3-001 | Missing year/month → MISSING releaseDateSource | PASS |
| C3-002 | Missing year/month → releaseDate = null | PASS |
| C3-003 | Missing year/month → repairNeeded = true | PASS |
| C3-004 | Missing year/month → available = false | PASS |
| C4-001 | releaseDate after asOfDate → unavailable | PASS |
| C4-002 | Source is AUTHORITATIVE for explicit releaseDate | PASS |
| C5-001 | releaseDate = asOfDate → available | PASS |
| C5-002 | releaseDate < asOfDate → available | PASS |
| C6-001 | Forbidden fields present but releaseDate inferred from year/month only | PASS |
| C6-002 | Source is INFERRED_NEXT_MONTH_10TH regardless of outcome fields | PASS |
| C6-003 | Forbidden fields (outcomePrice/returnPct/realizedReturnClass) must never flow into releaseDate logic — verified by inspection | WARN |
| C7-001 | Dec 2024 inferred releaseDate = 2025-01-10 | PASS |
| C7-002 | Year rolls over correctly (2024 → 2025) | PASS |
| C8-001 | Invalid releaseDate format → INVALID source | PASS |
| C8-002 | Invalid releaseDate → null returned | PASS |
| C8-003 | Invalid releaseDate → repairNeeded = true | PASS |
| C9-001 | Invalid asOfDate → available = false | PASS |
| C10-001 | AUTHORITATIVE releaseDate passes validation | PASS |
| C10-002 | AUTHORITATIVE source returned | PASS |
| C11-001 | Inferred releaseDate has no errors | PASS |
| C11-002 | Inferred date source is INFERRED_NEXT_MONTH_10TH | PASS |
| C11-003 | Inferred date has warning about repairNeeded | PASS |
| C12-001 | Missing year/month → validation invalid | PASS |
