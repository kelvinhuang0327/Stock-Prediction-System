# P29C-HARDRESET Final Report

**Task:** P29C — Backtest / Simulation Contract Paper Design
**Date:** 2026-05-25
**Final Classification:** `P29C_BACKTEST_SIMULATION_CONTRACT_READY`

> Not investment advice. Not a trading recommendation. Research observability only.

---

## 1. 本輪目標

建立 Backtest / Simulation Contract Paper Design — **主軸 B 在 P29 系列的正式啟動**：
- 定義 input contract、outcome isolation、PIT 約束、evaluation modes
- 設計 outcome isolation / leakage control design
- 設計 corpus expansion gate (blocked until P26F4)
- 建立 backtest output schema draft
- 建立 gate matrix (10 gates)
- 不執行 backtest、不跑 optimizer、不改 corpus / DB / scoring

---

## 2. P29B Recap

P29B (commit `cb53516`) completed FinancialReport + NewsEvent source acquisition plans:
- FinancialReport: PIT gate = `filingDate`, drop-zone `data/manual/financial-report/p29b-dropzone/`
- NewsEvent: PIT gate = `publishedAt` (NOT ingestedAt), drop-zone `data/manual/news-event/p29b-dropzone/`
- Both remain `HIGH_RISK_SOURCE_ABSENT`; `entersAlphaScore = false`

---

## 3. Existing Simulation / Replay Landscape

**12 relevant modules** scanned. Key findings:
- `PitSafeLedgerReplayEngine` — PIT-safe by design; reference implementation
- `RealPriceOutcomeResolver` — already isolates entry (PIT-safe) from outcome (post-asOf)
- `simulation_snapshot_corpus.jsonl` — 60 entries, 2 symbols, **BLOCKED**
- `SimulationExecutionEngine` (autonomous path) — has known timezone/double-execution issues; excluded from contract scope in P29C
- **Gap:** No unified simulation contract existed before P29C

---

## 4. Backtest / Simulation Contract v1

Key provisions:
- `paperDesignOnly = true`; `noProductionBacktest = true`; `noOptimizer = true`
- **Input:** `asOfDate, symbol, alphaScore, recommendationBucket, horizon` — outcome fields FORBIDDEN as input
- **Outcome section:** `outcomePrice, returnPct, realizedReturnClass` — joined AFTER snapshot frozen
- **5 evaluation modes:** OBSERVABILITY_ONLY (✅) / PAPER_ONLY_SIMULATION (🔒 token) / CORPUS_EXPANSION (❌ blocked) / OPTIMIZER (❌ blocked) / PRODUCTION_TRADING (❌ permanently blocked)

---

## 5. Outcome Isolation / Leakage Control Design

- 6 outcome fields defined and isolated
- Join timing: after scoring snapshot frozen + PIT registry gate passed
- 4 leakage classification states: OUTCOME_LEAKAGE_DETECTED / PIT_JOIN_VIOLATION / SCORING_INPUT_CONTAMINATED / **SAFE_OBSERVABILITY_ONLY** ← current state
- Evidence: P28D sweep confirmed 0 outcomeLeakageCount across 572 sampled rows

---

## 6. Corpus Expansion Gate Design

- Current corpus: 60 entries, 2 symbols, **BLOCKED**
- Blocked until: P26F4 import + coverage threshold + no HIGH_RISK in alphaScore + outcome isolation + frozen corpus sha256 unchanged + CTO token
- **Corpus expansion ≠ optimizer** (separate gates)

---

## 7. Backtest Output Schema Draft

- Schema version: `p29c-backtest-output-v1`
- `mode = "paper_only"` throughout P29C
- Outcome fields under `outcome` section (not root)
- `leakageControls.featuresFrozenBeforeOutcomeJoin = true` required
- `featureAvailabilitySnapshot` references P29A registry statuses

---

## 8. Gate Matrix

| Gate | Status |
| --- | :---: |
| G1 P29A Registry | ✅ PASS |
| G2 P29B Source Risk | ✅ PASS |
| G3 P26F4 MonthlyRevenue Source | ❌ BLOCKED |
| G4 Corpus Expansion | ❌ BLOCKED |
| G5 Outcome Isolation | ✅ PASS |
| G6 Leakage Scan | ✅ PASS |
| G7 Paper-only Mode | ✅ PASS |
| G8 Forbidden Claims | ✅ PASS |
| G9 No Optimizer | ✅ PASS |
| G10 CTO Approval | ℹ️ N/A (P29C) |

**7/10 PASS, 2 BLOCKED (operator-dependent), 1 N/A**

---

## 9. Tests Result

| Command | Tests | Result |
| --- | ---: | :---: |
| P29C targeted (23 tests) | 23/23 | ✅ |
| Full onlineValidation suite | **3078/3078** (103 suites) | ✅ |

Delta: 3055 → 3078 (+23 P29C tests).

---

## 10. Invariance Result

All frozen files UNCHANGED: `prisma/dev.db` ✅ | 3 scoring files ✅ | 5 corpus ✅

---

## 11. Forbidden Claims Scan — CLEAN

5 raw regex hits — all benign (prohibition statements, gate descriptions, module name substring). 0 violations.

---

## 12. Boundary Validation — BOUNDARY_SAFE (7/7)

No scoring files, DB, or corpus modified. No backtest/optimizer scripts created.

---

## 13. New Files

22 new files (21 outputs + 1 test). See commit body.

---

## 14. Remaining Blockers

| Blocker | Status |
| --- | --- |
| MonthlyRevenue 2025-09 to 2026-01 | WAITING_FOR_OPERATOR_SOURCE |
| P26F4 import | BLOCKED |
| Corpus expansion (simulation_snapshot_corpus) | BLOCKED (G4) |
| FinancialReport PIT gate | Not implemented |
| NewsEvent publishedAt audit | Not done |
| PAPER_ONLY_SIMULATION mode activation | Needs token + prerequisites |
| Optimizer gate | BLOCKED (multiple prerequisites) |

---

## 15. Contribution to CEO Two Strategic Axes

### Axis A — Taiwan Stock Prediction Research
**Indirect.** Contract defines that simulation output can NEVER flow back into scoring input, protecting axis A scoring integrity for future replay work.

### Axis B — Strategy Simulation and Optimization
**Direct.** P29C is the **first formal axis-B paper design** in the P29 series. It establishes:
- Input/outcome contract (PIT-safe inputs, isolated outcomes)
- Gate matrix (what's blocked and why)
- Backtest output schema (how future simulation results should be structured)
- Corpus expansion gate (prerequisite checklist for corpus growth)
- Clear path from OBSERVABILITY_ONLY → PAPER_SIMULATION → (future) CORPUS_EXPANSION

---

## 16. Final Classification

```
P29C_BACKTEST_SIMULATION_CONTRACT_READY
```
