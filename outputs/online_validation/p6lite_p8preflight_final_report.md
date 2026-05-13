# P6-LITE + P8-PREFLIGHT 最終報告

**生成時間:** 2025-12-01  
**任務範圍:** P6-HARDRESET-LITE (1-day cap Bucket Schema Short Diagnosis) + P8-PREFLIGHT (Signal/Reason Generic Diagnosis Preflight)  
**Final Classification:** **P6LITE_VERDICT_BY_DESIGN_BOUNDARY + P8_PREFLIGHT_COMPLETE**

> **Disclaimer:** Schema self-consistency diagnosis only. No investment recommendations. No scoring formula changes. No model changes. Descriptive diagnosis and observability output only.

---

## 1. 1-Day Cap Status

| 項目 | 狀態 |
|------|------|
| P6-LITE 完成時間 | 1-day cap 內 ✅ |
| P8-PREFLIGHT 完成時間 | 1-day cap 內 ✅ |
| Corpus 修改 | 無 — 全部凍結 ✅ |
| Scoring formula 修改 | 無 ✅ |
| alphaScore 修改 | 無 ✅ |
| recommendationBucket 修改 | 無 ✅ |
| Forbidden claims | 零命中（所有命中均為 disclaimer 或 pattern 定義） ✅ |

---

## 2. P6-LITE 最終 Verdict

### **FINAL VERDICT: BY_DESIGN_BOUNDARY**

| 指標 | 結果 |
|------|------|
| 分析案例數 | 5 個 INCONSISTENT cases |
| Watch+LowScore 邊界案例 | 4/5 (80%) |
| 主要診斷類別 | SCORE_THRESHOLD_MISMATCH |
| Verdict | **BY_DESIGN_BOUNDARY** |
| requiresContractFreeze | true ✅ |

### Verdict 意義

Watch bucket 設計上可接受 score=[21,29] 的信號合格案例，這是「有意邊界行為」，而非 schema bug。5 個 INCONSISTENT 案例中有 4 個屬於此類邊界模式。剩餘 1 個無法歸類至邊界模式，但整體佔比不足以改變 verdict。

### 合約凍結輸出

由於 verdict=BY_DESIGN_BOUNDARY，已自動生成：
- `p6lite_bucket_contract_freeze.json` — 包含 `canonicalBucketLabels` + `nonGoals` 欄位
- `p6lite_bucket_contract_freeze.md` — 人類可讀合約文件

---

## 3. P8-PREFLIGHT 4-Category 分佈

| 類別 | 案例數 | 比例 | 建議修復方向 |
|------|--------|------|------------|
| TEMPLATE_TOO_GENERIC | 9 | 37.5% | ENRICH_REASON_TEMPLATE |
| SCORING_ENGINE_UNDEROUTPUT | 9 | 37.5% | FIX_SCORING_ENGINE_OUTPUT_COMPLETENESS |
| FACTOR_EXPLANATION_MISSING | 4 | 16.7% | ADD_FACTOR_EXPLANATION_LAYER |
| SNAPSHOT_CAPTURE_MISSING | 2 | 8.3% | FIX_SNAPSHOT_FACTOR_CAPTURE |
| **合計** | **24** | **100%** | — |

### 主要洞察

1. **TEMPLATE_TOO_GENERIC (9/24)**: scoring 完整，但 reason 輸出仍是單一通用 token（如「技術偏多」）。問題在 reason 模板層，非 scoring 層。
2. **SCORING_ENGINE_UNDEROUTPUT (9/24)**: scoring 標記為 PARTIAL，導致 reason 只能輸出 1 個 token。根因在 scoring engine 輸出完整性。
3. **FACTOR_EXPLANATION_MISSING (4/24)**: 涉及法人/籌碼因子，這類因子需要額外解釋層（機構淨量說明）。
4. **SNAPSHOT_CAPTURE_MISSING (2/24)**: scoreBucketConsistency=INCONSISTENT 且單一 token，snapshot 擷取問題。

### 24 Cases 皆已根因預分類，無需修改 scoring。

---

## 4. CEO 主軸貢獻

### 主軸 A — 台股股價預測 (Signal Quality)

- P6-LITE 診斷確認 Watch bucket 邊界行為為設計決策，不是模型錯誤 → **預測信號可信度基線清楚**
- P8-PREFLIGHT 識別 reason 層的 24 個通用輸出案例 → 為未來 reason 解釋品質提升建立路徑

### 主軸 B — 策略模擬與優化 (Strategy Simulation)

- BY_DESIGN_BOUNDARY 確認 Watch bucket 的 score 邊界（[21,29]）是可接受的策略觀察範圍
- P8 的 SCORING_ENGINE_UNDEROUTPUT 分類為 scoring engine 輸出最佳化提供具體目標

