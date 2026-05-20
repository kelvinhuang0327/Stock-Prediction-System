# P29F-Repair Root Cause Confirmation

**Report ID:** p29f-repair-root-cause-confirmation  
**Generated:** 2026-05-21  
**Status:** ROOT CAUSE CONFIRMED

---

## Root Cause

**Bug ID:** RC-01 — YYYYMMDD vs ISO string comparison in Prisma PIT gate

**File:** `src/lib/analysis/RuleBasedStockAnalyzer.ts` (pre-repair, line 59)

**Buggy code:**
```typescript
const asOfDb = asOf ? asOf.replace(/-/g, '') : null;
// ...
prisma.stockQuote.findMany({ where: { date: { lte: asOfDb } } })
// asOfDb = "20260520", but stored date = "2026-05-20"
```

**Mechanism:**
SQLite performs lexicographic text comparison on the `date` column.

```
"2026-05-21" <= "20260520"   → TRUE  (WRONG — future record passes gate)
```

Because ASCII `'-'` = 45, `'0'` = 48: the hyphen makes ISO strings sort *before* compact YYYYMMDD strings of the same year. Any future same-year record with an ISO date incorrectly passes the YYYYMMDD gate.

**T12 proof (from p29f_repair_quote_chip_pit_date.test.ts):**
```typescript
expect("2026-05-21" <= "20260520").toBe(true); // PASS — confirms the bug
```

---

## Affected Sources

| Source | Affected | Why |
|--------|----------|-----|
| StockQuote | YES | Stores ISO via `parseTwseDateToIso`, queried with YYYYMMDD gate |
| InstitutionalChip | YES | Stores ISO via `isoDate` const, queried with YYYYMMDD gate |
| MarketRegime | NO | `MarketRegimeEngine.ts` uses `date: { lte: asOf }` directly — ISO-to-ISO |

---

## Fix Applied (Strategy A)

```typescript
// BEFORE (buggy):
const asOfDb = asOf ? asOf.replace(/-/g, '') : null;
date: { lte: asOfDb }   // YYYYMMDD vs ISO — broken

// AFTER (fixed):
const asOfIso = asOf ? normalizePitDateToIso(asOf) : null;
date: { lte: asOfIso }  // ISO vs ISO — correct
```

**Helper added:**
```typescript
export function normalizePitDateToIso(input: string): string {
    if (/^\d{4}-\d{2}-\d{2}$/.test(input)) return input;        // ISO passthrough
    if (/^\d{8}$/.test(input)) return `${input.slice(0,4)}-${input.slice(4,6)}-${input.slice(6,8)}`;
    throw new Error(`[PIT] Invalid date format: "${input}"`);
}
```

**After fix:**
```
"2026-05-21" <= "2026-05-20"   → FALSE (CORRECT — future record blocked)
"2026-05-20" <= "2026-05-20"   → TRUE  (CORRECT — same-day record passes)
"2026-05-19" <= "2026-05-20"   → TRUE  (CORRECT — past record passes)
```

---

## Schema Comment Fix

```prisma
// BEFORE:
date  String  // YYYYMMDD

// AFTER:
date  String  // ISO (YYYY-MM-DD) — stored as ISO via syncInstitutionalChip isoDate
```
