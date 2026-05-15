# P28B: Fixture & Test Plan

**Date:** 2026-05-19  
**Phase:** P28B-REASON-TEMPLATE-COVERAGE-HARDRESET

---

## Test File

`src/lib/onlineValidation/__tests__/p28b_reason_template_coverage_plan.test.ts`

**Total Test Cases:** 10 core + 1 mixed-signal + 2 score-zero inference = 13 total

---

## Core Test Cases (10)

| ID | Name | Trigger | Expected Outcome |
|----|------|---------|-----------------|
| FX-01 | no_triggered_factor_single_token | Single-token + empty factorSnapshot | FALLBACK_EMPTY |
| FX-02 | no_triggered_factor_with_factor_snapshot | Single-token + 10-item factorSnapshot | ENRICHED + context note |
| FX-03 | missing_monthly_revenue | MonthlyRevenue in missingSources | ENRICHED + `'月營收暫缺'` note |
| FX-04 | factor_snapshot_empty_fallback | `'法人買超'` + empty factorSnapshot | FALLBACK_EMPTY |
| FX-05 | multiple_factor_families | Technical + Chip + Momentum factors | ENRICHED, factorCount >= 3 |
| FX-06 | alpha_score_unchanged | Any enrichment | `alphaScoreUnchanged === true` |
| FX-07 | bucket_unchanged | Any enrichment | `bucketUnchanged === true` |
| FX-08 | no_outcome_fields_in_rendered_text | ENRICHED output | renderedReason not contains 'alphaScore', 'bucket', 'scoring formula' |
| FX-09 | forbidden_claims_clean | ENRICHED output | No forbidden investment claims |
| FX-10 | deterministic_output | Call renderer twice with same input | result1 === result2 |

---

## Mixed-Signal Test Cases

| ID | Name | Trigger | Expected Outcome |
|----|------|---------|-----------------|
| FX-MS-01 | mixed_signal_ma_bearish_macd_bullish | MA 空頭排列 + MACD 多方動能 | ENRICHED + '分歧' in text, no buy/sell language |

---

## Score-Zero Inference Test Cases

| ID | Name | Function | Expected Result |
|----|------|----------|----------------|
| FX-SZ-01 | ma_bullish_zero_tech_score_infers_direction | `inferDirectionFromMATrend('MA 趨勢：多頭排列...')` | `'偏多'` |
| FX-SZ-02 | ma_bearish_zero_tech_score_infers_direction | `inferDirectionFromMATrend('MA 趨勢：空頭排列...')` | `'偏空'` |

---

## Fixture Snapshots

### FX-02: 1710 / 00738U Representative (scoreSnapshot_zero_label family)
```json
{
  "reasonSnapshot": "技術偏多",
  "factorSnapshot": [
    "MA 趨勢：多頭排列（5MA > 10MA > 20MA）",
    "RSI(14)：52.3（中性區間）",
    "MACD：多方動能（MACD > Signal）",
    "近 20 日動能：+3.2%",
    "布林通道：中軌上方",
    "法人買超：外資淨買入 1200 張",
    "投信動向：淨買入 300 張",
    "成交量：近 5 日均量 112%",
    "市場情境：大盤多頭",
    "月營收：資料暫缺"
  ],
  "scoreSnapshot": { "technicalScore": 68, "chipScore": 55, "momentumScore": 60, "revenueScore": 0 },
  "usedSources": ["Technical", "Chip"],
  "missingSources": ["MonthlyRevenue"],
  "alphaScore": 68,
  "researchBucket": "NEUTRAL",
  "asOfDate": "2025-12-15"
}
```

### FX-MS-01: 00891 Representative (mixed_signals_no_template family)
```json
{
  "reasonSnapshot": "技術偏多",
  "factorSnapshot": [
    "MA 趨勢：空頭排列（5MA < 10MA < 20MA）",
    "MACD：多方動能（MACD > Signal）",
    "RSI(14)：48.5（中性區間）",
    "法人買超：外資淨賣出 800 張",
    "近 20 日動能：-1.2%"
  ],
  "scoreSnapshot": { "technicalScore": 63, "chipScore": 45, "momentumScore": 55, "revenueScore": 0 },
  "usedSources": ["Technical", "Chip"],
  "missingSources": ["MonthlyRevenue"],
  "alphaScore": 63,
  "researchBucket": "NEUTRAL",
  "asOfDate": "2025-11-12"
}
```

---

## Key Assertions

### Invariance Assertions (must pass for every test case)
```typescript
expect(result.alphaScoreUnchanged).toBe(true);
expect(result.bucketUnchanged).toBe(true);
```

### Forbidden Claims Assertion (FX-09)
```typescript
const forbiddenRegex = /ROI|win-rate|win rate|alpha(?!Score)|edge|profit|outperform|beat|買入|賣出|guaranteed|investment recommendation|投資建議/;
expect(forbiddenRegex.test(result.renderedReason)).toBe(false);
```

### Determinism Assertion (FX-10)
```typescript
const result1 = renderer.renderReasonFromCorpusSnapshot(snapshot);
const result2 = renderer.renderReasonFromCorpusSnapshot(snapshot);
expect(result1.renderedReason).toBe(result2.renderedReason);
```

---

*Observability only. No investment recommendations.*
