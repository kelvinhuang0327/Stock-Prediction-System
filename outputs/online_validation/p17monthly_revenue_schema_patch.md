# P17-HARDRESET: Prisma Schema Patch — APPLIED ✅

> **Disclaimer:** Does not constitute investment advice. Schema governance only. No production DB writes. productionApplyAllowed=false.

**Date:** 2026-05-12

## Fields Added to `MonthlyRevenue`

| Field | Type | Purpose |
|-------|------|---------|
| `releaseDate` | `DateTime?` | PIT gate — date revenue was publicly released |
| `releaseDateSource` | `String?` | Source tag: `INFERRED_NEXT_MONTH_10TH` or `EXPLICIT` |
| `releaseDateConfidence` | `String?` | Confidence: `LOW_TO_MEDIUM` or `HIGH` |

## Migration Draft
- Path: `prisma/migrations/20260512000000_monthly_revenue_release_date_pit_draft/migration.sql`
- Status: DRAFT — not applied to production DB
- `productionApplyAllowed: false` — requires explicit `prisma migrate deploy` approval

## Frozen
- Scoring formula: unchanged
- alphaScore / recommendationBucket: unchanged
- Frozen corpus: unchanged (60 / 4500 / 9900 / 4500)
