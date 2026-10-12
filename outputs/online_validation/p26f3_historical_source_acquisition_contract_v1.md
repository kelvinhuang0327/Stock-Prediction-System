# P26F3- Historical Source Acquisition Contract v1HARDRESET 

**Version**: v1  
**Date**: 2026-05-13

## Target Periods
2025-09, 2025-10, 2025-11, 2025-12, 2026-01

## Target Symbols (25)
0055, 00712, 00738U, 00830, 00891, 00903, 1210, 1308, 1314, 1319, 1326, 1402, 1434, 1513, 1536, 1560, 1598, 1605, 1710, 1717, 1802, 2317, 2330, 2454, 6415

## PIT Rules
- Visibility gate: releaseDate <= asOfDate ONLY
- year/month are revenue period identifiers, NOT visibility gates
- createdAt/ingestedAt are observability only, NOT visibility gates
- Inferred releaseDate requires needsManualReview=true
- Template-only is NOT real coverage

## Dry-run Contract
- outputMode: DRY_RUN_SOURCE_SYNC_ONLY
- dbWriteAllowed: false
- corpusOverwriteAllowed: false
- scoringChangeAllowed: false
- optimizerAllowed: false
- externalFetchAllowed: false
- fabricatedDataAllowed: false

**Disclaimer**: Does not constitute investment advice. Does not compute ROI, profit, alpha, win-rate, edge, or outperformance.
