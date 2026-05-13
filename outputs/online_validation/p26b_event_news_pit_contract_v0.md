# P26B Event/News PIT Contract v0

**Version:** p26b-event-news-pit-contract-v0
**Generated:** 2026-05-13

> Not for investment use. No financial projections.

## PIT Visibility Rule

**`publishedAt <= asOfDate (Asia/Taipei end-of-day)`**

- `ingestedAt` must NOT determine PIT visibility
- `ingestedAt` is observability metadata only (ingestion lag measurement)
- Timezone: UTC+8 (Taiwan, no DST)

## Metadata Status

| Property | Value |
|----------|-------|
| entersAlphaScore | false |
| entersRecommendationBucket | false |
| entersReasonContext | true (read-only) |
| entersFactorSnapshot | false |
| readOnly | true |

## Field Specifications

| Field | Status | Notes |
|-------|--------|-------|
| eventId | REQUIRED | Unique identifier |
| symbol | REQUIRED | Stock symbol |
| title | OPTIONAL | Not used for scoring |
| category | OPTIONAL | Event category |
| publishedAt | REQUIRED | PIT gate field |
| ingestedAt | OBSERVABILITY_ONLY | Must NOT gate visibility |
| source | OPTIONAL | News source name |
| sourceHash | OPTIONAL | URL hash for dedup |
| severity | OPTIONAL | fixture-level only |
| relevanceScore | OPTIONAL | fixture-level only, no scoring |

## Forbidden Fields

- outcomePrice
- returnPct
- realizedReturnClass
- futurePriceMovement
- postAsOfEvent

## Non-Goals

- NewsEvent does not enter alphaScore calculation
- NewsEvent does not enter recommendationBucket determination
- No production integration with external news API in this sprint
- No activation date committed for NewsEvent entering scoring
- No performance improvement claimed from NewsEvent context

## Verdict: `CONTRACT_V0_COMPLETE`
