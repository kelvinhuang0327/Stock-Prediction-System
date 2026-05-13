# P26F4-or-P26A Route Decision

**Route:** P26A_SCORING_UNDEROUTPUT_AUDIT
**Generated:** 2026-05-14

## Drop-zone Scan Result
- candidateSourceFiles: **0**
- classification: P26F3_5_SOURCE_NOT_PROVIDED
- DB write: NOT performed

## Approval Token
- Provided: **NO**
- Required for P26F4: `P26F4_APPROVE_HISTORICAL_MONTHLY_REVENUE_IMPORT_ONLY`

## Decision

candidateSourceFiles = 0 and approval token not provided.
Route: **P26A_SCORING_UNDEROUTPUT_AUDIT** (PART F).
P26F4 Controlled Import Gate: BLOCKED (SOURCE_NOT_PROVIDED).

## Next Step for P26F4
1. Operator places TWSE CSV files in `data/manual/monthly-revenue/p26f3-2-dropzone/`
2. Re-run: `node scripts/run-p26f3-5-dropzone-conditional-scan.js`
3. Provide approval token: `P26F4_APPROVE_HISTORICAL_MONTHLY_REVENUE_IMPORT_ONLY`

> Does not constitute investment advice.
