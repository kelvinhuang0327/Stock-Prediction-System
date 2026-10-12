# P20-HARDRESET Part D: Changed Case Samples

> DISCLAIMER: Does not constitute investment advice. Observability only. No ROI, win-rate, or investment recommendation.

**Phase**: P20-HARDRESET  
**Part**: D  
**Generated**: 2026-05-12T05:23:58.206Z  
**Sampling Method**: deterministic-stable-hash  
**Total cases**: 10  
**productionApplyAllowed**: false

---

## Classification Counts (from Part C)

- MONTHLY_REVENUE_EXCLUDED: 4500

---

## Sample Counts per Class

| Class | Available | Sampled |
|-------|-----------|---------|
| BUCKET_CHANGED | 0 | 0 |
| SCORE_CHANGED | 0 | 0 |
| REASON_CHANGED | 0 | 0 |
| SIGNAL_CHANGED | 0 | 0 |
| FACTOR_CHANGED | 0 | 0 |
| MONTHLY_REVENUE_EXCLUDED | 4500 | 5 |
| NO_CHANGE | 0 | 0 |
| NO_SCORING_CHANGE | 4500 | 5 |

---

## Key Finding

The P3 → P19 transition is a **metadata-only PIT annotation**. The P19 corpus was built by adding PIT gate metadata fields to P3 rows without modifying any scoring data. Therefore:

- All 4500 rows classify as **NO_CHANGE** in scoring (bucket, score, completeness, signals, factors, reasons unchanged)
- All 4500 rows classify as **MONTHLY_REVENUE_EXCLUDED** because MonthlyRevenue was already absent from scoring data (in `missingSources`) in both P3 and P19 — confirming consistent handling
- MonthlyRevenue PIT gate status: **NOT_APPLICABLE_NO_DATA** (no MonthlyRevenue data was present to gate or reject)

---

## Control Case (NO_CHANGE sample)

N/A

---

## MonthlyRevenue Excluded Sample

- Symbol: 00830
- asOfDate: 2025-11-24
- Pre missingSources: ["MonthlyRevenue"]
- Post missingSources: ["MonthlyRevenue"]
- MonthlyRevenue PIT status: NOT_APPLICABLE_NO_DATA
- Classification: MONTHLY_REVENUE_EXCLUDED
- Explanation: MonthlyRevenue was consistently absent from scoring in both P3 and P19.
  The NOT_APPLICABLE_NO_DATA status confirms no PIT gate rejection occurred — there was
  simply no data to evaluate.

---

> Note: No outcome, returnPct, or investment conclusion is used in any case record.
