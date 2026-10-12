# P4-03 Regime Transition Analysis

**Records:** 300, **Range:** 2025-01-14 to 2026-05-05

## Distribution

- BEAR: 4 (1.3%)
- BULL: 125 (41.7%)
- HIGH_VOLATILITY: 63 (21.0%)
- SIDEWAYS: 108 (36.0%)

## Latest: 2026-05-05 -> BULL (conf=1.0)

## Transitions (47 total)

- 2025-01-17 -> 2025-01-20: SIDEWAYS -> BULL
- 2025-01-20 -> 2025-01-21: BULL -> SIDEWAYS
- 2025-02-10 -> 2025-02-11: SIDEWAYS -> BULL
- 2025-02-11 -> 2025-02-12: BULL -> SIDEWAYS
- 2025-02-17 -> 2025-02-18: SIDEWAYS -> BULL
- 2025-02-19 -> 2025-02-20: BULL -> SIDEWAYS
- 2025-02-20 -> 2025-02-21: SIDEWAYS -> BULL
- 2025-02-21 -> 2025-02-24: BULL -> SIDEWAYS
- 2025-03-10 -> 2025-03-11: SIDEWAYS -> BEAR
- 2025-03-11 -> 2025-03-12: BEAR -> SIDEWAYS
- 2025-03-12 -> 2025-03-13: SIDEWAYS -> BEAR
- 2025-03-13 -> 2025-03-14: BEAR -> SIDEWAYS
- 2025-03-27 -> 2025-03-28: SIDEWAYS -> BEAR
- 2025-03-31 -> 2025-04-01: BEAR -> SIDEWAYS
- 2025-04-02 -> 2025-04-07: SIDEWAYS -> HIGH_VOLATILITY

## Longest Continuous: BULL (48 days, 2025-09-03 to 2025-11-13)

## Caveats

- HIGH_VOLATILITY overrides BULL/BEAR/SIDEWAYS when vol_20d_annualized > 30pct
- No return calculations performed - classification only
- No profitability claim is made for any regime
- Breadth proxy missing for 8 of 300 dates
- This is pattern description only, not strategy validation
