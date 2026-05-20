# P29F PIT Rule Definition

**Phase:** P29F-HARDRESET  
**Date:** 2026-05-20

## Quote PIT Rules

1. Price fields must only use data with `date <= asOfDate`
2. No future close / next close used as input feature
3. No label-like fields (`returnPct`, `outcomePrice`, `realizedReturnClass`) in feature set
4. `asOf` parameter must be passed from simulation/scoring caller
5. Technical indicators (MA, RSI, MACD, momentum) computed only from PIT-gated data
6. **CRITICAL**: Date format must be consistent between storage and gate comparison

**Gate:** `date: { lte: asOfDb }` where `asOfDb = asOf.replace(/-/g, '')` (YYYYMMDD)

**Critical Check:** Sync stores ISO format, gate uses YYYYMMDD — format mismatch may make gate ineffective for same-year future records.

---

## Regime PIT Rules

1. Regime determined only from TAIEX data with `date <= asOf`
2. Rolling window (MA50, MA200, 20d momentum, 60d volatility) must not include future rows
3. `detectRegime(asOf)` must use ISO asOf directly with ISO stored dates
4. `detectRegimeForPeriod` is **backtest-only** — not in simulation scoring path
5. Regime label (Bull/Bear/Sideways) derived from backward-looking factors only

**Gate:** `date: { lte: asOf }` where asOf is ISO YYYY-MM-DD (ISO-ISO comparison is correct)

**Critical Check:** MarketIndex.date is ISO (confirmed by sync code), `detectRegime` uses ISO directly — CORRECT.

---

## Chip PIT Rules

1. InstitutionalChip data must only use `date <= asOfDate`
2. Chip strength calculated from last 10 records (orderBy date desc) — all backward-looking
3. Fields used (`totalBuy`, `foreignBuy`, `trustBuy`) are net flow — no forward component
4. Publication lag: chip for T published at ~6pm T — same-day inclusion is industry standard
5. Schema comment `// YYYYMMDD` must be corrected to `// ISO (YYYY-MM-DD)` to match actual storage
6. **CRITICAL**: Date format inconsistency — same issue as Quote

**Gate:** `date: { lte: asOfDb }` where `asOfDb = asOf.replace(/-/g, '')` (YYYYMMDD)

**Critical Check:** Sync stores ISO (confirmed in `syncInstitutionalChip` line L395), gate uses YYYYMMDD — same mismatch as Quote.
