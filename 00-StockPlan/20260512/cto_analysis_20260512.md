已完成 CTO 版 roadmap 重排，新增文件：

[stock_roadmapPlan_20260512_cto_reprioritized.md](/Users/kelvin/Kelvin-WorkSpace/Stock-Prediction-System/docs/plans/stock_roadmapPlan_20260512_cto_reprioritized.md)

核心結論：舊 roadmap 把 `P10 Dashboard-ready Metrics Contract` 放在今日 P0，現在已不對齊實際狀態。P5 已明確指出 bucket schema 是阻塞點，所以今日 P0 應改為：

```text
P6-HARDRESET — Bucket Schema Repair Diagnosis
```

我已把 roadmap 調整為：

| Priority | 新排序 |
| --- | --- |
| P0 | P6 Bucket Schema Repair Diagnosis |
| P1 | P7 Bucket Assignment Code Trace / Safe Repair |
| P2 | P8 Signal / Reason Snapshot Quality Repair |
| P3 | P9 Data Coverage and Snapshot Field Population Audit |
| P4 | P10 Dashboard-ready Calibration Metrics Contract |
| P5 | P11 Corpus Expansion Gate v1 |
| P6 | P12 Technical/Event/Fundamental PIT Feature Contract |
| P7 | P13 Factor Attribution and Aggregation Explainability |
| P8 | P14 Simulation Engine Contract Unification |
| P9 | P15 Optimizer Sandbox Readiness Gate |
| P10 | P16 Strategy Optimizer Sandbox v0 / ML Baseline Research |

最值得優化方向是 bucket schema 診斷，不是 UI、不是 corpus expansion、不是 optimizer。原因很直接：`researchBucket` 是預測結果給人和後續模擬看的核心語意欄位；如果 5/58 deterministic cases 已經出現 score/bucket 不一致，後面 dashboard 或 optimizer 都可能放大錯誤解讀。

我也驗證了目前狀態：

- P5 review = 58 rows
- explainability COMPLETE = 58
- score/bucket INCONSISTENT = 5
- signal/reason GENERIC = 24
- frozen corpus line counts 全部符合：60 / 4500 / 9900 / 4500

這次只新增 roadmap 文件，沒有修改既有 dirty worktree 裡的 runtime/output/DB 變更，也沒有跑 code test，因為本輪是 CTO roadmap/document update。
# CEO 二次審查報告 — 2026-05-12

## 1. 昨天成果二次評估

**部分推進，但不是核心戰略推進。**

正面：
- P5 是 P0–P5 觀測鏈最後一塊，58/58 explainability COMPLETE，active scoring「可讀性」門檻已過。
- 凍結 corpus 紀律維持（60 / 4500 / 9900 / 4500），沒有破壞前期資產。
- 68/68 tests + 0 forbidden claims，工程紀律到位。

要誠實面對：
- P0–P5 全是「觀測層」，**到今天為止沒有任何一個新的預測能力或模擬能力上線**。
- 5 個 inconsistent + 24 個 generic 是「審計工具自己找到的審計問題」，本質上是工程內部 debt。
- 對 CEO 主軸 A（技術/時事/基本/籌碼/regime 預測）與主軸 B（策略模擬優化）的直接推進 = 0。

評等：**工程成熟度 +1，產品成熟度 0，戰略推進 0.5。**

---

## 2. CTO 判斷合理性

### 2.1 合理
- Dashboard (P10) 在 schema 不穩前往前推 = 把不一致包裝成權威 → 降級正確。
- Optimizer / ML Baseline 在 contract 不穩前不能跑 → 延後正確。
- ManualReview UI 繼續凍結 → 正確。

### 2.2 不合理或盲點

| 盲點 | 風險 |
| --- | --- |
| P6→P7→P8→P9→P10 連續 5 個都是 observability/contract | 又一週純內務，主軸 A/B 進度依然 0 |
| P12 PIT Feature Contract 被排到第 7 順位 | 這才是技術/時事/基本面真正的串接合約，太晚 |
| 5 個 inconsistent 全在 `Watch + score 21–29` | 同一個 boundary pattern，**很可能是 by-design「低分但仍想觀察」**，不是 schema bug；CTO 把它當多階段阻塞可能過度反應 |
| 24 個 generic reason (41%) 被排到 P2 | 比 5/58 (8.6%) 重要得多，被低估 |
| Wave 5/6/7/8 既有資產（EventSourceQuality / RelevanceOverlay / Coverage / Experiment Registry）沒被整合進新 roadmap | 自己造的輪子沒接回 scoring/explainability |
| 沒有「本週 CEO 看得到什麼新預測能力」milestone | 全是內部工程驗收條件 |

**結論：CTO 方向沒錯，但節奏太內向。把一個 boundary-by-design 的可能誤判當成多階段阻塞，會浪費一週。**

