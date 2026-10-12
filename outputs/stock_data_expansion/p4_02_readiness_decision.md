# P4-02 Readiness Decision
**Generated:** 2026-05-06  
**Task:** P4-02 — PIT-Safe Cross-Table Data Foundation Expansion

---

## Q1: P4-03 是否可以用目前 data foundation 開始？

**✅ YES — P4-03 CAN START**

Evidence:
- TAIEX: 766 trading days (exceeds 500d requirement)
- StockQuote: 185 symbols with ≥500 trading days
- MarketIndex ↔ StockQuote: 727 overlapping dates — JOIN safe
- 16 features are P4_03_READY
- All date fields 100% ISO — no date format blocker
- `build-p4-feature-foundation.py` executes successfully (dry-run + output verified)

---

## Q2: 哪些 features 可用於 P4-03？

16 features (all P4_03_READY):

**Price / OHLCV (6):**
`daily_return`, `close_to_ma20`, `close_to_ma60`, `volume_ratio_20d`, `volatility_20d`, `volatility_60d`

**Market Regime (6):**
`taiex_return_1d`, `taiex_return_20d`, `taiex_ma50`, `taiex_ma200`, `taiex_volatility_20d`, `market_breadth_proxy`

**Industry / Sector (4):**
`industry_code`, `industry_name`, `sector_group`, `sector_index_return`

---

## Q3: 哪些 features 可用於 portfolio walk-forward skeleton？

Same 16 features as P4-03. T-05 (old H001-H012 walk-forward) is deprecated.  
Portfolio walk-forward redesign (P4-04) must be redesigned around these 16 features first,  
with chip/revenue/financial features added when coverage is sufficient.

---

## Q4: 哪些 features 只能 prototype？

8 PROTOTYPE_ONLY features:
- **Chip (5):** `foreign_net_buy`, `investment_trust_net_buy`, `dealer_net_buy`, `chip_net_buy_5d`, `chip_net_buy_20d`
  - Reason: 236 trading days only (need 500)
- **Financial (2):** `eps`, `latest_financial_report_asof`
  - Reason: 2025-Q4 only (1 quarter), cannot compute trend
- **Revenue (1):** `latest_revenue_available_asof`
  - Reason: 2 months only, very limited lookup

---

## Q5: 哪些 features 必須 deferred？

5 DEFERRED features:
- **Revenue (3):** `revenue_yoy`, `revenue_mom`, `revenue_growth_trend_3m`
  - Reason: Need ≥13 months; currently 2 months
- **Financial (2):** `gross_margin`, `operating_margin`
  - Reason: Currently NULL in database

Plus 2 DO_NOT_USE: `roe`, `debt_ratio` — schema missing equity/balance-sheet fields

---

## Q6: 是否仍有 P0 blocker？

**❌ No P0 blockers remain for P4-03.**

Resolved in P4-02P0:
- Date normalization complete (100% ISO)
- TAIEX freshness repaired (+32 rows, max 2026-05-05)
- MarketIndex/StockQuote alignment verified

---

## Q7: P4-04 是否仍 blocked？

**✅ YES — P4-04 REMAINS BLOCKED**

| Data Source | Current | Required | Gap | Status |
|-------------|---------|----------|-----|--------|
| InstitutionalChip | 236 days | 500 days | 264 days | BLOCKED |
| MonthlyRevenue | 2 months | 13 months | 11 months | INSUFFICIENT_HISTORY |
| FinancialReport | 1 quarter | 8 quarters | 7 quarters | LIMITED_COVERAGE |
| T-05 walk-forward | DEPRECATED | redesign needed | — | NEEDS_REDESIGN |

---

## Q8: 下一輪應做 P4-03 還是 T-05 redesign？

**Primary: P4-03 Market Regime Classifier**  
**Parallel: T-05 redesign as portfolio walk-forward skeleton (P4-04 prep)**

Rationale:
- P4-03 has 16 ready features and sufficient TAIEX depth (766d)
- T-05 redesign is lightweight and can run in parallel
- P4-04 data backfill (chip / revenue / financial) can proceed independently
- No benefit from delaying P4-03 to wait for P4-04 data

---

## Q9: 是否需要先補 InstitutionalChip / MonthlyRevenue / FinancialReport？

**No — not required for P4-03.** These are P4-04 prerequisites only.

However, backfilling chip data can start in parallel (it does not block P4-03):
- InstitutionalChip backfill would require a working sync script (currently `bulk-history-sync.py` fails on `twstock` import)
- MonthlyRevenue / FinancialReport backfill scripts classified as `SCRIPT_EXISTS_BUT_NEEDS_FIX` or `NO_BACKFILL_SCRIPT`

---

## Q10: 是否存在 PIT leakage 風險？

**❌ No PIT leakage detected in current implementation.**

Verified:
- `build-p4-feature-foundation.py` applies strict `date <= asof_date` filter
- MarketIndex: NULL fallback on missing dates (no forward-fill)
- MonthlyRevenue: conservative (M+1)-15 lag applied (approximation documented)
- FinancialReport: TWSE quarterly announcement lag applied (approximation documented)
- InstitutionalChip: T+1 lag (date < asof_date) applied
- Feature matrix output: 0 future-date rows (verified by PIT check in script)

Residual risk:
- MonthlyRevenue / FinancialReport lags are approximations (schema has no announcement date)
- If actual disclosure dates are earlier than assumed, conservative lag may still allow look-ahead for some stocks
- This risk is documented and tagged as `PIT_SAFE_WITH_ASOF_LAG` (not PIT_SAFE)

---

## Final Verdict

| Decision | Verdict |
|----------|---------|
| P4-03 can start | ✅ YES |
| P4-04 blocked | ✅ YES (264 chip days / 11 revenue months / 7 quarters short) |
| P0 blockers remain | ❌ NONE |
| PIT leakage in current implementation | ❌ NONE |
| Next round | **P4-03 Market Regime Classifier** |
| Parallel action | T-05 redesign as portfolio walk-forward skeleton |
