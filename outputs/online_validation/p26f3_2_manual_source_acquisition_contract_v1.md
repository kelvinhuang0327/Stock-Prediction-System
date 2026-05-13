# P26F3-2 Manual Source Acquisition Contract v1

**Phase**: P26F3-2-HARDRESET  
**Date**: 2026-05-13

## Target Periods
- 2025-09 | 2025-10 | 2025-11 | 2025-12 | 2026-01

## Target Symbols (25)
0055, 00712, 00738U, 00830, 00891, 00903, 1210, 1308, 1314, 1319, 1326, 1402, 1434, 1513, 1536, 1560, 1598, 1605, 1710, 1717, 1802, 2317, 2330, 2454, 6415

## Accepted Formats: CSV, JSON, JSONL

## Required Fields
stockId, year, month, revenue, releaseDate, sourceName, sourceFileName

## Dry-run Contract
- dbWriteAllowed: false
- corpusWriteAllowed: false
- scoringChangeAllowed: false
- optimizerAllowed: false
- externalFetchAllowed: false
- fabricatedDataAllowed: false

## PIT Rules
- visibilityGate: `releaseDate <= asOfDate`
- releaseDate must be official, verified

## Disclaimer
Does not constitute investment advice. Does not compute ROI, profit, alpha, win-rate, edge, or outperformance.
