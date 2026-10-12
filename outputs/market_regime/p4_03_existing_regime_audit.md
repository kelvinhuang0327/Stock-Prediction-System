# P4-03 Existing Regime Logic Audit
**Generated:** 2026-05-06  
**Task:** P4-03 — PIT-Safe Market Regime Classifier

---

## Summary

An existing `MarketRegimeEngine.ts` was found and is **actively used in production**. The logic is sound and PIT-safe, but requires extension for P4-03 requirements. A new Python script will port and extend this logic rather than replace it.

---

## Existing Files Found

### 1. `src/lib/market/MarketRegimeEngine.ts` — Core Engine
- **Status:** ACTIVE, production-ready TypeScript module
- **Exports:** `detectRegime()`, `detectRegimeForPeriod()`, `buildRegimeTimeline()`
- **Labels used:** `Bull` | `Bear` | `Sideways` | `Unknown`
- **Features used:** TAIEX price, MA50, MA200, momentum_20d, momentum_60d, volatility_20d
- **Confidence range:** 0–100 (P4-03 requires 0–1)
- **PIT assessment:** ✅ PIT_SAFE — Prisma query fetches historical rows only; rolling windows computed strictly from prior data
- **Missing vs P4-03 spec:** `HIGH_VOLATILITY` label, `LOW_CONFIDENCE` label, `market_breadth_proxy`, `evidence_flags`, `pit_safety_flags`

### 2. `src/lib/__tests__/MarketRegimeEngine.test.ts` — Test Suite
- **Coverage:** `detectRegime()` only; 8 test cases
- **Tests:** 0/49/50/100/200+ data points; Bull/Bear/Sideways detection; confidence range; limitations array
- **Status:** ✅ TESTS_EXIST

### 3. `src/app/api/market/regime/route.ts` — API Route
- **Endpoint:** `GET /api/market/regime`
- **Status:** ACTIVE — calls `detectRegime()`, 5-min cache, returns JSON
- **PIT:** ✅ PIT_SAFE (live query, no future data)

### 4. `src/app/api/signals/regime-stratified/route.ts` — Research Route
- **Status:** Research-only; does not affect `alphaScore` or production signals
- **Note:** References H001-H012 via `RegimeStratifiedEngine` — deprecated for strategy use

---

## Existing Algorithm

**Score-based weighted voting across 5 factors:**

| Factor | Weight | Signal |
|--------|--------|--------|
| price vs MA50 | 2 | bull if above |
| price vs MA200 | 3 | bull if above |
| MA50 vs MA200 | 2 | bull if MA50 > MA200 (golden cross) |
| momentum_20d | 2 | bull > +2%; bear < -2%; neutral otherwise |
| momentum_60d | 2 | bull > +5%; bear < -5%; neutral otherwise |
| volatility_20d > 30% annualized | 1 | bear penalty |

**Regime thresholds:**
- `Bull`: bullRatio ≥ 0.70
- `Bear`: bearRatio ≥ 0.70
- `Sideways`: neither ≥ 0.70
- `Unknown`: < 50 data points

**Confidence adjustment:** × 0.6 if MA200 unavailable (< 200 data points)

---

## Reusable Components

- ✅ Score-based weighted factor logic (MA50/MA200/momentum/volatility)
- ✅ `buildRegimeTimeline()` for rolling historical regime labels (already PIT-safe)
- ✅ Confidence reduction when MA200 unavailable
- ✅ Limitations array pattern

---

## Deprecated / Unsafe Components

| Component | Concern | Action |
|-----------|---------|--------|
| `detectRegimeForPeriod()` | Uses `periodReturn` from full period — potential leakage if `endDate` is future | DO_NOT_USE in P4-03 Python script |
| Regime-stratified results referencing H001-H012 | H001-H012 retired | DEPRECATED for strategy validation |

---

## P4-03 Decision: EXTEND_LOGIC_IN_NEW_PYTHON_SCRIPT

**Rationale:**
1. TypeScript engine cannot be imported by Python directly
2. Python script needed for direct SQLite access (no Prisma/Next.js runtime)
3. Core factor logic is sound and PIT-safe — port it to Python
4. Extend with: `market_breadth_proxy`, `HIGH_VOLATILITY`, `LOW_CONFIDENCE` labels, `evidence_flags`, `pit_safety_flags`
5. Normalize confidence to 0.0–1.0 range
6. Alignment with existing engine: **HIGH** — same factor structure, same score-based voting
