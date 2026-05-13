# Hypothesis Failure Diagnostics

> Batch date: 20260501  |  Generated: 2026-05-05T09:58:35Z

| Hypothesis | Total Signals | Avg ROI | Avg Sharpe | Perm Pass | BH-FDR Pass | DI Count | Failure Reason |
|---|---|---|---|---|---|---|---|
| STOCK_H001_20D_MOMENTUM | 3000 | -0.478 | -0.682 | 1 | 0 | 0 | `NEGATIVE_ROI` |
| STOCK_H002_RSI_REVERSION | 1688 | -0.327 | -0.534 | 0 | 0 | 0 | `NEGATIVE_ROI` |
| STOCK_H003_VOLUME_BREAKOUT | 168 | 0.267 | 2.606 | 0 | 0 | 5 | `DATA_INSUFFICIENT` |
| STOCK_H004_MOM_VOL_CONFIRM | 103 | -0.058 | -0.368 | 0 | 0 | 2 | `DATA_INSUFFICIENT` |
| STOCK_H005_PULLBACK_UPTREND | 182 | 0.132 | 0.603 | 0 | 0 | 1 | `MIXED_WEAK_SIGNAL` |
| STOCK_H006_LOW_VOL_BREAKOUT | 48 | 1.164 | 6.516 | 0 | 0 | 2 | `DATA_INSUFFICIENT` |
| STOCK_H007_RELATIVE_STRENGTH | 0 | 0.000 | 0.000 | 0 | 0 | 4 | `DATA_INSUFFICIENT` |
| STOCK_H008_ETF_DEF_MOMENTUM | 391 | -0.033 | -0.155 | 1 | 1 | 2 | `DATA_INSUFFICIENT` |

---

## Full Diagnostics

See `hypothesis_failure_diagnostics.json` for complete per-hypothesis data.
See `symbol_diagnostics.json` for symbol-level breakdown.
See `feature_diagnostics.json` for feature-level analysis.
See `hypothesis_improvement_recommendations.md` for recommendations.