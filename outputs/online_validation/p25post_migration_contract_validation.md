# P25 Post-Migration Contract Validation

**Phase:** P25-HARDRESET Part F  
**Generated:** 2026-05-12T10:11:41.859Z  
**Validation Status:** `PASS`

## Summary

| Metric | Value |
|--------|-------|
| Total checks | 31 |
| PASS | 31 |
| FAIL | 0 |
| WARN | 0 |

## Checks

- [PASS] `F01` — P12 PIT feature contract parseable (p12pit_feature_contract_v0.json)
- [PASS] `F02` — P17 query gate patch: releaseDate <= asOfDate queries work (gated rows available: true)
- [PASS] `F03` — P24 migration gate = PASS (migrationStatus=PASS)
- [PASS] `F04` — P24 productionMigrationApplied = true (productionMigrationApplied=true)
- [PASS] `F05` — P24 backfill gate = PASS (backfillStatus=PASS)
- [PASS] `F06` — P24 rowsBackfilled = 2143 (rowsBackfilled=2143)
- [PASS] `F07` — P24 releaseDateSource = INFERRED_NEXT_MONTH_10TH ({"INFERRED_NEXT_MONTH_10TH":2143})
- [PASS] `F08` — P25 preflight classification = P25_PREFLIGHT_PASS (classification=P25_PREFLIGHT_PASS)
- [PASS] `F09` — P25 preflight all gates pass (failCount=0)
- [PASS] `F10` — P25 distribution audit = PASS (validationStatus=PASS)
- [PASS] `F11` — P25 totalRows >= 2143 (totalRows=2143)
- [PASS] `F12` — P25 rowsWithReleaseDate >= 2143 (rowsWithReleaseDate=2143)
- [PASS] `F13` — P25 invalidReleaseDateCount = 0 (invalidCount=0)
- [PASS] `F14` — P25 INFERRED_NEXT_MONTH_10TH in distribution ({"INFERRED_NEXT_MONTH_10TH":2143})
- [PASS] `F15` — P25 distribution: productionDbWritten = false (false)
- [PASS] `F16` — P25 query gate smoke = PASS (validationStatus=PASS)
- [PASS] `F17` — P25 query gate 0 failures (failCount=0)
- [PASS] `F18` — P25 DB gate: 0 Feb rows before 2026-03-10 (count=0)
- [PASS] `F19` — P25 DB gate: 1070 Feb rows on 2026-03-10 (count=1070)
- [PASS] `F20` — P25 query gate: productionDbWritten = false (false)
- [PASS] `F21` — P25 active scoring smoke PASS or PARTIAL (smokeStatus=PASS)
- [PASS] `F22` — P25 smoke: no FAIL entries with forbidden fields (totalEntries=25)
- [PASS] `F23` — P25 smoke: productionDbWritten = false (false)
- [PASS] `F24` — P25 smoke: corpusModified = false (false)
- [PASS] `F25` — P25 smoke: no snapshot contains forbidden fields (clean)
- [PASS] `F-FROZEN-hot_corpus` — Frozen corpus: simulation_snapshot_corpus.jsonl = 60 (actual=60)
- [PASS] `F-FROZEN-lay_corpus` — Frozen corpus: p0hardreset_historical_replay_corpus.jsonl = 4500 (actual=4500)
- [PASS] `F-FROZEN-lay_corpus` — Frozen corpus: p1baseline_historical_replay_corpus.jsonl = 9900 (actual=9900)
- [PASS] `F-FROZEN-lay_corpus` — Frozen corpus: p3active_scoring_historical_replay_corpus.jsonl = 4500 (actual=4500)
- [PASS] `F-FROZEN-lay_corpus` — Frozen corpus: p19active_scoring_pit_replay_corpus.jsonl = 4500 (actual=4500)
- [PASS] `F-P12-REPAIR` — P12 MonthlyRevenue PIT repair completed (releaseDate present) (rowsWithReleaseDate=2143)

## Cross-Reference

| Source | Status |
|--------|--------|
| P12 PIT contract present | ✅ |
| P17 query gate active | ✅ |
| P24 migration status | `PASS` |
| P24 rows backfilled | 2143 |
| P25 preflight | `P25_PREFLIGHT_PASS` |
| P25 distribution audit | `PASS` |
| P25 query gate smoke | `PASS` |
| P25 active scoring smoke | `PASS` |

## Errors

✅ None

## Warnings

None

*Does not constitute investment advice. No ROI / win-rate / alpha / profit / outperform claims.*
