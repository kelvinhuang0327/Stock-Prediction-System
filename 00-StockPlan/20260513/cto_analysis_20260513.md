已完成 CTO roadmap 重排與文件更新。

更新位置：
- [stock_roadmapPlan_20260513_cto_reprioritized.md](/Users/kelvin/Kelvin-WorkSpace/Stock-Prediction-System/docs/plans/stock_roadmapPlan_20260513_cto_reprioritized.md:1) 新增為 5/13 canonical roadmap
- [stock_roadmapPlan_20260504.md](/Users/kelvin/Kelvin-WorkSpace/Stock-Prediction-System/00-StockPlan/stock_roadmapPlan_20260504.md:21) 已在原始 roadmap 頂部加入 5/13 CTO alignment update
- [cto_analysis_20260513.md](/Users/kelvin/Kelvin-WorkSpace/Stock-Prediction-System/00-StockPlan/20260513/cto_analysis_20260513.md:1) 已加入本次 CTO 三次審查結論
- [stock_roadmapPlan_20260512_cto_reprioritized.md](/Users/kelvin/Kelvin-WorkSpace/Stock-Prediction-System/docs/plans/stock_roadmapPlan_20260512_cto_reprioritized.md:8) 已標註被 5/13 版取代

核心結論：P6 bucket schema 已由 P6-LITE 判定為 `BY_DESIGN_BOUNDARY`，P25 MonthlyRevenue post-migration observability 也已完成，所以 roadmap 不應再卡在 bucket repair 或 migration replay。新 P0 改為：

```text
P26-A Prediction Feature Snapshot v1 + Reason / Factor Enrichment
```

新排序重點：
- P0：Prediction Feature Snapshot v1 + Reason / Factor Enrichment
- P1：Event / News PIT Context Adapter v0
- P2：FinancialReport Availability Contract + Fixture Dry Run
- P3：Targeted Post-Migration Replay / Coverage Comparison
- P4 之後才做 corpus expansion、simulation contract、optimizer readiness

關鍵阻塞已明確寫入 roadmap：24/58 generic reason、P12 contract stale、時事面尚未 PIT-safe 接入、FinancialReport 缺 availabilityDate、simulation corpus 仍 `BLOCKED` 且 coverageRatio 只有 0.2333。

本輪是文件/roadmap 更新，沒有改程式碼，也沒有跑測試。
# CEO 二次審查 — 2026-05-13

## 一、昨日成果評估（P25 是否真的推進系統成熟度？）

**結論：P25 屬於「鞏固性勝利」，不是「主軸推進」。**

P25 完成的事項（observability + smoke）本質上是 P24 production migration 的安全驗證殼層，它證明 MonthlyRevenue releaseDate gate 在 production schema 上不會炸掉，但並沒有：
- 將 MonthlyRevenue 真正帶入 active scoring 的 reason/factor 評估鏈（P3/P19 corpus 仍然是 `NOT_APPLICABLE_NO_DATA`）
- 改善 P8 標記的 24/58 generic reason 問題
- 推進時事面（NewsEvent）PIT 接入
- 解決 simulation corpus `BLOCKED` + coverageRatio 0.2333 的問題

也就是說，P25 是必要的、做得正確的、但對主軸 A（台股預測）/ 主軸 B（模擬優化）的「可決策性」是**零增量**。再做一輪 migration replay 是 **diminishing return**。

## 二、CTO 判斷是否合理？盲點與誤判

**合理的部分：**
1. 把 P0 改成 `Prediction Feature Snapshot v1 + Reason/Factor Enrichment` 是正確的，這直接打到 24/58 generic reason 的信任缺口。
2. 把 broad replay comparison 降到 P3 是正確的 — P20 已經證明零 scoring delta。
3. 把 optimizer 放在 readiness gate 後是正確的 — 60 entries / 2 symbols / coverageRatio 0.2333 的 simulation corpus 不可能支撐任何 optimizer 結論。
4. 識別 P12 contract 已過時是正確的關鍵洞察。

