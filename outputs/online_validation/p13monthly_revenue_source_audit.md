# P13-HARDRESET: MonthlyRevenue Source Audit

> Disclaimer: Observability/contract work only. No investment recommendations. No ROI/alpha/profit claims. No production DB writes.

**Audit Mode:** SCHEMA_ONLY  
**Generated:** 2026-05-12T03:22:22.445Z

## MonthlyRevenue Schema

```
model MonthlyRevenue {
  id        Int      @id @default(autoincrement())
  stockId   String
  year      Int
  month     Int
  revenue   Float
  yoyGrowth Float? // YoY %
  momGrowth Float? // MoM %
  createdAt DateTime @default(now())

  stock Stock @relation(fields: [stockId], references: [id])

  @@unique([stockId, year, month])
}
```

| Field | Present |
|-------|---------|
| id | ✅ |
| stockId | ✅ |
| year | ✅ |
| month | ✅ |
| revenue | ✅ |
| yoyGrowth | ✅ |
| momGrowth | ✅ |
| createdAt | ✅ |
| **releaseDate** | **❌ MISSING** |
| announcementDate | ❌ |
| availabilityDate | ❌ |

## Code Path Audits

### RuleBasedStockAnalyzer
- File: `src/lib/analysis/RuleBasedStockAnalyzer.ts`
- Status: FOUND
- PIT Risk: **HIGH — gates by reporting period, not releaseDate**

### FundamentalResearchService
- File: `src/lib/fundamentals/FundamentalResearchService.ts`
- Status: FOUND
- PIT Risk: **HIGH — buildFundamentalResearchContextForSymbol uses no asOf gate at all**

### MonthlyRevenueLike interface
- File: `src/lib/fundamentals/StockFundamentalSnapshot.ts`
- Status: FOUND
- PIT Risk: **MEDIUM — interface does not include releaseDate, so even if schema had it, it would not flow through**

### BacktestRunner
- File: `src/lib/backtest/BacktestRunner.ts`
- Status: FOUND
- PIT Risk: **LOW — no direct revenue query or has gate**

## Overall PIT Risk

**Level: HIGH**

MonthlyRevenue schema has no releaseDate field. All query paths use year/month period gate, not announcement date.

## Required Repair Fields

- **`releaseDate`** (DateTime?): Primary PIT gate field. Must be added to schema, interface, and all query paths.
- **`releaseDateSource`** (String?): Tracks whether releaseDate is authoritative or inferred.
- **`releaseDateConfidence`** (String?): Documents confidence level of inferred releaseDates.

## Recommended Schema Migration

```prisma
model MonthlyRevenue {
  id                    Int       @id @default(autoincrement())
  stockId               String
  year                  Int
  month                 Int
  revenue               Float
  yoyGrowth             Float?
  momGrowth             Float?
  releaseDate           DateTime? // Authoritative release date (from TWSE/MOPS)
  releaseDateSource     String?   // AUTHORITATIVE | INFERRED_NEXT_MONTH_10TH
  releaseDateConfidence String?   // HIGH | MEDIUM | LOW_TO_MEDIUM
  createdAt             DateTime  @default(now())

  stock Stock @relation(fields: [stockId], references: [id])

  @@unique([stockId, year, month])
}
```

## Query Gate Change

```typescript
// BEFORE (HIGH PIT risk):
prisma.monthlyRevenue.findMany({
  where: {
    stockId: symbol,
    OR: [
      { year: { lt: asOfYear } },
      { year: asOfYear, month: { lte: asOfMonth } },
    ],
  },
})

// AFTER (PIT safe):
prisma.monthlyRevenue.findMany({
  where: {
    stockId: symbol,
    releaseDate: { lte: asOfDate },
  },
})
```
