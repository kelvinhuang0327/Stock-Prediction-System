# P2-HARDRESET Walkthrough Sample Cases

**Date:** 2026-05-11
**Total cases:** 30 (5D: 10, 20D: 10, 60D: 10)
**Sampling:** Deterministic (djb2 hash sort, no Math.random())

> **Limitations:** `researchBucket` = always "Neutral", all `scoreSnapshot` = 0.
> These cases are for observational inspection only — no scoring context is available.

---

### Horizon 5D (10 cases)

| # | Symbol | asOfDate | EntryPrice | OutcomeDate | OutcomePrice | returnPct | ReturnClass | priceSource |
|---|--------|----------|-----------|------------|-------------|----------|-------------|-------------|
| 1 | 00738U | 2025-10-14 | 43.58 | 2025-10-21 | 42.1 | -3.3961% | NEGATIVE | stockQuote.close |
| 2 | 00738U | 2025-10-15 | 42.6 | 2025-10-22 | 40.22 | -5.5869% | NEGATIVE | stockQuote.close |
| 3 | 00738U | 2025-10-16 | 43.15 | 2025-10-23 | 39.97 | -7.3696% | NEGATIVE | stockQuote.close |
| 4 | 00738U | 2025-10-20 | 42.22 | 2025-10-27 | 40.03 | -5.1871% | NEGATIVE | stockQuote.close |
| 5 | 00738U | 2025-10-21 | 42.1 | 2025-10-28 | 38.71 | -8.0523% | NEGATIVE | stockQuote.close |
| 6 | 00738U | 2025-10-22 | 40.22 | 2025-10-29 | 39.46 | -1.8896% | NEGATIVE | stockQuote.close |
| 7 | 00738U | 2025-10-27 | 40.03 | 2025-11-03 | 40.32 | +0.7245% | FLAT | stockQuote.close |
| 8 | 00738U | 2025-10-28 | 38.71 | 2025-11-04 | 39.65 | +2.4283% | POSITIVE | stockQuote.close |
| 9 | 00738U | 2025-10-29 | 39.46 | 2025-11-05 | 39.54 | +0.2027% | FLAT | stockQuote.close |
| 10 | 00738U | 2025-10-30 | 39.35 | 2025-11-06 | 39.97 | +1.5756% | POSITIVE | stockQuote.close |

### Horizon 20D (10 cases)

| # | Symbol | asOfDate | EntryPrice | OutcomeDate | OutcomePrice | returnPct | ReturnClass | priceSource |
|---|--------|----------|-----------|------------|-------------|----------|-------------|-------------|
| 1 | 1308 | 2025-10-16 | 12.85 | 2025-11-13 | 13.25 | +3.1128% | POSITIVE | stockQuote.close |
| 2 | 1308 | 2025-10-31 | 12.55 | 2025-11-28 | 13.1 | +4.3825% | POSITIVE | stockQuote.close |
| 3 | 1319 | 2025-11-03 | 97.3 | 2025-12-01 | 95.6 | -1.7472% | NEGATIVE | stockQuote.close |
| 4 | 1319 | 2025-11-04 | 97.5 | 2025-12-02 | 98.4 | +0.9231% | FLAT | stockQuote.close |
| 5 | 1319 | 2025-11-05 | 98.9 | 2025-12-03 | 96.9 | -2.0222% | NEGATIVE | stockQuote.close |
| 6 | 1319 | 2025-11-06 | 99 | 2025-12-04 | 96.3 | -2.7273% | NEGATIVE | stockQuote.close |
| 7 | 1319 | 2025-11-07 | 100 | 2025-12-05 | 96 | -4% | NEGATIVE | stockQuote.close |
| 8 | 1319 | 2025-11-24 | 95.3 | 2025-12-22 | 95.6 | +0.3148% | FLAT | stockQuote.close |
| 9 | 1210 | 2026-02-11 | 51.4 | 2026-03-19 | — | — | MISSING | MISSING |
| 10 | 6415 | 2026-02-11 | 280 | 2026-03-19 | — | — | MISSING | MISSING |

### Horizon 60D (10 cases)

| # | Symbol | asOfDate | EntryPrice | OutcomeDate | OutcomePrice | returnPct | ReturnClass | priceSource |
|---|--------|----------|-----------|------------|-------------|----------|-------------|-------------|
| 1 | 1308 | 2025-10-16 | 12.85 | 2026-01-09 | 12.95 | +0.7782% | FLAT | stockQuote.close |
| 2 | 1308 | 2025-10-23 | 13.7 | 2026-01-16 | 13.8 | +0.7299% | FLAT | stockQuote.close |
| 3 | 1308 | 2025-10-27 | 13.6 | 2026-01-20 | 13.55 | -0.3676% | NEGATIVE | stockQuote.close |
| 4 | 1319 | 2025-11-03 | 97.3 | 2026-01-27 | 115 | +18.1912% | POSITIVE | stockQuote.close |
| 5 | 1319 | 2025-11-04 | 97.5 | 2026-01-28 | 113 | +15.8974% | POSITIVE | stockQuote.close |
| 6 | 1319 | 2025-11-05 | 98.9 | 2026-01-29 | 109 | +10.2123% | POSITIVE | stockQuote.close |
| 7 | 1319 | 2025-11-06 | 99 | 2026-01-30 | 109.5 | +10.6061% | POSITIVE | stockQuote.close |
| 8 | 1319 | 2025-11-28 | 96.8 | 2026-03-03 | 95 | -1.8595% | NEGATIVE | stockQuote.close |
| 9 | 00903 | 2026-02-11 | 16.57 | 2026-05-18 | — | — | MISSING | PENDING |
| 10 | 1560 | 2026-02-11 | 425 | 2026-05-18 | — | — | MISSING | PENDING |


## Field Legend

| Field | Description |
|-------|-------------|
| Symbol | TWSE stock ID |
| asOfDate | Date of prediction snapshot |
| EntryPrice | closePriceAtPrediction (stockQuote.close) |
| OutcomeDate | Resolved outcome date |
| OutcomePrice | Resolved outcome close price |
| returnPct | (outcomePrice − entryPrice) / entryPrice × 100 |
| ReturnClass | NEGATIVE (<0), FLAT (0–1), POSITIVE (>1), MISSING |
| priceSource | stockQuote.close / MISSING / PENDING |

## Limitations

- All cases have `researchBucket = Neutral` (scoring engine default)
- All `scoreSnapshot` values = 0 (scoring engine not run during corpus generation)
- This corpus cannot be used to audit bucket-level or score-level calibration until regenerated with active scoring
- Results are observability-only, not investment insights

---
*P2-HARDRESET Walkthrough — 2026-05-11. Not investment advice.*