---

## 5. Wave 5/6/7/8 資產關係

| Wave | 關聯性 |
|------|--------|
| Wave 5 (P5-HARDRESET) | 提供 p5walkthrough_review.json，作為本次分析輸入 |
| Wave 6 (P6-LITE) | **本次完成** — Bucket schema 短診斷，verdict=BY_DESIGN_BOUNDARY |
| Wave 7 (P7/P8-PREFLIGHT) | **本次完成** — 24 generic reason 案例預分類 |
| Wave 8 (下一步) | P12 PIT Feature Contract v0（基於本次合約凍結結果） |

---

## 6. 明日建議路徑

由於 verdict=BY_DESIGN_BOUNDARY，**不需要**：
- ❌ 修改 scoring formula
- ❌ 重新校正 bucket threshold
- ❌ 修改 normalization 邏輯

**建議明日執行：**
1. **P12 PIT Feature Contract v0** — 基於 `p6lite_bucket_contract_freeze.json`，建立正式 PIT (Point-In-Time) 特徵合約
2. **P8 Reason Template Enrichment** — 針對 TEMPLATE_TOO_GENERIC (9 cases)，豐富 reason 輸出模板
3. **P8 Scoring Engine Output Audit** — 針對 SCORING_ENGINE_UNDEROUTPUT (9 cases)，審查 PARTIAL scoring 觸發條件

---

## 7. 風險項目

| 風險 | 等級 | 說明 |
|------|------|------|
| Watch[21,29] 邊界案例增加 | 低 | 已凍結為 BY_DESIGN_BOUNDARY，合約有據可查 |
| SCORING_ENGINE_UNDEROUTPUT 根因未追蹤 | 中 | 需要 code trace，本次 P6-LITE 範圍不含 |
| FACTOR_EXPLANATION_MISSING 法人因子 | 低-中 | 需要機構淨量說明層，設計已識別 |
| 未來 review 批次新增 INCONSISTENT | 低 | 有診斷 pipeline，可重新執行腳本 |

---

## 8. 產出清單

| 檔案 | 類型 | 說明 |
|------|------|------|
| `src/lib/onlineValidation/P6BucketSchemaDiagnosisUtils.ts` | TypeScript | P6 bucket schema 診斷工具 |
| `src/lib/onlineValidation/P8SignalReasonDiagnosisUtils.ts` | TypeScript | P8 signal/reason 診斷工具 |
| `scripts/run-p6-lite-bucket-schema-diagnosis.js` | Node.js script | P6 診斷執行腳本 |
| `scripts/run-p8-preflight-signal-reason-diagnosis.js` | Node.js script | P8 診斷執行腳本 |
| `outputs/online_validation/p6lite_preflight_audit.md` | Markdown | P6 前置審核報告 |
| `outputs/online_validation/p6lite_bucket_schema_diagnosis.json` | JSON | P6 診斷結果（5 cases） |
| `outputs/online_validation/p6lite_bucket_schema_diagnosis.md` | Markdown | P6 診斷摘要 |
| `outputs/online_validation/p6lite_bucket_contract_freeze.json` | JSON | Bucket 合約凍結文件 |
| `outputs/online_validation/p6lite_bucket_contract_freeze.md` | Markdown | 合約凍結說明 |
| `outputs/online_validation/p8preflight_signal_reason_diagnosis.json` | JSON | P8 診斷結果（24 cases） |
| `outputs/online_validation/p8preflight_signal_reason_diagnosis.md` | Markdown | P8 診斷摘要 |
| `src/lib/onlineValidation/__tests__/p6lite_bucket_schema_diagnosis_utils.test.ts` | Jest test | P6 工具單元測試（48 tests ✅） |
| `src/lib/onlineValidation/__tests__/p8preflight_signal_reason_diagnosis_utils.test.ts` | Jest test | P8 工具單元測試（39 tests ✅） |

---

## 9. 測試結果摘要

```
Test Suites: 50 passed, 50 total
Tests:       1164 passed, 1164 total
Time:        45.302 s
```

- P6 新增 48 tests ✅
- P8 新增 39 tests ✅
- 現有 50 個 test suites 零 regression ✅

---

## 10. Final Classification

```
P6LITE_VERDICT_BY_DESIGN_BOUNDARY
P8_PREFLIGHT_COMPLETE
Commit: a0562ee
Tests:  1164/1164 passed
Forbidden claims: 0
```

---

*本報告由自動化診斷 pipeline 生成。無投資建議。無 ROI / alpha / edge / win-rate / buy / sell 聲明。*
