# NewsEvent Source Acquisition Plan

**Phase:** P29B | **Paper design only** | *Not investment advice*

## Source Purpose
Verified company events with reliable publishedAt for PIT-safe event context in prediction snapshots.

## Recommended Source
**TWSE/MOPS official announcements** — 重大訊息公告
- URL: `https://mops.twse.com.tw/mops/web/t57sb01_q1`
- `publishedAt` = MOPS announcement datetime — highly reliable, system-timestamped
- Covers: earnings, dividends, capital changes, material events

## Current DB Problem
- Existing `NewsEvent` rows: `publishedAt` may default to `ingestedAt` for RSS sources
- Mock events (sourceType='mock') mixed with real events
- Audit required before any rows can be used in PIT-safe corpus

## PIT-safe Rule
`publishedAt <= asOfDate (Asia/Taipei end-of-day)`
**`ingestedAt` is NEVER a valid PIT gate**

## Event Taxonomy (17 types)
`EARNINGS_ANNOUNCEMENT, DIVIDEND_ANNOUNCEMENT, CAPITAL_REDUCTION, CAPITAL_INCREASE, MATERIAL_INFORMATION, REGULATORY_PENALTY, LITIGATION_EVENT, MANAGEMENT_CHANGE, SUPPLY_CHAIN_EVENT, CUSTOMER_CONTRACT, PRODUCT_LAUNCH, STRATEGIC_INVESTMENT, SHARE_BUYBACK, TRADING_HALT, MARKET_WIDE_EVENT, OTHER_OFFICIAL`
Forbidden: sentiment labels (BULLISH_EVENT, BEARISH_EVENT, BUY_SIGNAL, SELL_SIGNAL)

## Required Fields
`eventId, symbol, publishedAt (ISO-8601 from MOPS), eventType, eventTitle, sourceName, sourceUrl, verificationStatus`

## Existing DB Audit Needed
```sql
-- Rows where publishedAt ≈ ingestedAt (within 1 second = likely defaulted to ingest time)
SELECT COUNT(*) FROM NewsEvent
WHERE ABS(JULIANDAY(publishedAt) - JULIANDAY(ingestedAt)) < 0.001;
```

## Drop-zone
`data/manual/news-event/p29b-dropzone/`
Files: `news_events_<YYYY>_<MM>_<label>.csv`

## Status Transition
`HIGH_RISK_SOURCE_ABSENT` → `SOURCE_PRESENT_AWAITING_VALIDATION` → `AVAILABLE_NEEDS_VALIDATION`

## Forbidden
- `ingestedAt` as PIT gate ❌
- Mock events in PIT-safe corpus ❌
- Sentiment labels ❌
- Outcome fields ❌
- Enters alphaScore before AVAILABLE_PIT_SAFE ❌
