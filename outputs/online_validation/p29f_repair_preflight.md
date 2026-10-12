# P29F-Repair Pre-flight Gate

**Report ID:** p29f-repair-preflight  
**Generated:** 2026-05-21  
**HEAD:** `0165d79` — P29F: Audit Quote Regime Chip PIT validation  
**Status:** PREFLIGHT PASSED — Repair authorized

---

## P29F Classification at HEAD

| Source | Classification | mustBlock |
|--------|---------------|-----------|
| Quote | PIT_UNVERIFIED_NEEDS_REPAIR | true |
| Regime | PIT_SAFE_VERIFIED | false |
| Chip | PIT_UNVERIFIED_NEEDS_REPAIR | true |

**trustRootBlockerRemains:** `true`  
**overallClassification:** `P29F_QUOTE_REGIME_CHIP_PIT_AUDIT_RISK_FOUND_NEEDS_REPAIR`

---

## Baseline Hashes

| File | SHA256 | Invariant |
|------|--------|-----------|
| RuleBasedStockAnalyzer.ts | `bc3716cc...` (pre-repair) | NO — target of patch |
| SignalFusionEngine.ts | `b8ce3fa3...` | YES — locked |
| ActiveScoringSnapshotBuilder.ts | `063a3bd5...` | YES — locked |
| prisma/schema.prisma | pre-repair hash | NO — comment fix only |
| prisma/dev.db | `9c24c697...` | runtime-WAL only |

---

## Repair Strategy

**Strategy A (chosen):** Remove YYYYMMDD conversion. Add `normalizePitDateToIso(input)` helper. All StockQuote/InstitutionalChip Prisma queries use `asOfIso` (ISO format). Regime unchanged (already correct).

**Root bug:** `asOf.replace(/-/g,'')` produces `20260520` but DB stores `2026-05-20`. String comparison `"2026-05-21" <= "20260520"` = `true` because ASCII `'-'` (45) < `'0'` (48).

---

## Test Baseline

- **106 suites / 3181 tests** — all PASS at HEAD `0165d79`
- Repair must not regress any existing test

## Repair Scope

**Allowed changes:**
- `src/lib/analysis/RuleBasedStockAnalyzer.ts` — PIT date normalization
- `prisma/schema.prisma` — comment-only
- `src/lib/onlineValidation/p29f/quoteRegimeChipPitAudit.ts` — reclassification
- `src/lib/onlineValidation/__tests__/p29f_quote_regime_chip_pit_audit.test.ts` — assertion updates
- `src/lib/onlineValidation/__tests__/p29f_repair_quote_chip_pit_date.test.ts` — new test file
- `outputs/online_validation/p29f_repair_*` — artifacts

**Forbidden:** alphaScore, bucket, optimizer, corpus, DB, FinancialReport/NewsEvent, P27, scanner consolidation