---

## 3. CEO 重排 P0–P10

調整原則：schema 診斷壓到 1 天上限；generic reason (24/58) 升級；PIT Feature Contract 大幅前移；強制接回 Wave 5/6/7/8 既有資產。

| 新優先 | 任務 | 目的 | 完成條件 |
| --- | --- | --- | --- |
| **P0** | P6-LITE Bucket Schema 短診斷 (1 天硬上限) | 判定 5 個 Watch+low-score 是 SCHEMA_BUG / BY_DESIGN / NEEDS_CODE_TRACE | verdict JSON + 對應 contract 或修補建議 |
| **P1** | P8 Signal/Reason Generic 診斷 (24 cases) | 分類成 template / capture / explanation / engine 4 大類 | preflight JSON + repair proposal，不改 scoring |
| **P2** | P7 收尾：BY_DESIGN→contract 凍結，BUG→修補設計 | 結束 bucket schema 議題，不再循環 | 58/58 CONSISTENT 或 boundary 規則 + tests |
| **P3** | **P12 PIT Feature Contract v0 — 技/事/基/籌/regime** | 主軸 A 第一個產品工作 | as-of 安全合約：`publishedAt<=asOf`、財報延遲、月營收延遲、籌碼可得性、缺源語意 + tests |
| **P4** | Wave 5/6/7/8 既有資產回接 scoring snapshot | EventSourceQuality / RelevanceOverlay / Coverage / Experiment Registry 整合進 active scoring | snapshot 內可見三個 signal，且 dashboard 接得到 |
| **P5** | P13 Factor Attribution（消滅 generic reason 根因） | factor→score→bucket 可追溯 | 每 snapshot 有 factor direction / weight / normalized contribution |
| **P6** | P9 Data Coverage & Field Population Audit | 真缺源 vs 沒抓 | 缺源報告 + PIT 規則文件化 |
| **P7** | P10 Dashboard-ready Calibration Metrics Contract | schema/reason/coverage 穩後再 UI | 包含 DATA_LIMITED 警示 |
| **P8** | P11 Corpus Expansion Gate v1 | 上述穩定後才擴 | symbol/date/horizon 規格化 |
| **P9** | P14 Simulation Engine Contract Unification | 主軸 B 入口 | 成本/滑價/部位/流動性假設統一；簡化路徑包裝或棄用 |
| **P10** | P15 + P16 Optimizer Readiness Gate + Sandbox v0 / ML Baseline | 所有 contract 穩後才開閘 | machine-readable gates；sandbox 不可自動寫入 prod |

**關鍵差異 vs CTO 版：**
- P6 從多階段降到 **1 天硬上限**。
- P8 generic reason 從 CTO P2 升到 CEO **P1**。
- P12 PIT Feature Contract 從 CTO P6 升到 CEO **P3**。
- 新增 P4「Wave 5/6/7/8 資產回接」，避免重複造輪子。
- Dashboard、Corpus Expansion 全部壓後。

---

## 4. 今日最應聚焦方向

**今日 P0：P6-LITE 短診斷（≤ 1 天）+ P8 PREFLIGHT 並行。**

止損條件：若 1 天判定 BY_DESIGN → 直接寫 contract，不進 P7；若無法判定 → 明日進 code trace；不論結論為何，今日結束前 P8 preflight 必須交出。

---

## 5. 今天執行任務 Prompt（直接可用）

