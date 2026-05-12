# P20-HARDRESET: Pre/Post PIT MonthlyRevenue Impact Comparison

> DISCLAIMER: Does not constitute investment advice. Does not compute ROI, win-rate, or outperformance. Observability-only impact analysis.

**Phase**: P20-HARDRESET  
**Part**: C  
**Generated**: 2026-05-12T05:22:20.976Z  
**productionApplyAllowed**: false  
**productionDbWritten**: false

---

## 1. Corpus Shape Comparison

| Metric | P3 (Pre-PIT) | P19 (Post-PIT) |
|--------|-------------|----------------|
| Row count | 4500 | 4500 |
| Unique symbols | 25 | 25 |
| Unique asOfDates | 60 | 60 |
| Aligned rows | — | 4500 |
| Missing pre rows | — | 0 |
| Missing post rows | — | 0 |

**Horizon Distribution (P3)**: {"5":1500,"20":1500,"60":1500}  
**Horizon Distribution (P19)**: {"5":1500,"20":1500,"60":1500}  
**Shape Compatible**: true

---

## 2. Scoring Completeness Impact

| Status | P3 | P19 |
|--------|-----|-----|
| COMPLETE | 3099 | 3099 |
| PARTIAL | 1401 | 1401 |
| EMPTY | 0 | 0 |

- Changed: 0  
- Degraded: 0  
- Improved: 0  
- Same: 4500

> Note: Completeness reflects data source availability at scoring time, not realized returns.

---

## 3. ResearchBucket Impact

**P3 Distribution**: {"LowPriority":1158,"Watch":462,"Neutral":1401,"Strong":1479}  
**P19 Distribution**: {"LowPriority":1158,"Watch":462,"Neutral":1401,"Strong":1479}  
**Bucket Changed**: 0 rows (ratio: 0.0000)  
**Distribution Match**: true  
**Transition Matrix**: {}

---

## 4. Score Impact

- Score source: activeScoringSnapshot.alphaScore
- Non-zero pre alphaScore count: 4500
- Non-zero post alphaScore count: 4500
- Score changed: 0 rows (ratio: 0.0000)

> Note: alphaScore is a composite scoring index. Not a return, not a prediction, not a performance metric.

---

## 5. Snapshot Impact

| Dimension | Changed Count |
|-----------|--------------|
| Signal snapshot | 0 |
| Reason snapshot | 0 |
| Factor snapshot | 0 |
| MonthlyRevenue excluded | 4500 |

---

## 6. PIT Guard Impact

**PIT Validation Status**: PASS  
**Leakage Violations**: 0  
**Forbidden Field Violations**: 0

MonthlyRevenue PIT Gate Status Distribution (P19):
- NOT_APPLICABLE_NO_DATA: 4500

> Note: NOT_APPLICABLE_NO_DATA means MonthlyRevenue was already absent from scoring data — no gate rejection occurred.

---

## 7. Change Classification Counts

- MONTHLY_REVENUE_EXCLUDED: 4500

No-change (primary): 0

---

## 8. Readiness Conclusion

| Check | Status |
|-------|--------|
| Shape compatible | true |
| PIT validation PASS | true |
| Leakage violations = 0 | true |
| Forbidden field violations = 0 | true |
| Completeness not severely degraded | true |
| Changed cases documented | true |

**Ready for P21 Approval Review**: true

> This conclusion assesses readiness for approval review only. It does not approve production migration.
