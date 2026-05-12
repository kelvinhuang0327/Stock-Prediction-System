# P25 Pre-flight Gate

**Phase:** P25-HARDRESET  
**Generated:** 2026-05-12T10:10:29.317Z  
**Classification:** `P25_PREFLIGHT_PASS`

## Gate Summary

| Metric | Value |
|--------|-------|
| Total gates | 26 |
| PASS | 26 |
| FAIL | 0 |
| Classification | `P25_PREFLIGHT_PASS` |

## Gates

- [PASS] `A1-p24production_migrat` — P24 artifact exists: p24production_migration_execution_final_report.md (outputs/online_validation/p24production_migration_execution_final_report.md)
- [PASS] `A1-p24production_backup` — P24 artifact exists: p24production_backup_gate.json (outputs/online_validation/p24production_backup_gate.json)
- [PASS] `A1-p24production_migrat` — P24 artifact exists: p24production_migration_gate.json (outputs/online_validation/p24production_migration_gate.json)
- [PASS] `A1-p24production_backfi` — P24 artifact exists: p24production_backfill_gate.json (outputs/online_validation/p24production_backfill_gate.json)
- [PASS] `A1-p24production_post_m` — P24 artifact exists: p24production_post_migration_validation.json (outputs/online_validation/p24production_post_migration_validation.json)
- [PASS] `A1-p24production_rollba` — P24 artifact exists: p24production_rollback_readiness.json (outputs/online_validation/p24production_rollback_readiness.json)
- [PASS] `A2-backup-status` — P24 backup gate = PASS (backupStatus=PASS)
- [PASS] `A2-migration-status` — P24 migration gate = PASS (migrationStatus=PASS)
- [PASS] `A2-migration-applied` — P24 productionMigrationApplied = true (productionMigrationApplied=true)
- [PASS] `A2-backfill-status` — P24 backfill gate = PASS (backfillStatus=PASS)
- [PASS] `A2-rows-backfilled` — P24 rowsBackfilled >= 2143 (rowsBackfilled=2143)
- [PASS] `A2-rows-skipped` — P24 rowsSkipped = 0 (rowsSkipped=0)
- [PASS] `A2-postval-status` — P24 post-migration validation = PASS (validationStatus=PASS)
- [PASS] `A2-rollback-status` — P24 rollback readiness = PASS (rollbackReadinessStatus=PASS)
- [PASS] `A2-distribution` — P24 distribution has INFERRED_NEXT_MONTH_10TH (dist={"INFERRED_NEXT_MONTH_10TH":2143})
- [PASS] `A3-schema-releaseDate` — DB MonthlyRevenue has releaseDate column (PRAGMA table_info)
- [PASS] `A3-schema-releaseDateSource` — DB MonthlyRevenue has releaseDateSource column (PRAGMA table_info)
- [PASS] `A3-schema-releaseDateConfidence` — DB MonthlyRevenue has releaseDateConfidence column (PRAGMA table_info)
- [PASS] `A3-row-count` — MonthlyRevenue row count >= 2143 (rowCount=2143)
- [PASS] `A3-null-releaseDate` — No rows with NULL releaseDate (nullCount=0)
- [PASS] `A3-source-distribution` — All non-null releaseDateSource = INFERRED_NEXT_MONTH_10TH (unexpectedSourceRows=0)
- [PASS] `A4-simulation_snapshot_corpu` — Frozen: simulation_snapshot_corpus.jsonl = 60 lines (actual=60)
- [PASS] `A4-p0hardreset_historical_re` — Frozen: p0hardreset_historical_replay_corpus.jsonl = 4500 lines (actual=4500)
- [PASS] `A4-p1baseline_historical_rep` — Frozen: p1baseline_historical_replay_corpus.jsonl = 9900 lines (actual=9900)
- [PASS] `A4-p3active_scoring_historic` — Frozen: p3active_scoring_historical_replay_corpus.jsonl = 4500 lines (actual=4500)
- [PASS] `A4-p19active_scoring_pit_rep` — Frozen: p19active_scoring_pit_replay_corpus.jsonl = 4500 lines (actual=4500)

## DB Schema (post-migration)

- releaseDate: ✅
- releaseDateSource: ✅
- releaseDateConfidence: ✅
- Total rows: 2143
- NULL releaseDate rows: 0

## Frozen Corpus Counts

- ✅ `simulation_snapshot_corpus.jsonl` — expected 60, actual 60
- ✅ `p0hardreset_historical_replay_corpus.jsonl` — expected 4500, actual 4500
- ✅ `p1baseline_historical_replay_corpus.jsonl` — expected 9900, actual 9900
- ✅ `p3active_scoring_historical_replay_corpus.jsonl` — expected 4500, actual 4500
- ✅ `p19active_scoring_pit_replay_corpus.jsonl` — expected 4500, actual 4500

*Does not constitute investment advice. No ROI / win-rate / alpha / profit / outperform claims.*