```text
你是 Stock Prediction System 的 Senior Worker Agent。

任務名稱：
P6-HARDRESET-LITE — Bucket Schema Short Diagnosis (1-day cap)
+ P8-PREFLIGHT — Signal / Reason Generic Diagnosis Preflight

日期：
2026-05-12

工作目錄：
/Users/kelvin/Kelvin-WorkSpace/Stock-Prediction-System

戰略背景：
CEO 主軸 A = 台股股價預測（技術面 / 時事面 / 基本面 / 籌碼 / 市場狀態）
CEO 主軸 B = 策略模擬與優化
P0–P5 已建立觀測鏈，但仍未推進主軸 A/B 任何一個新預測或模擬能力。
本日必須在 1 天內完成診斷，避免再消耗一整週純 observability 工作。

本日唯一允許的兩件事：
1) P6-LITE：判定 P5 的 5 個 score/bucket inconsistent 是 SCHEMA_BUG / BY_DESIGN_BOUNDARY / NEEDS_CODE_TRACE。
2) P8-PREFLIGHT：對 24 個 generic reason cases 做 root-cause 預分類，不改 scoring，只產診斷檔。

絕對不可：
- 修改 scoring formula / alphaScore / recommendationBucket
- 修改 ActiveScoringSnapshotBuilder scoring 行為
- 修改 P0 / P1 / P3 / P4 corpus
- 修改 simulation_snapshot_corpus.jsonl
- 修改 ManualReview* 模組
- 修改 SignalFusion / RuleBased / StrategyScreen 計算邏輯
- 呼叫外部 API / LLM
- 自動交易
- 輸出 buy / sell / recommendation / outperform / guaranteed
- 宣稱 ROI / win-rate / alpha / edge / profit

可以：
- 新增 diagnosis utilities
- 新增 root-cause reports
- 新增 schema contract proposal（僅當 verdict = BY_DESIGN_BOUNDARY 時）
- 新增 unit tests
- 引用既有 Wave 5/6/7/8 模組做解讀（不修這些模組本身）

============================================================
PART A — Pre-flight (≤ 30 min)
============================================================
驗證下列檔案存在且 parse OK：
- outputs/online_validation/p5walkthrough_review.json
- outputs/online_validation/p5walkthrough_repair_backlog.json
- outputs/online_validation/p4calibration_walkthrough_cases.json
- outputs/online_validation/p3active_scoring_historical_replay_corpus.jsonl

凍結 corpus 行數驗證：
- simulation_snapshot_corpus.jsonl = 60
- p0hardreset_historical_replay_corpus.jsonl = 4500
- p1baseline_historical_replay_corpus.jsonl = 9900
- p3active_scoring_historical_replay_corpus.jsonl = 4500

輸出：
- outputs/online_validation/p6lite_preflight_audit.json
- outputs/online_validation/p6lite_preflight_audit.md

若 fail：
- outputs/online_validation/p6lite_escalation_report.md
- Final Classification = P6LITE_BLOCKED_BY_ARTIFACTS（立即停止）

============================================================
PART B — Bucket Schema Short Diagnosis (≤ 3 hours)
============================================================
新增：
- src/lib/onlineValidation/P6BucketSchemaDiagnosisUtils.ts

必須 export：
- extractInconsistentCases(reviewRows)
- normalizeBucketLabel(bucket)              // 中英文 / 空白 / Insufficient Data / 偏多 / 偏空
- inferExpectedBucketFromScore(score, opts)
- diagnoseBucketInconsistency(caseRow, opts)
- summarizeBucketSchemaDiagnosis(rows)
- buildBucketSchemaShortVerdict(summary)    // SCHEMA_BUG | BY_DESIGN_BOUNDARY | NEEDS_CODE_TRACE
- scanForbiddenClaims(text)

對 5 個 inconsistent cases 必須輸出：
- caseId / symbol / asOf / horizon / score / scoreSource
- researchBucket / normalizedBucket
- activeScoringSnapshot bucket vs top-level bucket vs scoreSnapshot fields
- 是否同屬「Watch + score 21–29」boundary pattern
- diagnosisCategory：
  BUCKET_MAPPING_MISMATCH | SCORE_THRESHOLD_MISMATCH | NORMALIZATION_GAP |
  SNAPSHOT_CAPTURE_MISMATCH | FACTOR_AGGREGATION_AMBIGUOUS | UNKNOWN_REQUIRES_CODE_TRACE
- recommendedRepairType
- whyNoModelChangeNow

新增 script：
- scripts/run-p6-lite-bucket-schema-diagnosis.js

輸出：
- outputs/online_validation/p6lite_bucket_schema_diagnosis.json
- outputs/online_validation/p6lite_bucket_schema_diagnosis.md

最終 verdict 必填一個：
1. SCHEMA_BUG           → 明日進 P7 修補設計（不在本日做）
2. BY_DESIGN_BOUNDARY   → 本日順手做 contract 凍結
3. NEEDS_CODE_TRACE     → 明日進 P7 code trace（不在本日做）

若 verdict = BY_DESIGN_BOUNDARY，追加輸出：
- outputs/online_validation/p6lite_bucket_contract_freeze.json
- outputs/online_validation/p6lite_bucket_contract_freeze.md
內容：canonical labels / Watch 接受 score 區間 / normalization 規則 / non-goals。

不得用 realized return 決定 bucket 是否正確；只可檢查 score/bucket/schema 自洽性。

============================================================
PART C — P8 Signal / Reason Generic Preflight (≤ 2 hours)
============================================================
新增：
- src/lib/onlineValidation/P8SignalReasonDiagnosisUtils.ts

對 24 個 generic reason cases 必須分類成：
- TEMPLATE_TOO_GENERIC         (reason template 本身太籠統)
- SNAPSHOT_CAPTURE_MISSING     (snapshot 沒抓到 factor)
- FACTOR_EXPLANATION_MISSING   (factor 有但沒解釋)
- SCORING_ENGINE_UNDEROUTPUT   (scoring 本身輸出不足)
- UNKNOWN_REQUIRES_CODE_TRACE

每個 case 輸出：
- caseId / symbol / asOf / horizon
- reasonRaw / reasonNormalized
- factorCount / factorSummary
- diagnosisCategory + evidence + recommendedRepairType

新增 script：
- scripts/run-p8-preflight-signal-reason-diagnosis.js

輸出：
- outputs/online_validation/p8preflight_signal_reason_diagnosis.json
- outputs/online_validation/p8preflight_signal_reason_diagnosis.md

本日不修任何 reason / signal 邏輯，只做分類診斷。

============================================================
PART D — Tests (≤ 1 hour)
============================================================
新增：
- src/lib/onlineValidation/__tests__/p6lite_bucket_schema_diagnosis_utils.test.ts
- src/lib/onlineValidation/__tests__/p8preflight_signal_reason_diagnosis_utils.test.ts

至少涵蓋：
- normalizeBucketLabel 中英文 / 空白 / InsufficientData / 偏多 / 偏空 變體
- inferExpectedBucketFromScore deterministic
- diagnoseBucketInconsistency 命中三大代表類別
- buildBucketSchemaShortVerdict 三 verdict 各自能命中
- P8 4 大 category 各自能命中
- forbidden claim scanner 抓得到 ROI / alpha / edge / profit / outperform / buy / sell / guaranteed
- 不使用 Math.random
- 不修改任何 corpus 檔

執行：
- npx jest src/lib/onlineValidation/__tests__/p6lite_bucket_schema_diagnosis_utils.test.ts --no-coverage
- npx jest src/lib/onlineValidation/__tests__/p8preflight_signal_reason_diagnosis_utils.test.ts --no-coverage
- npx jest src/lib/onlineValidation/__tests__ --no-coverage

============================================================
PART E — Forbidden Claims Scan
============================================================
grep -RniE "ROI|win[- ]rate|\balpha\b|\bedge\b|\bprofit\b|outperform|beat|\bbuy\b|\bsell\b|guaranteed|investment recommendation" \
  outputs/online_validation/p6lite_* outputs/online_validation/p8preflight_* \
  src/lib/onlineValidation/P6BucketSchemaDiagnosisUtils.ts \
  src/lib/onlineValidation/P8SignalReasonDiagnosisUtils.ts \
  scripts/run-p6-lite-bucket-schema-diagnosis.js \
  scripts/run-p8-preflight-signal-reason-diagnosis.js || true

允許：disclaimer / 測試資料 / 欄位名 alphaScore。
若有非 disclaimer 語境，必須修正。

============================================================
PART F — Artifact Validation
============================================================
- 所有 p6lite_*.json + p8preflight_*.json parse OK
- 凍結 corpus 行數未變
- p6lite diagnosis cases.length === 5
- p8preflight diagnosis cases.length === 24
- 若 verdict = BY_DESIGN_BOUNDARY，contract_freeze.json 必須含 canonicalBucketLabels 與 nonGoals

============================================================
PART G — Commit
============================================================
全部 PASS 才 commit：

P6-LITE + P8-PREFLIGHT: Bucket schema short diagnosis + reason generic preflight

- New: bucket schema short diagnosis utilities (1-day cap)
- New: short verdict (SCHEMA_BUG / BY_DESIGN_BOUNDARY / NEEDS_CODE_TRACE)
- New: P8 signal/reason generic preflight (24 cases classified)
- Frozen: P0/P1/P3/P4/simulation corpus unchanged
- Frozen: scoring formula / alphaScore / recommendationBucket unchanged
- No ROI / alpha / edge / win-rate / buy / sell claims

============================================================
PART H — Final Report
============================================================
新增：
- outputs/online_validation/p6lite_p8preflight_final_report.md

需包含：
1. 1-day cap 是否守住
2. P6-LITE final verdict（三選一）
3. P8-PREFLIGHT 4 大類別分布
4. 對 CEO 主軸 A（技術/時事/基本面預測）與主軸 B（策略模擬）的具體貢獻
5. 既有 Wave 5/6/7/8 資產與本輪診斷結論的關係
6. 明日建議路徑：
   - 若 verdict = BY_DESIGN_BOUNDARY → 明日直接進 P12 PIT Feature Contract v0（主軸 A 第一步）
   - 若 verdict = SCHEMA_BUG → 明日 P7 修補設計
   - 若 verdict = NEEDS_CODE_TRACE → 明日 P7 code trace
7. 風險與不確定點
8. Final Classification 五選一：
   - P6LITE_VERDICT_BY_DESIGN_BOUNDARY + P8_PREFLIGHT_COMPLETE
   - P6LITE_VERDICT_SCHEMA_BUG + P8_PREFLIGHT_COMPLETE
   - P6LITE_VERDICT_NEEDS_CODE_TRACE + P8_PREFLIGHT_COMPLETE
   - P6LITE_BLOCKED_BY_ARTIFACTS
   - P6LITE_TIMECAP_EXCEEDED（1-day cap 沒守住，必須回報）
```