已完成 CTO v2 roadmap 重排，並直接更新指定 roadmap。

更新檔案：
- [stock_roadmapPlan_20260504.md](/Users/kelvin/Kelvin-WorkSpace/Stock-Prediction-System/00-StockPlan/roadmap/stock_roadmapPlan_20260504.md:21)
- [cto_analysis_20260513v2.md](/Users/kelvin/Kelvin-WorkSpace/Stock-Prediction-System/00-StockPlan/20260513/cto_analysis_20260513v2.md:1)

核心判斷已改為：

```text
P0 — Manual TWSE Historical MonthlyRevenue Data Acquisition Execution
```

原因很明確：P26A～P26F3-4 已完成，內部工具鏈、validator、coverage preview、safety gate、scoring invariance 都 ready。現在真正阻塞是 drop-zone 沒有 2025-09～2026-01 的 TWSE/MOPS 歷史月營收真實 source files，因此：

- candidateSourceFiles = 0
- acceptedRows = 0
- matchedRows = 0
- readyForP26F4 = false

我也查實目前 `prisma/dev.db`：`MonthlyRevenue.releaseDate` 欄位存在，2143 rows 都有 releaseDate，但只有 2026-02 / 2026-03，releaseDate 是 2026-03-10 / 2026-04-10；而 corpus asOf 最晚到 2026-02-11，所以 coverage 仍為 0。阻塞不是欄位，而是歷史 source 缺口。

新 P0-P10 已更新為：

- P0：Manual TWSE Historical MonthlyRevenue Data Acquisition Execution
- P1：P26F4 Controlled Import Gate
- P2：修 `data-quality/route.ts` 既有 TSC error
- P3：Formal Historical MonthlyRevenue Import
- P4：Re-run P26F Candidate Corpus Coverage
- P5：Formal Corpus Expansion PR Gate
- P6：NewsEvent / FinancialReport Source Acquisition Plan
- P7：PIT-safe Feature Availability Registry v1
- P8：Backtest / Replay Observability Upgrade
- P9：Strategy / Ranking Layer Readiness Review
- P10：Controlled Optimizer Exploration Gate

本輪是 roadmap / CTO analysis 文件更新，沒有改 scoring、DB、corpus，也沒有跑測試。
# CEO 二次審查 — 2026-05-13 v2

## 一、昨日成果評估（P26A–P26F3-4 是否真的推進系統成熟度？）

**結論：實質有推進，但已進入「內部工具觸頂、外部資料缺口暴露」的拐點。**

P26A 把 24/58 generic reason 降到 9，且 9000 rows score/bucket invariance = 0 mismatch — 這是主軸 A 真正的能力升級（reason 可審查、scoring 不變）。
P26B/C/D/E/F/F2/F3/F3-4 把時事面、財報面、coverage 評估、MonthlyRevenue source mapping、operator package 全部建好，但所有路徑最後都收斂到同一個現實：
- candidateSourceFiles = 0
- acceptedRows = 0
- matchedRows = 0
- DB MonthlyRevenue 雖 2143 rows 都有 releaseDate，但只有 2026-02 / 2026-03，**對 corpus asOf ≤ 2026-02-11 來說等於 zero coverage**

也就是說，**昨天把所有「不需要真實資料的內部工程」做到了上限**。再寫第 N 個 validator / dashboard / dry-run，邊際價值已經很小。

## 二、CTO 判斷是否合理？關鍵盲點

**合理的部分：**
1. 正確識別出真實阻塞已從「工程」轉為「資料取得」。
2. 正確把 P26F4 從「下一步預設執行」改為「conditional gate」— 沒有 accepted source 就不可進。
3. 正確把 optimizer 仍鎖在 readiness gate 後。
4. 對 main axis A/B 的對應關係描述清晰。

**關鍵盲點（必須由 CEO 修正）：**

