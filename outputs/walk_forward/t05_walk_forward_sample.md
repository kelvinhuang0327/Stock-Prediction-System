# T-05 Walk-Forward Sample

Generated: 2026-05-06 | Source: build-portfolio-walk-forward-skeleton.py

## Summary

| Metric | Value |
|--------|-------|
| Total asof dates | 120 |
| Date range | 2025-10-15 to 2026-05-06 |
| Average portfolio size | 8.87 |
| Low confidence days | 0 |
| Missing regime days | 0 |
| Dates with data quality flags | 9 |
| Dates with forbidden logic flags | 0 |

## Regime Distribution

| Label | Count | % |
|-------|-------|---|
| BULL | 71 | 59.2% |
| HIGH_VOLATILITY | 40 | 33.3% |
| SIDEWAYS | 9 | 7.5% |

## Sample Records (first 5 and last 5)

### First 5
- 2025-10-15: BULL (conf=1.0) portfolio=10 candidates=['1101', '1102', '1210']...
- 2025-10-16: BULL (conf=1.0) portfolio=10 candidates=['1101', '1102', '1210']...
- 2025-10-17: BULL (conf=0.8462) portfolio=10 candidates=['1101', '1102', '1210']...
- 2025-10-20: BULL (conf=1.0) portfolio=10 candidates=['1101', '1102', '1210']...
- 2025-10-21: BULL (conf=1.0) portfolio=10 candidates=['1101', '1102', '1210']...

### Last 5
- 2026-04-29: BULL (conf=0.9231) portfolio=10 candidates=['01001T', '01002T', '01004T']...
- 2026-04-30: BULL (conf=0.8462) portfolio=10 candidates=['01001T', '01002T', '01004T']...
- 2026-05-04: BULL (conf=1.0) portfolio=10 candidates=['01001T', '01002T', '01004T']...
- 2026-05-05: BULL (conf=0.8462) portfolio=0 candidates=[]...
- 2026-05-06: BULL (conf=0.8462) portfolio=0 candidates=[]...

## Safety Guardrails

- All records: asof_date <= 2026-05-06 (no future dates)
- All records: portfolio_size <= 10
- All records: forbidden_logic_flags all false
- No buy/sell/signal/roi/win_rate fields
- No H001-H012 references
- Candidate selection: deterministic_alphabetical_mock (no optimization)
