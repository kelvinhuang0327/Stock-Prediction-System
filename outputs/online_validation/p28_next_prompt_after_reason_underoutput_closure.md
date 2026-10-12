# P28E — Next Prompt After Reason Underoutput Closure

**Closure state:** `REASON_UNDEROUTPUT_TRACK_CLOSED`
**Renderer version:** `p26a-corpus-renderer-v2`
**Date:** 2026-05-22
**CEO mandate:** Route D pre-commit — axis-A continuation enforced.

---

## Choose Route by Operator Source State

### Route A — Source NOT arrived (CEO-recommended path) → Route D below

If `data/manual/monthly-revenue/p26f3-2-dropzone/` is still empty (no official TWSE/MOPS CSVs), **do NOT** spend the next round on more drop-zone scans or governance audits. Execute **Route D** below.

### Route B — Source arrived

If the operator has confirmed source files placed in drop-zone with a filled `SOURCE_MANIFEST.json`, switch to:

```text
outputs/online_validation/p26_next_prompt_source_arrival_only.md
```

Run: source-present gate → manifest validation → dry-run → token gate → controlled import.

Approval token required for controlled import:

```text
P26F4_APPROVE_HISTORICAL_MONTHLY_REVENUE_IMPORT_ONLY
```

### Route C — Blocking residual underoutput found

**Not applicable to this closure.** P28E residual scan returned 0 blocking F8/F9/F10. This route would only activate if a future scan finds blocking residual. The placeholder task name is `P28F-RESIDUAL-UNDEROUTPUT-REPAIR-HARDRESET` (renderer-only repair; no scoring change).

### Route D — Axis-A continuation (CEO-mandated next round when source not arrived)

Execute the following task. P27 naming audit / scanner consolidation / phase registry housekeeping are **explicitly forbidden** as next-round main task — they have been deprioritized to P10.

---

## Route D Task Prompt (next round)

```text
你是 Stock Prediction System 的 Senior PIT-safe Feature Availability Registry Agent。

任務名稱：
P29A-HARDRESET — PIT-safe Feature Availability Registry v1 (Paper Design)

日期：
(next round)

工作目錄：
/Users/kelvin/Kelvin-WorkSpace/Stock-Prediction-System

CEO 治理註記（必讀）：
- 本任務是 P28E closure 後 CEO Route D 強制執行
- P27 naming audit / scanner consolidation / phase registry housekeeping 不得作為本輪主任務
- 本輪是 paper design only：不寫 DB、不改 scoring、不擴 corpus、不接 production
- Strategic P0（operator MonthlyRevenue source acquisition）仍由 operator 處理，與本輪 agent 任務並行
- 若 operator source 在本輪期間到位，切回 p26_next_prompt_source_arrival_only.md

目前狀態：
- HEAD: (P28E commit)
- P28 reason underoutput track CLOSED (renderer v2)
- 2997+ jest PASS（含 P28E closure tests）
- DB / 5 frozen corpus / 3 scoring files sha256 UNCHANGED
- P26F4 = WAITING_FOR_OPERATOR_SOURCE; candidateSourceFiles = 0
- no-new-repo policy ACTIVE

本輪目標：
1. 設計 PIT-safe Feature Availability Registry v1（machine-readable）
2. 涵蓋 6 個 feature source：
   - StockQuote（TWSE / TPEX）
   - MarketRegime
   - InstitutionalChip
   - MonthlyRevenue（REPAIRED_2026_05_12）
   - FinancialReport（STILL_HIGH_RISK；不 enter scoring）
   - NewsEvent（STILL_HIGH_RISK；不 enter scoring）
3. 每個 source 必須描述：
   - gateField（asOf 比對所用欄位）
   - sourceStatus（READY / WAITING / DEPRECATED）
   - coverage（rows / symbols / date span）
   - freshness（lastObservedAt）
   - knownLimitations
   - entersAlphaScore（boolean）
   - entersResearchBucket（boolean）
4. 不修改 scoring formula
5. 不寫 DB / corpus
6. 不啟用 NewsEvent / FinancialReport 進 scoring
7. 建立 registry tests，驗證每個 source 的描述齊全

本輪不得：
- 修改 alphaScore / recommendationBucket / scoring formula
- 修改 RuleBasedStockAnalyzer / SignalFusionEngine / ActiveScoringSnapshotBuilder
- 寫 prisma/dev.db
- 修改任何 corpus
- 啟用 FinancialReport / NewsEvent 為 scoring 輸入
- 創建新 repo
- 自動下載 TWSE/MOPS
- 宣稱 ROI / win-rate / alpha / edge / profit / outperform / buy / sell / guaranteed

本輪可以：
- 讀取所有現有 source mapping artifacts (P12 v1 / P17 / P25 / P26B / P26C / P26F)
- 新增 PIT registry types 與 utility
- 新增 paper artifact: p29a_pit_feature_availability_registry_v1.json/.md
- 新增 tests
- 更新 ARTIFACT_INDEX / phase chain registry

預期 final classification：
P29A_PIT_FEATURE_AVAILABILITY_REGISTRY_V1_COMPLETE
```

---

## CEO Route D Governance

- **Explicit forbidden alternatives as next-round main task:**
  - `P27_REPORT_NAMING_AUDIT`
  - `P27_FORBIDDEN_CLAIMS_SCANNER_CONSOLIDATION`
  - `P27_PHASE_REGISTRY_CONSISTENCY`
  - These tasks are **deprioritized to P10**. They are valid housekeeping but must not be the main task while axis-A advancement is available.
- **Rationale:** P28A→P28D was the first real axis-A advancement since 2026-05-13 P26A. Returning to P27 housekeeping immediately after would relapse into the governance comfort zone the CEO has been pushing back against for multiple rounds.
- **Strategic P0 reminder:** Operator must still acquire 2025-09 to 2026-01 official MonthlyRevenue CSVs + filled `SOURCE_MANIFEST.json`. P29-A runs in parallel and does not block or replace this.

---

## Invariance Reminders (Carry Forward)

- `prisma/dev.db` SHA-256 must remain `a5cf277182c161dfe97ba05f9b81528d6c8e477dd5ac0bec6810ffbb8711c6f8`
- 5 frozen corpora: 60 / 4500 / 9900 / 4500 / 4499 line counts
- 3 scoring files SHA-256 unchanged
- Renderer remains `p26a-corpus-renderer-v2`

---

*Observability only. No investment advice. No ROI / alpha / edge / win-rate / profit / outperform / buy / sell claims.*
