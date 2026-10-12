# P4-02P0 — Next Execution Decision

**Date**: 2026-05-06  
**Authored by**: Worker Agent (P4-02P0)  
**Basis**: Direct SQLite evidence + script execution results

---

## Decision Summary

| Question | Answer |
|---|---|
| **P4-02 can start?** | ✅ **YES** |
| **P4-03 can start?** | ✅ **YES** |
| **P4-04 still blocked?** | ❌ **YES — BLOCKED** |
| **MarketIndex / TAIEX meets regime classifier minimum?** | ✅ **YES** (766 days, gap=1d) |
| **StockQuote / MarketIndex can JOIN by date?** | ✅ **YES** (both 100% ISO) |
| **Remaining P0 blockers?** | **None** |

---

## Evidence for Each Decision

### P4-02 CAN START
- StockQuote: 129,151 rows, **100% ISO**, 185 symbols ≥500 trading days
- MarketIndex: 2,665 rows, **100% ISO**
- Cross-table JOIN on `date` is now **safe**
- No UNKNOWN_FORMAT blockers
- Industry sector mapping available (heuristic, 33 codes)

### P4-03 CAN START
- TAIEX: **766 distinct trading days** (requirement: 500) ✅
- TAIEX **max date: 2026-05-05**, freshness gap: **1 day** ✅
- TAIEX date range: 2017-12-01 → 2026-05-05
- 21+ sector indices available in MarketIndex
- Date overlap with StockQuote: **727 trading dates** ✅

### P4-04 REMAINS BLOCKED
Three separate blockers, all must be resolved:
1. **InstitutionalChip**: 236 distinct trading days → needs ≥500 → gap ~264 days
   - Backfill script requires `twstock` (unavailable in current Python 3.14 externally managed env)
2. **MonthlyRevenue**: only 2026 data → needs 2020–2025 historical backfill
3. **FinancialReport**: only 2025 data → needs 2020–2024 historical backfill
4. **T-05 Walk-Forward**: H001-H012 all retired → 522 existing WalkForwardResult rows are deprecated → must redesign as portfolio walk-forward (P4-04 scope)

---

## Next 5 Tasks — Ordered by Priority

### P0 — Immediate (Execute Next)

**P4-02**: Data Foundation Expansion  
> Build the feature engineering pipeline foundation: cross-table joins using date-aligned StockQuote + MarketIndex, sector grouping via industry code mapping, basic derived features (returns, volatility, relative strength). Target: produce a clean, JOIN-safe feature dataset for 185+ symbols ≥500 days.

**P4-03**: Market Regime Classifier  
> Implement a simple market regime model using TAIEX (766 days available, ≥500 sufficient). Classify market states: bull / sideways / bear using TAIEX rolling return + volatility. No hypothesis required — this is an infrastructure-level regime signal. Can run in parallel with P4-02.

### P1 — Next (After P4-02/P4-03)

**P4-04 Pre-requisite: Chip Backfill Fix**  
> Resolve `twstock` dependency blocker. Options: (a) install `twstock` in a dedicated venv, (b) replace with direct TWSE HTTP fetcher using stdlib `urllib`, (c) use TWSE alternative data API. Then run InstitutionalChip backfill for 2021–2024 (~1,300 days). Verify MonthlyRevenue and FinancialReport historical backfill via same mechanism.

**T-01 Completion: Lane-based Scheduler Heartbeat**  
> `TrainingScheduler.ts` is PARTIAL — 4 lanes exist but no heartbeat/watchdog. Two jobs are stuck in "running" state in JobRunLog. Add heartbeat mechanism and auto-recovery for stuck jobs. Required for Phase 1 Stabilization.

**T-02 Completion: Unified Freshness Guard**  
> `AutonomousDataLayer.ts` has per-stock freshness but no unified system-wide gate. Add `systemFreshnessGate()` that returns a single boolean and blocks downstream pipeline if any critical table is stale. Required for Phase 1 Stabilization.

### P2 — Deferred

- **T-05 Redesign (Portfolio Walk-Forward)**: Requires P4-04 data foundation. Deprioritize until InstitutionalChip ≥500 days and FinancialReport historical data are available.
- **Extended Industry Crosswalk**: Current heuristic mapping sufficient for P4-03; official TWSE XML crosswalk import is a nice-to-have, not a blocker.
- **ETF epoch anomaly fix (1970-12-04 rows)**: Low risk, low urgency; fix after P4-02/P4-03 are stable.

### Deprecated / Do Not Continue

- **H001–H012 validation / signal promotion**: All hypotheses retired as of 2026-05-05. WalkForwardResult rows for H001-H012 are historical artifacts only — do not reuse.
- **Original T-05 (signal-level walk-forward)**: Deprecated. The 522 WalkForwardResult rows belong to retired hypotheses. Must redesign as portfolio walk-forward in P4-04.
- **bulk-history-sync.py as primary sync tool**: Blocked by `twstock` dependency. Use TWSE stdlib-based fallbacks until environment is resolved.

---

## Risk Register

| Risk | Severity | Mitigation |
|---|---|---|
| `twstock` unavailable → InstitutionalChip backfill blocked | HIGH | Build urllib-based TWSE chip fetcher (same approach used for TAIEX refresh) |
| TAIEX gap of ~9 trading days (2026-05-06 to 2026-05-18) | LOW | TWSE publishes with 1-day lag; run monthly sync; not a P4-03 blocker |
| StockQuote epoch date anomaly (1970-12-04) | LOW | Pre-existing; does not affect 100% ISO ratio; fix separately |
| Python 3.14 externally managed — cannot pip install | MEDIUM | Use `python3 -m venv` or `--break-system-packages` only for approved packages |

---

## Phase 1 Stabilization Status (For Reference)

| Task | Status |
|---|---|
| T-01 Lane scheduler + heartbeat | PARTIAL — needs heartbeat + stuck-job recovery |
| T-02 Unified freshness guard | PARTIAL — needs system-wide gate |
| T-03 Daily Ops Report | ✅ DONE |
| T-04 LLM hard-off + missing-taskId alert | ✅ DONE |
| T-05 Walk-forward skeleton | DEPRECATED — redesign in P4-04 |
