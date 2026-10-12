# Next Prompt After P29F-Repair

**Generated:** 2026-05-21  
**Prerequisite Commit:** P29F-Repair: Fix Quote Chip PIT date normalization  
**P29F-Repair Status:** `P29F_REPAIR_QUOTE_CHIP_PIT_DATE_READY_TRUST_ROOT_CLEARED`

---

## What Was Completed

The P29F-Repair has been committed. The PIT date normalization bug in `RuleBasedStockAnalyzer.ts` is fixed:

- `StockQuote` and `InstitutionalChip` Prisma PIT gates now use `normalizePitDateToIso(asOf)` → ISO-to-ISO comparison
- All three sources classified `PIT_SAFE_VERIFIED`
- `trustRootBlockerRemains: false` — trust-root CLEARED
- 3181/3181 onlineValidation tests pass
- No invariant files changed (SignalFusionEngine, ActiveScoringSnapshotBuilder)

---

## Trust-Root Gate Status

| Gate | Status |
|------|--------|
| Quote PIT | ✅ PIT_SAFE_VERIFIED |
| Regime PIT | ✅ PIT_SAFE_VERIFIED |
| Chip PIT | ✅ PIT_SAFE_VERIFIED |
| Trust-root blocker | ✅ CLEARED (false) |
| Simulation expansion | ✅ AUTHORIZED |

---

## Recommended Next Phase: P29G

**P29G: Paper Simulation Runner Dry-run Expansion**

The trust-root blocker that prevented simulation expansion (P29F finding) has been cleared. P29G may now proceed.

**P29G scope:**
1. Design a paper simulation runner that uses `analyzeStock(symbol, asOf)` with verified PIT-safe inputs
2. Run dry-run expansion against the existing corpus (P3 9-case + P6 corpus)
3. Validate simulation output determinism (same asOf → same score)
4. Validate no forward-looking data enters any simulation step
5. Produce P29G simulation runner contract + dry-run results

**Hard constraints for P29G:**
- All simulation runs must pass PIT gate (use `asOf` parameter always)
- `normalizePitDateToIso` is available and exported — use it in simulation runner if asOf is passed as YYYYMMDD
- Do NOT modify SignalFusionEngine.ts or ActiveScoringSnapshotBuilder.ts
- Do NOT change scoring math or alphaScore formula
- Simulation output must be reproducible (no timestamp-based randomness)

---

## Invariant Hashes to Maintain

| File | SHA256 |
|------|--------|
| `SignalFusionEngine.ts` | `b8ce3fa3ae63fd7edf6b6067dd8ccea63c02741454b93792e87bfbc1e95d2bf4` |
| `ActiveScoringSnapshotBuilder.ts` | `063a3bd524d20e9d0dfc847e342a93b36bd086bab042d9fde88282963156bf5d` |
| `RuleBasedStockAnalyzer.ts` (post-repair) | `4f6434a31fd211b6122408ee5e977e41f4cd45aee45cec586ec988b2c009e8e2` |

---

## If P29G Is Not Ready Yet

Alternative valid next steps (in priority order):

1. **Extend P29F-Repair test coverage** — Add integration test that seeds DB with future record, calls `analyzeStock(symbol, asOf)`, confirms future record absent from result
2. **P29H: FinancialReport / NewsEvent PIT audit** — Audit remaining data sources not covered by P29F
3. **P26F3.6 scanner consolidation** — If flagged in P26F3.5 scan

---

## Commit Reference

```
P29F-Repair: Fix Quote Chip PIT date normalization
```

Files committed:
- `src/lib/analysis/RuleBasedStockAnalyzer.ts`
- `prisma/schema.prisma`
- `src/lib/onlineValidation/p29f/quoteRegimeChipPitAudit.ts`
- `src/lib/onlineValidation/__tests__/p29f_quote_regime_chip_pit_audit.test.ts`
- `src/lib/onlineValidation/__tests__/p29f_repair_quote_chip_pit_date.test.ts`
- `outputs/online_validation/p29f_repair_*` (all artifacts)
- `outputs/online_validation/p29_next_prompt_after_p29f_repair.md`
