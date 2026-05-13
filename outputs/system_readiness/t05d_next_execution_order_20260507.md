# T-05D Next Execution Order — 2026-05-07

**Task:** T-05D Taiwan Trading Calendar Adapter  
**Status:** T05D_TAIWAN_TRADING_CALENDAR_ADAPTER_COMPLETE  
**Labels:** Taiwan trading calendar adapter | deterministic calendar | static override contract  
**Labels:** no external API | no DB write | no LLM call | no strategy mutation | no performance claim | no edge claim

---

## Completed This Session

| Task | Status |
|---|---|
| T-05B Walk-Forward Skeleton v2 | ✅ COMPLETE (45/45) |
| T-05C Regime Context Loader | ✅ COMPLETE (45/45) |
| T-05D Taiwan Trading Calendar Adapter | ✅ COMPLETE (48/48) |

**Full regression: 10 suites / 227 tests PASS**

---

## Next Execution Order

### Priority 1 — T-05E: PIT-safe Candidate Data Adapter

- Build point-in-time safe candidate data adapter for WalkForwardEngine
- No look-ahead bias in candidate data loading
- No external API, no DB write, no LLM
- Observability only — not a strategy

### Priority 2 — T-06: Portfolio Skeleton Backtest Runner (after T-05E)

- Wire T-05B + T-05C + T-05D + T-05E together
- Still observability only at this stage
- No performance conclusions, no ROI claims

---

## Guardrails Inherited by T-05E

- Must not introduce strategy validation
- Must not calculate ROI / win-rate / alpha / edge / profit
- Must not write to DB
- Must not call external API
- Must not call LLM
- Must use resolveCurrentDate() — no hardcoded date cap
- Must not output H001-H012

---

## Risk Notes

- Static holiday list (2024-2026) requires annual maintenance
- Calendar adapter without official TWSE data requires periodic human review
- Taiwan trading calendar adapter ≠ production backtest
- T-05B ranking is still deterministic rule-only sorting (not strategy)
- T-05C loader coverage depends on MarketRegimeResult DB backfill status
