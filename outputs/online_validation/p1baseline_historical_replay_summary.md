# P1 Baseline Historical Replay Corpus — Generation Summary

Generated: 2026-05-11T13:40:52.551Z
Script: generate-p1baseline-historical-replay-corpus-v1
Writer: p1hardreset-naive-baseline-writer-v1
Run ID: p1baseline-2026-05-11

## Acceptance Gate: ✅ PASS



## Corpus Stats

| Metric | Value |
|--------|-------|
| Total Lines | 9900 |
| Unique Symbols | 25 |
| Unique AsOfDates | 60 |
| Coverage % | 94.23% |
| Elapsed | 2.6s |

## Baseline Type Counts

| Type | Count |
|------|-------|
| BUY_AND_HOLD_ALL | 4500 |
| TOP_N_EQUAL_WEIGHT | 1800 |
| RANDOM_N_DETERMINISTIC | 1800 |
| STOCKQUOTE_COVERAGE_TOP_N | 1800 |

## Horizon Counts

| Horizon | Count |
|---------|-------|


## Price Source Distribution

| Source | Count |
|--------|-------|
| stockQuote.close | 9329 |
| MISSING | 516 |
| PENDING | 55 |

## Frozen Corpus

simulation_snapshot_corpus.jsonl: **60 lines — UNCHANGED ✓**

## Safety Note

Observability-only. No production writes. No performance claims. No mock-deterministic.

## Limitations

- All baseline types are naive reference models — not investment strategies
- TOP_N_EQUAL_WEIGHT uses lexical order as deterministic control (no scores available)
- RANDOM_N_DETERMINISTIC uses seeded LCG; different asOfDates produce different selections
- STOCKQUOTE_COVERAGE_TOP_N uses quoteDays as liquidity/coverage proxy (no market cap or volume data)
- Scores are not used; all alpha/confidence scores = 0 in baseline universe
- returnPct is observational only — not predictive, not ROI-adjusted

---
*Observability-only. No investment advice, ROI claims, or alpha claims.*
