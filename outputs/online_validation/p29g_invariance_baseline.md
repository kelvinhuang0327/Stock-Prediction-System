# P29G Invariance Baseline

**Phase:** P29G — Paper Simulation Dry-run Runner  
**Captured:** 2026-05-15  
**Algorithm:** sha256sum

## Forbidden File Checksums

| File | SHA256 | Status |
|------|--------|--------|
| `prisma/dev.db` | `9c24c697f798...af99ba6` | ✅ MATCH (pre-existing runtime mutation) |
| `p0hardreset_historical_replay_corpus.jsonl` | `f231e3b768ce...f51189` | ✅ MATCH |
| `p1baseline_historical_replay_corpus.jsonl` | `66f62cb2a2b8...99bded` | ✅ MATCH |
| `p3active_scoring_historical_replay_corpus.jsonl` | `e8b4e1a9f255...101712` | ✅ MATCH |
| `simulation_snapshot_corpus.jsonl` | `6a668ba2196f...fe18e` | ✅ MATCH |
| `RuleBasedStockAnalyzer.ts` | `4f6434a31fd2...09e8e2` | ✅ MATCH |
| `SignalFusionEngine.ts` | `b8ce3fa3ae63...d2bf4` | ✅ MATCH |
| `ActiveScoringSnapshotBuilder.ts` | `063a3bd524d2...56bf5d` | ✅ MATCH |

## Verdict

**ALL 8 FORBIDDEN FILES UNCHANGED from P29H baseline.**

P29G implementation touched ONLY:
- `src/lib/onlineValidation/p29g/` (new directory, 3 new files)
- `src/lib/onlineValidation/__tests__/p29g_paper_simulation_dry_run_runner.test.ts` (new file)
- `outputs/online_validation/p29g_*` (new artifact files)

No modifications to DB, corpus files, or scoring engine files.