**盲點與需修正：**
1. **CTO 未明確將「scoring purity invariance」設為 P0 hard gate。** 24 generic reason 中有 9 個是 `scoring underoutput` — 這類案例很容易在「修 reason」的旗號下偷偷動 score。必須要求：P0 完成後在 P3/P19 corpus 上 byte-level reproduce 既有 alphaScore + recommendationBucket。
2. **CTO 把 P12 v1 refresh 寫在 P0 內文但沒列為獨立交付物。** 應該明確要求 `p12pit_feature_contract_v1.json/.md` 作為 P0 必交檔案，否則下輪會因為文件過時再被卡住。
3. **CTO 對 9 個「scoring underoutput」案例的處理路徑不夠清楚。** 這 9 個案例若真的是 score 不該輸出但輸出了 / 該輸出但沒輸出 — 應單獨歸為「**read-only score-output audit**」，並 *不在本輪修正 score*，只在本輪產出 audit artifact，留到 P0.5 或 P2 再評估。
4. **沒有明確禁止 reason enrichment 引入新 factor。** 必須要求：reason 只能描述「scoring formula 已經用過的 factor」，不可以新增任何不在 SignalFusionEngine 或 RuleBasedStockAnalyzer 中已計算的 factor。否則就會無聲擴大 model surface。
5. **P25 報告中的 `data-quality/route.ts` 既有 TS error 必須持續被排除確認，不可吞掉。** CTO 文件有提，但本輪 prompt 必須機械化 enforce。

## 三、實作進度確認（兩大主軸）

| 主軸 | 維度 | 狀態 | 缺口 |
| --- | --- | --- | --- |
| A 預測 | 技術面 | 已整合 | reason 過於 generic |
| A 預測 | 籌碼面 | 已整合 | factor 解釋不足 |
| A 預測 | 基本面 — MonthlyRevenue | PIT 已修 / 已 migrate / 已 smoke | **尚未真的進到 reason 評估鏈** |
| A 預測 | 基本面 — FinancialReport | 未啟用 | 缺 `availabilityDate` 契約 |
| A 預測 | 時事面 — NewsEvent | 模組存在但未進 scoring | 缺 PIT context adapter |
| A 預測 | 市場 regime | 已整合 | OK |
| B 模擬 | replay corpus | 4,500 rows 凍結 | OK |
| B 模擬 | simulation corpus | `BLOCKED` / coverage 0.2333 | **尚未具備 optimizer 條件** |
| B 模擬 | backtest engine | 骨架存在 | contract 未統一 |
| B 模擬 | optimizer | 不存在 | 須等 readiness gate |

主軸 A 缺口 ≥ 主軸 B 缺口。**今日聚焦主軸 A 的 reason / factor / 時事面銜接。**

## 四、CEO 重排 P0–P10

| Priority | Task | 與 CTO 差異 |
| --- | --- | --- |
| **P0** | **P26-A Prediction Feature Snapshot v1 + Reason/Factor Enrichment + P12 v1 contract refresh + scoring purity invariance gate** | 把 P12 v1 refresh 合併入 P0 必交；scoring invariance 變 hard gate |
| **P1** | **P26-B Event/News PIT Context Adapter v0**（read-only snapshot metadata） | 維持 CTO 順序，強調不進 scoring |
| **P2** | **P26-C FinancialReport Availability Contract + Fixture Dry Run** | 維持 |
| **P3** | **P26-D Targeted Post-Migration Replay / Coverage Comparison**（real MonthlyRevenue-available rows） | 維持 |
| **P4** | **Scoring Output Underflow Audit (read-only)** ← 從 CTO P0 中拆出 9 案例 | 新增；只 audit 不修 |
| **P5** | **Data Coverage / Corpus Expansion Gate v2** | 維持 |
| **P6** | **Simulation Engine Contract Unification (paper-design only)** | 維持但限定本輪僅 design |
| **P7** | **Optimizer Sandbox Readiness Gate v1**（machine-readable gates） | 維持 |
| **P8** | **Dashboard Contract v1 for Prediction Snapshot Health** | 維持 |
| **P9** | **Autonomous Scheduler / Learning Safety Repair** | 維持 |
| **P10** | **ML Baseline / Ensemble Research v0 + ManualReview v2** | 合併最末位 |