1. **P0 不是 agent-actionable**。CTO 把 P0 設為「Manual TWSE Historical MonthlyRevenue Data Acquisition Execution」— 但 AI agent 不能去 TWSE / MOPS 網站抓檔案。如果今天直接把這當 agent 的 P0，agent 大概率只會 run `scripts/run-p26f3-3-dropzone-inventory.js`、看到 0 個檔案、輸出 `P0_SOURCE_NOT_PROVIDED`、然後停止。這是浪費一輪。
2. **CTO 沒有區分「operator P0」與「agent P0」**。今天 agent 該做的，是把所有「能在 source 進來之前先做好的事」一次清掉，讓 operator 真正放檔案那天，pipeline 一次性通過。
3. **CTO 把 TSC fix 放 P2**，但這是今天唯一無依賴、無風險、可以實際 commit 的工程任務。CEO 認為應把它合進 agent 的當輪工作。
4. **CTO 未提 P26A 殘留的 9 個 SCORING_UNDEROUTPUT 案例**。這 9 個案例在 P26A 是 read-only audit，沒有後續處理路徑。應在 backlog 裡明確列出。
5. **CTO 未要求對 P26F3-4 pipeline 做 end-to-end pre-flight**。若 operator 放真實檔案的那一刻，inventory / validator / coverage preview / safety / scoring invariance 任何一階段壞掉，會浪費 operator 的時間並造成混亂。今天應該用 synthetic fixture 做一次 end-to-end dry-run，確認每一階段都跑得通。
6. **CTO 沒有要求產出明確 operator handoff packet（URL/月份/symbol/檔名）**。Operator 拿到的還是一份 checklist，不是「點這 5 個 URL 下載這 5 個檔案」的具體規格。Operator handoff 必須再精煉一輪。

## 三、實作進度確認（兩大主軸）

| 主軸 | 維度 | 狀態 | 缺口 |
| --- | --- | --- | --- |
| A 預測 | 技術面 reason | 已增強 | 9 underoutput 案例待 audit follow-up |
| A 預測 | 籌碼面 reason | 已增強 | 同上 |
| A 預測 | 基本面 — MonthlyRevenue | schema + PIT + adapter + mapping ready；**歷史 source 缺** | **這是當前最大缺口** |
| A 預測 | 基本面 — FinancialReport | adapter + contract ready；read-only | 缺 real source；不可 scoring |
| A 預測 | 時事面 — NewsEvent | adapter + PIT context ready；read-only | 缺 real source；不可 scoring |
| A 預測 | 市場 regime | 已整合 | OK |
| B 模擬 | corpus expansion | gate 已建；**coverage = 0 等真實 source** | 待 P0 解開 |
| B 模擬 | replay observability | partial（P26D） | 升級需等 corpus expanded |
| B 模擬 | backtest contract | 未統一 | 待主軸 A 穩定 |
| B 模擬 | optimizer | 鎖在 gate 後 | 不變 |

**主軸 A 的單一最大瓶頸 = MonthlyRevenue 歷史 source。**
**主軸 B 等主軸 A 提供 expanded corpus 後才能解。**

## 四、CEO 重排 P0–P10

CTO 的順序大體正確，但 CEO 把今天能做的事整合成 **agent-actionable P0**，把 CTO 的 P0 重新定位為 **operator-actionable P0**（並行）：

| Priority | Task | 與 CTO 差異 |
| --- | --- | --- |
| **P0 (operator)** | Manual TWSE Historical MonthlyRevenue Data Acquisition | 與 CTO 同；屬 operator 任務 |
| **P0 (agent — 今天)** | **P26F3-5 Pre-flight + Operator Handoff Acceleration + TSC Hygiene + Drop-zone Conditional Scan** | 新增；CTO 漏 |
| **P1** | P26F4 Controlled Import Gate（conditional） | 與 CTO 同 |
| **P2** | Formal Historical MonthlyRevenue Import | 從 CTO P3 提前 |
| **P3** | Re-run P26F Candidate Corpus Coverage with Real Rows | 同 CTO P4 |
| **P4** | Formal Corpus Expansion PR Gate | 同 CTO P5 |
| **P5** | **P26A SCORING_UNDEROUTPUT 9-Case Follow-up Audit (read-only)** | 新增；CTO 漏 |
| **P6** | NewsEvent / FinancialReport Source Acquisition Plan | 同 CTO P6 |
| **P7** | PIT-safe Feature Availability Registry v1 | 同 CTO P7 |
| **P8** | Backtest / Replay Observability Upgrade | 同 CTO P8 |
| **P9** | Strategy / Ranking Layer Readiness Review | 同 CTO P9 |
| **P10** | Controlled Optimizer Exploration Gate | 同 CTO P10 |

