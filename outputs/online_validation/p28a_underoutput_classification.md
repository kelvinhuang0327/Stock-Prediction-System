# P28A Underoutput Classification

**Generated:** 2026-05-15T03:33:14.257Z
**Total Cases:** 9

## Classification Distribution

| Category | Count | Percentage |
|----------|-------|-----------|
| (a) NO_TRIGGERED_FACTOR | 9 | 100.0% |
| (b) CONTRIBUTION_BELOW_REASON_THRESHOLD | 0 | 0.0% |
| (c) TEMPLATE_BRANCH_MISSING | 0 | 0.0% |
| (d) UNKNOWN_NEEDS_CODE_TRACE | 0 | 0.0% |

**Primary Driver:** (a) NO_TRIGGERED_FACTOR

## Detailed Classifications

### Case 1: P5-CASE-010

**Classification:** (a) NO_TRIGGERED_FACTOR
**Symbol:** 1710 | **As Of:** 2025-12-15 | **Horizon:** 5
**Alpha Score:** 68 | **Bucket:** NEUTRAL

**Reasoning:**
Factors present (factorSnapshotCount=10) but reason collapsed to 1 token (技術偏多). Scoring is correct; reason serialization failed (renderer issue).

**Evidence:**
- Has Factors Triggered: ✅ Yes
- Factor Count: 10
- Reason Token Count: 1
- Data Coverage: limited
- Is Renderer Underoutput: ✅ Yes
- Sample Factors: MA 趨勢: 多頭排列 (MA20(12.24) > MA60(12.19)); RSI(14): 60 (中性健康區間); MACD: 0.01 (MACD > 0，多方動能)

**Blocked By:**
- MonthlyRevenue: ✅
- NewsEvent: ❌
- FinancialReport: ❌

**Recommended Next Steps:**
- Renderer fix: deserialize factorSnapshot for multi-factor reason generation
- Source completion: P26F4 import for MonthlyRevenue missing data

---

### Case 2: P5-CASE-011

**Classification:** (a) NO_TRIGGERED_FACTOR
**Symbol:** 00738U | **As Of:** 2025-12-19 | **Horizon:** 5
**Alpha Score:** 63 | **Bucket:** NEUTRAL

**Reasoning:**
Factors present (factorSnapshotCount=10) but reason collapsed to 1 token (技術偏多). Scoring is correct; reason serialization failed (renderer issue).

**Evidence:**
- Has Factors Triggered: ✅ Yes
- Factor Count: 10
- Reason Token Count: 1
- Data Coverage: limited
- Is Renderer Underoutput: ✅ Yes
- Sample Factors: MA 趨勢: 多頭排列 (MA20(40.86) > MA60(38.08)); RSI(14): 57.58 (中性健康區間); MACD: 0.91 (MACD > 0，多方動能)

**Blocked By:**
- MonthlyRevenue: ✅
- NewsEvent: ❌
- FinancialReport: ❌

**Recommended Next Steps:**
- Renderer fix: deserialize factorSnapshot for multi-factor reason generation
- Source completion: P26F4 import for MonthlyRevenue missing data

---

### Case 3: P5-CASE-013

**Classification:** (a) NO_TRIGGERED_FACTOR
**Symbol:** 1710 | **As Of:** 2025-12-15 | **Horizon:** 5
**Alpha Score:** 68 | **Bucket:** NEUTRAL

**Reasoning:**
Factors present (factorSnapshotCount=10) but reason collapsed to 1 token (技術偏多). Scoring is correct; reason serialization failed (renderer issue).

**Evidence:**
- Has Factors Triggered: ✅ Yes
- Factor Count: 10
- Reason Token Count: 1
- Data Coverage: limited
- Is Renderer Underoutput: ✅ Yes
- Sample Factors: MA 趨勢: 多頭排列 (MA20(12.24) > MA60(12.19)); RSI(14): 60 (中性健康區間); MACD: 0.01 (MACD > 0，多方動能)

