# P26A Renderer Fix 9-Case Before/After

**Generated:** 2026-05-14

## Summary

- Total cases: 9
- All improved: True
- All alphaScore unchanged: True
- All bucket unchanged: True
- Mismatched alphaScore count: 0
- Mismatched bucket count: 0
- MonthlyRevenue still missing: YES (all 9)

## Case Results

| caseId | symbol | alpha | oldReason | newFactors | class |
|--------|--------|-------|-----------|------------|-------|
| P5-CASE-010 | 1710 | 68 | 技術偏多 | 4 | PARTIAL_FIX_SOURCE_STILL_MISSING |
| P5-CASE-011 | 00738U | 63 | 技術偏多 | 4 | PARTIAL_FIX_SOURCE_STILL_MISSING |
| P5-CASE-013 | 1710 | 68 | 技術偏多 | 4 | PARTIAL_FIX_SOURCE_STILL_MISSING |
| P5-CASE-023 | 00891 | 63 | 技術偏多 | 4 | PARTIAL_FIX_SOURCE_STILL_MISSING |
| P5-CASE-026 | 00891 | 63 | 技術偏多 | 4 | PARTIAL_FIX_SOURCE_STILL_MISSING |
| P5-CASE-037 | 00891 | 63 | 技術偏多 | 4 | PARTIAL_FIX_SOURCE_STILL_MISSING |
| P5-CASE-053 | 00738U | 63 | 技術偏多 | 4 | PARTIAL_FIX_SOURCE_STILL_MISSING |
| P5-CASE-054 | 00891 | 63 | 技術偏多 | 4 | PARTIAL_FIX_SOURCE_STILL_MISSING |
| P5-CASE-055 | 1710 | 68 | 技術偏多 | 4 | PARTIAL_FIX_SOURCE_STILL_MISSING |

## Sample Enriched Reasons

**P5-CASE-010 -- 1710 @ 2025-12-15:**
- OLD: 技術偏多
- NEW: 技術面偏多，多頭排列（MA20(12.24），RSI 60，MACD 0.01 / 法人中性（外資 -1,004,000 / 投信 0） / 波動率 2.34%
- MonthlyRevenue: STILL_MISSING_SOURCE_BLOCKED

**P5-CASE-011 -- 00738U @ 2025-12-19:**
- OLD: 技術偏多
- NEW: 技術面偏多，多頭排列（MA20(40.86），RSI 57.58，MACD 0.91 / 法人中性（外資 390 / 投信 0） / 波動率 9.4%
- MonthlyRevenue: STILL_MISSING_SOURCE_BLOCKED

**P5-CASE-023 -- 00891 @ 2025-11-12:**
- OLD: 技術偏多
- NEW: 技術面偏多，空頭排列（MA20(16.05），RSI 54.92，MACD 0.12 / 法人中性（外資 10,870,342 / 投信 0） / 波動率 6.7%
- MonthlyRevenue: STILL_MISSING_SOURCE_BLOCKED

**P5-CASE-037 -- 00891 @ 2025-10-15:**
- OLD: 技術偏多
- NEW: 技術面偏多，空頭排列（MA20(16.05），RSI 54.92，MACD 0.12 / 法人中性（外資 10,870,342 / 投信 0） / 波動率 6.7%
- MonthlyRevenue: STILL_MISSING_SOURCE_BLOCKED

**P5-CASE-054 -- 00891 @ 2025-12-30:**
- OLD: 技術偏多
- NEW: 技術面偏多，空頭排列（MA20(16.05），RSI 54.92，MACD 0.12 / 法人中性（外資 10,870,342 / 投信 0） / 波動率 6.7%
- MonthlyRevenue: STILL_MISSING_SOURCE_BLOCKED

## Interpretation

PARTIAL_FIX_SOURCE_STILL_MISSING: renderer underoutput fixed (multi-factor reason now rendered), but MonthlyRevenue dimension still absent because source files not yet provided by operator.

This is EXPECTED and CORRECT -- the renderer fix improves reason richness without fabricating missing data.

> Does not constitute investment advice.
