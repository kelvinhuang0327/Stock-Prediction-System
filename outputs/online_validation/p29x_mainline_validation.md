# P29X Mainline Validation

**Phase:** P29X  
**Date:** 2026-05-20

## Test Results

| Suite | Tests | Passed | Failed | Result |
|-------|-------|--------|--------|--------|
| P29G targeted | 76 | 76 | 0 | ✅ PASS |
| P29E regression | 58 | 58 | 0 | ✅ PASS |
| Full onlineValidation (108 suites) | 3315 | 3315 | 0 | ✅ PASS |

**Zero regressions from branch archival operations.**

## Forbidden Diff Scan

| File | Dirty? | Classification | Staged? |
|------|--------|----------------|---------|
| `prisma/dev.db` | YES | pre-existing runtime side effect | ❌ No |
| `runtime/agent_orchestrator/llm_usage.jsonl` | YES | pre-existing runtime side effect | ❌ No |
| `src/lib/analysis/RuleBasedStockAnalyzer.ts` | NO | — | — |
| `src/lib/alpha/SignalFusionEngine.ts` | NO | — | — |
| `src/lib/onlineValidation/ActiveScoringSnapshotBuilder.ts` | NO | — | — |

## Branch Sanity

- Branches containing `676266d` (P29G commit): **`main` only** ✅
- main HEAD: `676266d`
- Active worktrees: **1** (main only — all claude/* worktrees removed)

## Overall: PASS ✅
