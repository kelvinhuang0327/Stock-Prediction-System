# P26F3-4 Operator  TWSE MonthlyRevenue Manual Source PlacementChecklist 

**Phase:** P26F3-4-HARDRESET  
**Status:** AWAITING_MANUAL_FILE_PLACEMENT  
**Date:** 2026-05-13  
**DB write:** false | **Corpus write:** false

---

## Pre-conditions

- P26F3-3 classification: `P26F3_3_SOURCE_NOT_PROVIDED_PACKAGE_CONFIRMED`
- Drop-zone validator: READY
- Safety gate: READY
- Scoring invariance gate: READY

## Checklist Steps

| # | Step | Details | Status |
|---|---|---|---|
| 1 | Download 5 period files from TWSE/MOPS | Periods: 2025-09, 2025-10, 2025-11, 2025-12, 2026- PENDING |01 | 
| 2 | Confirm 25 target symbols coverage | See `P26F3_4_TWSE_ACQUISITION_REQUEST.md` for full symbol  PENDING |list | 
| 3 | Confirm releaseDate is official announcement date | `releaseDate <= asOfDate` required for PIT  PENDING |safety | 
| 4 | Confirm revenue field is numeric | No commas, no currency symbols, no  PENDING |text | 
| 5 | Confirm no forbidden outcome fields | Forbidden: outcomePrice, returnPct, realizedReturnClass, futureReturn, priceAfterAsOf,  PENDING |recommendationResult | 
| 6 | Place files in drop-zone | Path: `data/manual/monthly-revenue/p26f3-2- PENDING |dropzone/` | 
 expect `SOURCE_FILES_ PENDING |PRESENT` | 
 expect `acceptedRows >  PENDING |0` | 
 expect `matchedRows >  PENDING |0` | 
| 10 | Send CTO approval for P26F4 | Required before controlled import gate can  PENDING |proceed | 

## File Naming Convention

```
twse_monthly_revenue_2025_09.csv   # one per period
twse_monthly_revenue_2025_10.csv
twse_monthly_revenue_2025_11.csv
twse_monthly_revenue_2025_12.csv
twse_monthly_revenue_2026_01.csv
# or combined:
twse_monthly_revenue_2025_09_to_2026_01.jsonl
```

## Required Fields

```
stockId, year, month, revenue, releaseDate, sourceName, sourceFileName
```

## Allowed sourceName Values

`TWSE` | `MOPS` | `OFFICIAL` | `MANUAL`

## Absolutely Forbidden Fields

`outcomePrice` | `returnPct` | `realizedReturnClass` | `futureReturn` | `priceAfterAsOf` | `recommendationResult`

## P26F4 Gate Conditions

1. `acceptedRows > 0`
2. `rejectedRows = 0` or all rejections documented
3. `coverage preview matchedRows > 0`
4. Safety gate: PASS
5. Scoring invariance: PASS
6. `no DB write detected`
7. CTO approval granted

---

*Does not constitute investment advice. No ROI/profit/win-rate computed.*
