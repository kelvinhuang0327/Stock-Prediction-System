# P4-02 Next Execution Order
**Generated:** 2026-05-06  
**Task:** P4-02 — PIT-Safe Cross-Table Data Foundation Expansion  
**Classification:** P4_02_PIT_SAFE_DATA_FOUNDATION_COMPLETE

---

## Current State Summary

| Component | Status | Evidence |
|-----------|--------|---------|
| Date normalization | ✅ DONE | 100% ISO in StockQuote, MarketIndex, StockMetrics |
| TAIEX freshness | ✅ DONE | 766 trading days, max 2026-05-05 |
| Cross-table availability audit | ✅ DONE | p4_02_cross_table_availability_audit.json |
| Feature contract (31 features) | ✅ DONE | p4_02_feature_contract.json |
| Feature builder script | ✅ DONE | scripts/build-p4-feature-foundation.py (dry-run + output verified) |
| Feature matrix sample | ✅ DONE | p4_02_feature_matrix_sample.json (6000 rows, 50 symbols x 120 days) |
| PIT safety rules | ✅ DONE | p4_02_pit_safety_rules.md |
| Readiness decision | ✅ DONE | p4_02_readiness_decision.json |

---

## P0 — Must Execute Next (Immediate)

### P4-03: Market Regime Classifier
**Priority:** P0  
**Status:** UNBLOCKED — can start immediately  
**Rationale:** 16 features ready, TAIEX 766 days, StockQuote 185 symbols ≥500d, PIT rules documented  

Inputs ready:
- `outputs/stock_data_expansion/p4_02_feature_contract.json` (feature definitions)
- `outputs/stock_data_expansion/p4_02_pit_safety_rules.md` (PIT rules)
- `scripts/build-p4-feature-foundation.py` (feature builder, can be extended)
- `prisma/dev.db` (TAIEX + StockQuote aligned, 100% ISO)

Expected deliverables:
- Market regime classifier (bull / bear / sideways / high-volatility)
- Regime signal using TAIEX features (ma50/ma200 crossover, volatility, breadth)
- Integration with feature matrix pipeline
- No hypothesis claim, no strategy signal

---

## P1 — High Priority (Current Sprint)

### T-05 Redesign: Portfolio Walk-Forward Skeleton
**Priority:** P1  
**Status:** NEEDS_REDESIGN (H001-H012 retired; old WalkForwardResult schema no longer applicable)  
**Rationale:** T-05 is deprecated but the scaffold is needed for P4-04 when chip/revenue/financial data is ready  

Expected deliverables:
- Portfolio walk-forward skeleton (rule-only, no hypothesis)
- Uses 16 P4_03_READY features as inputs
- PIT-safe date windowing
- No backtest claims, no signal promotion

### InstitutionalChip Backfill (Unblock P4-04)
**Priority:** P1 (parallel, not blocking P4-03)  
**Status:** SCRIPT_EXISTS_BUT_NEEDS_FIX (`bulk-history-sync.py` fails on `twstock` import)  
**Gap:** 264 trading days (need 500, have 236)  
**Action required:** Fix or replace chip sync script to use stdlib (no external packages)

---

## P2 — Medium Priority (Next Sprint)

### MonthlyRevenue Backfill
**Priority:** P2  
**Status:** INSUFFICIENT_HISTORY (2 months → need 13+)  
**Action:** Build or fix revenue sync script; add announcement lag field to schema if possible

### FinancialReport Backfill
**Priority:** P2  
**Status:** LIMITED_COVERAGE (1 quarter → need 8+)  
**Action:** Build or fix financial report sync script; add ROE/balance-sheet fields to schema

### T-01 Scheduler Heartbeat
**Priority:** P2  
**Status:** PARTIAL (lane scheduler exists, no heartbeat/watchdog; 2 stuck jobs)  
**Action:** Add heartbeat mechanism, resolve stuck jobs in scheduler

### T-02 Freshness Guard
**Priority:** P2  
**Status:** PARTIAL (per-stock freshness exists, no system-wide gate)  
**Action:** Add system-level dataCoverage write + freshness gate before daily ops

---

## Deprecated / Do Not Pursue

| Task | Status | Reason |
|------|--------|--------|
| H001-H012 validation | DEPRECATED | All retired in P3-14 |
| WalkForwardResult backfill (old schema) | DEPRECATED | startDate/endDate columns missing; strategy retired |
| ROE / debt_ratio features | DO_NOT_USE | Schema missing equity/balance-sheet fields |
| any new hypothesis (H013+) | PROHIBITED | No hypothesis design until P4 foundation complete |

---

## Execution Order

```
[TODAY/IMMEDIATE]
P4-03 Market Regime Classifier         ← P0, unblocked
T-05 Portfolio Walk-Forward Skeleton   ← P1, parallel

[NEXT SPRINT]
InstitutionalChip backfill fix         ← P1, unblocks P4-04
MonthlyRevenue backfill                ← P2
FinancialReport backfill               ← P2
T-01 heartbeat                         ← P2
T-02 freshness gate                    ← P2

[AFTER P4-04 DATA READY]
P4-04 Portfolio Walk-Forward w/Chip    ← blocked until chip >= 500d
```

---

## Risk Register

| Risk | Severity | Mitigation |
|------|----------|-----------|
| InstitutionalChip backfill script broken (twstock dependency) | HIGH | Rewrite using TWSE API + stdlib urllib |
| MonthlyRevenue / FinancialReport schema lacks announcement date | MEDIUM | Apply conservative lag; document as approximation |
| TAIEX freshness gap (max 2026-05-05 vs StockQuote max 2026-05-18) | LOW | 13-day gap; acceptable for P4-03 prototype |
| ETF epoch anomaly (~1,355 rows date=1970-12-04) | LOW | Pre-existing, not fixed; filter in queries |
| industry_code missing for 274 stocks (20%) | LOW | Use NULL-safe join; document coverage |
