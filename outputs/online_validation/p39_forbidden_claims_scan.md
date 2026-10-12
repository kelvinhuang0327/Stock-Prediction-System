# P39 — Forbidden Claims Scan

**Phase:** P39 — Paper Simulation Input Contract for Eligible Sources  
**Scanned at:** 2026-05-21  
**Verdict: CLEAN**

---

## Files Scanned

1. `src/lib/onlineValidation/p39/PaperSimulationInputContract.ts`
2. `src/lib/onlineValidation/p39/PaperSimulationInputContractBuilder.ts`
3. `src/lib/onlineValidation/__tests__/p39_paper_simulation_input_contract.test.ts`

---

## Forbidden Terms Checked

`buy` · `sell` · `hold` · `ROI` · `win-rate` · `winRate` · `alpha claim` · `outperform` · `investment recommendation` · `guaranteed` · `expected return` · `edge score` · `profit` · `prediction` · `recommendation` · `alphaScore` · `backtestResult` · `optimizerScore`

---

## Findings

All occurrences of forbidden terms in P39 files are **prohibition references only** — not active claims.

| File | Term | Context | Verdict |
|------|------|---------|---------|
| `PaperSimulationInputContract.ts` | `alphaScore, buy, sell, hold, recommendation, prediction, profit, winRate, backtestResult, optimizerScore` | `PAPER_SIMULATION_CONTRACT_FORBIDDEN_FIELDS` constant — list of PROHIBITED fields | BENIGN_PROHIBITION_REFERENCE |
| `PaperSimulationInputContractBuilder.ts` | `buy/sell/hold`, `investment recommendation` | `forbiddenUse` arrays — enumerate what sources MUST NOT be used for | BENIGN_PROHIBITION_REFERENCE |
| `PaperSimulationInputContractBuilder.ts` | `entersAlphaScore=true`, `paperOnly=false` | JSDoc rule comments — describe invariants the validator enforces against | BENIGN_PROHIBITION_REFERENCE |
| `p39_paper_simulation_input_contract.test.ts` | `BUY`, `buy, sell, hold, winRate, profit, expectedReturn` | Tests that ASSERT the validator REJECTS these values / verify they appear in FORBIDDEN_FIELDS | BENIGN_TEST_ASSERTION |

---

## Summary

| Category | Count |
|----------|-------|
| Active investment advice claims | 0 |
| Active buy/sell/hold recommendations | 0 |
| Active predictive claims | 0 |
| Active performance claims (profit/ROI/win-rate) | 0 |
| Active alpha claims | 0 |
| All hits: prohibition references or test assertions | ✅ |

**Verdict: CLEAN — No forbidden active claims in P39 deliverables.**

---

## Governance Confirmation

- `entersAlphaScore = false` in all P39 files ✅
- `noInvestmentAdvice = true` ✅
- `noBuySellActionSemantics = true` ✅
- `paperOnly = true` ✅
- `dryRunOnly = true` ✅

**Classification:** `P39_PAPER_SIMULATION_INPUT_CONTRACT_READY`
