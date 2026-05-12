# P12-HARDRESET PIT Feature Contract v0

**Contract Version:** p12-pit-feature-contract-v0  
**Generated:** 2026-05-12  
**Verdict:** CONTRACT_PARTIAL

> **Disclaimer:** PIT feature contract v0. No investment recommendations. No scoring changes. Observability and guardrail scaffolding only.

## Summary

| Metric | Value |
|--------|-------|
| Total Sources | 11 |
| LOW Risk Sources | 7 |
| MEDIUM Risk Sources | 2 |
| HIGH Risk Sources | 2 |
| Sources Requiring Repair | 3 |
| P0 Repairs | 1 |
| P1 Repairs | 1 |
| PIT Safety Requirements | 7 |
| Snapshot Capture Rules | 14 |

## Feature Source Contracts

| Source | PIT Risk | Repair Needed | Used in Scoring |
|--------|----------|--------------|-----------------|
| StockQuote | LOW | ✅ No | Yes |
| InstitutionalChip | LOW | ✅ No | Yes |
| MonthlyRevenue | HIGH | ⚠️ Yes | Yes |
| FinancialReport | MEDIUM | ⚠️ Yes | No |
| NewsEvent | HIGH | ⚠️ Yes | No |
| TechnicalIndicators | LOW | ✅ No | Yes |
| MarketRegime | MEDIUM | ✅ No | Yes |
| ActiveScoringSnapshot | LOW | ✅ No | Yes |
| ReasonSignalFactorSnapshot | LOW | ✅ No | No |
| BucketContract | LOW | ✅ No | Yes |
| TwseTradingCalendar | LOW | ✅ No | No |

### HIGH Risk Sources

- **MonthlyRevenue** — Add releaseDate (DateTime) field to MonthlyRevenue prisma schema. Gate queries to releaseDate <= asOfDate. Taiwan monthly revenue is released on the 10th of the following month — the current year+month composite gate may include unreleased data.
- **NewsEvent** — Not currently used in scoring. If activated: gate by publishedAt <= asOfDate. Never use ingestedAt. Validate relatedSymbols JSON parse.

## PIT Safety Requirements

| ID | Enforcement | Description |
|----|-------------|-------------|
| PIT-001 | HARD | All time-series feature sources must gate queries to date <= asOfDate. No future |
| PIT-002 | HARD | pitGateDate must equal asOfDate in every activeScoringSnapshot. Divergence is a  |
| PIT-003 | SOFT | MonthlyRevenue: Uses year+month composite gate (no releaseDate). Approved as int |
| PIT-004 | HARD | Forbidden snapshot fields must never appear inside activeScoringSnapshot: outcom |
| PIT-005 | SOFT | NewsEvent: If added to scoring, must gate by publishedAt <= asOfDate. Must NOT u |
| PIT-006 | SOFT | FinancialReport: Not currently active. If activated, must add availabilityDate f |
| PIT-007 | HARD | priceSource must never be mock-deterministic in any active scoring corpus row. T |

## Snapshot Capture Rules

**Forbidden fields in activeScoringSnapshot:**

- `outcomePrice` — belongs only in outcomeSnapshot, never in activeScoringSnapshot
- `returnPct` — belongs only in outcomeSnapshot, never in activeScoringSnapshot
- `realizedReturnClass` — belongs only in outcomeSnapshot, never in activeScoringSnapshot
- `futurePrice` — belongs only in outcomeSnapshot, never in activeScoringSnapshot
- `baselineResult` — belongs only in outcomeSnapshot, never in activeScoringSnapshot
- `outcomeClose` — belongs only in outcomeSnapshot, never in activeScoringSnapshot
- `horizonReturnPct` — belongs only in outcomeSnapshot, never in activeScoringSnapshot

## Repair Priorities

| Priority | Source | Action |
|----------|--------|--------|
| P0 | MonthlyRevenue | Add releaseDate (DateTime) field to MonthlyRevenue schema. Gate queries to relea |
| P1 | ReasonSignalFactorSnapshot | P8-PREFLIGHT found 24 generic reason cases. Fix RuleBasedStockAnalyzer.buildReas |
| P2 | FinancialReport | Add availabilityDate (DateTime) field to FinancialReport schema before activatin |

## Bucket Contract Reference (P6-LITE)

- **Source:** p6lite_bucket_contract_freeze.json
- **Verdict:** BY_DESIGN_BOUNDARY
- **Canonical Labels:** [object Object], [object Object], [object Object], [object Object], [object Object]

## P8 Signal/Reason Reference

- **Source:** p8preflight_signal_reason_diagnosis.json
- **Total Cases:** 24
- **Category Counts:** {"undefined":24}

## Non-Goals

1. This contract does NOT modify scoring formulas, scoring weights, or bucket thresholds.
2. This contract does NOT modify any corpus files (simulation, p0, p1, p3).
3. This contract does NOT add new investment claims, performance predictions, or strategy recommendations.
4. This contract does NOT modify ManualReview modules.
5. This contract does NOT change production database schema — schema repairs are flagged as future work (P0/P1 priority).
6. This contract does NOT produce ROI figures, win rates, alpha calculations, profit estimates, or performance guarantees.
