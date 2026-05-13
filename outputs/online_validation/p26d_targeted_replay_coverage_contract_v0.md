# P26D Targeted Replay Coverage Contract v0

**Phase:** P26D-HARDRESET  
**Version:** v0  
**Generated:** 2026-05-13

## Coverage Dimensions (9 total)

| Dimension | Context Type | Gate Field | Read-Only | Enters Scoring |
|-----------|-------------|-----------|-----------|---------------|
| monthlyRevenueAvailableAsOf | MonthlyRevenue |  |releaseDate |  | 
| monthlyRevenueReasonContextPresent | MonthlyRevenue |  |reasonContext |  | 
| monthlyRevenueFactorEvidencePresent | MonthlyRevenue |  |factorEvidence |  | 
| newsEventContextVisibleAsOf | NewsEvent |  |publishedAt |  | 
| financialReportContextVisibleAsOf | FinancialReport |  |availabilityDate |  | 
|  |contextReadOnly |  |  | ALL | 
| entersAlphaScoreFalseForNewsAndFinancial |  |NewsEvent | | | FinancialReport | 
|  |alphaScoreInvariant |  |  | ScoringInvariant | 
|  |recommendationBucketInvariant |  |  | ScoringInvariant | 

## Output Classifications

1. `COVERAGE_READY_FOR_CORPUS_EXPANSION`
2. `COVERAGE_PARTIAL_NEEDS_SOURCE_MAPPING`
3. `COVERAGE_BLOCKED_BY_ARTIFACTS`
4. `SCORING_INVARIANCE_BROKEN`
5. `PIT_CONTEXT_GATE_BROKEN`
6. `FAILED_TESTS`

## Excluded Scope

- No corpus regeneration
- No DB write
- No scoring change
- No external API or LLM
- No Math.random()
- No outcome fields (outcomePrice/returnPct/realizedReturnClass)

---
*No investment recommendations. No ROI/win-rate/profit/outperform/buy/sell claims.*
