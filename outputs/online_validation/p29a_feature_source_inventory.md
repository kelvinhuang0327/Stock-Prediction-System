# P29A Feature Source Inventory

**Phase:** P29A PART B
**Method:** code-read + artifact cross-reference

## Sources Currently Entering alphaScore

| Source | Family | PIT Gate | Field | Weight (Stock) | Weight (ETF) |
| --- | --- | :---: | --- | ---: | ---: |
| StockQuote | price/technicals | ✅ | `date` <= asOfDate | 0.35 | 0.50 |
| MarketRegime | market context | ✅ | asOf param (TAIEX) | 0.15 | 0.25 |
| InstitutionalChip | chip/flow | ✅ | `date` <= asOfDate | 0.25 | 0.25 |
| MonthlyRevenue | fundamental | ✅ (repaired) | `releaseDate` <= asOfDate | 0.25 | **0.00** |

## Sources NOT Entering alphaScore

| Source | Family | PIT Gate | Reason Not In Scoring |
| --- | --- | :---: | --- |
| FinancialReport | fundamental | ❌ not implemented | No `availabilityDate` gate; P26C paper only |
| NewsEvent | event/news | ❌ not implemented | P26B read-only metadata only; `ingestedAt` is not PIT-safe |

## Sub-features (Derived from StockQuote — same gate)

- **Volume / Liquidity** → `量能變化` in factorSnapshot
- **Momentum / Volatility** → `近 20 日動能` in factorSnapshot

## Key Limitations

1. **MonthlyRevenue historical gap:** 2025-09 to 2026-01 official CSVs not acquired → P26F4 WAITING
2. **FinancialReport:** no `availabilityDate` governance; not safe to enter scoring
3. **NewsEvent:** `publishedAt` may fall back to ingest time; real PIT-safe source not verified
4. **All P3/P19 corpus rows:** `missingSources=[MonthlyRevenue]` by design (pre-dates PIT repair)

*Observability only. Not investment advice.*
