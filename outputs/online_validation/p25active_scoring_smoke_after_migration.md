# P25 Active Scoring Smoke After Migration

**Phase:** P25-HARDRESET Part E  
**Generated:** 2026-05-12T10:11:01.446Z  
**Smoke Status:** `PASS`

## Summary

| Metric | Value |
|--------|-------|
| Total entries | 25 |
| PASS | 25 |
| FAIL | 0 |
| PARTIAL | 0 |
| Service callable | true |

## Symbols Tested

- 1101
- 1102
- 1103
- 1104
- 1108

## asOfDates Tested

- 2026-03-09
- 2026-03-10
- 2026-03-15
- 2026-04-09
- 2026-05-12

## MonthlyRevenue PIT Gate Analysis

| Check | Count | Total |
|-------|-------|-------|
| asOf 2026-03-09: correctly excludes MonthlyRevenue | 5 | 5 |
| asOf 2026-03-10: includes MonthlyRevenue | 0 | 5 |

## Per-Entry Results

- [PASS] `1101` asOf=`2026-03-09` | coverage=limited | usedSources=["StockQuote","InstitutionalChip"] | revenueYoY=null
- [PASS] `1101` asOf=`2026-03-10` | coverage=limited | usedSources=["StockQuote","InstitutionalChip"] | revenueYoY=null
- [PASS] `1101` asOf=`2026-03-15` | coverage=limited | usedSources=["StockQuote","InstitutionalChip"] | revenueYoY=null
- [PASS] `1101` asOf=`2026-04-09` | coverage=limited | usedSources=["StockQuote","InstitutionalChip"] | revenueYoY=null
- [PASS] `1101` asOf=`2026-05-12` | coverage=limited | usedSources=["StockQuote","InstitutionalChip"] | revenueYoY=null
- [PASS] `1102` asOf=`2026-03-09` | coverage=limited | usedSources=["StockQuote","InstitutionalChip"] | revenueYoY=null
- [PASS] `1102` asOf=`2026-03-10` | coverage=limited | usedSources=["StockQuote","InstitutionalChip"] | revenueYoY=null
- [PASS] `1102` asOf=`2026-03-15` | coverage=limited | usedSources=["StockQuote","InstitutionalChip"] | revenueYoY=null
- [PASS] `1102` asOf=`2026-04-09` | coverage=limited | usedSources=["StockQuote","InstitutionalChip"] | revenueYoY=null
- [PASS] `1102` asOf=`2026-05-12` | coverage=limited | usedSources=["StockQuote","InstitutionalChip"] | revenueYoY=null
- [PASS] `1103` asOf=`2026-03-09` | coverage=insufficient | usedSources=[] | revenueYoY=null
- [PASS] `1103` asOf=`2026-03-10` | coverage=insufficient | usedSources=[] | revenueYoY=null
- [PASS] `1103` asOf=`2026-03-15` | coverage=insufficient | usedSources=[] | revenueYoY=null
- [PASS] `1103` asOf=`2026-04-09` | coverage=insufficient | usedSources=[] | revenueYoY=null
- [PASS] `1103` asOf=`2026-05-12` | coverage=insufficient | usedSources=[] | revenueYoY=null
- [PASS] `1104` asOf=`2026-03-09` | coverage=insufficient | usedSources=[] | revenueYoY=null
- [PASS] `1104` asOf=`2026-03-10` | coverage=insufficient | usedSources=[] | revenueYoY=null
- [PASS] `1104` asOf=`2026-03-15` | coverage=insufficient | usedSources=[] | revenueYoY=null
- [PASS] `1104` asOf=`2026-04-09` | coverage=insufficient | usedSources=[] | revenueYoY=null
- [PASS] `1104` asOf=`2026-05-12` | coverage=insufficient | usedSources=[] | revenueYoY=null
- [PASS] `1108` asOf=`2026-03-09` | coverage=insufficient | usedSources=[] | revenueYoY=null
- [PASS] `1108` asOf=`2026-03-10` | coverage=insufficient | usedSources=[] | revenueYoY=null
- [PASS] `1108` asOf=`2026-03-15` | coverage=insufficient | usedSources=[] | revenueYoY=null
- [PASS] `1108` asOf=`2026-04-09` | coverage=insufficient | usedSources=[] | revenueYoY=null
- [PASS] `1108` asOf=`2026-05-12` | coverage=insufficient | usedSources=[] | revenueYoY=null

## Limitations

None

*Does not constitute investment advice. No ROI / win-rate / alpha / profit / outperform claims.*
