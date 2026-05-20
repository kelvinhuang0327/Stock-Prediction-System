# P29F PIT Audit Tests

**Phase:** P29F-HARDRESET  
**Date:** 2026-05-20

## P29F Test Results

**PASS — 73/73 tests**

| Group | Name | Tests | Status |
|-------|------|-------|--------|
| T01 | audit module exists | 4 | ✓ PASS |
| T02 | quote source is discovered | 4 | ✓ PASS |
| T03 | regime source is discovered | 4 | ✓ PASS |
| T04 | chip source is discovered | 4 | ✓ PASS |
| T05 | each source has PIT rule | 4 | ✓ PASS |
| T06 | each source has classification | 3 | ✓ PASS |
| T07 | classification only uses allowed enum | 4 | ✓ PASS |
| T08 | source entering alphaScore cannot be unclassified | 4 | ✓ PASS |
| T09 | suspicious future-like fields detected | 7 | ✓ PASS |
| T10 | suspicious target/label-like fields detected | 4 | ✓ PASS |
| T11 | date gate ambiguity flagged | 6 | ✓ PASS |
| T12 | FinancialReport remains entersAlphaScore=false | 2 | ✓ PASS |
| T13 | NewsEvent remains entersAlphaScore=false | 2 | ✓ PASS |
| T14 | P29E simulation scaffold remains paper-only | 4 | ✓ PASS |
| T15 | no production scoring imports | 3 | ✓ PASS |
| T16 | no optimizer imports | 1 | ✓ PASS |
| T17 | no DB write path | 1 | ✓ PASS |
| T18 | no corpus mutation | 1 | ✓ PASS |
| T19 | no P27/scanner consolidation | 1 | ✓ PASS |
| T20 | next prompt blocks optimizer until resolved | 3 | ✓ PASS |
| EXTRA | buildP29FAuditSummary structure | 7 | ✓ PASS |

**Total: 73 tests, 73 pass, 0 fail**

## Full Suite

| Metric | Before P29F | After P29F | Delta |
|--------|-------------|------------|-------|
| Total suites | 288 | 289 | +1 |
| Passed | 272 | 273 | +1 |
| Failed | 16 | 16 | 0 (pre-existing) |
| Total tests | 4950 | 5023 | +73 |
| Passed tests | 4903 | 4976 | +73 |
| Failed tests | 47 | 47 | 0 (pre-existing) |
