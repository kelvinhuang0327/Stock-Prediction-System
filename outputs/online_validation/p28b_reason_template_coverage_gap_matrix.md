# P28B: Reason Template Coverage Gap Matrix

**Date:** 2026-05-19  
**Phase:** P28B-REASON-TEMPLATE-COVERAGE-HARDRESET

---

## Matrix Summary

| Stat | Value |
|------|-------|
| Total Factor Families | 10 |
| Total Gaps Identified | 13 |
| Need Scoring Change | **0** |
| Safe to Fix Now | **10** |
| CRITICAL Priority | 2 |
| HIGH Priority | 3 |
| MEDIUM Priority | 3 |
| LOW Priority | 2 |

---

## Factor Family Coverage Table

| ID | Family | Currently Covered | Uncovered Branches | Weak Branches | Impacted Cases | Needs Scoring Change | Safe to Fix | Priority |
|----|--------|-------------------|-------------------|---------------|----------------|---------------------|-------------|----------|
| FF-01 | technical | ✅ Partial | 2 | 1 | 9 | ❌ No | ✅ Yes | CRITICAL |
| FF-02 | chip | ✅ Partial | 1 | 1 | 5 | ❌ No | ✅ Yes | HIGH |
| FF-03 | volume | ❌ No | 2 | 0 | 0 | ❌ No | ✅ Yes | MEDIUM |
| FF-04 | momentum | ✅ Partial | 1 | 1 | 5 | ❌ No | ✅ Yes | HIGH |
| FF-05 | volatility | ❌ No | 2 | 0 | 0 | ❌ No | ✅ Yes | LOW |
| FF-06 | marketRegime | ❌ No | 3 | 0 | 0 | ❌ No | ✅ Yes | MEDIUM |
| FF-07 | monthlyRevenueDataAvailability | ✅ Partial | 1 | 0 | 9 | ❌ No | ✅ Yes | MEDIUM |
| FF-08 | missingSourceNotes | ✅ Partial | 1 | 1 | 0 | ❌ No | ✅ Yes | LOW |
| FF-09 | genericFallbackReason | ✅ Partial | 1 | 0 | 9 | ❌ No | ✅ Yes | HIGH |
| FF-10 | multiFactorAggregation | ✅ Partial | 2 | 1 | 4 | ❌ No | ✅ Yes | CRITICAL |

---

## CRITICAL Gaps

### FF-01: Technical — Direction Label Inversion (5 cases)
- **Uncovered:** MA 多頭排列 → `scoreSnapshot.technicalScore=0` → label `'技術面偏空'` (WRONG)
- **Uncovered:** MA bearish + MACD bullish → no unified mixed-signal template
- **Fix:** scoreSnapshot passthrough + mixed-signal template (renderer-only)

### FF-10: Multi-Factor Aggregation — Mixed-Signal Template Missing (4 cases)
- **Uncovered:** MA 空頭排列 + MACD 多方動能 → no unified neutral-context summary
- **Uncovered:** All-neutral → no neutral-context template
- **Fix:** Add mixed-signal aggregation template to renderer

---

## HIGH Gaps

### FF-02: Chip — Direction May Be Wrong Due to Zeros (5 cases)
- **Uncovered:** `chipScore=0` may invert chip direction label in renderer
- **Fix:** scoreSnapshot passthrough from corpus adapter

### FF-04: Momentum — Direction May Be Wrong Due to Zeros (5 cases)
- **Uncovered:** `momentumScore=0` may produce wrong momentum label
- **Fix:** scoreSnapshot passthrough

### FF-09: Generic Fallback — NO_TRIGGERED_FACTOR Context Note Missing (9 cases)
- **Uncovered:** factorSnapshot present (count=10) but no factor exceeded threshold → no explanation
- **Fix:** Add NO_TRIGGERED_FACTOR context note in renderer when factorCount>0 and reason is single-token

---

## MEDIUM Gaps

### FF-03: Volume — No Coverage
- Volume above/below average context completely absent from renderer
- Fix: Add volume context block in renderer when factor present

### FF-06: Market Regime — No Coverage
- No regime (bull/bear/sideways) context in renderer output
- Fix: Add regime context block from `signalSnapshot.regime` when available

### FF-07: Monthly Revenue Data Availability (9 cases)
- **Uncovered:** Revenue missing → renderer silently skips revenue block (no inline note)
- **Fix:** Add `'月營收資料暫缺，待更新'` inline note when MonthlyRevenue in missingSources

---

## LOW Gaps

### FF-05: Volatility — No Coverage
- Bollinger band squeeze / ATR expansion context absent
- Fix: Add volatility context block when factor present (P28C+)

### FF-08: Missing Source Notes — Integration Weak
- Data coverage note appended at end but not integrated into body
- Doesn't distinguish impact-level of missing data
- Fix: Inline data note in relevant factor section (P28C+)

---

## Repair Family → Gap Mapping

### Family 1: `scoreSnapshot_zero_label` (5 cases)
- Gaps: G6-1, G6-2, G3-1, G3-2
- Factor families: FF-01, FF-02, FF-04
- Cases: P5-CASE-010, 011, 013, 053, 055

### Family 2: `mixed_signals_no_template` (4 cases)
- Gaps: G5-2
- Factor families: FF-01, FF-10
- Cases: P5-CASE-023, 026, 037, 054

---

**No scoring change required or permitted for any gap.**

*Observability only. No investment recommendations.*