---

## 五、今日最應聚焦的系統優化方向

**Agent P0 = P26F3-5 — Pre-flight + Operator Handoff Acceleration + TSC Hygiene + Drop-zone Conditional Scan**

理由：
- 真實 source 取得是 operator 的事，agent 等不起一輪
- Agent 必須把 pipeline 從頭到尾用 synthetic fixture 跑一次，確保 operator 放真實檔案那一刻就能成功
- 順便把 `data-quality/route.ts` TSC error 修掉（CI 訊號乾淨）
- 順便產出具體 URL/月份/symbol/filename 的 operator handoff packet
- 若 drop-zone 已有真實檔案（operator 已提前放），自動走完整 pipeline

---

## 六、最新開始執行的任務 Prompt

```text
你是 Stock Prediction System 的 Senior Pipeline Pre-flight + Operator Handoff Acceleration Agent。

任務名稱：
P26F3-5-HARDRESET — Pre-flight + Operator Handoff Acceleration + TSC Hygiene + Drop-zone Conditional Scan

日期：
2026-05-13

工作目錄：
/Users/kelvin/Kelvin-WorkSpace/Stock-Prediction-System

目前狀態：
- P26A～P26F3-4 全部完成
- P26A 9000 rows score/bucket invariance = 0 mismatch；generic reason 24→9
- P26B/C/D/E/F/F2/F3/F3-4 完成；所有新 context 維持 read-only / entersAlphaScore=false
- 全部 frozen corpus 60 / 4500 / 9900 / 4500 / 4500 unchanged
- DB MonthlyRevenue rows = 2143；releaseDate 欄位存在；但只有 2026-02 / 2026-03，coverage = 0
- Drop-zone 目前 candidateSourceFiles = 0、acceptedRows = 0、matchedRows = 0
- src/app/api/admin/data-quality/route.ts 仍有 pre-existing TS1128 / TS1005 errors
- Git head：b3385c9 P26F3-4-HARDRESET

CEO 結論：
- 真實 TWSE/MOPS 2025-09～2026-01 source 必須由 operator 取得，agent 無法執行
- Agent 今天該做的是「所有 source 進來之前該完成的事」一次清掉
- 這包含：synthetic-fixture pipeline pre-flight、TSC 修復、operator handoff packet 精煉、drop-zone conditional scan

本輪目標：
1. 用 synthetic fixture 把 P26F3-4 pipeline 跑 end-to-end，驗證 inventory → validator → coverage preview → safety → scoring invariance 每階段可通過
2. 修復 src/app/api/admin/data-quality/route.ts 的 TS1128 / TS1005 既有錯誤，不修其他 lint
3. 產出 operator handoff packet：明確 URL、月份、symbol、filename、SHA 驗證指令
4. 對 drop-zone 做 conditional scan：若有檔案 → 跑完整 pipeline；若無檔案 → 標記 P26F3-5_SOURCE_NOT_PROVIDED 並輸出 operator next step
5. 不得使用 synthetic fixture 寫 DB
6. 不得修改 alphaScore / recommendationBucket / corpus

本輪不是模型調參。
本輪不是 corpus regeneration。
本輪不是真實 source 取得（那是 operator 任務）。
本輪不是 P26F4 import。

本輪不得：
- 寫真實 MonthlyRevenue 資料到 DB
- 使用 synthetic fixture 模擬「真實 historical data」對外傳達
- 修改 alphaScore / recommendationBucket / scoring formula
- 修改 SignalFusionEngine / RuleBasedStockAnalyzer 計算 path
- 修改 P0 / P1 / P3 / P19 / simulation corpus
- 在 reason 中加入新 factor
- 修改 ManualReview* 模組
- 使用 outcomePrice / returnPct / realizedReturnClass
- 呼叫外部 API / LLM
- 自動下載 TWSE / MOPS 檔案（agent 無此權限，且不可偽造 source）
- 自動交易
- 宣稱 ROI / win-rate / alpha / edge / profit / outperform / buy / sell / guaranteed
- 將 synthetic fixture 寫進任何 production artifact（必須清楚標記 FIXTURE）

本輪可以：
- 讀 drop-zone 檔案
- 讀現有 P26F3-4 artifacts 與 operator checklist
- 用 synthetic fixture 走過 inventory / validator / coverage preview / safety / scoring invariance 流程
- 修 data-quality/route.ts TS error
- 產生 operator handoff packet 與 URL 規格
- 新增 tests
- 新增 final report

============================================================
PART A — Pre-flight Gate
============================================================

A.1 必要 artifacts 存在性：
- outputs/online_validation/p26a_feature_snapshot_v1_final_report.md
- outputs/online_validation/p26f_monthly_revenue_source_mapping_final_report.md（或對應命名）
- outputs/online_validation/p26f2_monthly_revenue_dry_run_final_report.md（或對應命名）
- outputs/online_validation/p26f3_4_*final_report.md
- docs/manual-data/monthly-revenue/P26F3_4_OPERATOR_CHECKLIST.md
- data/manual/monthly-revenue/p26f3-2-dropzone/（資料夾必須存在；可為空）

A.2 Frozen corpus line count：
- simulation_snapshot_corpus.jsonl = 60
- p0hardreset_historical_replay_corpus.jsonl = 4500
- p1baseline_historical_replay_corpus.jsonl = 9900
- p3active_scoring_historical_replay_corpus.jsonl = 4500
- p19active_scoring_pit_replay_corpus.jsonl = 4500

A.3 DB 基線快照：
- 紀錄 MonthlyRevenue rows / releaseDate 範圍 / sha256(prisma/dev.db)
- 本輪結束時必須相同（除非 PART E.5 確認有真實 operator-provided source 並且 P1 approval token 已給；本輪不要求此情況）

A.4 程式碼基線快照：
- sha256 of RuleBasedStockAnalyzer.ts / SignalFusionEngine.ts / ActiveScoringSnapshot*.ts
- 本輪結束時必須與基線一致（本輪不修 scoring path）

輸出：
- outputs/online_validation/p26f3_5_preflight.json
- outputs/online_validation/p26f3_5_preflight.md

若 artifacts 不完整：
- outputs/online_validation/p26f3_5_escalation_report.md
- Final Classification = P26F3_5_BLOCKED_BY_ARTIFACTS

============================================================
PART B — Synthetic Fixture for Pipeline Pre-flight
============================================================

新增：
- data/manual/monthly-revenue/p26f3_5_synthetic_fixture/
  - README.md（清楚標記 SYNTHETIC / NOT_FOR_DB_WRITE）
  - twse_monthly_revenue_2025_09_synthetic.csv
  - twse_monthly_revenue_2025_10_synthetic.csv
  - twse_monthly_revenue_2025_11_synthetic.csv
  - twse_monthly_revenue_2025_12_synthetic.csv
  - twse_monthly_revenue_2026_01_synthetic.csv

Synthetic fixture 規則：
- 行數 = 5 個月 × 25 symbols = 125 candidate rows
- symbols 從 P3/P19 corpus 中已知存在的 symbol 集合取，按 deterministic ascending sort
- revenue 值用 deterministic placeholder（例如 1_000_000 + symbol_hash % 100_000）
- releaseDate 按 INFERRED_NEXT_MONTH_10TH 填
- 必須在檔頭加 `# SYNTHETIC FIXTURE — NOT FOR DB WRITE — generated by P26F3-5` 註解
- 不得放進 dropzone（避免被誤認為真實 source）

