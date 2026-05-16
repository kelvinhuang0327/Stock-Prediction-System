# P28E PART C — Residual Underoutput Distribution Scan (compressed)

**Renderer version:** `p26a-corpus-renderer-v2`
**Sampling:** deterministic, every 16th row per corpus
**F9 length threshold:** 12 chars

## CEO-revised compressed scope

F1-F6 (rendererError / FALLBACK_EMPTY / single-token / lowFactor / outcomeLeakage / scoreSnapshot-zero-fallback) are already covered by P28D's regression sweep with 0 errors on each corpus. P28E does **not** redo F1-F6.

P28E scans only F7-F10 (read-only, sample-based).

## Per-corpus counts

| Corpus | Parsed | Sampled | F7 | F8 | F9 | F10 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| p3active_scoring_historical_replay_corpus.jsonl | 4500 | 282 | 279 | 0 | 0 | 0 |
| p19active_scoring_pit_replay_corpus.jsonl | 4500 | 282 | 279 | 0 | 0 | 0 |

## Aggregate

- F7 = 558 (informational; see interpretation below)
- F8 = 0
- F9 = 0
- F10 = 0
- **Blocking residual count (F8 + F9 + F10) = 0**

## Closure status: `NO_BLOCKING_RESIDUAL_UNDEROUTPUT`

## Family interpretation

- **F7:** P3/P19 corpora pre-date the MonthlyRevenue PIT repair; every row has `missingSources=[MonthlyRevenue]`. Renderer correctly does not invent a coverage note from corpus data. F7 hits here are *expected by design* and are **not** a blocking residual.
- **F8:** mixed-signal detection coverage. Renderer v2 added the note; F8>0 would mean v2 missed cases.
- **F9:** degenerate short output that did not declare FALLBACK_EMPTY.
- **F10:** template-coverage gap — factors present but rendered text has no factor keyword.

## Production safety

- `productionWritten`: false
- `dbWritten`: false
- `corpusWritten`: false
- This script runs read-only and writes only to `outputs/online_validation/p28e_*`.
