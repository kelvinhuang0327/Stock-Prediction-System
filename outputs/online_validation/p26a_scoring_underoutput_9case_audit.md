# P26A SCORING_UNDEROUTPUT 9-Case Read-only Audit

**Audit ID:** P26A-9CASE-AUDIT
**Generated:** 2026-05-14
**Classification:** P26A_9CASE_AUDIT_COMPLETE_PATCH_CANDIDATE_FOUND

> Does not constitute investment advice. Read-only audit findings only.

## Summary

- Total cases: 9
- Unique (symbol, asOfDate) combos: 5
- Unique symbols: 00738U, 00891, 1710
- All blocked by MonthlyRevenue source: YES
- All have renderer underoutput: YES
- All fixable without scoring change: YES
- Patch candidates found: 9

## Taxonomy Summary

- MONTHLY_REVENUE_BLOCKED_BY_SOURCE: 9 cases
- SNAPSHOT_FIELD_PRESENT_BUT_REASON_NOT_RENDERED: 9 cases

## 9-Case Inventory

| caseId | symbol | asOfDate | horizon | alphaScore | reasonRaw | factorCount | completeness |
|--------|--------|----------|---------|------------|-----------|-------------|--------------|
| P5-CASE-010 | 1710 | 2025-12-15 | 5d | 68 | 技術偏多 | 10 | PARTIAL |
| P5-CASE-011 | 00738U | 2025-12-19 | 5d | 63 | 技術偏多 | 10 | PARTIAL |
| P5-CASE-013 | 1710 | 2025-12-15 | 5d | 68 | 技術偏多 | 10 | PARTIAL |
| P5-CASE-023 | 00891 | 2025-11-12 | 20d | 63 | 技術偏多 | 10 | PARTIAL |
| P5-CASE-026 | 00891 | 2025-11-12 | 20d | 63 | 技術偏多 | 10 | PARTIAL |
| P5-CASE-037 | 00891 | 2025-10-15 | 60d | 63 | 技術偏多 | 10 | PARTIAL |
| P5-CASE-053 | 00738U | 2025-12-19 | 5d | 63 | 技術偏多 | 10 | PARTIAL |
| P5-CASE-054 | 00891 | 2025-12-30 | 5d | 63 | 技術偏多 | 10 | PARTIAL |
| P5-CASE-055 | 1710 | 2025-12-15 | 5d | 68 | 技術偏多 | 10 | PARTIAL |

## Root Cause Analysis

### Primary Cause: SNAPSHOT_FIELD_PRESENT_BUT_REASON_NOT_RENDERED

All 9 cases: reasonSnapshot is a single-token string instead of structured multi-factor object. factorSnapshot has 10+ rich signals (MA/RSI/MACD/momentum/volume/volatility/institutional) but NOT surfaced in reasonSnapshot. Renderer receives pre-collapsed string, cannot decompose. MonthlyRevenue absent from all usedSources (in missingSources). alphaScore is correctly computed; this is a renderer/serialization issue, NOT a scoring formula problem.

**Key observation:**
- `reasonSnapshot` = single-token pre-collapsed string ("technicalBullish")
- `factorSnapshot` contains 10+ signals: MA, RSI, MACD, momentum, returns, volume, volatility, max-drawdown, institutional
- Signals are scored correctly but NOT surfaced in reason text
- This is a **renderer/serialization issue**, NOT a scoring formula problem

### Secondary Cause: MONTHLY_REVENUE_BLOCKED_BY_SOURCE

- All 3 symbols (1710, 00738U, 00891) have MonthlyRevenue in missingSources
- usedSources = ["StockQuote", "InstitutionalChip"] only
- completenessStatus = PARTIAL, dataCoverage = limited
- Root fix: Operator provides TWSE/MOPS source files (see P26F3_5_OPERATOR_HANDOFF_PACKET.md)

## Case Details

### P5-CASE-010 - 1710 @ 2025-12-15

- alphaScore: 68
- bucket: NEUTRAL
- horizon: 5d
- reasonRaw: `技術偏多`
- factorSnapshotCount: 10 (signals present but not rendered)
- usedSources: ['StockQuote', 'InstitutionalChip']
- missingSources: ['MonthlyRevenue']
- completenessStatus: PARTIAL
- patchRecommendation: PATCH_CANDIDATE_RENDERER

### P5-CASE-011 - 00738U @ 2025-12-19

