# P29F-Repair Final Report: Quote/Chip PIT Date Normalization

**Report ID:** p29f-repair-quote-chip-pit-date-final-report  
**Generated:** 2026-05-21  
**Status:** `P29F_REPAIR_QUOTE_CHIP_PIT_DATE_READY_TRUST_ROOT_CLEARED`

---

## Executive Summary

The P29F audit identified that `StockQuote` and `InstitutionalChip` Prisma PIT gates in `RuleBasedStockAnalyzer.ts` used a YYYYMMDD-formatted date (`asOfDb`) to filter rows stored with ISO format (`YYYY-MM-DD`). This caused an ASCII string comparison bug where same-year future ISO dates silently passed the gate.

**P29F-Repair** fixed this by introducing `normalizePitDateToIso()` and replacing the YYYYMMDD conversion. All 17 new tests pass. All 73 P29F audit tests pass. All 3181 onlineValidation tests pass.

---

## The Bug

```typescript
// BEFORE (buggy):
const asOfDb = asOf ? asOf.replace(/-/g, '') : null;
// asOfDb = "20260520"; DB stores "2026-05-20"
// "2026-05-21" <= "20260520" → TRUE (wrong: future record passes gate)
```

**Mechanism:** ASCII `'-'` = 45, `'0'` = 48. ISO strings sort *before* YYYYMMDD strings of the same year.

---

## The Fix

```typescript
// AFTER (fixed):
const asOfIso = asOf ? normalizePitDateToIso(asOf) : null;
// asOfIso = "2026-05-20"; DB stores "2026-05-20"
// "2026-05-21" <= "2026-05-20" → FALSE (correct: future record blocked)
```

```typescript
export function normalizePitDateToIso(input: string): string {
    if (/^\d{4}-\d{2}-\d{2}$/.test(input)) return input;
    if (/^\d{8}$/.test(input)) {
        return `${input.slice(0, 4)}-${input.slice(4, 6)}-${input.slice(6, 8)}`;
    }
    throw new Error(`[PIT] Invalid date format: "${input}"`);
}
```

---

## Files Changed

| File | Change Type | Summary |
|------|-------------|---------|
| `src/lib/analysis/RuleBasedStockAnalyzer.ts` | Logic fix | Added `normalizePitDateToIso`; `asOfDb` → `asOfIso` in PIT gate |
| `prisma/schema.prisma` | Comment only | `// YYYYMMDD` → `// ISO (YYYY-MM-DD)` for `InstitutionalChip.date` |
| `src/lib/onlineValidation/p29f/quoteRegimeChipPitAudit.ts` | Reclassification | Quote/Chip → `PIT_SAFE_VERIFIED`; trust-root cleared |
| `src/lib/onlineValidation/__tests__/p29f_quote_regime_chip_pit_audit.test.ts` | Assertion update | 4 assertions updated to match reclassification |
| `src/lib/onlineValidation/__tests__/p29f_repair_quote_chip_pit_date.test.ts` | New test file | 17 tests covering normalization, gate correctness, bug proof |

---

## Classification After Repair

| Source | Pre-Repair | Post-Repair |
|--------|------------|-------------|
| Quote | `PIT_UNVERIFIED_NEEDS_REPAIR` | `PIT_SAFE_VERIFIED` |
| Regime | `PIT_SAFE_VERIFIED` | `PIT_SAFE_VERIFIED` (unchanged) |
| Chip | `PIT_UNVERIFIED_NEEDS_REPAIR` | `PIT_SAFE_VERIFIED` |
| trustRootBlockerRemains | `true` | `false` |
| overallClassification | RISK_FOUND_NEEDS_REPAIR | `P29F_REPAIR_QUOTE_CHIP_PIT_DATE_READY_TRUST_ROOT_CLEARED` |

---

## Test Results

| Suite | Tests | Status |
|-------|-------|--------|
| `p29f_repair_quote_chip_pit_date.test.ts` | 17/17 | PASS |
| `p29f_quote_regime_chip_pit_audit.test.ts` | 73/73 | PASS |
| All onlineValidation suites | 3181/3181 | PASS (106 suites) |

---

## Invariance

| File | SHA256 | Changed |
|------|--------|---------|
| `SignalFusionEngine.ts` | `b8ce3fa3...` | NO — locked |
| `ActiveScoringSnapshotBuilder.ts` | `063a3bd5...` | NO — locked |
| alphaScore formula | — | NO — unchanged |
| Scoring thresholds | — | NO — unchanged |

---

## Trust-Root Status

**`trustRootBlockerRemains: false`** — P29G Paper Simulation Runner Dry-run Expansion may now proceed.

All three scoring input sources (Quote, Regime, Chip) are classified `PIT_SAFE_VERIFIED`. The simulation trust-root is `VERIFIED_SAFE`.