**Blocked By:**
- MonthlyRevenue: ✅
- NewsEvent: ❌
- FinancialReport: ❌

**Recommended Next Steps:**
- Renderer fix: deserialize factorSnapshot for multi-factor reason generation
- Source completion: P26F4 import for MonthlyRevenue missing data

---

### Case 4: P5-CASE-023

**Classification:** (a) NO_TRIGGERED_FACTOR
**Symbol:** 00891 | **As Of:** 2025-11-12 | **Horizon:** 20
**Alpha Score:** 63 | **Bucket:** NEUTRAL

**Reasoning:**
Factors present (factorSnapshotCount=10) but reason collapsed to 1 token (技術偏多). Scoring is correct; reason serialization failed (renderer issue).

**Evidence:**
- Has Factors Triggered: ✅ Yes
- Factor Count: 10
- Reason Token Count: 1
- Data Coverage: limited
- Is Renderer Underoutput: ✅ Yes
- Sample Factors: MA 趨勢: 空頭排列 (MA20(16.05) < MA60(16.58)); RSI(14): 54.92 (中性健康區間); MACD: 0.12 (MACD > 0，多方動能)

**Blocked By:**
- MonthlyRevenue: ✅
- NewsEvent: ❌
- FinancialReport: ❌

**Recommended Next Steps:**
- Renderer fix: deserialize factorSnapshot for multi-factor reason generation
- Source completion: P26F4 import for MonthlyRevenue missing data

---

### Case 5: P5-CASE-026

**Classification:** (a) NO_TRIGGERED_FACTOR
**Symbol:** 00891 | **As Of:** 2025-11-12 | **Horizon:** 20
**Alpha Score:** 63 | **Bucket:** NEUTRAL

**Reasoning:**
Factors present (factorSnapshotCount=10) but reason collapsed to 1 token (技術偏多). Scoring is correct; reason serialization failed (renderer issue).

**Evidence:**
- Has Factors Triggered: ✅ Yes
- Factor Count: 10
- Reason Token Count: 1
- Data Coverage: limited
- Is Renderer Underoutput: ✅ Yes
- Sample Factors: MA 趨勢: 空頭排列 (MA20(16.05) < MA60(16.58)); RSI(14): 54.92 (中性健康區間); MACD: 0.12 (MACD > 0，多方動能)

**Blocked By:**
- MonthlyRevenue: ✅
- NewsEvent: ❌
- FinancialReport: ❌

**Recommended Next Steps:**
- Renderer fix: deserialize factorSnapshot for multi-factor reason generation
- Source completion: P26F4 import for MonthlyRevenue missing data

---

### Case 6: P5-CASE-037

**Classification:** (a) NO_TRIGGERED_FACTOR
**Symbol:** 00891 | **As Of:** 2025-10-15 | **Horizon:** 60
**Alpha Score:** 63 | **Bucket:** NEUTRAL

**Reasoning:**
Factors present (factorSnapshotCount=10) but reason collapsed to 1 token (技術偏多). Scoring is correct; reason serialization failed (renderer issue).

**Evidence:**
- Has Factors Triggered: ✅ Yes
- Factor Count: 10
- Reason Token Count: 1
- Data Coverage: limited
- Is Renderer Underoutput: ✅ Yes
- Sample Factors: MA 趨勢: 空頭排列 (MA20(16.05) < MA60(16.58)); RSI(14): 54.92 (中性健康區間); MACD: 0.12 (MACD > 0，多方動能)

**Blocked By:**
- MonthlyRevenue: ✅
- NewsEvent: ❌
- FinancialReport: ❌

**Recommended Next Steps:**
- Renderer fix: deserialize factorSnapshot for multi-factor reason generation
- Source completion: P26F4 import for MonthlyRevenue missing data

---

### Case 7: P5-CASE-053

