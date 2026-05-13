# P26B News Events Fixture Report (PART D)

**Generated:** 2026-05-13

> Not for investment use. No financial projections.

## Fixture Overview

- asOfDate: `2026-05-13`
- symbol: `2330`
- Total events: 6

## Fixture Coverage

| Case | Expected Visibility | Purpose |
|------|---------------------|---------|
| CASE_1 | VISIBLE_AS_OF | publishedAt before asOf; ingestedAt AFTER asOf - must still be visible |
| CASE_2 | FUTURE_PUBLISHED_AT_EXCLUDED | publishedAt AFTER asOf; ingestedAt before asOf - must still be excluded |
| CASE_3 | WRONG_SYMBOL | Different symbol - must not appear in 2330 context |
| CASE_4 | INVALID_MISSING_PUBLISHED_AT | Missing publishedAt - must be invalid/invisible |
| CASE_5 | VISIBLE_AS_OF | publishedAt at end of asOfDate in Taiwan time - must be visible |
| CASE_6 | DEDUPED (same sourceHash as CASE_1) | Duplicate sourceHash - first occurrence kept |

## Key PIT Proofs

1. ingestedAt AFTER asOf does NOT block visibility (CASE_1 passes)
2. ingestedAt BEFORE asOf does NOT grant visibility to future publishedAt (CASE_2 excluded)
3. Missing publishedAt = INVALID, not visible
4. Timezone boundary (UTC 15:59 = Taiwan 23:59 on same day) = visible

## Verdict: `FIXTURE_COVERAGE_COMPLETE`
