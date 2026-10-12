# P29H — Invariance Baseline

**Phase:** P29H Phase 3 Verification  
**Date:** 2026-05-20

---

## Forbidden Files — Checksums

| File | SHA256 | Matches Baseline |
|---|---|---|
| `prisma/dev.db` | `9c24c697...af99ba6` | ✅ MATCH |
| `p0hardreset_historical_replay_corpus.jsonl` | `f231e3b7...f51189` | ✅ MATCH |
| `p1baseline_historical_replay_corpus.jsonl` | `66f62cb2...9bded` | ✅ MATCH |
| `p3active_scoring_historical_replay_corpus.jsonl` | `e8b4e1a9...01712` | ✅ MATCH |
| `p19active_scoring_pit_replay_corpus.jsonl` | `da92963f...0a94` | ✅ MATCH |
| `simulation_snapshot_corpus.jsonl` | `6a668ba2...fe18e` | ✅ MATCH |
| `RuleBasedStockAnalyzer.ts` | `4f6434a3...09e8e2` | ✅ MATCH |
| `SignalFusionEngine.ts` | `b8ce3fa3...d2bf4` | ✅ MATCH |
| `ActiveScoringSnapshotBuilder.ts` | `063a3bd5...56bf5d` | ✅ MATCH |

All 9 checksums match the P29G-PREFLIGHT baseline exactly.

---

## Note on prisma/dev.db Dirty State

`prisma/dev.db` appears in `git diff HEAD` but its sha256 matches the P29G-PREFLIGHT baseline. This confirms the file was mutated by pre-existing runtime backend service activity — **not** by the P29H scaffold implementation.

---

## Verdict: INVARIANCE_MAINTAINED ✅

All forbidden files are intact. The P29E scaffold implementation did not touch any protected asset.
