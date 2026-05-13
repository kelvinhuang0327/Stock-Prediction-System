# P26 Next Prompt: Source Arrival Only

**Date:** 2026-05-16  
**Trigger:** Operator explicitly confirms source files have been placed in drop-zone

## When To Use This Prompt
**ONLY when operator says:** "I have placed the TWSE/MOPS source files in the drop-zone."

Do NOT run this prompt if operator has NOT confirmed source arrival.

## Source Arrival Protocol
When operator confirms source files placed:

1. Verify `data/manual/monthly-revenue/p26f3-2- candidateSourceFiles > 0dropzone/` 
2. Run source-present gate: `node scripts/run-p26f3-5-dropzone-conditional-scan.js`
 proceed to P26F4-SOURCE-PRESENT-GATE prompt
4. Run manifest validation (SOURCE_MANIFEST.json completeness check)
5. Run dry-run (no DB write)
 request token from operator
7. Operator provides token: `P26F4_APPROVE_HISTORICAL_MONTHLY_REVENUE_IMPORT_ONLY`
8. Run controlled import with rollback capability
9. Run post-import coverage preview
10. Report invariants: DB row count, releaseDate range, no corpus change

## Invariant Baselines (must verify before any write)
| Item | Expected |
|------|----------|
| prisma/dev.db SHA256 | a5cf277182c161dfe97ba05f9b81528d6c8e477dd5ac0bec6810ffbb8711c6f8 |
| Corpus | 60/4500/9900/4500/4500 |
| Scoring files | unchanged |

## Do NOT Do Without Source
- Do not run dry-run without candidateSourceFiles > 0
- Do not import without dry-run PASS
- Do not import without token
- Do not expand corpus without import + coverage PASS
- Do not scan empty drop-zone as primary task

> Observability only. No investment recommendations.
