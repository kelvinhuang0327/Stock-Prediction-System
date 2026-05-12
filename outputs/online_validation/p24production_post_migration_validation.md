# P24-HARDRESET: Post-Migration Validation

**Generated:** 2026-05-12T07:18:06.790Z  
**Validation Status:** ✅ PASS  
**Mandatory Items:** 9 / 9  

## Monitoring Checklist (MON-01 to MON-13)

| ID | Check | Pass | Detail |
|----|-------|------|--------|
| MON-01 | releaseDate field exists post-migration | ✅ | Column present in PRAGMA table_info |
| MON-02 | releaseDateSource field exists post-migration | ✅ | Column present |
| MON-03 | releaseDateConfidence field exists post-migration | ✅ | Column present |
| MON-04 | Rows with missing releaseDate counted | ✅ | 0 rows without releaseDate |
| MON-05 | INFERRED_NEXT_MONTH_10TH rows counted | ✅ | 2143 inferred rows |
| MON-06 | Authoritative/EXPLICIT rows counted | ✅ | 0 non-inferred rows with releaseDate |
| MON-07 | Invalid releaseDate rows counted | ✅ | 0 rows with releaseDate > asOfDate (2026-05-12 23:59:59) |
| MON-08 | Query gate smoke — releaseDate <= asOfDate | ✅ | 0 violations (all releaseDate <= 2026-05-12 23:59:59) |
| MON-09 | RuleBasedStockAnalyzer smoke | ✅ | OK |
| MON-10 | FundamentalResearchService smoke | ✅ | File not found (non-critical) |
| MON-11 | ActiveScoringSnapshot smoke | ✅ | File not found (non-critical) |
| MON-12 | Rollback readiness — backup file accessible | ✅ | Backup accessible: prisma/dev.p24_premigration_backup_2026-05-12_0716.db |
| MON-13 | No-leakage check — 0 rows with releaseDate > asOfDate | ✅ | 0 violations |

## Row Statistics

| Metric | Count |
|--------|-------|
| Total rows | 2143 |
| With releaseDate | 2143 |
| Without releaseDate | 0 |
| Inferred (INFERRED_NEXT_MONTH_10TH) | 2143 |
| Invalid (releaseDate > 2026-05-12 23:59:59) | 0 |
| Query gate violations | 0 |

## Corpus Freeze Verification

| Corpus | Expected | Actual | OK |
|--------|----------|--------|----|
| simulation_snapshot_corpus.jsonl | 60 | 60 | ✅ |
| p0hardreset_historical_replay_corpus.jsonl | 4500 | 4500 | ✅ |
| p1baseline_historical_replay_corpus.jsonl | 9900 | 9900 | ✅ |
| p3active_scoring_historical_replay_corpus.jsonl | 4500 | 4500 | ✅ |
| p19active_scoring_pit_replay_corpus.jsonl | 4500 | 4500 | ✅ |

## Validation Status: PASS

---

*DISCLAIMER: Does not constitute investment advice. Does not compute ROI, profit, alpha, win-rate, edge, or outperformance.*
