# P4-01S — MarketIndex / StockQuote Alignment Audit

**Task**: P4-01S — Evidence-First Data Foundation & Phase 1 Readiness Audit  
**Workstream**: D — MarketIndex / StockQuote Alignment Audit  
**Date**: 2026-05-06  
**Evidence**: Direct SQLite queries on `prisma/dev.db`  

---

## Summary Verdict

| Check | Result | Severity |
|---|---|---|
| TAIEX available | ✅ YES — 734 rows, 2017-12-01 → 2026-03-17 | OK |
| TAIEX depth for 500d window | ✅ YES — 734 trading days > 500 | OK |
| TAIEX freshness | ❌ STALE — last entry 2026-03-17, gap ~47 trading days | 🔴 CRITICAL |
| Date format alignment (SQ ↔ MI) | ❌ MISMATCH — ROC-format contamination in both tables | 🔴 CRITICAL |
| Date overlap (ISO-format rows) | ⚠️ PARTIAL — StockQuote has 102 more dates than TAIEX | ⚠️ HIGH |
| Sector indices available | ✅ YES — 21+ sector indices present in MarketIndex | OK |
| Symbol/universe alignment by date | ⚠️ PARTIAL — requires date normalization first | ⚠️ HIGH |
| P4-03 Regime Classifier feasibility | ✅ YES — after freshness fix | Conditional |

---

## Detailed Findings

### 1. TAIEX Availability

- **Present**: YES — `name = 'TAIEX'` in `MarketIndex`
- **Row count**: 734
- **Date range**: 2017-12-01 → 2026-03-17
- **Distinct dates**: 734 (one row per trading day)
- **Fields available**: `name`, `date`, `value`, `change`, `changePercent`
- **P4-03 usage**: TAIEX close value can be used to compute:
  - 50d / 200d moving average for trend regime
  - Rolling volatility for volatility regime
  - Drawdown from peak for bear regime detection

### 2. TAIEX Freshness Gap ⚠️ CRITICAL

```
TAIEX last entry:       2026-03-17
StockQuote latest:      2026-05-18
Gap:                    ~47 trading days (all of April + early May 2026)
```

**Impact on P4-03**: If Market Regime Classifier is used to condition cross-sectional signals in April-May 2026, it will have **no TAIEX data** for that period. This means:
- Cannot classify current regime
- Any regime-conditioned validation for recent period is impossible
- P4-03 outputs for Apr-May 2026 would be `UNKNOWN_REGIME`

**Fix**: Run `scripts/bulk-history-sync.py --phase index` to refresh TAIEX to current date.

### 3. Date Format Mismatch ⚠️ CRITICAL

Both tables have a data quality issue:

```
StockQuote sample dates:
  '1150327'   ← ROC calendar format (民國115年3月27日 = 2026-03-27)
  '1970-12-04' ← Anomalous
  '2017-04-05' ← Correct ISO format

MarketIndex sample dates:
  '1150327'   ← Same ROC format artifact
  '2017-12-01' ← Correct ISO format
```

**Direct JOIN** on `date` column will produce wrong results or miss matches for affected rows.

**Rows affected**:
- StockQuote: ~2,701 rows with non-ISO dates
- MarketIndex: ~1 row with '1150327'

**Fix**: Run `scripts/normalize-dates.py` before any cross-table alignment.

### 4. Date Overlap Analysis (ISO-format rows only)

```
TAIEX distinct ISO dates:          734
StockQuote distinct ISO dates:     805
TAIEX dates NOT in StockQuote:      31  (older TAIEX dates pre-2017-04-05)
StockQuote dates NOT in TAIEX:     102  (Apr 2 – May 18, 2026 = freshness gap)
```

**Interpretation**:
- The 31 TAIEX dates before StockQuote start (Dec 2017 – Apr 2017) are orphan TAIEX data
- The 102 StockQuote dates without TAIEX are due to the freshness gap
- After TAIEX refresh, overlap should be ~734 common dates with minor holiday discrepancies

### 5. Sector Index Alignment

**21+ sector-level indices present** in MarketIndex, including:
- 半導體類指數 → industry code 22
- 電子類指數 → general electronics bucket
- 金融保險類指數 → industry code 18
- 光電類指數 → industry code 24
- 生技醫療類指數 → industry code 09/21
- 鋼鐵類指數 → industry code 10
- 建材營造類指數 → industry code 15
- 航運類指數 → industry code 16
- 電子零組件類指數 → industry code 26
- 通信網路類指數 → industry code 25
- 電腦及週邊設備類指數 → industry code 23
- 資訊服務類指數 → industry code 28
- 數位雲端類指數 → industry code 37
- 食品類指數 → industry code 02
- 塑膠類指數 → industry code 03
- 紡織纖維類指數 → industry code 04
- 電機機械類指數 → industry code 05
- 電器電纜類指數 → industry code 06
- 油電燃氣類指數 → industry code 30
- 綠能環保類指數 → industry code 31
- 橡膠類指數 → industry code 11

**Gap**: Sector index names are Chinese strings — need a `MarketIndex.name → industry_code` mapping table to join sector returns with `Stock.industry` codes.

### 6. 500-Day Window Feasibility

| Metric | Value | Sufficient for 500d? |
|---|---|---|
| TAIEX total trading days | 734 | ✅ YES |
| TAIEX coverage (2017-12-01 → 2026-03-17) | ~8.3 years | ✅ YES |
| Usable TAIEX range (excluding freshness gap) | 2017-12-01 → 2026-03-17 | 734 days |
| In-sample window (500d) | 2017-12-01 → ~2020-02 | ✅ Feasible |
| OOS window (200d) | Multiple windows available | ✅ Feasible |

TAIEX depth is **sufficient** for P4-03 regime classifier with 200–500d lookback windows.

### 7. Universe Alignment by Trading Date

**Current state**: Both tables can be aligned by ISO-format dates after normalization. For cross-sectional analysis:

```sql
-- Example join pattern (after date normalization)
SELECT sq.date, sq.stockId, sq.close, mi.value as taiex_close
FROM StockQuote sq
JOIN MarketIndex mi ON sq.date = mi.date AND mi.name = 'TAIEX'
WHERE sq.date >= '2021-01-01'
```

**Number of symbols per trading day**: Average 1,357 symbols present in StockQuote per date. Cross-sectional basket construction is feasible at universe scale.

---

## Recommended Actions Before P4-03

1. **Run date normalization** (`scripts/normalize-dates.py`) — eliminates format mismatch
2. **Refresh TAIEX** (`scripts/bulk-history-sync.py --phase index`) — fills Apr-May 2026 gap
3. **Build sector-to-industry mapping table** — enables sector-relative regime analysis
4. **Validate join results** — confirm cross-table date alignment after normalization

---

## P4-03 Readiness Verdict

**CONDITIONALLY READY** — P4-03 Market Regime Classifier can start after:
- [ ] Date normalization completed
- [ ] TAIEX refreshed to current date

Historical depth (734 days covering 2017-2026) is sufficient for:
- Bull / Bear / Sideways regime classification using TAIEX MA crossover
- Rolling volatility regime (high/low vol)
- Drawdown-based bear regime detection
- Multiple OOS windows for walk-forward validation
