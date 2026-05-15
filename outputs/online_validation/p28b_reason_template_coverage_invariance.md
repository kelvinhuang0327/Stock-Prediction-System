# P28B — Invariance Re-Check

**Phase**: P28B-REASON-TEMPLATE-COVERAGE-HARDRESET

## Frozen File SHA256 Verification

| File | Expected SHA256 | Actual SHA256 | Status |
|---|---|---|---|
| `prisma/dev.db` | a5cf277182... | a5cf277182... | ✅ MATCH |
| `RuleBasedStockAnalyzer.ts` | bc3716cc8e... | bc3716cc8e... | ✅ MATCH |
| `SignalFusionEngine.ts` | b8ce3fa3ae... | b8ce3fa3ae... | ✅ MATCH |
| `ActiveScoringSnapshotBuilder.ts` | 063a3bd524... | 063a3bd524... | ✅ MATCH |

## Corpus Row Counts (Unchanged)

| File | Rows |
|---|---|
| p3active_scoring_historical_replay_corpus.jsonl | 4500 |
| p26f2_monthly_revenue_release_date_candidates.jsonl | 2143 |
| p26f3_monthly_revenue_historical_source_candidates.jsonl | 125 |
| simulation_snapshot_corpus.jsonl | 60 |
| shadow_prediction_ledger.jsonl | 2 |

## Underoutput Case alphaScore/Bucket (Unchanged)

| Case | Symbol | alphaScore | bucket |
|---|---|---|---|
| P5-CASE-010 | 1710 | 68 | NEUTRAL |
| P5-CASE-011 | 1710 | 68 | NEUTRAL |
| P5-CASE-013 | 1710 | 68 | NEUTRAL |
| P5-CASE-023 | 00891 | 63 | NEUTRAL |
| P5-CASE-026 | 00891 | 63 | NEUTRAL |
| P5-CASE-037 | 00891 | 63 | NEUTRAL |
| P5-CASE-053 | 00738U | 63 | NEUTRAL |
| P5-CASE-054 | 00891 | 63 | NEUTRAL |
| P5-CASE-055 | 00738U | 63 | NEUTRAL |

**Verdict**: ✅ ALL_FROZEN_FILES_UNCHANGED — No scoring mutation occurred during P28B planning phase.
