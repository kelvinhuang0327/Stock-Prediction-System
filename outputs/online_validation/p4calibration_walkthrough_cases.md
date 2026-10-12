# P4 Calibration Walkthrough Cases

**Version**: `p4hardreset-walkthrough-v1`  **Date**: 2026-05-13
**Total cases**: 58
**Selection**: Deterministic (djb2 hash, no Math.random)

> Deterministic selection via djb2 stable hash. No Math.random used. Not investment advice.

## Coverage Summary

**Per horizon:**
- 5d: 31 cases ✓
- 20d: 14 cases ✓
- 60d: 13 cases ✓

**Per bucket:**
- LowPriority: 17 cases ✓
- Watch: 5 cases ✓
- Neutral: 15 cases ✓
- Strong: 21 cases ✓

**Mandatory scenario coverage:**
- high-score-negative: 9 cases ✓
- low-score-positive: 9 cases ✓
- high-score-positive: 9 cases ✓
- neutral-or-insufficient: 6 cases ✓
- completeness-COMPLETE: 3 cases ✓
- completeness-PARTIAL: 3 cases ✓

## Sample Cases

| # | Label | Symbol | Date | Horizon | Bucket | Score | Decile | ReturnPct | ReturnClass | Status |
|---|-------|--------|------|---------|--------|-------|--------|-----------|-------------|--------|
| 1 | high-score-negative | 1434 | 2025-10-23 | 5d | Strong | 77 | 8 | -1.9544 | NEGATIVE | COMPLETE |
| 2 | high-score-negative | 2454 | 2025-11-05 | 5d | Strong | 94 | 10 | -6.3910 | NEGATIVE | COMPLETE |
| 3 | high-score-negative | 1717 | 2025-12-22 | 5d | Strong | 85 | 9 | -0.4854 | NEGATIVE | COMPLETE |
| 4 | low-score-positive | 1536 | 2025-12-02 | 5d | Watch | 21 | 1 | 4.3630 | POSITIVE | COMPLETE |
| 5 | low-score-positive | 00903 | 2025-12-03 | 5d | LowPriority | 38 | 3 | 2.2989 | POSITIVE | COMPLETE |
| 6 | low-score-positive | 00712 | 2025-11-24 | 5d | Watch | 29 | 1 | 2.8921 | POSITIVE | COMPLETE |
| 7 | high-score-positive | 1326 | 2026-01-12 | 5d | Strong | 94 | 10 | 7.5501 | POSITIVE | COMPLETE |
| 8 | high-score-positive | 1717 | 2025-12-04 | 5d | Strong | 85 | 9 | 4.5743 | POSITIVE | COMPLETE |
| 9 | high-score-positive | 1717 | 2026-01-13 | 5d | Strong | 82 | 9 | 17.4790 | POSITIVE | COMPLETE |
| 10 | neutral-or-insufficient | 1710 | 2025-12-15 | 5d | Neutral | 68 | 7 | -2.0243 | NEGATIVE | PARTIAL |
| 11 | neutral-or-insufficient | 00738U | 2025-12-19 | 5d | Neutral | 63 | 6 | 14.7770 | POSITIVE | PARTIAL |
| 12 | completeness-COMPLETE | 1536 | 2025-12-02 | 5d | Watch | 21 | 1 | 4.3630 | POSITIVE | COMPLETE |
| 13 | completeness-PARTIAL | 1710 | 2025-12-15 | 5d | Neutral | 68 | 7 | -2.0243 | NEGATIVE | PARTIAL |
| 14 | high-score-negative | 2330 | 2025-10-31 | 20d | Strong | 94 | 10 | -4.0000 | NEGATIVE | COMPLETE |
| 15 | high-score-negative | 1434 | 2025-12-11 | 20d | Strong | 77 | 8 | -0.6250 | NEGATIVE | COMPLETE |
| 16 | high-score-negative | 1560 | 2026-01-07 | 20d | Strong | 94 | 10 | -3.6730 | NEGATIVE | COMPLETE |
| 17 | low-score-positive | 1314 | 2025-10-14 | 20d | LowPriority | 33 | 2 | 14.4033 | POSITIVE | COMPLETE |
| 18 | low-score-positive | 1314 | 2025-10-31 | 20d | LowPriority | 33 | 2 | 9.5872 | POSITIVE | COMPLETE |
| 19 | low-score-positive | 0055 | 2025-12-08 | 20d | LowPriority | 42 | 3 | 6.0786 | POSITIVE | COMPLETE |
| 20 | high-score-positive | 2454 | 2025-12-24 | 20d | Strong | 94 | 10 | 7.6087 | POSITIVE | COMPLETE |
| 21 | high-score-positive | 6415 | 2026-01-13 | 20d | Strong | 94 | 10 | 16.8860 | POSITIVE | COMPLETE |
| 22 | high-score-positive | 1717 | 2025-12-26 | 20d | Strong | 85 | 9 | 56.4677 | POSITIVE | COMPLETE |
| 23 | neutral-or-insufficient | 00891 | 2025-11-12 | 20d | Neutral | 63 | 6 | 3.4429 | POSITIVE | PARTIAL |
| 24 | neutral-or-insufficient | 2317 | 2025-11-06 | 20d | Neutral | 59 | 5 | -7.8629 | NEGATIVE | PARTIAL |
| 25 | completeness-COMPLETE | 1314 | 2025-12-08 | 20d | LowPriority | 33 | 2 | -0.3807 | NEGATIVE | COMPLETE |
| 26 | completeness-PARTIAL | 00891 | 2025-11-12 | 20d | Neutral | 63 | 6 | 3.4429 | POSITIVE | PARTIAL |
| 27 | high-score-negative | 1308 | 2026-01-28 | 60d | Strong | 85 | 9 | -0.7067 | NEGATIVE | COMPLETE |
| 28 | high-score-negative | 1513 | 2025-10-15 | 60d | Strong | 77 | 8 | -7.3482 | NEGATIVE | COMPLETE |
| 29 | high-score-negative | 1605 | 2025-12-24 | 60d | Strong | 94 | 10 | -2.8436 | NEGATIVE | COMPLETE |
| 30 | low-score-positive | 0055 | 2025-11-03 | 60d | LowPriority | 42 | 3 | 5.4248 | POSITIVE | COMPLETE |
| 31 | low-score-positive | 6415 | 2025-11-05 | 60d | LowPriority | 30 | 1 | 42.6190 | POSITIVE | COMPLETE |
| 32 | low-score-positive | 1314 | 2025-10-16 | 60d | LowPriority | 33 | 2 | 9.2798 | POSITIVE | COMPLETE |
| 33 | high-score-positive | 1513 | 2025-10-28 | 60d | Strong | 77 | 8 | 18.7291 | POSITIVE | COMPLETE |
| 34 | high-score-positive | 1560 | 2025-12-01 | 60d | Strong | 77 | 8 | 46.3722 | POSITIVE | COMPLETE |
| 35 | high-score-positive | 2330 | 2025-10-14 | 60d | Strong | 94 | 10 | 17.5439 | POSITIVE | COMPLETE |
| 36 | neutral-or-insufficient | 1402 | 2025-11-10 | 60d | Neutral | 59 | 5 | 3.1540 | POSITIVE | PARTIAL |
| 37 | neutral-or-insufficient | 00891 | 2025-10-15 | 60d | Neutral | 63 | 6 | 13.5121 | POSITIVE | PARTIAL |
| 38 | completeness-COMPLETE | 1210 | 2025-11-06 | 60d | LowPriority | 42 | 3 | -5.2142 | NEGATIVE | COMPLETE |
| 39 | completeness-PARTIAL | 1402 | 2025-11-10 | 60d | Neutral | 59 | 5 | 3.1540 | POSITIVE | PARTIAL |
| 40 | bucket-coverage-Watch | 1536 | 2025-12-02 | 5d | Watch | 21 | 1 | 4.3630 | POSITIVE | COMPLETE |
| 41 | bucket-coverage-Watch | 00712 | 2025-12-02 | 20d | Watch | 29 | 1 | -1.5086 | NEGATIVE | COMPLETE |
| 42 | decile-2-coverage | 1314 | 2025-11-05 | 5d | LowPriority | 33 | 2 | -4.1714 | NEGATIVE | COMPLETE |
| 43 | decile-2-coverage | 1314 | 2025-11-28 | 5d | LowPriority | 33 | 2 | -2.7947 | NEGATIVE | COMPLETE |
| 44 | decile-2-coverage | 2317 | 2026-01-05 | 5d | LowPriority | 36 | 2 | -2.5586 | NEGATIVE | COMPLETE |
| 45 | decile-3-coverage | 00903 | 2025-12-03 | 5d | LowPriority | 38 | 3 | 2.2989 | POSITIVE | COMPLETE |
| 46 | decile-3-coverage | 00903 | 2025-10-31 | 5d | LowPriority | 38 | 3 | -4.9430 | NEGATIVE | COMPLETE |
| 47 | decile-4-coverage | 1319 | 2025-12-12 | 5d | LowPriority | 47 | 4 | 5.3393 | POSITIVE | COMPLETE |
| 48 | decile-4-coverage | 1319 | 2025-10-28 | 5d | LowPriority | 47 | 4 | -0.7128 | NEGATIVE | COMPLETE |
| 49 | decile-4-coverage | 1319 | 2025-11-25 | 5d | LowPriority | 47 | 4 | 3.3613 | POSITIVE | COMPLETE |
| 50 | decile-5-coverage | 1326 | 2025-12-03 | 5d | Neutral | 59 | 5 | -9.5506 | NEGATIVE | PARTIAL |
| 51 | decile-5-coverage | 1402 | 2025-10-30 | 5d | Neutral | 59 | 5 | 0.1855 | FLAT | PARTIAL |
| 52 | decile-5-coverage | 1326 | 2025-10-27 | 5d | Neutral | 59 | 5 | -6.3518 | NEGATIVE | PARTIAL |
| 53 | decile-6-coverage | 00738U | 2025-12-19 | 5d | Neutral | 63 | 6 | 14.7770 | POSITIVE | PARTIAL |
| 54 | decile-6-coverage | 00891 | 2025-12-30 | 5d | Neutral | 63 | 6 | 7.5994 | POSITIVE | PARTIAL |
| 55 | decile-7-coverage | 1710 | 2025-12-15 | 5d | Neutral | 68 | 7 | -2.0243 | NEGATIVE | PARTIAL |
| 56 | decile-8-coverage | 1434 | 2025-10-23 | 5d | Strong | 77 | 8 | -1.9544 | NEGATIVE | COMPLETE |
| 57 | decile-8-coverage | 1560 | 2025-12-16 | 5d | Strong | 77 | 8 | 0.1351 | FLAT | COMPLETE |
| 58 | decile-10-coverage | 1326 | 2026-01-12 | 5d | Strong | 94 | 10 | 7.5501 | POSITIVE | COMPLETE |

---
*Not investment advice. Not a trading system.*