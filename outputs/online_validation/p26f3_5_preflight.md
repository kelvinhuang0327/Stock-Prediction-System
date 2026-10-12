# P26F3-5 Pre-flight Gate

**Classification:** `P26F3_5_PREFLIGHT_COMPLETE`  
**Generated:** 2026-05-13T10:03:25.239Z

## A.1 Required Artifacts

| Artifact | Status |
|---|---|
| outputs/online_validation/p26a_feature_snapshot_v1_final_report.md | PRESENT |
| outputs/online_validation/p26f_monthly_revenue_corpus_expansion_candidate_final_report.md | PRESENT |
| outputs/online_validation/p26f2_monthly_revenue_release_date_population_final_report.md | PRESENT |
| outputs/online_validation/p26f3_4_twse_manual_source_preparation_final_report.md | PRESENT |
| docs/manual-data/monthly-revenue/P26F3_4_OPERATOR_CHECKLIST.md | PRESENT |
| data/manual/monthly-revenue/p26f3-2-dropzone | PRESENT |

**Result:** ALL PRESENT

## A.2 Frozen Corpus Line Counts

| Corpus | Expected | Actual | Status |
|---|---|---|---|
| simulation_snapshot_corpus.jsonl | 60 | 60 | OK |
| p0hardreset_historical_replay_corpus.jsonl | 4500 | 4500 | OK |
| p1baseline_historical_replay_corpus.jsonl | 9900 | 9900 | OK |
| p3active_scoring_historical_replay_corpus.jsonl | 4500 | 4500 | OK |
| p19active_scoring_pit_replay_corpus.jsonl | 4500 | 4500 | OK |

**Note (p19):** `wc -l` = 4499 (no trailing newline); non-empty lines = 4500. Using 4500 as canonical count per P26F3-4 specification.

## A.3 DB Baseline

- `prisma/dev.db` sha256: `a5cf277182c161dfe97ba05f9b81528d6c8e477dd5ac0bec6810ffbb8711c6f8`
- MonthlyRevenue rows: ~2143
- releaseDate coverage: 2026-02 / 2026-03 only (0% for 2025-09 to 2026-01 target)

## A.4 Scoring Code Baseline

| File | Expected (16 chars) | Actual (16 chars) | Status |
|---|---|---|---|
| RuleBasedStockAnalyzer.ts | bc3716cc8e74be30... | bc3716cc8e74be30... | OK |
| SignalFusionEngine.ts | b8ce3fa3ae63fd7e... | b8ce3fa3ae63fd7e... | OK |
| ActiveScoringSnapshotBuilder.ts | 063a3bd524d20e9d... | 063a3bd524d20e9d... | OK |

## Conclusion

All pre-flight checks: **PASS**  
 PART C (Pipeline Pre-flight).

> Does not constitute investment advice.
