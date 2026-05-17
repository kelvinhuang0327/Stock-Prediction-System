# Next Prompt After P29A — PIT Feature Registry v1

**From:** P29A-HARDRESET (commit: TBD — see PART M)
**P29A classification:** `P29A_PIT_FEATURE_REGISTRY_V1_READY`
**P26F4 state:** `WAITING_FOR_OPERATOR_SOURCE`
**CEO mandate:** Route D continuation — axis A/B advancement only; no P27 housekeeping as main task

---

## Route A — Source still not arrived (expected) → P29-B or P29-C

### Recommended: P29-B — NewsEvent / FinancialReport Real Source Acquisition PLAN

```
你是 Stock Prediction System 的 Senior Source Acquisition Planning Agent。

任務名稱：
P29B-HARDRESET — NewsEvent / FinancialReport Real Source Acquisition Plan

日期：
2026-05-23（或下一輪實際日期）

工作目錄：
/Users/kelvin/Kelvin-WorkSpace/Stock-Prediction-System

目前狀態：
- P29A 已完成，classification = P29A_PIT_FEATURE_REGISTRY_V1_READY
- PIT-safe Feature Availability Registry v1 已建立
  - NewsEvent.sourceStatus = HIGH_RISK_SOURCE_ABSENT
  - FinancialReport.sourceStatus = HIGH_RISK_SOURCE_ABSENT
  - 兩者均 entersAlphaScore=false
- P26F4 仍 WAITING_FOR_OPERATOR_SOURCE
- CEO Route D mandate: axis-A continuation only

本輪目標：
1. 盤點現有 NewsEvent source（Cnyes API / RSS）的 publishedAt 可靠性
2. 研究 FinancialReport 的 TWSE filing calendar 與 availabilityDate 對應關係
3. 提出 NewsEvent source acquisition plan（不涉及資料匯入）
4. 提出 FinancialReport availabilityDate governance plan（不涉及 DB schema 變更）
5. 確認兩者均仍維持 NOT_ALLOWED_FOR_SCORING 直到正式審計通過

本輪不是：
- 不是 DB write
- 不是 corpus regeneration
- 不是 scoring 修改
- 不是 optimizer
- 不是 P26F4 import

硬性禁止：
- 不得修改 scoring files / corpus / DB
- 不得宣稱 ROI / win-rate / alpha / edge / profit / outperform / buy / sell / guaranteed
- 不得啟動 NewsEvent 或 FinancialReport 進入 scoring

輸出：
- outputs/online_validation/p29b_news_event_source_acquisition_plan.json / .md
- outputs/online_validation/p29b_financial_report_availability_governance_plan.json / .md
- outputs/online_validation/p29b_source_acquisition_boundary_review.json
- src/lib/onlineValidation/__tests__/p29b_source_acquisition_plan.test.ts
- outputs/online_validation/p29b_final_report.md

Final Classification:
- P29B_SOURCE_ACQUISITION_PLAN_READY
- P29B_BLOCKED_BY_SOURCE_COMPLEXITY
- P29B_FAILED_TESTS
```

### Alternative: P29-C — Backtest / Simulation Contract Paper Design (Axis B)

```
你是 Stock Prediction System 的 Senior Simulation Contract Paper Design Agent。

任務名稱：
P29C-HARDRESET — Backtest / Simulation Contract Paper Design

日期：
2026-05-23（或下一輪實際日期）

工作目錄：
/Users/kelvin/Kelvin-WorkSpace/Stock-Prediction-System

目前狀態：
- P29A 已完成，PIT registry v1 ready
- Axis B (simulation) 從 P28E 起完全未推進
- simulation_snapshot_corpus.jsonl = 60 entries / BLOCKED / coverageRatio 0.2333
- P26F4 仍 WAITING_FOR_OPERATOR_SOURCE

本輪目標：
1. 盤點現有 StrategyBacktestEngine / ShadowLedger / WalkForwardEngine 的 contract
2. 草擬統一的 simulation contract：cost assumptions / slippage / position cap / PIT-safe inputs
3. 定義 optimizer readiness gate：sample size / train-test split / horizon maturity / anti-overfit checks
4. 純 paper design；不執行任何 backtest；不寫 DB；不修改 corpus

硬性禁止：
- 不得修改 scoring files / corpus / DB
- 不得宣稱 ROI / win-rate / alpha / edge / profit / outperform
- 不得啟動 optimizer

輸出：
- outputs/online_validation/p29c_simulation_contract_paper_design.json / .md
- outputs/online_validation/p29c_optimizer_readiness_gate_spec.json / .md
- src/lib/onlineValidation/__tests__/p29c_simulation_contract.test.ts
- outputs/online_validation/p29c_final_report.md

Final Classification:
- P29C_SIMULATION_CONTRACT_PAPER_DESIGN_READY
- P29C_FAILED_TESTS
```

---

## Route B — Source arrived → use canonical source-arrival prompt

```
outputs/online_validation/p26_next_prompt_source_arrival_only.md
```

Steps (from that file):
1. Drop files → `data/manual/monthly-revenue/p26f3-2-dropzone/`
2. Fill `SOURCE_MANIFEST.json`
3. Run inventory + validator + coverage preview + safety
4. Dry-run PASS → provide token: `P26F4_APPROVE_HISTORICAL_MONTHLY_REVENUE_IMPORT_ONLY`
5. Controlled import

---

## Route C — Registry found blocker → P29A-FOLLOWUP

If any registry source is found to have a scoring path leak or contract violation:

```
P29A-FOLLOWUP-HARDRESET — Registry Scoring Boundary Gap Repair
- paper-only fix
- no scoring / DB / corpus change
```

---

## CEO Route D Reminder

P27 naming audit / scanner consolidation / phase registry are explicitly deprioritized to P10. The next round's **main task** must be either P29-B, P29-C, or the source-arrival gate — not housekeeping.

*Observability only. Not investment advice.*
