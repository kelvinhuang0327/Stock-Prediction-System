# P26C FinancialReport Fixture Report (PART D)

**Generated:** 2026-05-13

> Not for investment use. No financial projections.

## Fixture Overview

- asOfDate: `2026-05-13`
- symbol: `2330`
- Total reports: 8

## Fixture Coverage

| Case | Expected | Purpose |
|------|----------|---------|
| CASE_1 | FUTURE_AVAILABILITY_DATE_EXCLUDED | periodEndDate before asOf; filingDate after  NOT visible |asOf 
| CASE_2 | VISIBLE_AS_OF | filingDate before asOf; ingestedAt after  MUST be visible |asOf 
| CASE_3 | FUTURE_AVAILABILITY_DATE_EXCLUDED | filingDate after asOf; ingestedAt before  NOT visible |asOf 
| CASE_4 | VISIBLE_AS_OF | announcementDate before asOf; filingDate  fallback priority works |null 
| CASE_5 | INVALID_MISSING_AVAILABILITY_DATE | all availability fields null |
| CASE_6 | WRONG_SYMBOL | symbol=0050 not in 2330 context |
| CASE_7 | DUPLICATE_EXCLUDED | same sourceHash as CASE_2 |
| CASE_8 | VISIBLE_AS_OF | timezone boundary: UTC 15:59 = Taiwan 23:59 on asOfDate |

## Key PIT Proofs

1. periodEndDate before asOf does NOT grant visibility (CASE_1 excluded)
2. ingestedAt after asOf does NOT block visibility (CASE_2 visible)
3. ingestedAt before asOf does NOT grant future filingDate visibility (CASE_3 excluded)
4. announcementDate fallback works when filingDate missing (CASE_4 visible)
5. All availability fields missing = INVALID, not visible (CASE_5)
6. Timezone boundary: UTC 15:59 = Taiwan 23:59 on asOfDate = visible (CASE_8)

## Verdict: `FIXTURE_COVERAGE_COMPLETE`
