# P26F4 Source-Present Gate — Invariance

**Phase:** P26F4-SOURCE-PRESENT-GATE-HARDRESET  
**Date:** 2026-05-16

## Import Status

**No import occurred** — `candidateSourceFiles = 0`

## No-write Invariance

| Item | Before | After | Match |
|------|--------|-------|-------|
| `prisma/dev.db` SHA256 | `a5cf277...` | `a5cf277...` | ✅ |
| `simulation_snapshot_corpus.jsonl` | 60 | 60 | ✅ |
| `p0hardreset...jsonl` | 4500 | 4500 | ✅ |
| `p1baseline...jsonl` | 9900 | 9900 | ✅ |
| `p3active...jsonl` | 4500 | 4500 | ✅ |
| `p19active...jsonl` | 4500 (canonical) | 4500 (canonical) | ✅ |
| `RuleBasedStockAnalyzer.ts` | `bc3716c...` | `bc3716c...` | ✅ |
| `SignalFusionEngine.ts` | `b8ce3fa...` | `b8ce3fa...` | ✅ |
| `ActiveScoringSnapshotBuilder.ts` | `063a3bd...` | `063a3bd...` | ✅ |

**Status: INVARIANCE_PASS** ✅

*Observability only. No investment recommendations.*
