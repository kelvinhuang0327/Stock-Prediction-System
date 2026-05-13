# P4-04 Regime Transition Stability Analysis

**Date:** 2026-05-06

## Summary

| Metric | Value |
|---|---|
| Total days | 300 |
| Total transitions | 47 |
| Transition rate | 15.72% per day |
| Distinct periods | 48 |
| Avg period duration | 6.25 days |
| Longest period | BULL 48 days (Sep-Nov 2025) |
| Single-day periods | 21 (7% churn) |
| LOW_CONFIDENCE dates | 0 |

## Transition Matrix (top pairs)

 To | Count |
|---|---|
 BULL | 19 |
 SIDEWAYS | 18 |
 BEAR | 3 |
 SIDEWAYS | 3 |

## Verdict: PASS_WITH_WARNINGS

Warnings:
- 21 single-day regime periods (7% churn) -- optional smoothing deferred to P2
- HIGH_VOLATILITY confidence always 1.0 by design (override applied)

No excessive churn that would block integration. No LOW_CONFIDENCE contamination.
