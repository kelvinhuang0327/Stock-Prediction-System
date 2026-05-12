# P16-HARDRESET: Fixture Backfill Dry-Run

> **Disclaimer:** Does not constitute investment advice. Governance / dry-run only. No production DB writes.

**Phase:** P16-HARDRESET | **Date:** 2026-05-12  
**Approval Token:** `P14_APPROVE_SCHEMA_MIGRATION_DRY_RUN_ONLY` — VERIFIED  
**productionApplyAllowed:** false | **dryRunOnly:** true

## Validation Status: PASS ✅

## Summary
- Inferred: 4
- Preserved: 2
- Skipped: 4
- Warnings: 2

## Scenario Results
| Status | Scenario | Detail |
|--------|----------|--------|
| ✅ | 1. Jan 2024 inferred releaseDate = 2024-02-10 | action=INFERRED, releaseDate=2024-02-10 |
| ✅ | 2. Dec 2024 inferred releaseDate = 2025-01-10 | action=INFERRED, releaseDate=2025-01-10 |
| ✅ | 3. Explicit releaseDate preserved (OFFICIAL_TWSE) | action=PRESERVED, releaseDate=2024-04-08 |
| ✅ | 4. Missing year → SKIPPED | action=SKIPPED, reason=missing or invalid year |
| ✅ | 5. Missing month → SKIPPED | action=SKIPPED, reason=missing or invalid month |
| ✅ | 6. Invalid month (13) → SKIPPED | action=SKIPPED, reason=invalid month: 13 |
| ✅ | 7. Authoritative releaseDate preserved | action=PRESERVED, releaseDate=2024-07-05 |
| ✅ | 8. Outcome fields detected as warning, not used for backfill | action=INFERRED, outcomeWarning=true |
| ✅ | 9. Duplicate stockId+period → second SKIPPED | TWN-001 results: ["INFERRED","SKIPPED"] |
| ✅ | 10. Future period inferred releaseDate = 2026-12-10 | action=INFERRED, releaseDate=2026-12-10 |

## Safety Gates
| Status | Gate |
|--------|------|
| ✅ | productionDbWritten === false |
| ✅ | dryRunOnly === true |
| ✅ | validationStatus PASS |
| ✅ | all inferred tagged with INFERRED_NEXT_MONTH_10TH |

## Warnings
- Record TWN-008: forbidden outcome fields detected (not used for backfill): returnPct, realizedReturnClass
- Duplicate period for TWN-001:2024:1 — skipping duplicate

## Taiwan Revenue Release Rule
- `month ≠ 12` → `DATE(year, month+1, 10)`
- `month = 12` → `DATE(year+1, 1, 10)`
- releaseDateSource = `INFERRED_NEXT_MONTH_10TH`
- releaseDateConfidence = `LOW_TO_MEDIUM`
