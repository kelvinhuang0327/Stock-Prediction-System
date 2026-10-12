# P34 — NewsEvent PIT Audit

**Phase:** P34  
**Date:** 2026-05-21  
**Source:** NewsEvent  
**Mode:** pit-audit  
**PIT Gate Field:** `publishedAt`  
**PIT Audit Result:** PASS — `NEWS_EVENT_PIT_AUDIT_PASS`  

> Disclaimer: PIT audit report only. Does not constitute investment advice. `entersAlphaScore = false`. ALWAYS.

---

## Governance Flags

| Flag | Value |
|------|-------|
| `entersAlphaScore` | **false** |
| `paperOnly` | **true** |
| `dryRun` | **true** |
| `notInvestmentRecommendation` | **true** |
| `noBuySellActionSemantics` | **true** |

---

## Coverage

| Field | Count | Null | Coverage |
|-------|-------|------|----------|
| `publishedAt` | 1018 | 0 | **100%** |
| `source` | 1018 | 0 | **100%** |
| `trustLevel` | 1018 | 0 | **100%** |
| `ingestedAt` | 1018 | 0 | **100%** |

---

## Date Range

| Field | Min | Max |
|-------|-----|-----|
| `publishedAt` | 1766995200000 (~2025-12-29) | 1777976893000 (~2026-05-05) |
| `ingestedAt` | 1773856621019 (~2026-03-15) | 1777977006548 (~2026-05-05) |

---

## PIT Timing Anomaly Check

| Check | Result |
|-------|--------|
| Rows where `publishedAt > ingestedAt` | **0** — PASS |
| Missing `publishedAt` | **0** — PASS |
| Missing `source` | **0** — PASS |
| Missing `trustLevel` | **0** — PASS |

No impossible timing anomalies detected. `publishedAt <= ingestedAt` holds for all 1018 rows.

---

## Historical Import Analysis

`publishedAt` range starts ~2025-12-29, but `ingestedAt` range starts ~2026-03-15. This indicates the system performed a historical backfill import: events from late December 2025 through mid-March 2026 were ingested approximately 76 days after publication for the oldest events.

**Impact on PIT gate:** None — the correct PIT gate field is `publishedAt` (when the event was publicly available), not `ingestedAt` (when the system recorded it). Using `ingestedAt` as the PIT gate would incorrectly treat historical events as if they became "available" only when ingested, introducing a reverse look-ahead error.

**Conclusion:** Use `publishedAt` as PIT gate. This is confirmed by the source field (`pitGateField = publishedAt`).

---

## Comparison to MonthlyRevenue PIT Audit

| Dimension | MonthlyRevenue (P32) | NewsEvent (P34) |
|-----------|---------------------|-----------------|
| PIT gate field | `releaseDate` | `publishedAt` |
| PIT policy | `INFERRED_NEXT_MONTH_10TH` | `RECORDED_FROM_SOURCE` |
| PIT confidence | LOW | **RECORDED** |
| Anomalies | 0 | **0** |
| Coverage | 100% | **100%** |

NewsEvent `publishedAt` provides **stronger PIT confidence** than MonthlyRevenue `releaseDate`. No inference policy is required — `publishedAt` is directly recorded from the originating source feed.

---

## PIT Audit Result

**pitAuditResult:** `PASS`  
**overallClassification:** `NEWS_EVENT_PIT_AUDIT_PASS`
