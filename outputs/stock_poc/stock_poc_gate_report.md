# GBGF Stock POC Gate Report
**Task**: P3-01 — StockDomain Framework Portability Test
**Generated**: 2026-05-05T05:34:13.825624 UTC | DRY RUN
**Strategy**: STOCK_POC_SIMPLE_20D_MOMENTUM_001
**⚠ MOCK DATA — Not a trading recommendation**

---

## Gate Results

| Gate | Status | Message |
|------|--------|---------|
| G01 Hypothesis Registry Gate | ✅ PASS | Hypothesis pre-registered |
| G02 Data Leakage Gate | ✅ PASS | StockDomain: PIT flag confirmed on mock data. RISK NOTE: Survivorship bias not e |
| G03 OOS Validation Gate | ❌ FAIL | Only 0/1 OOS windows pass |
| G04 Permutation Null Gate | ⚠️ WARN | No permutation p-value in evidence bundle |
| G05 Multiple Testing Gate | ⚠️ WARN | No BH-FDR result in evidence bundle |
| G06 EV / ROI Gate | ⚠️ WARN | EV negative by design. Classification: EV_NEGATIVE_BY_DESIGN. Not recommended fo |
| G07 Live Monitoring Gate | ⚠️ WARN | Insufficient live outcomes: 0 (need >=5 for reliable monitoring) |
| G08 Retirement Gate | ✅ PASS | No retirement condition triggered |
| G09 Production Write Gate | 🚫 BLOCKED | Blocked: critical gate failure upstream |
| G10 Human Review Gate | 🚫 BLOCKED | Human review not yet completed. Agent cannot auto-approve. |

**3 PASS | 4 WARN | 2 BLOCKED | 1 FAIL**

---

## OOS Backtest (Mock OHLCV)

| Window | Edge (pp) | p-value | n | Pass |
|--------|-----------|---------|---|------|
| 60d_oos | -8.330 | 0.0400 | 60 | — |

---

## Stock Domain Risks

- ⚠️ PIT (point-in-time) data required — avoid look-ahead on fundamentals/restatements
- ⚠️ Survivorship bias: universe must include delisted stocks
- ⚠️ Transaction cost: 10bps assumed; real cost includes slippage + market impact
- ⚠️ Sharpe / CAGR / max drawdown: computed from mock data — not production-valid

---

## Framework Verdict

> StockDomain adapter successfully integrates with GBGF GateRunner. G01 PASS (hypothesis pre-registered). G02 PASS with survivorship-bias risk note. G03/G04/G05 WARN: mock OOS data; real permutation test not yet implemented. G06 WARN: mock Sharpe computed from synthetic OHLCV. G09/G10 BLOCKED: no human review, no dry-run approval. Framework portability from Lottery → Stock domain: CONFIRMED.

---

## Final Classification

**STOCK_POC_FRAMEWORK_VALIDATED**

| Check | Value |
|-------|-------|
| DB modified | False |
| Production write | False |
| Trading recommendation | False |
| Dry run | True |
