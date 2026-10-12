# P29G-PREFLIGHT: Invariance Baseline

**Audit Date:** 2026-05-20 (Asia/Taipei)  
**HEAD:** `1c5a270b0be185a9f06d870305ed93f07950c69b` (main)

---

## Database

| File | SHA256 |
|------|--------|
| `prisma/dev.db` | `9c24c697f7980c910802e37faecdf05d0d821db097358cda1ad6c5085af99ba6` |

> **Note:** `prisma/dev.db` shows as dirty in `git diff` due to pre-existing modification by running backend services. This audit did NOT touch the database. The sha256 above reflects the current on-disk state.

---

## Corpus Files (5)

| File | Lines | SHA256 |
|------|-------|--------|
| `p0hardreset_historical_replay_corpus.jsonl` | 4,500 | `f231e3b768cec2250a1c792751f7ec61bc307aa3281cbcc6b454c0fd81f51189` |
| `p1baseline_historical_replay_corpus.jsonl` | 9,900 | `66f62cb2a2b8e9a04f414a033dece8408ac68764c44130102ad6994a9399bded` |
| `p3active_scoring_historical_replay_corpus.jsonl` | 4,500 | `e8b4e1a9f255e3a96af13925176559538ed0fdca7793d7030bb7164c71101712` |
| `p19active_scoring_pit_replay_corpus.jsonl` | 4,499 | `da92963f0d0f596cdd8673d63e3a19c6a70ca92e23a31b1029595ce913c90a94` |
| `simulation_snapshot_corpus.jsonl` | 60 | `6a668ba2196fba05aa96304262f3eff154fc797612a5adf878ed4794af2fe18e` |

All paths are under `outputs/online_validation/`.

---

## Scoring Files (3)

| File | SHA256 |
|------|--------|
| `src/lib/analysis/RuleBasedStockAnalyzer.ts` | `4f6434a31fd211b6122408ee5e977e41f4cd45aee45cec586ec988b2c009e8e2` |
| `src/lib/alpha/SignalFusionEngine.ts` | `b8ce3fa3ae63fd7edf6b6067dd8ccea63c02741454b93792e87bfbc1e95d2bf4` |
| `src/lib/onlineValidation/ActiveScoringSnapshotBuilder.ts` | `063a3bd524d20e9d0dfc847e342a93b36bd086bab042d9fde88282963156bf5d` |

---

## Invariance Status: BASELINE_ESTABLISHED

Corpus files and scoring files were **not modified** by this audit. All checksums recorded for future P29G task verification. Any future task that runs against this codebase must re-verify these hashes before reporting results.
