# Next Prompt After P29B — Real Source Acquisition Plan

**From:** P29B-HARDRESET (commit: TBD)
**P29B classification:** `P29B_REAL_SOURCE_ACQUISITION_PLAN_READY`
**P26F4 state:** `WAITING_FOR_OPERATOR_SOURCE`
**CEO mandate:** axis A/B continuation — no P27 housekeeping as main task

---

## Route A — Source still not arrived → P29-C (Recommended)

### P29-C — Backtest / Simulation Contract Paper Design (Axis B)

```
你是 Stock Prediction System 的 Senior Simulation Contract Paper Design Agent。

任務名稱：
P29C-HARDRESET — Backtest / Simulation Contract Paper Design

日期：
2026-05-24（或下一輪實際日期）

目前狀態：
- P29B 已完成，classification = P29B_REAL_SOURCE_ACQUISITION_PLAN_READY
- PIT registry v1 ready；FinancialReport/NewsEvent acquisition plan ready
- Axis B (simulation) 從 P28E 起完全未推進
- simulation_snapshot_corpus.jsonl = 60 entries / BLOCKED
- P26F4 仍 WAITING_FOR_OPERATOR_SOURCE

本輪目標：
1. 盤點現有 StrategyBacktestEngine / ShadowLedger / WalkForwardEngine 的 contract
2. 草擬統一 simulation contract：cost/slippage/position-cap/PIT-safe-inputs
3. 定義 optimizer readiness gate (machine-readable gates)
4. 定義 minimal corpus maturity for optimizer entry
5. 純 paper design；不執行任何 backtest；不寫 DB；不修改 corpus

硬性禁止：
- 不得修改 scoring files / corpus / DB
- 不得宣稱 ROI / win-rate / alpha / edge / profit / outperform
- 不得啟動 optimizer
- 不得回 P27 housekeeping 作為主任務

輸出：
- p29c_simulation_contract_paper_design.json/.md
- p29c_optimizer_readiness_gate_spec.json/.md
- p29c_backtest_corpus_maturity_requirements.json/.md
- src/lib/onlineValidation/__tests__/p29c_simulation_contract.test.ts
- p29c_final_report.md

Final Classification:
- P29C_SIMULATION_CONTRACT_PAPER_DESIGN_READY
- P29C_FAILED_TESTS
```

---

## Route B — MonthlyRevenue source arrived → P26F4 source-present gate

```
Use: outputs/online_validation/p26_next_prompt_source_arrival_only.md
```

1. Drop CSVs → `data/manual/monthly-revenue/p26f3-2-dropzone/`
2. Fill `SOURCE_MANIFEST.json`
3. Run inventory + validator + coverage preview + safety
4. Dry-run PASS → provide token: `P26F4_APPROVE_HISTORICAL_MONTHLY_REVENUE_IMPORT_ONLY`
5. Controlled import

---

## Route C — FinancialReport / NewsEvent operator source arrived

If operator provides source files for either FinancialReport or NewsEvent:
1. Place in drop-zone (`data/manual/financial-report/p29b-dropzone/` or `data/manual/news-event/p29b-dropzone/`)
2. Fill manifest with attestations
3. Run P29B validator dry-run only (no DB import)
4. Dry-run PASS → provide approval token separately
5. Update registry entry status (paper proposal only; actual status change requires separate round)

---

## CEO Reminder

P27 naming audit / scanner consolidation / phase registry = **deprioritized to P10**.
Next main-task options in priority order:
1. P29-C Backtest contract (axis B, no source needed)
2. P26F4 gate (if MonthlyRevenue source arrives)
3. FinancialReport / NewsEvent drop-zone scaffold (if operator provides source files)

*Observability only. Not investment advice.*
