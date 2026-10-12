# P29F PIT Classification Results

**Phase:** P29F-HARDRESET  
**Date:** 2026-05-20

## Summary Table

| Source | Classification | Risk | Blocks Simulation | simulationInputTag |
|--------|---------------|------|------------------|--------------------|
| **Quote** | PIT_UNVERIFIED_NEEDS_REPAIR | MEDIUM_HIGH | YES | UNVERIFIED |
| **Regime** | PIT_SAFE_VERIFIED | LOW | NO | VERIFIED |
| **Chip** | PIT_UNVERIFIED_NEEDS_REPAIR | MEDIUM | YES | UNVERIFIED |

---

## Quote — PIT_UNVERIFIED_NEEDS_REPAIR

**Risk:** MEDIUM_HIGH  
**Blocks simulation:** YES

**Key Findings:**
1. ✅ PIT gate exists: `date: { lte: asOfDb }` in `RuleBasedStockAnalyzer.ts:L79`
2. ❌ Date format mismatch: sync stores ISO (from `parseTwseDateToIso`), gate uses YYYYMMDD (`asOf.replace(/-/g, '')`)
3. ❌ Same-year future ISO dates pass YYYYMMDD filter (ASCII `-`=45 `<` `'0'`=48)
4. ✅ No future-labeled fields in schema
5. ✅ No confirmed future-data contamination in current DB
6. ✅ asOf correctly propagated through call chain

**Repair needed:** Verify DB format; fix gate to use consistent format.

---

## Regime — PIT_SAFE_VERIFIED

**Risk:** LOW  
**Blocks simulation:** NO

**Key Findings:**
1. ✅ Gate: `date: { lte: asOf }` — ISO asOf with ISO stored dates — **correct**
2. ✅ MarketIndex.date is ISO (confirmed from `syncMarketIndices` via `openapiDate`)
3. ✅ All calculations backward-looking (MA50, MA200, momentum, volatility)
4. ✅ `detectRegimeForPeriod` is backtest-only (not in scoring path)
5. ✅ asOf correctly propagated through SignalFusionEngine
6. ✅ No future-labeled fields

**No repair required.** Advisory: document ISO format assumption.

---

## Chip — PIT_UNVERIFIED_NEEDS_REPAIR

**Risk:** MEDIUM  
**Blocks simulation:** YES

**Key Findings:**
1. ✅ PIT gate exists: `date: { lte: asOfDb }` in `RuleBasedStockAnalyzer.ts:L84-86`
2. ❌ Date format mismatch: sync CONFIRMED to store ISO (`date: isoDate` in `syncInstitutionalChip:L395`)
3. ❌ Schema comment `// YYYYMMDD` is **INCORRECT** — actual storage is ISO
4. ❌ Same-year future chip dates pass YYYYMMDD filter (same issue as Quote)
5. ✅ Chip strength uses backward-looking aggregates only (totalBuy, foreignBuy, trustBuy)
6. ⚠️ Publication lag: chip for T published ~6pm T — same-day inclusion is industry standard
7. ✅ No confirmed future-data contamination in current DB

**Repair needed:** Fix schema comment; fix gate to use ISO asOf directly.

---

## Overall Verdict

**P29F_QUOTE_REGIME_CHIP_PIT_AUDIT_RISK_FOUND_NEEDS_REPAIR**

- Trust root blocker remains: **YES**
- Simulation trust root status: **UNVERIFIED_NEEDS_REPAIR**
- Any violation confirmed: NO
- Any source verified: YES (Regime only)
