# P28E Invariance Re-check

**Classification:** `P28E_INVARIANCE_PASS`
**Verdict:** `ALL_FROZEN_FILES_UNCHANGED`

## DB

| File | Baseline SHA-256 | Current SHA-256 | Match |
| --- | --- | --- | :---: |
| `prisma/dev.db` | `a5cf2771...` | `a5cf2771...` | ✅ |

## Scoring Files

| File | Baseline SHA-256 | Current SHA-256 | Match |
| --- | --- | --- | :---: |
| `RuleBasedStockAnalyzer.ts` | `bc3716cc...` | `bc3716cc...` | ✅ |
| `SignalFusionEngine.ts` | `b8ce3fa3...` | `b8ce3fa3...` | ✅ |
| `ActiveScoringSnapshotBuilder.ts` | `063a3bd5...` | `063a3bd5...` | ✅ |

## Corpus Files

| Corpus | Lines (baseline / current) | SHA-256 Match |
| --- | --- | :---: |
| simulation_snapshot_corpus.jsonl | 60 / 60 | ✅ |
| p0hardreset_historical_replay_corpus.jsonl | 4500 / 4500 | ✅ |
| p1baseline_historical_replay_corpus.jsonl | 9900 / 9900 | ✅ |
| p3active_scoring_historical_replay_corpus.jsonl | 4500 / 4500 | ✅ |
| p19active_scoring_pit_replay_corpus.jsonl | 4499 / 4499 | ✅ |

**Total:** 9/9 files match baseline. 0 mismatches.
