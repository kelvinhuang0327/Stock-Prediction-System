# P1 Baseline vs P0 — Observability Comparison

Generated: 2026-05-11T13:41:47.929Z
Script: compare-p0hardreset-corpus-to-p1baseline-v1

> **Observability only.** No investment recommendations, ROI claims, alpha claims, or predictions.

## Corpus Overview

| Metric | P0 (System Predictions) | P1 (Naive Baseline) |
|--------|------------------------|---------------------|
| Total Lines | 4500 | 9900 |
| Unique Symbols | 25 | 25 |
| Unique AsOfDates | 60 | 60 |
| Coverage % | 0% | 94.2323% |
| Parse Errors | 0 | 0 |

## P0 Price Source Distribution

- UNKNOWN: 4500

## P1 Price Source Distribution

- stockQuote.close: 9329
- MISSING: 516
- PENDING: 55

## P0 Return% — Overall & By Horizon

Overall: n=4500, mean=NaN%, median=NaN%, min=NaN%, max=NaN%, σ=NaN%

| Horizon | Stats |
|---------|-------|
| horizon_undefinedd | n/a |

## P1 Return% — By Baseline Type

| Type | Stats |
|------|-------|
| BUY_AND_HOLD_ALL | n=4204, mean=6.3248%, median=1.6898%, min=-35.8718%, max=144.6889%, σ=16.216% |
| TOP_N_EQUAL_WEIGHT | n=1690, mean=3.8681%, median=1.0288%, min=-35.8718%, max=144.6889%, σ=13.9933% |
| RANDOM_N_DETERMINISTIC | n=1677, mean=6.1152%, median=1.5152%, min=-34.5312%, max=128.9217%, σ=15.5362% |
| STOCKQUOTE_COVERAGE_TOP_N | n=1758, mean=9.9057%, median=3.0692%, min=-35.8718%, max=144.6889%, σ=19.1836% |

## P1 Return% — By Horizon

| Horizon | Stats |
|---------|-------|
| horizon_5d | n=3300, mean=0.9619%, median=0.3519%, min=-28.8136%, max=56.2952%, σ=6.0596% |
| horizon_20d | n=3273, mean=4.7403%, median=1.7241%, min=-27.521%, max=75.5306%, σ=11.9139% |
| horizon_60d | n=2756, mean=15.2782%, median=8.5743%, min=-35.8718%, max=144.6889%, σ=24.1785% |

## Cross-Corpus Notes

- P0 corpus contains system-generated prediction entries — not a strategy recommendation.
- P1 corpus is a naive reference baseline — not a strategy recommendation.
- Return % figures are back-computed from historical TWSE close prices and are observational only.
- No live trading, no buy/sell signals, no investment advice derived from this comparison.
- Past statistical summaries do not predict future returns.
- Coverage gaps (MISSING/PENDING) affect completeness of statistics.

---
*P0 file:* p0hardreset_historical_replay_corpus.jsonl  
*P1 file:* p1baseline_historical_replay_corpus.jsonl
