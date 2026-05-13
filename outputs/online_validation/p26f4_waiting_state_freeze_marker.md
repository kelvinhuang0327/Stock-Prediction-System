# P26F4 Waiting-State Freeze Marker

**Date:** 2026-05-16  
**State:** `P26F4_WAITING_FOR_OPERATOR_SOURCE`

## Current Status
| Field | Value |
|-------|-------|
| candidateSourceFiles | 0 |
| sourceManifest | missing |
| dryRunGate | skipped |
| import | BLOCKED |
| dbWrite | false |
| corpusExpansion | BLOCKED |
| optimizer | BLOCKED |

## Next Allowed P26F4 Actions (in order)
1. Operator places real TWSE/MOPS source files (2025-09 ~ 2026-01) in drop-zone
2. Operator provides filled `SOURCE_MANIFEST.json`
3. Agent runs source-present gate
4. Dry-run gate PASS
5. Operator provides exact token: `P26F4_APPROVE_HISTORICAL_MONTHLY_REVENUE_IMPORT_ONLY`
6. Agent runs controlled import

## Policy
**Repeated empty drop-zone scans must NOT be scheduled as 24h tasks** unless the operator explicitly confirms source files were added.

> Observability only. No investment recommendations.
