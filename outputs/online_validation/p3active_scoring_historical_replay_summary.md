# P3-HARDRESET Active Scoring Historical Replay Corpus — Generation Summary

Generated: 2026-05-11T14:31:11.847Z
Elapsed: 63.3s
Status: **PASS**
P3 Classification: `P3_ACTIVE_SCORING_REPLAY_COMPLETE`

## Corpus Run Info

| Field | Value |
|-------|-------|
| corpusRunId | `p3active-historical-replay-batch` |
| writerVersion | `p0hardreset-historical-replay-writer-v1` |
| useActiveScoringSnapshot | `true` |
| universeTier | `P3_ACTIVE_SCORING_HISTORICAL_REPLAY` |
| horizons | `[5, 20, 60]` |

## Corpus Stats

| Metric | Value |
|--------|-------|
| Lines written | 4500 |
| Unique symbols | 25 |
| Unique asOfDates | 60 |
| Success count | 4204 |
| Pending count | 25 |
| Missing count | 271 |
| Error count | 0 |

## Scoring Completeness

| Status | Count |
|--------|-------|
| COMPLETE | 3099 |
| PARTIAL | 1401 |
| EMPTY | 0 |
| MISSING (no field) | 0 |
| Usable (COMPLETE+PARTIAL) | 4500 (100.0%) |

## Price Source Distribution

- `stockQuote.close`: 4204
- `MISSING`: 271
- `PENDING`: 25

## Frozen Corpus Safety

- `simulation_snapshot_corpus.jsonl`: UNTOUCHED
- `p0hardreset_historical_replay_corpus.jsonl`: UNTOUCHED
- `p1baseline_historical_replay_corpus.jsonl`: UNTOUCHED
- ManualReview* modules: NOT modified

---
*P3-HARDRESET PART D — Not investment advice.*