# P0-HARDRESET Historical Replay Corpus — Generation Summary

Generated: 2026-05-11T11:51:04.174Z  
Elapsed: 61.1s  
Status: **✅ PASS**

## Corpus Run Info

| Field | Value |
|-------|-------|
| corpusRunId | `historical-replay-2026-02-11` |
| writerVersion | `p0hardreset-historical-replay-writer-v1` |
| universeTier | `HISTORICAL_REPLAY` |
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

## Price Source Distribution

- `stockQuote.close`: 4204
- `MISSING`: 271
- `PENDING`: 25

## Quality Gate

**PASS** — All acceptance criteria met.

## Frozen Corpus

`simulation_snapshot_corpus.jsonl` is UNCHANGED (frozen per P0-HARDRESET safety contract).  
ManualReview* modules: NOT modified (frozen).

## Notes

- 4500 corpus lines written
- 25 unique symbols
- 60 unique asOfDates
- priceSource: real=4204 pending=25 missing=271
- FROZEN: simulation_snapshot_corpus.jsonl NOT modified
- ManualReview* modules: NOT modified (frozen per P0-HARDRESET)

---
*Not investment advice. Not a trading system. Research corpus only.*
