# P28B: P28A Findings Recap

**Date:** 2026-05-19  
**Phase:** P28B-REASON-TEMPLATE-COVERAGE-HARDRESET  
**Source:** P28A-HARDRESET (commit 1cf0252)

---

## P28A Conclusion (Confirmed)

| Field | Value |
|-------|-------|
| Final Classification | P28A_SCORING_UNDEROUTPUT_AUDIT_COMPLETE |
| Scoring Correct | ✅ YES |
| alphaScore Correct | ✅ YES |
| bucket Correct | ✅ YES |
| Root Cause | reason serialization / renderer collapse |
| Fixable Without Scoring Change | ✅ YES |
| No scoring formula change required | ✅ CONFIRMED |
| No alphaScore adjustment required | ✅ CONFIRMED |
| No bucket adjustment required | ✅ CONFIRMED |

> ⚠️ This is NOT a model accuracy problem. This is NOT a scoring formula problem. This is a reason output serialization / renderer coverage problem only.

---

## 9-Case Summary

| Metric | Value |
|--------|-------|
| Total Cases | 9 |
| Classification | **9/9 = NO_TRIGGERED_FACTOR** |
| Unique Symbols | 3 (1710, 00738U, 00891) |
| Unique Symbol-Date Combos | 5 |
| All blocked by MonthlyRevenue | ✅ Yes |
| All renderer underoutput | ✅ Yes |
| All fixable without scoring change | ✅ Yes |

---

## 9-Case Detail Table

| Case ID | Symbol | AsOfDate | Horizon | alphaScore | Bucket | reasonSnapshot | factorCount | Root Cause Family |
|---------|--------|----------|---------|------------|--------|----------------|-------------|-------------------|
| P5-CASE-010 | 1710 | 2025-12-15 | 5 | 68 | NEUTRAL | 技術偏多 (1 token) | 10 | scoreSnapshot_zero_label |
| P5-CASE-011 | 00738U | 2025-12-19 | 5 | 63 | NEUTRAL | 技術偏多 (1 token) | 10 | scoreSnapshot_zero_label |
| P5-CASE-013 | 1710 | 2025-12-15 | 5 | 68 | NEUTRAL | 技術偏多 (1 token) | 10 | scoreSnapshot_zero_label |
| P5-CASE-023 | 00891 | 2025-11-12 | 20 | 63 | NEUTRAL | 技術偏多 (1 token) | 10 | mixed_signals_no_template |
| P5-CASE-026 | 00891 | 2025-11-12 | 20 | 63 | NEUTRAL | 技術偏多 (1 token) | 10 | mixed_signals_no_template |
| P5-CASE-037 | 00891 | 2025-10-15 | 60 | 63 | NEUTRAL | 技術偏多 (1 token) | 10 | mixed_signals_no_template |
| P5-CASE-053 | 00738U | 2025-12-19 | 5 | 63 | NEUTRAL | 技術偏多 (1 token) | 10 | scoreSnapshot_zero_label |
| P5-CASE-054 | 00891 | 2025-12-30 | 5 | 63 | NEUTRAL | 技術偏多 (1 token) | 10 | mixed_signals_no_template |
| P5-CASE-055 | 1710 | 2025-12-15 | 5 | 68 | NEUTRAL | 技術偏多 (1 token) | 10 | scoreSnapshot_zero_label |

---

## Renderer Repair Families Identified

### Family 1: `scoreSnapshot_zero_label` (5 cases)
**Cases:** P5-CASE-010, 011, 013, 053, 055

**Pattern:**
- factorSnapshot: 10 signals including MA 多頭排列
- reasonSnapshot collapsed to "技術偏多" (1 token)
- `minimalSnapshot.scoreSnapshot.technicalScore = 0` (hardcoded in P5WalkthroughReviewUtils)
- enrichReasonFromExistingFactors uses `techScore=0` → produces label `'技術面偏空'` (WRONG)
- MA 多頭排列 signals are present but direction label is inverted

**Repair:** Pass actual `scoreSnapshot` from `activeScoringSnapshot` through `WalkthroughCaseInput`, or add factorSnapshot-derived direction inference as fallback.

### Family 2: `mixed_signals_no_template` (4 cases)
**Cases:** P5-CASE-023, 026, 037, 054

**Pattern:**
- factorSnapshot: 10 signals, MA 空頭排列 + MACD 多方動能 (contradictory)
- No unified template for mixed-signal (bearish MA + bullish MACD) case
- Renderer outputs fragmented text without a unifying directional summary
- reasonSnapshot collapsed to "技術偏多" despite neutral-to-mixed evidence

**Repair:** Add mixed-signal aggregation template that outputs neutral context when MA and MACD disagree, with explicit explanation of signal conflict.

---

## Invariance Confirmation

| Check | Result |
|-------|--------|
| Scoring files unchanged | ✅ PASS |
| alphaScore not modified | ✅ PASS |
| bucket not modified | ✅ PASS |
| All corpus unchanged | ✅ PASS |
| DB unchanged | ✅ PASS |
| P3 + P19 invariance rows | 4500 + 4499 = 8999 PASS |

---

*Observability only. No investment recommendations. Scoring is CORRECT.*  
*This is a renderer output coverage issue only. alphaScore and bucket are NOT to be modified.*
