# P4 Data Availability Audit

**Task:** P3- Research Program Reset  14 
**As-of Date:** 2026-05-01  
**DB:** prisma/dev.db

---

## Summary

| Data Source | Status | Priority | Blocker |
|-------------|--------|----------|---------|
| StockQuote EXISTS | CRITICAL | None | | 
| MarketIndex (TAIEX + sector EXISTS | CRITICAL | None |) | 
| Stock metadata ( PARTIAL | HIGH | Industry codes numeric, no name mapping |industry) | 
|  PARTIAL | HIGH | Only 1 year of history (2026) |2025InstitutionalChip | 
|  PARTIAL | MEDIUM | Only 2 months (2026-02 to 2026-03) |MonthlyRevenue | 
|  PARTIAL | MEDIUM | Limited quarterly depth |FinancialReport | 
| Short selling  MISSING | LOW | No table in DB |balance | 
| Margin  MISSING | LOW | No dedicated table |balance | 
| Dividend / ex-right  MISSING | MEDIUM | No table in DB |events | 

---

## Detailed Findings

### StockQuote
- **Total symbols:** 1,357
- **ISO date format symbols 500 rows:** 181with 
- **ISO date format symbols 1000 rows:** 0 (max ~803 trading days in DB)with 
- **Date range:** 2017-04-05 to 2026-05-18
- **Trading days:** 803
- **PIT safe Yes:** 
- **Action:** Immediately usable for cross-sectional ranking and market regime features

### MarketIndex
- **Total rows:** 2,633
- **Distinct indices:** 298 (TAIEX + sector indices in Chinese)
- **TAIEX trading days:** 734
- **Date range:** 2017-12-01 to 2026-03-17
- **PIT safe Yes:** 
- **Action:** Immediately usable for market regime classifier (P4-03)

### Stock Metadata
- **Total stocks:** 1,358
- **With industry code:** 1,084 (numeric codes like 28, 24, 26)
- **Distinct industry codes:** 33
- **ETF/stock flag:** NOT in  derived by symbol pattern heuristicschema 
 sector name table.

### InstitutionalChip
- **Total rows:** 291,068
- **Symbols:** 1,358
- **Date range:** 2025-05-02 to 2026-05-05 (**~1 year only**)
- **Fields:** foreignBuy, trustBuy, dealerBuy, totalBuy, holders400, holders1000
- **Blocker:** Only 1 year of data. Insufficient for 500d window backtesting. Need backfill to 2020+.

### MonthlyRevenue
- **Total rows:** 2,143
- **Symbols:** 1,074
- **Date range:** 2026-02 to 2026-03 (**2 months only**)
- **Blocker:** Extremely limited. Need multi-year backfill before any event-based hypothesis.

### FinancialReport
- **Total rows:** 957
- **Symbols:** limited
- **Blocker:** Need audit of quarterly coverage depth.

### Missing Data Sources
- **Short selling  DATA_SOURCE_MISSINGbalance:** 
- **Margin  DATA_SOURCE_MISSING (InstitutionalChip has holders but not margin)balance:** 
- **Dividend  DATA_SOURCE_MISSINGschedule:** 
- **Ex-right / ex-dividend  DATA_SOURCE_MISSINGevents:** 

---

## Critical Blockers for P4

1. ** only 1 year. Need backfill to 2020+ for robust validationInstitutionalChip** 
2. ** only 2 months. Need multi-year backfillMonthlyRevenue** 
3. **Stock. numeric codes with no name mappingindustry** 
4. **No dividend/ex-right  requires new data sourcetable** 

## Immediately Usable for P4

 cross-sectional ranking (P4-02)
 market regime classifier (P4-03)