**Classification:** (a) NO_TRIGGERED_FACTOR
**Symbol:** 00738U | **As Of:** 2025-12-19 | **Horizon:** 5
**Alpha Score:** 63 | **Bucket:** NEUTRAL

**Reasoning:**
Factors present (factorSnapshotCount=10) but reason collapsed to 1 token (技術偏多). Scoring is correct; reason serialization failed (renderer issue).

**Evidence:**
- Has Factors Triggered: ✅ Yes
- Factor Count: 10
- Reason Token Count: 1
- Data Coverage: limited
- Is Renderer Underoutput: ✅ Yes
- Sample Factors: MA 趨勢: 多頭排列 (MA20(40.86) > MA60(38.08)); RSI(14): 57.58 (中性健康區間); MACD: 0.91 (MACD > 0，多方動能)

**Blocked By:**
- MonthlyRevenue: ✅
- NewsEvent: ❌
- FinancialReport: ❌

**Recommended Next Steps:**
- Renderer fix: deserialize factorSnapshot for multi-factor reason generation
- Source completion: P26F4 import for MonthlyRevenue missing data

---

### Case 8: P5-CASE-054

**Classification:** (a) NO_TRIGGERED_FACTOR
**Symbol:** 00891 | **As Of:** 2025-12-30 | **Horizon:** 5
**Alpha Score:** 63 | **Bucket:** NEUTRAL

**Reasoning:**
Factors present (factorSnapshotCount=10) but reason collapsed to 1 token (技術偏多). Scoring is correct; reason serialization failed (renderer issue).

**Evidence:**
- Has Factors Triggered: ✅ Yes
- Factor Count: 10
- Reason Token Count: 1
- Data Coverage: limited
- Is Renderer Underoutput: ✅ Yes
- Sample Factors: MA 趨勢: 空頭排列 (MA20(16.05) < MA60(16.58)); RSI(14): 54.92 (中性健康區間); MACD: 0.12 (MACD > 0，多方動能)

**Blocked By:**
- MonthlyRevenue: ✅
- NewsEvent: ❌
- FinancialReport: ❌

**Recommended Next Steps:**
- Renderer fix: deserialize factorSnapshot for multi-factor reason generation
- Source completion: P26F4 import for MonthlyRevenue missing data

---

### Case 9: P5-CASE-055

**Classification:** (a) NO_TRIGGERED_FACTOR
**Symbol:** 1710 | **As Of:** 2025-12-15 | **Horizon:** 5
**Alpha Score:** 68 | **Bucket:** NEUTRAL

**Reasoning:**
Factors present (factorSnapshotCount=10) but reason collapsed to 1 token (技術偏多). Scoring is correct; reason serialization failed (renderer issue).

**Evidence:**
- Has Factors Triggered: ✅ Yes
- Factor Count: 10
- Reason Token Count: 1
- Data Coverage: limited
- Is Renderer Underoutput: ✅ Yes
- Sample Factors: MA 趨勢: 多頭排列 (MA20(12.24) > MA60(12.19)); RSI(14): 60 (中性健康區間); MACD: 0.01 (MACD > 0，多方動能)

**Blocked By:**
- MonthlyRevenue: ✅
- NewsEvent: ❌
- FinancialReport: ❌

**Recommended Next Steps:**
- Renderer fix: deserialize factorSnapshot for multi-factor reason generation
- Source completion: P26F4 import for MonthlyRevenue missing data

---

## Next Steps Recommendation

Based on the primary driver **(a) NO_TRIGGERED_FACTOR**, the recommended next phase is:

- **Phase:** P28A-CONTINUATION or CLOSED (depends on auditor review)
- **Rationale:** All 9 cases are correctly scored; underoutput is due to renderer serialization failure, not scoring formula.
- **Action:** For production readiness, renderer should be fixed to deserialize factorSnapshot into multi-factor reason text.
- **Source Gap:** MonthlyRevenue import (P26F4) will add additional context but does not change scoring.

## Disclaimer

Observability only. No investment recommendations.
