# P4-03 Next Execution Order

Generated: 2026-05-06 | Current Task: P4-03 COMPLETE

## Known Gaps

| Gap | Impact | Priority |
|-----|--------|----------|
| TAIEX stale (max=2026-05-05, StockQuote=2026-05-18) | 13-day regime gap | HIGH |
| Chip features only 236 days (need 500) | P4-04 blocked | MEDIUM |
| Revenue only 2 months | P4-04 blocked | MEDIUM |
| T-05 walk-forward needs redesign (H001-H012 retired) | Portfolio blocked | MEDIUM |

## Recommended Next Round Order

Option A (Recommended): Data first
1. P4-03b - TAIEX backfill (2026-05-06 to 2026-05-18) via TWSE FMTQIK
2. T-05 Redesign - Portfolio walk-forward skeleton with regime context
3. P4-04 Planning - when data becomes sufficient

Option B: Walk-forward first
1. T-05 Redesign - Portfolio walk-forward skeleton
2. P4-03b - TAIEX backfill
3. P4-04 Planning

## What Must NOT Happen

- No strategy threshold optimization
- No buy/sell signal generation
- No H013+ hypothesis design
- No production DB writes without explicit mandate
- No chip/revenue/financial features in production signals
