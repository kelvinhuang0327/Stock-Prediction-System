# P4-04 Confidence Calibration Sanity Check

**Date:** 2026-05-06

## Distribution

| Bucket | Count | % |
|---|---|---|
| 0.0 - 0.2 | 0 | 0.0% |
| 0.2 - 0.4 | 8 | 2.7% |
| 0.4 - 0.6 | 43 | 14.3% |
| 0.6 - 0.8 | 56 | 18.7% |
| 0.8 - 1.0 | 193 | 64.3% |

Confidence == 1.0: 113 records (37.7%)
Confidence == 0.0: 0 records

## By Label

| Label | Min | Max | Avg |
|---|---|---|---|
| BULL | 0.8462 | 1.0 | 0.9072 |
| SIDEWAYS | 0.3846 | 0.6923 | 0.6010 |
| HIGH_VOLATILITY | 1.0 | 1.0 | 1.0 |
| BEAR | 0.8462 | 0.8462 | 0.8462 |

## Verdict: PASS_WITH_WARNINGS

HIGH_VOLATILITY always 1.0 by design (high_vol_override_applied flag in pitSafetyJson). Not a defect. No performance-based calibration applied. No calibration redesign required.
