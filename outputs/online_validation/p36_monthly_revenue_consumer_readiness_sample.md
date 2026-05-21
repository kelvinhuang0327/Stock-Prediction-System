# P36 MonthlyRevenue Consumer Readiness — Sample Report

**DISCLAIMER:** Controlled feature consumer contract only. Does not constitute investment advice.  
MonthlyRevenue `entersAlphaScore = false`. ALWAYS.

---

## Batch Summary

| Field | Value |
|-------|-------|
| Source | MonthlyRevenue |
| Consumer Mode | controlled-feature-consumer-readiness |
| Row Count | 5 |
| Consumer-Ready (incl. warnings) | 4 |
| Warning Rows (LOW confidence) | 4 |
| Blocked Rows | 1 |
| Overall Classification | `CONSUMER_BATCH_BLOCKED` |
| entersAlphaScore | false |
| dryRunOnly | true |
| paperOnly | true |
| noBuySellActionSemantics | true |

## Confidence Distribution

| Tier | Count |
|------|-------|
| HIGH | 0 |
| MEDIUM | 0 |
| LOW | 4 |

**Expected:** All MonthlyRevenue rows use `INFERRED_NEXT_MONTH_10TH` policy → LOW confidence tier.

## Blocked Breakdown

| Reason | Count |
|--------|-------|
| CONSUMER_BLOCKED_MISSING_METADATA | 1 (symbol 2308: releaseDate=null) |
| CONSUMER_BLOCKED_PIT_VIOLATION | 0 |
| CONSUMER_BLOCKED_FORBIDDEN_FIELD | 0 |

## Row Results

| Symbol | Classification | Consumer Ready | Confidence | PIT OK |
|--------|---------------|----------------|------------|--------|
| 2330 | CONSUMER_READY_WITH_LOW_CONFIDENCE_WARNING | ✅ | LOW | ✅ |
| 2317 | CONSUMER_READY_WITH_LOW_CONFIDENCE_WARNING | ✅ | LOW | ✅ |
| 2454 | CONSUMER_READY_WITH_LOW_CONFIDENCE_WARNING | ✅ | LOW | ✅ |
| 2412 | CONSUMER_READY_WITH_LOW_CONFIDENCE_WARNING | ✅ | LOW | ✅ |
| 2308 | CONSUMER_BLOCKED_MISSING_METADATA | ❌ | LOW | — |

## Readiness Conclusion

4 of 5 rows are consumer-ready (with LOW confidence warning).  
1 row blocked due to missing release metadata (releaseDate=null).  
The LOW confidence distribution is expected — all MonthlyRevenue rows use `INFERRED_NEXT_MONTH_10TH` policy.  

**Downstream consumers must treat results as structural audit data only — not as investment signals.**
