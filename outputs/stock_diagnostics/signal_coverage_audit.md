# P3-12 Signal Coverage & Universe Expansion Audit

> as_of_date: 2026-05-01  |  Generated: 2026-05-05T10:30:38.683221+00:00

---

## 1. Universe Summary

| Metric | Count |
|---|---|
| Total symbols in DB | 1357 |
| Symbols ≥ 150 rows | 248 |
| Symbols ≥ 300 rows | 237 |
| Symbols ≥ 500 rows | 118 |
| Stock-like ≥ 500 rows | 112 |
| ETF-like ≥ 500 rows | 6 |
| **Symbols tested in P3-11** | **8** |
| **Untested eligible (≥300)** | **229** |

> ⚠️ **P3-11 tested only 8 of 237 eligible symbols.**
> This is 3.4% of the available universe.

---

## 2. Candidate Coverage Summaries

| Candidate | Total Signals | Avg Rate | Symbols w/ Signal | DI Windows | Failure Mode |
|---|---|---|---|---|---|
| STOCK_H009_PULLBACK_10D_HOLD | 1850 | 13.05% | 60 | 31/60 | `DATA_TOO_SHORT` |
| STOCK_H010_MOM_MODERATE_VOLUME | 2584 | 15.21% | 60 | 22/60 | `SIGNAL_NOISY` |
| STOCK_H011_NEAR_BREAKOUT_LOW_VOL | 1308 | 7.19% | 51 | 47/60 | `DATA_TOO_SHORT` |
| STOCK_H012_RSI_REVERSION_PROBE | 340 | 54.59% | 2 | 58/60 | `DATA_TOO_SHORT` |

---

## 3. P3-11 (8 symbols) vs Full Universe Comparison

| Scope | Symbols | Total Signals |
|---|---|---|
| P3-11 (8 symbols) | 8 | 2089 |
| Remaining eligible | 22 | 3993 |
| **Multiplier** | — | **1.9×** |

---

## 4. Window Design — Data Insufficiency Rates

| Window | Total Tests | DI Count | DI Rate |
|---|---|---|---|
| 150d | 120 | 110 | 91.7% |
| 500d | 120 | 48 | 40.0% |

---

## 5. Top Blocking Conditions

| Condition | Occurrence Count |
|---|---|
| `volume_zscore_gt_0p5` | 60 |
| `symbol_in_scope` | 58 |
| `return_5d_lt_0` | 32 |
| `close_near_breakout_0p98` | 32 |
| `volatility_low_p25` | 28 |
| `close_gt_ma60` | 22 |
| `return_20d_gt_0` | 6 |
| `rsi_oversold_lt30` | 2 |

---

## 6. Condition Attribution (500d window, cross-symbol average)

**STOCK_H009_PULLBACK_10D_HOLD**:

| Condition | Pass Rate |
|---|---|
| `close_gt_ma60` | 47.90% |
| `return_5d_lt_0` | 49.19% |
| `return_20d_gt_0` | 48.63% |
| `all_conditions` | 11.58% |

**STOCK_H010_MOM_MODERATE_VOLUME**:

| Condition | Pass Rate |
|---|---|
| `return_20d_gt_0` | 49.53% |
| `volume_zscore_gt_0p5` | 24.11% |
| `all_conditions` | 13.75% |

**STOCK_H011_NEAR_BREAKOUT_LOW_VOL**:

| Condition | Pass Rate |
|---|---|
| `volatility_low_p25` | 26.89% |
| `close_near_breakout_0p98` | 21.19% |
| `all_conditions` | 8.20% |

**STOCK_H012_RSI_REVERSION_PROBE**:

| Condition | Pass Rate |
|---|---|
| `symbol_in_scope` | 3.33% |
| `all_conditions` | 1.79% |
| `rsi_oversold_lt30` | 23.52% |
| `rsi_overbought_gt70` | 30.27% |
