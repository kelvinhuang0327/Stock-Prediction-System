# P29F-Repair Patch Design

**Report ID:** p29f-repair-patch-design  
**Strategy:** A — ISO normalization helper; remove YYYYMMDD conversion  
**Generated:** 2026-05-21

---

## PATCH-1: RuleBasedStockAnalyzer.ts (Logic Fix)

**Scope:** PIT gate normalization only. Scoring math, thresholds, alphaScore, bucket logic — all unchanged.

### Added: normalizePitDateToIso helper
```typescript
export function normalizePitDateToIso(input: string): string {
    if (/^\d{4}-\d{2}-\d{2}$/.test(input)) return input;
    if (/^\d{8}$/.test(input)) {
        return `${input.slice(0, 4)}-${input.slice(4, 6)}-${input.slice(6, 8)}`;
    }
    throw new Error(`[PIT] Invalid date format for normalizePitDateToIso: "${input}"`);
}
```

### Changed: asOfDb → asOfIso
```typescript
// BEFORE:
const asOfDb = asOf ? asOf.replace(/-/g, '') : null;
// AFTER:
const asOfIso = asOf ? normalizePitDateToIso(asOf) : null;
```

### Changed: MonthlyRevenue month slice
```typescript
// BEFORE (YYYYMMDD slice):
const asOfMonth = parseInt(asOfDb.slice(4, 6), 10);
// AFTER (ISO slice):
const asOfMonth = parseInt(asOfIso.slice(5, 7), 10);
```

### Changed: PIT gate queries
```typescript
// StockQuote and InstitutionalChip: asOfDb → asOfIso
date: { lte: asOfIso }   // ISO-to-ISO: correct lexicographic comparison
```

---

## PATCH-2: prisma/schema.prisma (Comment Only)

```prisma
// BEFORE:
date  String // YYYYMMDD

// AFTER:
date  String // ISO (YYYY-MM-DD) — stored as ISO via syncInstitutionalChip isoDate
```

No migration required — schema structure unchanged.

---

## PATCH-3: quoteRegimeChipPitAudit.ts (Reclassification)

| Field | Before | After |
|-------|--------|-------|
| Quote.classification | PIT_UNVERIFIED_NEEDS_REPAIR | PIT_SAFE_VERIFIED |
| Quote.riskLevel | MEDIUM_HIGH | LOW |
| Quote.mustBlockBeforeSimulation | true | false |
| Quote.simulationInputTag | UNVERIFIED | VERIFIED |
| Chip.classification | PIT_UNVERIFIED_NEEDS_REPAIR | PIT_SAFE_VERIFIED |
| Chip.riskLevel | MEDIUM | LOW |
| Chip.mustBlockBeforeSimulation | true | false |
| Chip.simulationInputTag | UNVERIFIED | VERIFIED |
| overallClassification | P29F_QUOTE_REGIME_CHIP_PIT_AUDIT_RISK_FOUND_NEEDS_REPAIR | P29F_REPAIR_QUOTE_CHIP_PIT_DATE_READY_TRUST_ROOT_CLEARED |

---

## PATCH-4: p29f_quote_regime_chip_pit_audit.test.ts (4 assertion updates)

Updated `mustBlockBeforeSimulation` and `simulationInputTag` assertions for Quote/Chip to match reclassified values.

---

## PATCH-5: p29f_repair_quote_chip_pit_date.test.ts (New — 17 tests)

| Test | Description |
|------|-------------|
| T01-T05 | normalizePitDateToIso ISO passthrough |
| T06-T09 | normalizePitDateToIso YYYYMMDD→ISO conversion |
| T10-T11 | Invalid input rejection (throw) |
| T12 | PROOF of old bug: "2026-05-21" <= "20260520" = true |
| T13 | PROOF of fix: "2026-05-21" <= "2026-05-20" = false |
| T14-T15 | Same-day and past ISO gate correctness |
| T16-T17 | Round-trip gate correctness |

---

## Invariance

| File | Changed | Hash |
|------|---------|------|
| SignalFusionEngine.ts | NO | `b8ce3fa3...` locked |
| ActiveScoringSnapshotBuilder.ts | NO | `063a3bd5...` locked |