============================================================
PART C — Pipeline End-to-End Dry-run with Synthetic Fixture
============================================================

新增 script：
scripts/run-p26f3-5-pipeline-preflight.js

該 script 必須：
1. 把 synthetic fixture 複製到一個臨時 dropzone：`/tmp/p26f3_5_preflight_dropzone/`
2. 依序執行 P26F3-4 已建立的 pipeline：
   a. inventory（須計算 candidateSourceFiles > 0）
   b. validator（須報出 acceptedRows / rejectedRows）
   c. coverage preview（須報出 matchedRows）
   d. safety gate（須通過）
   e. scoring invariance dry-run（須通過，因為不寫 DB）
3. 每階段都把輸出存到 outputs/online_validation/p26f3_5_pipeline_preflight/<stage>.json
4. 任何階段失敗 → 該 script 必須 fail loud，並標示 fixSpecForP26F3_4

輸出：
- outputs/online_validation/p26f3_5_pipeline_preflight_summary.json
- outputs/online_validation/p26f3_5_pipeline_preflight_summary.md

驗收：
- inventory.candidateSourceFiles = 5
- validator.acceptedRows = 125（synthetic 全部 well-formed）
- coverage.matchedRows > 0
- safety.status = PASS
- invariance.mismatchedAlphaScoreCount = 0
- invariance.mismatchedBucketCount = 0
- 全程不寫 DB；prisma/dev.db sha256 未變
- frozen corpus 未變