---

## 五、今日最應聚焦的系統優化方向

**P0 = P26-A Prediction Feature Snapshot v1 + Reason / Factor Enrichment + P12 v1 Contract Refresh**

理由：直接消解 24/58 generic reason 的信任缺口，補完 axis A 表達能力，並把已修好的 MonthlyRevenue 真正帶進 reason / factor snapshot，**且不動任何 scoring 邏輯**。

---

## 六、最新開始執行的任務 Prompt

```text
你是 Stock Prediction System 的 Senior Prediction Feature Snapshot Agent。

任務名稱：
P26A-HARDRESET — Prediction Feature Snapshot v1 + Reason / Factor Enrichment + P12 v1 Contract Refresh

日期：
2026-05-13

工作目錄：
/Users/kelvin/Kelvin-WorkSpace/Stock-Prediction-System

目前狀態：
P25-HARDRESET 已完成（commits 330b8ea + e2cc962）：
- Final Classification: P25_POST_MIGRATION_OBSERVABILITY_COMPLETE
- MonthlyRevenue releaseDate schema / migration / backfill / smoke = PASS
- P6-LITE bucket schema = BY_DESIGN_BOUNDARY（不再為 P0 blocker）
- P8-PREFLIGHT 已標記 24/58 generic reason 案例，分類：
    - 9 = TEMPLATE_GENERIC
    - 9 = SCORING_UNDEROUTPUT
    - 4 = FACTOR_EXPLANATION_INSUFFICIENT
    - 2 = SNAPSHOT_CAPTURE_GAP
- P12 PIT feature contract 仍為 v0，仍將 MonthlyRevenue 描述為「pending high-risk repair」
- Frozen corpus 60 / 4500 / 9900 / 4500 / 4500 unchanged
- scoring formula / alphaScore / recommendationBucket 不得改動

本輪目標：
1. 將 24/58 generic reason 案例的 TEMPLATE_GENERIC（9）+ FACTOR_EXPLANATION_INSUFFICIENT（4）+ SNAPSHOT_CAPTURE_GAP（2）共 15 個案例修復至 reason 可審查
2. 將 SCORING_UNDEROUTPUT（9）僅做 read-only audit，不修 score、不修 reason 模板
3. 將 MonthlyRevenue（已 PIT-safe）帶進 reason / factor snapshot（讀取現有 releaseDate gate，不新增 factor）
4. Refresh P12 PIT feature contract 到 v1：MonthlyRevenue 由 HIGH-RISK → REPAIRED，並列出剩餘 HIGH/MEDIUM 來源
5. 在 P3 / P19 active scoring corpus 上 byte-level invariance check：alphaScore + recommendationBucket 不變
6. 在 P5 walkthrough 58 案例上 rerun，產出 reason 品質改善量化

本輪不是模型調參。
本輪不是 corpus regeneration。
本輪不是投資績效評估。
本輪不是 scoring 修改。

本輪不得：
- 修改 alphaScore 計算
- 修改 recommendationBucket thresholds
- 修改 RuleBasedStockAnalyzer / SignalFusionEngine 的權重或門檻
- 在 reason 中加入「不在 SignalFusionEngine 或 RuleBasedStockAnalyzer 已計算 factor 之外」的新 factor
- 修改 P0 / P1 / P3 / P4 / P19 / simulation corpus
- 修改 ManualReview* 模組
- 修改 production MonthlyRevenue 欄位值
- 用 outcomePrice / returnPct / realizedReturnClass 作為 reason 生成輸入
- 呼叫外部 API / LLM
- 自動交易
- 宣稱 ROI / win-rate / alpha / edge / profit / outperform
- 輸出 buy / sell / recommendation / guaranteed
- 修復 SCORING_UNDEROUTPUT 9 案例（僅 audit，不修）

本輪可以：
- 讀取 P5 / P8 / P12 / P17 / P25 artifacts
- 新增 PredictionFeatureSnapshotV1 utilities
- 新增 reason template enrichment utilities（read-only over existing factors）
- 新增 P12 v1 contract refresh artifact
- 新增 scoring purity invariance check
- 重跑 P5 walkthrough review（reason 品質維度）
- 重跑 active scoring smoke
- 新增 tests
- 新增 final report

============================================================
PART A — Pre-flight Gate
============================================================

A.1 必要 artifacts 存在性檢查：
- outputs/online_validation/p5walkthrough_final_report.md
- outputs/online_validation/p5walkthrough_review.json
- outputs/online_validation/p8preflight_generic_reason_audit.json（或對應命名）
- outputs/online_validation/p12pit_feature_contract_final_report.md
- outputs/online_validation/p17monthly_revenue_final_report.md
- outputs/online_validation/p25post_migration_observability_final_report.md
- outputs/online_validation/p3active_scoring_historical_replay_corpus.jsonl（4500 行）
- outputs/online_validation/p19active_scoring_pit_replay_corpus.jsonl（4500 行）

A.2 Frozen corpus line check：
- simulation_snapshot_corpus.jsonl = 60
- p0hardreset_historical_replay_corpus.jsonl = 4500
- p1baseline_historical_replay_corpus.jsonl = 9900
- p3active_scoring_historical_replay_corpus.jsonl = 4500
- p19active_scoring_pit_replay_corpus.jsonl = 4500

A.3 P25 結論驗證：
- Final Classification = P25_POST_MIGRATION_OBSERVABILITY_COMPLETE
- productionMigrationApplied = true
- scoring formula unchanged

A.4 程式碼基線快照：
- 記錄 RuleBasedStockAnalyzer.ts / SignalFusionEngine.ts / ActiveScoringSnapshotBuilder*.ts 的 sha256
- 本輪結束時必須與基線比對：若有差異，必須屬於 reason / snapshot enrichment 範圍，不得觸及 score 計算 path

輸出：
- outputs/online_validation/p26a_feature_snapshot_preflight.json
- outputs/online_validation/p26a_feature_snapshot_preflight.md

若 artifacts 不完整：
- outputs/online_validation/p26a_feature_snapshot_escalation_report.md
- Final Classification = P26A_BLOCKED_BY_ARTIFACTS

============================================================
PART B — P12 PIT Feature Contract v1 Refresh
============================================================

新增：
- outputs/online_validation/p12pit_feature_contract_v1.json
- outputs/online_validation/p12pit_feature_contract_v1.md
- src/lib/onlineValidation/P12FeatureContractV1Utils.ts

必須描述：
1. 每個 feature source 的 PIT 狀態：
    - Quote（TWSE / TPEX）— ALREADY_PIT_GATED
    - MarketRegime — ALREADY_PIT_GATED
    - InstitutionalChip — ALREADY_PIT_GATED
    - MonthlyRevenue — REPAIRED_2026_05_12（references P17/P24/P25）
    - FinancialReport — STILL_HIGH_RISK_NOT_PIT_GATED
    - NewsEvent — STILL_HIGH_RISK_NOT_PIT_GATED
2. 每個 feature 的 asOf gate 規則（publishedAt vs ingestedAt vs releaseDate）
3. 每個 feature 在 active scoring snapshot 中應出現的欄位
4. 哪些 feature 目前實際進入 alphaScore（必須與 SignalFusionEngine 對齊）
5. 哪些 feature 進入 reason / factor snapshot 但不影響 score
6. 已知 staleness：原 v0 中所有「MonthlyRevenue HIGH-RISK pending repair」描述必須被 supersedes

P12 v1 不得：
- 新增任何不在現有 codebase 計算的 feature
- 預先承諾 FinancialReport / NewsEvent 進 scoring 的時程
- 描述任何 outcome / return 相關欄位作為 feature

============================================================
PART C — Reason Enrichment Utility（Read-only over existing factors）
============================================================

新增：
src/lib/onlineValidation/P26AReasonFactorEnrichmentUtils.ts

必須 export：
- enrichReasonFromExistingFactors(snapshot)
- attachMonthlyRevenueContextToReason(snapshot, monthlyRevenueAvailability)
- attachRegimeContextToReason(snapshot, regimeAssessment)
- attachChipContextToReason(snapshot, chipScore)
- attachTechnicalContextToReason(snapshot, technicalScore)
- buildFactorEvidenceBlock(snapshot)
- classifyReasonQuality(reasonText, factorEvidence)
- validateReasonDoesNotIntroduceNewFactor(reasonText, allowedFactorSet)
- validateReasonHasNoForbiddenClaim(reasonText)

Hard rules：
1. enrichReasonFromExistingFactors 必須是 pure function，輸入相同 snapshot 必須輸出相同 reason
2. 所有 factor 必須屬於 allowedFactorSet（由 SignalFusionEngine + RuleBasedStockAnalyzer 已使用的 factor 列舉）
3. 不得讀取 outcomePrice / returnPct / realizedReturnClass
4. 不得呼叫外部 API
5. 不得使用 Math.random
6. 不得修改傳入的 snapshot object

============================================================
PART D — Scoring Output Underflow Audit (Read-only)
============================================================

新增 script：
scripts/run-p26a-scoring-underoutput-audit.js

針對 P8 標記的 9 個 SCORING_UNDEROUTPUT 案例：
- 列出每個案例的 symbol / asOf / horizon
- 列出當時 active scoring snapshot 中每個 factor 的 raw 值
- 列出 SignalFusionEngine 的 contribution
- 列出 final alphaScore + recommendationBucket
- 列出對應 reason / factor snapshot 為何空泛
- 分類為：
    a) factor 確實沒觸發任何 SignalFusionEngine 訊號（NO_TRIGGERED_FACTOR）
    b) factor 觸發但 contribution 太小未被 reason 模板採用（CONTRIBUTION_BELOW_REASON_THRESHOLD）
    c) factor 觸發但 reason 模板缺對應分支（TEMPLATE_BRANCH_MISSING）
    d) 無法歸類（UNKNOWN_NEEDS_CODE_TRACE）

輸出：
- outputs/online_validation/p26a_scoring_underoutput_audit.json
- outputs/online_validation/p26a_scoring_underoutput_audit.md

本 PART 嚴禁修改 score / threshold / 模板分支。
任何 (c) 案例若可由「擴增 reason template 對應分支」修復 — 在 PART E 處理，但仍不得改 score。
任何 (a)(b)(d) 案例僅 audit，不修。

============================================================
PART E — Apply Reason Enrichment to TEMPLATE_GENERIC + FACTOR_EXPLANATION + SNAPSHOT_CAPTURE 案例
============================================================

針對 P8 標記的 15 個非 SCORING_UNDEROUTPUT 案例：
- 9 TEMPLATE_GENERIC
- 4 FACTOR_EXPLANATION_INSUFFICIENT
- 2 SNAPSHOT_CAPTURE_GAP

修復路徑：
- TEMPLATE_GENERIC → reason 模板根據既有 factor evidence 增加描述
- FACTOR_EXPLANATION_INSUFFICIENT → 在 factor snapshot 中暴露既有 numeric evidence（不新增 factor）
- SNAPSHOT_CAPTURE_GAP → 補捕捉 RuleBased / SignalFusion 已計算但未寫入 snapshot 的欄位

修改檔案僅限：
- 既有 reason template / factor snapshot 寫入 path
- 不得修改 score 計算 path

修改後必須執行 PART F invariance check 才能 commit。

============================================================
PART F — Scoring Purity Invariance Gate（HARD GATE）
============================================================

新增 script：
scripts/run-p26a-scoring-invariance-check.js

對 P3 / P19 corpus 全 4500 + 4500 = 9000 rows：
- 重跑 active scoring（使用本輪修改後的程式碼）
- 比對每一 row 的 alphaScore + recommendationBucket
- 若有任何一個 row 的 alphaScore 或 recommendationBucket 不同 → 立即失敗

輸出：
- outputs/online_validation/p26a_scoring_invariance_check.json
- outputs/online_validation/p26a_scoring_invariance_check.md

驗收：
- mismatchedAlphaScoreCount = 0
- mismatchedBucketCount = 0
- 否則 Final Classification = P26A_SCORING_INVARIANCE_BROKEN

============================================================
PART G — Re-run P5 Walkthrough Reason Quality Comparison
============================================================

新增 script：
scripts/run-p26a-walkthrough-reason-quality-compare.js

針對 P5 的 58 案例：
- 重新生成 reason / factor snapshot（使用本輪修改後程式碼）
- 與 P5 baseline 對照
- 用 classifyReasonQuality 重新分類
- 報告：
    - 原 generic 24 案例中有幾個變為 RICH
    - 原 RICH 案例是否有退化
    - score / bucket（必須 100% 不變，與 PART F 互相驗證）

輸出：
- outputs/online_validation/p26a_walkthrough_reason_quality_compare.json
- outputs/online_validation/p26a_walkthrough_reason_quality_compare.md

驗收：
- generic 案例下降至 <= 6（24 - 至少 18 修復），或所有未修復案例都已歸類為 SCORING_UNDEROUTPUT（read-only audit）
- 無 RICH 退化
- score / bucket invariance 與 PART F 一致

============================================================
PART H — Active Scoring Smoke Regression
============================================================

新增 script：
scripts/run-p26a-active-scoring-smoke-regression.js

沿用 P25 smoke 樣本（>=5 symbols / >=5 asOfDates）：
- 確認 RuleBasedStockAnalyzer 仍可呼叫
- 確認 ActiveScoringSnapshotBuilder 仍可呼叫
- 確認 MonthlyRevenue PIT gate 仍 obey releaseDate <= asOfDate
- 確認 snapshot 不含 outcomePrice / returnPct / realizedReturnClass
- 確認新的 reason enrichment 不引入 forbidden claim

輸出：
- outputs/online_validation/p26a_active_scoring_smoke_regression.json
- outputs/online_validation/p26a_active_scoring_smoke_regression.md

============================================================
PART I — Tests
============================================================

新增測試：
src/lib/onlineValidation/__tests__/p26a_reason_factor_enrichment_utils.test.ts
src/lib/onlineValidation/__tests__/p12pit_feature_contract_v1_utils.test.ts

至少涵蓋：
- enrichReasonFromExistingFactors 是 pure function（同輸入同輸出）
- validateReasonDoesNotIntroduceNewFactor 拒絕新 factor
- validateReasonHasNoForbiddenClaim 拒絕 ROI / alpha / edge / win-rate / profit / outperform / buy / sell / guaranteed
- classifyReasonQuality 對 generic / rich / underoutput 三類有確定性分類
- P12 v1 contract 不含任何 outcome 欄位
- P12 v1 contract MonthlyRevenue 狀態為 REPAIRED_2026_05_12
- P12 v1 contract FinancialReport / NewsEvent 仍標記 STILL_HIGH_RISK
- 無 Math.random
- 無對 P0 / P1 / P3 / P4 / P19 / simulation corpus 的修改

執行：
npx jest src/lib/onlineValidation/__tests__/p26a_reason_factor_enrichment_utils.test.ts --no-coverage
npx jest src/lib/onlineValidation/__tests__/p12pit_feature_contract_v1_utils.test.ts --no-coverage
npx jest src/lib/onlineValidation/__tests__ --no-coverage
npx jest src/lib/data/__tests__ --no-coverage
npx tsc --noEmit

若 tsc 出現既有 src/app/api/admin/data-quality/route.ts 非本輪錯誤：
- 必須列出該錯誤完整訊息
- 必須確認該錯誤不來自本輪新增/修改檔案
- 不得吞掉

============================================================
PART J — Forbidden Claims Scan
============================================================

grep -RniE "ROI|win-rate|win rate|alpha|edge|profit|outperform|beat|buy|sell|guaranteed|investment recommendation" \
  outputs/online_validation/p26a* \
  outputs/online_validation/p12pit_feature_contract_v1* \
  src/lib/onlineValidation/P26AReasonFactorEnrichmentUtils.ts \
  src/lib/onlineValidation/P12FeatureContractV1Utils.ts \
  scripts/run-p26a-*.js \
  || true

允許：
- disclaimer context
- forbidden claim scanner test data
- 欄位名稱 alphaScore

============================================================
PART K — Artifact Validation
============================================================

JSON parse：
for f in outputs/online_validation/p26a_*.json outputs/online_validation/p12pit_feature_contract_v1.json; do
  node -e "JSON.parse(require('fs').readFileSync('$f','utf8')); console.log('$f OK')"
done

Frozen line count check（與 P25 同樣的 60 / 4500 / 9900 / 4500 / 4500）

程式碼基線比對：
- 若 RuleBasedStockAnalyzer.ts / SignalFusionEngine.ts 的 sha256 與 PART A 紀錄不同 → 失敗
  （除非 diff 範圍經 PART F invariance gate 證實 0 mismatch）

============================================================
PART L — Commit
============================================================

若全部 PASS，commit：

P26A-HARDRESET: Prediction Feature Snapshot v1 + Reason / Factor Enrichment + P12 v1

- New: P12 PIT feature contract v1（MonthlyRevenue REPAIRED）
- New: reason / factor enrichment utility（read-only over existing factors）
- New: scoring purity invariance gate（P3 + P19 = 9000 rows / 0 mismatch）
- New: walkthrough reason quality compare（generic 24 → N reduced）
- New: scoring underoutput audit（9 案例 read-only，不修 score）
- Frozen: P0 / P1 / P3 / P19 / simulation corpus unchanged
- Frozen: alphaScore / recommendationBucket unchanged
- No scoring formula change
- No new factor introduced into reason
- No ROI / alpha / edge / win-rate / profit / outperform / buy / sell claim

============================================================
PART M — Final Report
============================================================

新增：
outputs/online_validation/p26a_feature_snapshot_v1_final_report.md

格式：

P26A-HARDRESET Final Report

1. 本輪目標
2. P25 recap + P26A scope
3. Pre-flight 結論
4. P12 v1 contract 變更摘要
5. Reason enrichment 修復案例摘要（15 案例）
6. Scoring underoutput audit 結果（9 案例 read-only）
7. Scoring purity invariance gate 結果
8. P5 walkthrough reason quality 比對
9. Active scoring smoke regression
10. Frozen corpus 驗證
11. 修改 / 新增檔案清單
12. 測試結果 / regression
13. TypeScript validation（含既有 data-quality 錯誤是否仍存在）
14. Forbidden claims scan
15. Artifact validation
16. 對 CEO 兩大主軸貢獻
    - 主軸 A：直接貢獻；MonthlyRevenue 進入 reason，technical/chip/regime reason 表達更可審查
    - 主軸 B：上游貢獻；穩定 feature snapshot 是 simulation contract 統一的前提
17. 風險與不確定點（特別是 9 個 underoutput 案例的後續處理）
18. 下一輪建議
    - 若 PASS：P26-B Event/News PIT Context Adapter v0
    - 若 invariance broken：P26A_FIX_INVARIANCE
    - 若 reason quality 未顯著改善：P26A-2 reason template deepening
    - 若 underoutput audit 顯示 template branch missing 普遍：P0.5 Template Branch Repair（仍 read-only over score）
19. Final Classification

Final Classification 七選一：
1. P26A_FEATURE_SNAPSHOT_V1_COMPLETE
2. P26A_REASON_QUALITY_PARTIAL（generic 仍 > 6 但 invariance PASS）
3. P26A_SCORING_INVARIANCE_BROKEN
4. P26A_P12_V1_REFRESH_FAILED
5. P26A_BLOCKED_BY_ARTIFACTS
6. P26A_FAILED_TESTS
7. P26A_FORBIDDEN_CLAIM_DETECTED
```

---

**CEO 結語：**
昨天 P25 是必要的安全鞏固，但今天必須回到主軸 A 的可決策性。本輪三個鐵則：
1. 不動 score、不動 bucket — `PART F invariance gate` 強制執行
2. reason 不引入新 factor — `validateReasonDoesNotIntroduceNewFactor` 把關
3. 9 個 underoutput 案例只 audit 不修 — 留給專門的下一輪評估

完成 P26-A 後，主軸 A 才有資格往 P1（時事面 PIT 接入）推進；主軸 B 在 P5/P6/P7 readiness gate 之前都繼續凍結。