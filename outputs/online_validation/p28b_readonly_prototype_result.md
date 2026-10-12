# P28B — Read-Only Prototype Result

**Phase**: P28B-REASON-TEMPLATE-COVERAGE-HARDRESET  
**Run**: `p28b-readonly-prototype-run`  
**Prototype Module**: `src/lib/onlineValidation/P28BReasonTemplateCoveragePlanner.ts`

## Invariance Gate

| Check | Result |
|---|---|
| alphaScoreUnchanged | ✅ true (all plans) |
| bucketUnchanged | ✅ true (all plans) |
| noScoringChange | ✅ true (all entries) |

> All renderer plans are template/display-only. No scoring formula change required or applied.

## Snapshot Results

### Snapshot 1 — Symbol 1710 (alphaScore 68)

| Field | Value |
|---|---|
| inferredTechDirection | 偏多 (from MA 多頭排列) |
| hasMixedSignal | false |
| hasMonthlyRevenueMissing | true |
| factorSnapshotCount | 10 |
| isGenericSingleToken | true |

**Repair Entries**:
1. `scoreSnapshot_zero_label` → TR-01, TR-02 — Pass scoreSnapshot from corpus; use inferDirectionFromMATrend() fallback
2. `no_triggered_factor_note` → TR-04 — Append note: 系統偵測 10 項因子，但各項訊號強度均未達閾值
3. `monthly_revenue_missing_note` → TR-05 — Add inline revenue missing note

### Snapshot 2 — Symbol 00891 (alphaScore 63)

| Field | Value |
|---|---|
| inferredTechDirection | 偏空 (from MA 空頭排列) |
| hasMixedSignal | true (MA 空頭排列 + MACD 多方動能) |
| hasMonthlyRevenueMissing | true |
| factorSnapshotCount | 5 |
| isGenericSingleToken | true |

**Repair Entries**:
1. `scoreSnapshot_zero_label` → TR-01, TR-02
2. `mixed_signals_no_template` → TR-03 — Add mixed-signal aggregation template (neutral context)
3. `no_triggered_factor_note` → TR-04
4. `monthly_revenue_missing_note` → TR-05

### Snapshot 3 — Symbol 00738U (alphaScore 63, empty factorSnapshot)

| Field | Value |
|---|---|
| inferredTechDirection | 中性 (no MA factor) |
| hasMixedSignal | false |
| factorSnapshotCount | 0 |
| isGenericSingleToken | true |

**Repair Entries**:
1. `monthly_revenue_missing_note` → TR-05 only (fallback_empty for main reason — no factor to enrich)

## Conclusion

- Prototype correctly classifies both repair families
- `inferDirectionFromMATrend()` correctly returns `偏多` for 1710, `偏空` for 00891, `中性` for 00738U
- Mixed-signal detection works for 00891 (空頭排列 + 多方動能)
- All entries have `requiresScoringChange: false`

**Prototype Status**: ✅ READY — can serve as basis for P28C implementation
