# GBGF Stock Project — Guardrail Note

**Document:** Stock Project Guardrail Note  
**Version:** 1.0  
**Date:** 2026-05-05  
**Task:** P3-03  
**Classification:** MANDATORY_READ — Read before any stock research or deployment  

---

## ⚠️ WARNING: Read This Entire Document Before Using GBGF in a Stock Project

---

### 1. GBGF Does Not Guarantee Profit

The Generic Backtest & Governance Framework (GBGF) is a **research governance tool**.  
It validates whether a hypothesis is testable and reproducible.  
It does **not** guarantee that any strategy will be profitable in live trading.  
A strategy passing G01–G10 is necessary but **not sufficient** for live deployment.

---

### 2. Stock POC Is a Framework Smoke Test Only

The Stock POC (`STOCK_POC_SIMPLE_20D_MOMENTUM_001`) was created to:
- Verify that GBGF can accept a non-lottery domain
- Verify that G01–G10 gates can process stock data
- Verify that G09 and G10 correctly block unauthorized production writes

**The Stock POC is not a validated trading strategy.**  
It uses synthetic mock data. It has **no real edge**.  
G03 correctly FAILs on this mock data, which is the expected result.

---

### 3. Mock Data Results Are Not Representative

The `sample_stock_ohlcv.csv` contains **randomly generated price data**.  
Any results computed from this file (Sharpe, CAGR, win rate) are **illustrative only**.  
They do not represent performance of any real stock strategy.  
The `mock_data=true` flag is set in all outputs for this reason.

---

### 4. Real Stock Data Must Be Point-In-Time (PIT)

Any real stock research must use **point-in-time data**:

- Fundamentals must be available as they were **known at the time of decision**, not retroactively restated
- Financial statement data must use the **original release date**, not the revised version
- Index compositions must reflect membership **at the time**, not hindsight
- The `data_is_point_in_time` flag must be `true` for all real data rows
- Using non-PIT data **invalidates all backtest results** — this is a HIGH-severity risk (R02)

---

### 5. Survivorship Bias Must Be Handled

Any stock universe must include **delisted and bankrupt companies**:

- Using only currently-listed stocks introduces systematic upward bias
- This makes any backtest result appear better than reality
- The `SurvivorshipGuard` component must be implemented before any real backtest
- This risk is classified HIGH severity (R03) in the domain risk register

---

### 6. Transaction Costs and Slippage Must Be Modeled

The POC assumes a flat `10bps` transaction cost as a placeholder.  
Real trading costs include:
- Bid-ask spread (varies by liquidity)
- Market impact (large trades move the price)
- Brokerage commissions
- Short-selling costs (for short strategies)
- Borrowing fees

**A strategy that ignores transaction costs is not a valid strategy.**  
The `TransactionCostModel` must be implemented before any production consideration.

---

### 7. Production Write and Order Placement Are Prohibited by Default

The GBGF production write guard (`gbgf/production_write_guard.py`) enforces:

- G09 is **BLOCKED** by default — no production write without explicit human authorization
- G10 is **BLOCKED** — no auto-approval without documented human review
- `is_trading_recommendation=False` must be confirmed in all gate outputs
- `production_write=False` must be confirmed in all gate outputs

**Connecting GBGF to any brokerage API or order management system requires:**
1. Full G01–G10 PASS (not just smoke test)
2. Real PIT data validation
3. SurvivorshipGuard active
4. TransactionCostModel validated
5. Authorized human review sign-off
6. Documented G09 clearance with reviewer name and date

---

### 8. Human Review Is Required Before Any Production Integration

The GBGF is designed so that **no system can autonomously approve its own strategy**.  
G10 (Human Review Gate) **never auto-passes**.  
Before any production integration:

- A human reviewer must inspect all gate results
- The reviewer must sign off on the reproducibility pack
- The review must be documented with name, date, and decision
- This requirement exists regardless of how many times the dry-run passes

---

### 9. Lottery Strategy Concepts Must Not Be Transferred to Stock

The GBGF originated in lottery research (LotteryNew). The following concepts **do not apply to stocks**:

| Lottery Concept | Why It Doesn't Apply to Stock |
|---|---|
| Hot/cold number analysis | Stocks are not i.i.d. lottery draws — market structure differs |
| Draw frequency patterns | Stock returns have autocorrelation, volatility clustering |
| Payout skew optimization | Stock instruments have different payoff structures |
| H6 gate hypothesis | H6 was lottery-specific; not a stock factor |
| DAILY_539 patterns | Taiwan lottery rules; not a stock market phenomenon |

**Do not reuse lottery strategy logic for stocks.** Build fresh hypotheses validated through G01 (hypothesis pre-registration).

---

### 10. Summary of Prohibitions

| Prohibited Action | Enforced By |
|---|---|
| Production write without human review | G09 (BLOCKED), ProductionWriteGuard |
| Order placement without authorization | G09 + G10 |
| Claiming strategy is profitable | G06 EV Gate, this document |
| Using non-PIT data | G02, LeakageDetector |
| Ignoring survivorship bias | G02, SurvivorshipGuard |
| Ignoring transaction costs | G06, TransactionCostModel |
| Reusing lottery strategy concepts | This document, G01 hypothesis pre-registration |
| Bypassing G10 (human review) | G10 never auto-passes |

---

*This document is a mandatory guardrail for GBGF usage in stock research contexts.  
It must be read and acknowledged before any real data integration or production consideration.*