============================================================
PART D — TSC Hygiene: Fix data-quality/route.ts Pre-existing Errors
============================================================

僅修：
- src/app/api/admin/data-quality/route.ts

允許修復：
- TS1128 Declaration or statement expected
- TS1005 expected token
- 修復內容必須是語法錯誤修復或結構修復，**不得更動 API 行為 / response shape / SQL / Prisma query semantics**

不允許：
- 改動 admin auth 邏輯
- 改動 data quality 計算邏輯
- 改動 response field names / types
- 加 / 移除 endpoint
- 重命名匯出
- 改動其他檔案的 type

驗收：
- npx tsc --noEmit 對 src/app/api/admin/data-quality/route.ts 不再報 TS1128 / TS1005
- 全 repo tsc 剩餘錯誤必須列出，且必須屬於非本輪、非 data-quality 範圍
- API 回應在現有 jest 測試（若有）下仍通過；若無現有測試，必須新增最小 smoke test 確認 export 與 method signature 未變

輸出：
- outputs/online_validation/p26f3_5_tsc_hygiene.json
- outputs/online_validation/p26f3_5_tsc_hygiene.md

============================================================
PART E — Operator Handoff Packet（Concrete Source Acquisition Spec）
============================================================

新增：
- docs/manual-data/monthly-revenue/P26F3_5_OPERATOR_HANDOFF_PACKET.md

必須包含：
1. 5 個官方來源 URL（TWSE 月營收下載頁 / MOPS 月營收查詢頁），明確標註：
   - 月份：2025-09、2025-10、2025-11、2025-12、2026-01
   - symbol set：25 個 symbol 完整列出（與 P3/P19 corpus 對應）
   - 預期下載格式（CSV / HTML table / XLS）
2. 每個檔案的 expected filename pattern（與 P26F3-4 filename manifest 對齊）
3. drop-zone 絕對路徑
4. 下載後驗證指令（sha256 / row count quick check）
5. 一次性執行：放完檔後跑哪些 npm/node 指令
6. 預期 success classification
7. 預期 failure classification 與每種 failure 的 next step
8. 不允許行為（不可手動編輯 CSV、不可合併多月、不可重新命名為 INFERRED）

驗收：
- packet 內容必須可由非工程人員照做
- URL 必須是現有 TWSE / MOPS 官方頁面（不可虛構；若 CTO 無法給確定 URL，須在 packet 中標註「URL TBD by operator」並提供候選 keyword）
- 不得 fabricate URL 並假裝權威來源

輸出：
- outputs/online_validation/p26f3_5_operator_handoff_packet_summary.json

