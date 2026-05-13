# P4-04 Persisted Regime Data Audit

**Date:** 2026-05-06 | **Task:** P4-04 Formal MarketRegime Validation

## Summary

| Field | Value |
|---|---|
| row_count | 300 |
| min_date | 2025-01-15 |
| max_date | 2026-05-06 |
| distinct_dates | 300 |
| duplicates | 0 |
| future_dates | 0 |
| invalid labels | 0 |
| invalid confidence | 0 |

## Label Distribution

| Label | Count | % |
|---|---|---|
| BULL | 126 | 42.0% |
| SIDEWAYS | 107 | 35.7% |
| HIGH_VOLATILITY | 63 | 21.0% |
| BEAR | 4 | 1.3% |

## Confidence Stats

| Stat | Value |
|---|---|
| min | 0.3846 |
| max | 1.0 |
| avg | 0.8167 |
| median | 0.8462 |

## Verdict: PASS

All 300 records pass: correct labels, confidence in [0,1], no duplicates, no future dates, all JSON fields parseable. Matches T-08 expected sample count.