- alphaScore: 63
- bucket: NEUTRAL
- horizon: 5d
- reasonRaw: `技術偏多`
- factorSnapshotCount: 10 (signals present but not rendered)
- usedSources: ['StockQuote', 'InstitutionalChip']
- missingSources: ['MonthlyRevenue']
- completenessStatus: PARTIAL
- patchRecommendation: PATCH_CANDIDATE_RENDERER

### P5-CASE-013 - 1710 @ 2025-12-15

- alphaScore: 68
- bucket: NEUTRAL
- horizon: 5d
- reasonRaw: `技術偏多`
- factorSnapshotCount: 10 (signals present but not rendered)
- usedSources: ['StockQuote', 'InstitutionalChip']
- missingSources: ['MonthlyRevenue']
- completenessStatus: PARTIAL
- patchRecommendation: PATCH_CANDIDATE_RENDERER

### P5-CASE-023 - 00891 @ 2025-11-12

- alphaScore: 63
- bucket: NEUTRAL
- horizon: 20d
- reasonRaw: `技術偏多`
- factorSnapshotCount: 10 (signals present but not rendered)
- usedSources: ['StockQuote', 'InstitutionalChip']
- missingSources: ['MonthlyRevenue']
- completenessStatus: PARTIAL
- patchRecommendation: PATCH_CANDIDATE_RENDERER

### P5-CASE-026 - 00891 @ 2025-11-12

- alphaScore: 63
- bucket: NEUTRAL
- horizon: 20d
- reasonRaw: `技術偏多`
- factorSnapshotCount: 10 (signals present but not rendered)
- usedSources: ['StockQuote', 'InstitutionalChip']
- missingSources: ['MonthlyRevenue']
- completenessStatus: PARTIAL
- patchRecommendation: PATCH_CANDIDATE_RENDERER

### P5-CASE-037 - 00891 @ 2025-10-15

- alphaScore: 63
- bucket: NEUTRAL
- horizon: 60d
- reasonRaw: `技術偏多`
- factorSnapshotCount: 10 (signals present but not rendered)
- usedSources: ['StockQuote', 'InstitutionalChip']
- missingSources: ['MonthlyRevenue']
- completenessStatus: PARTIAL
- patchRecommendation: PATCH_CANDIDATE_RENDERER

### P5-CASE-053 - 00738U @ 2025-12-19

- alphaScore: 63
- bucket: NEUTRAL
- horizon: 5d
- reasonRaw: `技術偏多`
- factorSnapshotCount: 10 (signals present but not rendered)
- usedSources: ['StockQuote', 'InstitutionalChip']
- missingSources: ['MonthlyRevenue']
- completenessStatus: PARTIAL
- patchRecommendation: PATCH_CANDIDATE_RENDERER

### P5-CASE-054 - 00891 @ 2025-12-30

- alphaScore: 63
- bucket: NEUTRAL
- horizon: 5d
- reasonRaw: `技術偏多`
- factorSnapshotCount: 10 (signals present but not rendered)
- usedSources: ['StockQuote', 'InstitutionalChip']
- missingSources: ['MonthlyRevenue']
- completenessStatus: PARTIAL
- patchRecommendation: PATCH_CANDIDATE_RENDERER

### P5-CASE-055 - 1710 @ 2025-12-15

- alphaScore: 68
- bucket: NEUTRAL
- horizon: 5d
- reasonRaw: `技術偏多`
- factorSnapshotCount: 10 (signals present but not rendered)
- usedSources: ['StockQuote', 'InstitutionalChip']
- missingSources: ['MonthlyRevenue']
- completenessStatus: PARTIAL
- patchRecommendation: PATCH_CANDIDATE_RENDERER

## Patch Recommendations

### 1. PATCH_CANDIDATE_RENDERER (HIGH PRIORITY, NO SCORING CHANGE)

Description: Reason renderer should use factorSnapshot list to generate multi-factor reason text, not rely on pre-collapsed reasonSnapshot string.
Scoring change required: NO
Corpus change required: NO
DB write required: NO
Next round: P26A-RENDERER-FIX

### 2. MONTHLY_REVENUE_BLOCKED_BY_SOURCE (OPERATOR ACTION REQUIRED)

Description: Operator must provide TWSE/MOPS CSV for 2025-09 to 2026-01. See P26F3_5_OPERATOR_HANDOFF_PACKET.md.
DB write required: YES (controlled import via P26F4)
Next round: P26F4 Controlled Import Gate

## Final Classification

**P26A_9CASE_AUDIT_COMPLETE_PATCH_CANDIDATE_FOUND**

Renderer fix identified (no scoring change required). All 9 also blocked by MonthlyRevenue source gap (P26F4 required).

> Does not constitute investment advice.
