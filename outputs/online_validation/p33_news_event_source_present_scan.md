# P33 — NewsEvent Source-present Readiness Scan

**Phase:** P33  
**Date:** 2026-05-21  
**Source:** NewsEvent  
**Mode:** source-present-readiness-scan  
**Result:** ELIGIBLE — `NEWS_EVENT_SOURCE_PRESENT_DRY_RUN_ELIGIBLE`  

> Disclaimer: Structural audit contract only. Does not constitute investment advice. No profit, return, or investment performance claims are made. NewsEvent `entersAlphaScore = false`. ALWAYS. Results must not be used as buy/sell/hold signals or investment recommendations.

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

## Schema

**Table:** `NewsEvent`

| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| id | TEXT | NOT NULL | cuid |
| title | TEXT | NOT NULL | |
| summary | TEXT | nullable | |
| source | TEXT | NOT NULL | |
| trustLevel | TEXT | NOT NULL | official\|mainstream\|secondary\|unknown |
| publishedAt | DATETIME | NOT NULL | **PIT gate field** |
| relatedSymbols | TEXT | NOT NULL | JSON string array |
| relatedThemes | TEXT | NOT NULL | JSON string array |
| rawUrl | TEXT | nullable | |
| titleHash | TEXT | NOT NULL | |
| ingestedAt | DATETIME | NOT NULL | ingestion time |

---

## PIT Safety Field Inventory

| Field | Present | Assessment |
|-------|---------|------------|
| `publishedAt` | ✅ 100% (1018/1018) | **Serves as PIT gate field** — RECORDED from source, not inferred |
| `source` | ✅ 100% (1018/1018) | Fills `releaseDateSource` role |
| `trustLevel` | ✅ 100% (1018/1018) | Partially fills `releaseDateConfidence` role |
| `releaseDateSource` | — absent | Covered by `source` field |
| `releaseDateConfidence` | — absent | Not required; `publishedAt` is RECORDED not INFERRED |

---

## Row Counts

| Metric | Count |
|--------|-------|
| Total rows | 1018 |
| With publishedAt | **1018 (100%)** |
| With source | **1018 (100%)** |
| With trustLevel | **1018 (100%)** |
| Ready rows | **1018** |
| Blocked rows | **0** |

---

## Data Distribution

### TrustLevel

| TrustLevel | Count |
|------------|-------|
| mainstream | 952 |
| secondary | 63 |
| official | 3 |

### Top Sources

| Source | Count |
|--------|-------|
| Yahoo 台股新聞 RSS | 857 |
| Yahoo股市 | 83 |
| sinotrade.com.tw | 30 |
| 自由財經 | 15 |
| others | 45 |

### Date Range

| Field | Range |
|-------|-------|
| `publishedAt` | ~2025-12-29 → ~2026-05-02 |
| `ingestedAt` | ~2026-03-15 → ~2026-05-02 |

---

## Source-present Readiness Assessment

**PIT gate field:** `publishedAt`  
**PIT policy:** `RECORDED_FROM_SOURCE`  
**PIT confidence:** `RECORDED` (stronger than MonthlyRevenue's INFERRED)  
**Status: ELIGIBLE**  

`publishedAt` records the actual publication timestamp from the originating news source. For news events, this is the source-present timestamp — it directly records when the event entered public availability. This is semantically equivalent to `releaseDate` for the news domain.

Unlike MonthlyRevenue (`INFERRED_NEXT_MONTH_10TH`, confidence=`LOW`), NewsEvent `publishedAt` is a recorded value from the source, making the PIT confidence inherently stronger.

**Dry-run eligible: YES** — 1018/1018 rows

---

## Companion Field Gap Note

NewsEvent lacks explicit `releaseDateSource` and `releaseDateConfidence` companion fields that were present in the MonthlyRevenue pattern. However:

1. `source` column fills the `releaseDateSource` role (100% populated)
2. `trustLevel` column partially fills the `releaseDateConfidence` role
3. `publishedAt` is RECORDED not INFERRED — confidence is inherently higher than MonthlyRevenue's LOW/INFERRED pattern

This gap is **not blocking** the current dry-run gate. A future phase could add explicit companion fields for full MonthlyRevenue-pattern parity if needed.

---

## Audit Conclusion

NewsEvent table exists with 1018 rows. `publishedAt` coverage: 100% (1018/1018). `source` coverage: 100% (1018/1018). `trustLevel` coverage: 100% (1018/1018). All 1018 rows are eligible for source-present dry-run. `entersAlphaScore=false` preserved.

**readyScanResult:** `ELIGIBLE`  
**overallClassification:** `NEWS_EVENT_SOURCE_PRESENT_DRY_RUN_ELIGIBLE`
