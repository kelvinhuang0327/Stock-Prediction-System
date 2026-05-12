# P19 Active Scoring PIT Replay Corpus — Generation Summary

> DISCLAIMER: Does not constitute investment advice. Does not compute ROI, profit, alpha, win-rate, edge, or outperformance. Historical replay PIT governance only.

**Phase**: P19-HARDRESET PART C
**Run ID**: p19-pit-replay-2026-05-12
**Generated**: 2026-05-12T05:06:00.026Z
**Validation Status**: PASS

## Corpus Dimensions

| Metric | Value |
|--------|-------|
| Total rows | 4500 |
| Unique symbols | 25 |
| Unique asOfDates | 60 |
| COMPLETE + PARTIAL ratio | 100% |
| stockQuote.close coverage | 100% |
| mock-deterministic rows | 0 |
| PIT safety violations | 0 |

## ScoringCompletenessStatus Distribution

- COMPLETE: 3099
- PARTIAL: 1401

## MonthlyRevenue PIT Gate Status Distribution

- NOT_APPLICABLE_NO_DATA: 4500

## Horizon Distribution

- 5D: 1500
- 20D: 1500
- 60D: 1500

## Gate Results

- Passed: 21/21
- Failed: none

## Production Safety

- productionApplyAllowed: false
- productionDbWritten: false
- Frozen corpus line counts: simulation_snapshot_corpus.jsonl=60, p0hardreset_historical_replay_corpus.jsonl=4500, p1baseline_historical_replay_corpus.jsonl=9900, p3active_scoring_historical_replay_corpus.jsonl=4500
