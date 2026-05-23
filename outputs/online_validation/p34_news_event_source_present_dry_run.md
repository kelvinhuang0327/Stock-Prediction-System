# P34 — NewsEvent Source-present Dry-run

**Phase:** P34  
**Date:** 2026-05-21  
**Source:** NewsEvent  
**Mode:** source-present-dry-run  
**Classification:** `NEWS_EVENT_SOURCE_PRESENT_DRY_RUN_READY`  

> Disclaimer: Structural dry-run contract only. Does not constitute investment advice. No buy/sell/hold signals. No profit, ROI, win-rate, or investment performance claims. `entersAlphaScore = false`. ALWAYS.

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

## PIT Gate

| Field | Value |
|-------|-------|
| PIT gate field | `publishedAt` |
| PIT policy | `RECORDED_FROM_SOURCE` |
| PIT confidence | `RECORDED` (stronger than MonthlyRevenue INFERRED/LOW) |

---

## Row Counts

| Metric | Count |
|--------|-------|
| Total rows | **1018** |
| Ready rows | **1018** |
| Blocked rows | **0** |
| Skipped rows | **0** |
| publishedAt coverage | **1018/1018 — 100%** |
| source coverage | **1018/1018 — 100%** |
| trustLevel coverage | **1018/1018 — 100%** |

---

## Date Range

| Field | Range |
|-------|-------|
| `publishedAt` | 2025-12-29 → 2026-05-05 (UTC approx) |
| `ingestedAt` | 2026-03-15 → 2026-05-05 (UTC approx) |

---

## TrustLevel Distribution

| TrustLevel | Count |
|------------|-------|
| mainstream | 952 |
| secondary | 63 |
| official | 3 |

---

## Top Sources

| Source | Count |
|--------|-------|
| Yahoo 台股新聞 RSS | 857 |
| Yahoo股市 | 83 |
| sinotrade.com.tw | 30 |
| 自由財經 | 15 |
| others | 45 |

---

## PIT Timing Check

| Check | Result |
|-------|--------|
| `publishedAt > ingestedAt` anomalies | **0** — PASS |
| Historical import gap | Expected — oldest events ingested retroactively (~76 days). `publishedAt` is the correct PIT gate field. |

---

## Dry-run Status: READY

All 1018 rows are source-present eligible. `publishedAt` PIT gate: PASS. No blocked rows.

**dryRunStatus:** `READY`  
**overallClassification:** `NEWS_EVENT_SOURCE_PRESENT_DRY_RUN_READY`