============================================================
PART F — Drop-zone Conditional Scan
============================================================

新增 script：
scripts/run-p26f3-5-dropzone-conditional-scan.js

行為：
- 讀 data/manual/monthly-revenue/p26f3-2-dropzone/
- 若 candidateSourceFiles = 0：
  - 輸出 SOURCE_NOT_PROVIDED；
  - 引用 P26F3_5_OPERATOR_HANDOFF_PACKET 路徑；
  - 不執行 validator；
  - 不寫 DB；
- 若 candidateSourceFiles > 0：
  - 不得自動假定為真實 source 而 import
  - 必須執行 inventory + validator + coverage preview + safety + scoring invariance
  - 結果輸出到 outputs/online_validation/p26f3_5_dropzone_scan_result.json
  - 不 commit DB write
  - 必須標記 `requiresExplicitImportApprovalToken = true`
  - approval token 必須是字串：`P26F4_APPROVE_HISTORICAL_MONTHLY_REVENUE_IMPORT_ONLY`，本輪未提供，所以不可 import

輸出：
- outputs/online_validation/p26f3_5_dropzone_scan_result.json
- outputs/online_validation/p26f3_5_dropzone_scan_result.md

============================================================
PART G — Tests
============================================================

新增測試：
src/lib/onlineValidation/__tests__/p26f3_5_pipeline_preflight.test.ts

至少涵蓋：
- synthetic fixture loader 不寫 DB
- synthetic fixture 不會被誤認為 production source（檔名含 _synthetic 或 fixture 標記）
- pipeline 在 synthetic input 下 5 stages 皆 PASS
- pipeline 在 empty input 下回 SOURCE_NOT_PROVIDED
- pipeline 在 malformed input 下回 REJECTED 而非 ACCEPTED
- approval token check：未提供 token 不可 import
- frozen corpus 線數未變
- scoring formula 未變（檔案 sha256 比對）
- forbidden claims 掃描通過

執行：
- npx jest src/lib/onlineValidation/__tests__/p26f3_5_pipeline_preflight.test.ts --no-coverage
- npx jest src/lib/onlineValidation/__tests__ --no-coverage
- npx jest src/app/api/admin/__tests__ --no-coverage（若存在）
- npx tsc --noEmit

驗收：
- 本輪新增測試全 PASS
- regression 範圍內 jest 全 PASS
- tsc 不再報 data-quality/route.ts 的 TS1128 / TS1005

============================================================
PART H — Forbidden Claims Scan
============================================================

grep -RniE "ROI|win-rate|win rate|alpha|edge|profit|outperform|beat|buy|sell|guaranteed|investment recommendation" \
  outputs/online_validation/p26f3_5_* \
  docs/manual-data/monthly-revenue/P26F3_5_OPERATOR_HANDOFF_PACKET.md \
  data/manual/monthly-revenue/p26f3_5_synthetic_fixture/ \
  scripts/run-p26f3-5-*.js \
  src/lib/onlineValidation/__tests__/p26f3_5_pipeline_preflight.test.ts \
  || true

允許：
- disclaimer
- forbidden claim scanner test data
- 欄位名稱 alphaScore

任何非 disclaimer 命中 → 必須修正

============================================================
PART I — Artifact & Safety Validation
============================================================

I.1 JSON parse:
for f in outputs/online_validation/p26f3_5_*.json; do
  node -e "JSON.parse(require('fs').readFileSync('$f','utf8')); console.log('$f OK')"
done

I.2 Frozen corpus 線數 unchanged（60/4500/9900/4500/4500）

I.3 prisma/dev.db sha256 unchanged（本輪不寫 DB）

I.4 RuleBasedStockAnalyzer.ts / SignalFusionEngine.ts sha256 unchanged

I.5 synthetic fixture 必須位於 p26f3_5_synthetic_fixture/，不得放進 p26f3-2-dropzone/

============================================================
PART J — Commit
============================================================

若全部 PASS，commit：

P26F3-5-HARDRESET: Pipeline Pre-flight + TSC Hygiene + Operator Handoff Packet + Drop-zone Conditional Scan

