# P29J — Chip C-F05 Lag Evidence Inventory

**Audit ID:** P29J-CHIP-LAG-EVIDENCE-INVENTORY  
**Captured:** 2026-05-15  
**Classification:** `CHIP_LAG_WARN_ASSUMPTION_REQUIRED`

---

## 1. Schema Evidence

| Field | Value |
|---|---|
| Model | `InstitutionalChip` |
| Date field | `date: String (ISO YYYY-MM-DD)` |
| `availableAt` | **ABSENT** |
| `releaseDate` | **ABSENT** |
| `generatedAt` | **ABSENT** |

**Fields:** `id, stockId, date, foreignBuy, trustBuy, dealerBuy, totalBuy, holders400, holders1000, createdAt`

**Conclusion:** No field records when T chip data became available. Cannot confirm T+0 chip availability from schema alone.

---

## 2. Cron Evidence

| Property | Value |
|---|---|
| Schedule | `0 7 * * 1-5` |
| UTC | 07:00 UTC |
| Taiwan | **15:00 TWN (UTC+8)** |
| Market close | 13:30 TWN |
| T86 availability | **~17:30 TWN** |
| Cron fires before T86 | **YES — 2.5 hours early** |
| Same-day T+0 via cron | **IMPOSSIBLE** |
| Effective chip at cron time | **T-1 (prior trading day)** |

---

## 3. C-F05 Assumption Audit

C-F05 text: *"T+0 institutional chip data published ~6pm on T. Post-close scoring assumption: scoring runs after 6pm (T) or uses prior day data."*

- The **"prior day data"** branch is the **actual production path** via the scheduled cron.
- C-F05 correctly documents both branches — assumption is not violated.
- However, **no production log confirms T+0 chip data has ever been loaded via cron**.

---

## 4. PIT Gate Status

Gate exists: `date: { lte: normalizePitDateToIso(asOf) }` in `RuleBasedStockAnalyzer.ts`  
`asOf` propagated from `SignalFusionEngine.ts → analyzeStock(symbol, asOf)` ✅

---

## 5. Classification Rationale

`CHIP_LAG_WARN_ASSUMPTION_REQUIRED` — PIT gate exists and is correctly applied; C-F05 assumption covers the T-1 case; but no availability timestamp in schema and no prod log evidence to confirm T+0. Cannot upgrade to `CHIP_LAG_CONFIRMED` without:
1. `availableAt` field in schema
2. Production sync log confirmation

---

## 6. Upgrade Path

1. Add `availableAt DateTime` to `prisma.InstitutionalChip`
2. Set `availableAt` on each upsert in `syncInstitutionalChip()`
3. Reschedule cron to fire after T86 (~18:00 TWN = 10:00 UTC)
4. Verify T+0 via production logs
5. Re-audit → advance to `CHIP_LAG_CONFIRMED`

---

*Structural audit-only. Does not constitute investment advice.*
