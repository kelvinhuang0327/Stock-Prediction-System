# P26F3-HARDRESET — Source Acquisition Plan

**Date**: 2026-05-13  
**Status**: SOURCE_ACQUISITION_PLAN_COMPLETE

## Needed Periods
- 2025-09 → candidate releaseDate: 2025-10-10
- 2025-10 → candidate releaseDate: 2025-11-10
- 2025-11 → candidate releaseDate: 2025-12-10
- 2025-12 → candidate releaseDate: 2026-01-10
- 2026-01 → candidate releaseDate: 2026-02-10

## Needed Symbols (25)
0055, 00712, 00738U, 00830, 00891, 00903, 1210, 1308, 1314, 1319, 1326, 1402, 1434, 1513, 1536, 1560, 1598, 1605, 1710, 1717, 1802, 2317, 2330, 2454, 6415

## Official Source
- Source: TWSE (Taiwan Stock Exchange) / MOPS
- Data type: Monthly Revenue (月營收)
- Release schedule: typically by 10th of following month
- Verification: REQUIRES_MANUAL_VERIFICATION
- External fetch allowed: **NO** (requires P26F4 approval)

## Acquisition Steps
1. CTO/manual approval to acquire historical TWSE MonthlyRevenue data
2. Download TWSE monthly revenue data for 2025-09 to 2026-01 for 25 target symbols
3. Verify actual releaseDate for each period from official source metadata
4. Apply Prisma migration: 20260512000000_monthly_revenue_release_date_pit_draft
5. Import data via P26F4 controlled import approval gate
6. Re-run P26F2/P26F3 coverage preview with real data
7. Confirm PIT safety and scoring invariance post-import

## DB Import Prerequisites
- P26F4 controlled import approval gate PASS
- prisma migrate deploy: 20260512000000_monthly_revenue_release_date_pit_draft
- Manual releaseDate verification for each period
- DB backup taken before import
- Scoring invariance baseline captured before import

## Review Checklist
- [ ] releaseDate verified from official TWSE source (not inferred)
- [ ] No fabricated revenue data
- [ ] PIT safety validated before DB import
- [ ] Scoring invariance confirmed: alphaScore/recommendationBucket unchanged
- [ ] Frozen corpus (60/4500/9900/4500/4500) unchanged after import

## Constraints
- dbWriteAllowed: false
- corpusOverwriteAllowed: false
- scoringChangeAllowed: false
- optimizerAllowed: false
- externalFetchAllowed: false

**This plan requires P26F4 Controlled Historical MonthlyRevenue Import Approval Gate.**