- New: synthetic fixture for pipeline pre-flight（clearly labelled SYNTHETIC）
- New: end-to-end pipeline pre-flight script + summary（5 stages PASS on synthetic input）
- New: operator handoff packet（concrete URL/months/symbols/filenames）
- New: drop-zone conditional scan（SOURCE_NOT_PROVIDED if empty；no import without explicit token）
- Fix: data-quality/route.ts TS1128 / TS1005（pre-existing TSC hygiene）
- Frozen: P0/P1/P3/P19/simulation corpus unchanged
- Frozen: prisma/dev.db unchanged
- Frozen: scoring formula / alphaScore / recommendationBucket unchanged
- No real source acquisition（operator action required）
- No DB write
- No ROI / alpha / edge / win-rate / profit / outperform / buy / sell claim

============================================================
PART K — Final Report
============================================================

新增：
outputs/online_validation/p26f3_5_pipeline_preflight_final_report.md

格式：
P26F3-5-HARDRESET Final Report

1. 本輪目標
2. P26F3-4 recap + P26F3-5 scope
3. Pre-flight 結論
4. Synthetic fixture 摘要
5. Pipeline end-to-end 各階段結果
6. TSC hygiene 結果（data-quality/route.ts 修復摘要 / 行為 invariance 證明）
7. Operator handoff packet 摘要
8. Drop-zone conditional scan 結果
9. Frozen corpus / DB / scoring path invariance 驗證
10. 修改 / 新增檔案清單
11. 測試結果
12. Forbidden claims scan
13. 對 CEO 兩大主軸貢獻
    - 主軸 A：間接但必要；為真實 MonthlyRevenue source 進來鋪好 pipeline，operator 一旦放檔案就可一次通過
    - 主軸 B：間接；coverage gating 維持嚴格，避免在缺真實資料時誤啟動 corpus expansion
14. 風險與不確定點
    - operator URL 是否正確、是否需 CTO 確認
    - 9 個 P26A SCORING_UNDEROUTPUT 案例仍待後續 audit
15. 下一輪建議
    - 若 operator 已放真實 source → P26F4 Controlled Import Gate（須 explicit approval token）
    - 若 operator 尚未放 → 持續等待，agent 可進 P5 SCORING_UNDEROUTPUT audit 或 P6 NewsEvent/FinancialReport source plan
    - 若 TSC hygiene 失敗 → P26F3-5-FIX-TSC
    - 若 pipeline pre-flight 任一階段失敗 → P26F3-4-PIPELINE-FIX
16. Final Classification

Final Classification 七選一：
1. P26F3_5_PIPELINE_PREFLIGHT_COMPLETE_AND_OPERATOR_HANDOFF_READY
2. P26F3_5_PIPELINE_PREFLIGHT_COMPLETE_OPERATOR_DROPPED_FILES_AWAITING_IMPORT_APPROVAL
3. P26F3_5_PIPELINE_PREFLIGHT_PARTIAL（任一階段未通過）
4. P26F3_5_TSC_HYGIENE_FAILED
5. P26F3_5_BLOCKED_BY_ARTIFACTS
6. P26F3_5_FAILED_TESTS
7. P26F3_5_FORBIDDEN_CLAIM_DETECTED
```

---

**CEO 結語：**
CTO 的判斷主軸正確（瓶頸在外部 source），但漏了「agent 今天該做什麼」的問題。本輪 agent 不可空轉等 operator；必須一次清完三件事：
1. **Pipeline pre-flight**：synthetic fixture 走完五階段，確保真實 source 進來時不會卡
2. **TSC hygiene**：data-quality/route.ts 既有錯誤修掉，讓 CI 訊號乾淨
3. **Operator handoff**：產出具體 URL/月份/symbol/filename 的取得規格，把 operator 該做的事從「checklist」推進到「可一鍵執行」

完成後，主軸 A 就只剩「operator 放檔案 → P26F4 import gate」一步；同時主軸 B 的 corpus expansion 也才有真實資料地基。