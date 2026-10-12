# P4-02P0 — MarketIndex / StockQuote Alignment Validation

**Generated**: 2026-05-06T11:10:26Z
**DB**: prisma/dev.db (direct SQLite query)

---

## Readiness Verdicts

| Check | Result |
|---|---|
| StockQuote 100% ISO | ✅ YES |
| MarketIndex 100% ISO | ✅ YES |
| TAIEX fresh (gap <=7d) | ✅ YES |
| StockQuote/MarketIndex JOIN safe | ✅ YES |
| **P4-02 can proceed** | ✅ YES |
| **P4-03 can proceed** | ✅ YES |
| **P4-04 can proceed** | ❌ NO — InstitutionalChip only 236 trading days (need >=500); T-05 walk-forward needs redesign |

## P0 Blockers Status

✅ All P0 blockers resolved (date normalization complete, TAIEX refreshed)

---

## StockQuote Date State

| Metric | Value |
|---|---|
| Total rows | 129151 |
| ISO rows | 129151 |
| ISO ratio | 100.0% |
| Anomaly rows (pre-2010) | 1355 (pre-existing epoch artifact) |
| Effective min date | 2017-04-05 |
| Effective max date | 2026-05-18 |

---

## TAIEX State

| Metric | Value |
|---|---|
| Total TAIEX rows | 766 |
| Distinct trading days | 766 |
| Min date | 2017-12-01 |
| Max date | 2026-05-05 |
| Today | 2026-05-06 |
| Freshness gap | 1 days |
| Sufficient for 500d window | ✅ YES |

---

## Date Overlap (TAIEX vs StockQuote)

| Metric | Value |
|---|---|
| TAIEX distinct dates (≥2010) | 766 |
| StockQuote distinct dates (≥2010) | 803 |
| Overlapping dates | 727 |
| TAIEX dates not in StockQuote | 39 |
| StockQuote dates not in TAIEX | 76 |

StockQuote dates not in TAIEX (most recent, sample): ['2017-04-12', '2017-04-13', '2017-04-14', '2017-04-17', '2017-04-18']

---

## StockQuote Symbol Coverage

| Metric | Value |
|---|---|
| Distinct symbols | 1357 |
| Symbols ≥500 trading days | 185 |
| Symbols ≥200 trading days | 245 |

---

## Sector Indices Available

MarketIndex contains **75** distinct sector index names.
Sample: 光電類指數, 其他電子類指數, 其他類指數, 化學生技醫療類指數, 化學類指數, 半導體類指數, 塑膠化工類指數, 塑膠類指數, 居家生活類指數, 建材營造類指數
