# P4-03 Market Regime Classifier Contract

**Program:** Stock Prediction System  
**Task:** P4- PIT-Safe Market Regime Classifier  03 
**Generated:** 2026-05-06  
**Version:** 1.0  

---

## Allowed Labels

| Label | Priority | Description |
|-------|----------|-------------|
| `LOW_CONFIDENCE` | 1 (checked first) | Missing TAIEX or < 50 rows; confidence = 0.0 |
| `HIGH_VOLATILITY` | 2 (override) | taiex_vol_20d > 30% annualized |
| `BULL` | 3 |  0.70 |bullRatio 
| `BEAR` | 4 |  0.70 |bearRatio 
| `SIDEWAYS` | 5 (residual) | Neither BULL nor BEAR threshold met |

## Confidence Range

**0.0 to 1.0** (normalized; note: existing TypeScript engine uses 100)0

## Allowed Features (P4_03_READY Only)

- Price/OHLCV: daily_return, close_to_ma20, close_to_ma60, volume_ratio_20d, volatility_20d, volatility_60d
- Market regime: taiex_return_1d, taiex_return_20d, taiex_ma50, taiex_ma200, taiex_volatility_20d, market_breadth_proxy
- Industry/sector: industry_code, industry_name, sector_group, sector_index_return

## Prohibited Features

chip, revenue, financial  all DO_NOT_USE or PROTOTYPE_ONLY per P4-02.features 

## Scoring Logic

| Factor | Weight | BULL condition | BEAR condition |
|--------|--------|----------------|----------------|
| price_vs_ma50 | 2 | close > ma50 | close < ma50 |
| price_vs_ma200 | 3 | close > ma200 | close < ma200 |
| ma50_vs_ma200 | 2 | ma50 > ma200 | ma50 < ma200 |
| momentum_20d | 2 | return > +2% | return < -2% |
| momentum_60d | 2 | return > +5% | return < -5% |
| breadth | 2 |  0.50 | breadth < 0.45 |breadth 

**Max score = 13 (all weights summed)**  
**BULL:** bullRatio = bull_score/max_ 0.70  score 
**BEAR:** bearRatio = bear_score/max_ 0.70  score 
**SIDEWAYS:** residual  

## PIT Safety Rules

1. All rolling calculations use only rows WHERE date <= asof_date.
2. Ascending-sorted historical slice; no future data.
 LOW_CONFIDENCE; no forward-fill.
 confidence  0.60.
5. volatility_20d = std(daily_returns[-20:])  sqrt(252), all from date <= asof_date.

## Prohibited Operations

No backtest, ROI, win-rate, buy/sell signal, threshold optimization from returns,
future date usage, chip/revenue/financial features, forward-fill of missing data.
