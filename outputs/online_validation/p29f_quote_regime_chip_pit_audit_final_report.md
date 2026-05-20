# P29F Quote / Regime / Chip PIT Validation Audit — Final Report (Part K)

**Phase:** P29F-HARDRESET  
**Generated:** 2026-05-20  
**Final Classification:** `P29F_QUOTE_REGIME_CHIP_PIT_AUDIT_RISK_FOUND_NEEDS_REPAIR`

---

## 1. 本輪目標 (Round Objective)

對 Quote（StockQuote）、Regime（MarketIndex）、Chip（InstitutionalChip）三個資料來源進行 Point-in-Time (PIT) 安全性靜態審計，確認：
- 各來源是否有 PIT gate
- Gate 是否使用一致的日期格式
- 計算是否皆為 backward-looking
- 是否存在 future leakage 風險
- 是否影響 simulation trust-root blocker

---

## 2. 已完成事項 (Completed Work)

| 步驟 | 狀態 |
|------|------|
| Pre-flight checks | ✅ PASS |
| Source discovery (Quote / Regime / Chip) | ✅ COMPLETED |
| MarketIndex vs StockQuote date format consistency investigation | ✅ COMPLETED |
| Static audit — suspicious field scan | ✅ PASS (all CLEAN) |
| Static audit — date usage scan | ✅ COMPLETED |
| Static audit — rolling window audit | ✅ PASS (all backward-looking) |
| Static audit — caller chain audit | ✅ COMPLETED |
| PIT classification per source | ✅ COMPLETED |
| Simulation dependency gate assessment | ✅ COMPLETED |
| TypeScript audit module created | ✅ `src/lib/onlineValidation/p29f/quoteRegimeChipPitAudit.ts` |
| TypeScript PIT types created | ✅ `src/lib/onlineValidation/p29f/pitAuditTypes.ts` |
| P29F test file created | ✅ `src/lib/onlineValidation/__tests__/p29f_quote_regime_chip_pit_audit.test.ts` |
| P29F tests run — 73/73 PASS | ✅ Exit code 0 |
| 16 output artifacts created | ✅ All p29f_* files |
| Invariance re-check (Part H) | ✅ PASS |
| Forbidden claims scan (Part I) | ✅ CLEAN |
| Boundary validation (Part J) | ✅ PASS |

---

## 3. 修改 / 新增檔案 (Files Added/Modified)

### New Source Files (audit-only, read-only)
- `src/lib/onlineValidation/p29f/quoteRegimeChipPitAudit.ts` (588 lines)
- `src/lib/onlineValidation/p29f/pitAuditTypes.ts` (73 lines)

### New Test File
- `src/lib/onlineValidation/__tests__/p29f_quote_regime_chip_pit_audit.test.ts` (513 lines)

### New Output Artifacts (21 files)
- `p29f_source_discovery.{json,md}`
- `p29f_pit_rule_definition.{json,md}`
- `p29f_quote_regime_chip_pit_audit_preflight.{json,md}`
- `p29f_static_audit_results.{json,md}`
- `p29f_pit_classification.{json,md}`
- `p29f_simulation_dependency_gate.{json,md}`
- `p29f_quote_regime_chip_pit_audit_tests.{json,md}`
- `p29f_quote_regime_chip_pit_audit_invariance.{json,md}` ← Part H
- `p29f_forbidden_claims_scan.{json,md}` ← Part I
- `p29f_boundary_validation.{json,md}` ← Part J
- `p29f_quote_regime_chip_pit_audit_final_report.md` ← Part K (this file)

### Modified Production Files
**None** — All production scoring files are INVARIANT.

---

## 4. Quote Classification

| Attribute | Value |
|-----------|-------|
| **Classification** | `PIT_UNVERIFIED_NEEDS_REPAIR` |
| **Risk Level** | MEDIUM_HIGH |
| DB Table | `StockQuote` |
| Date field stored format | ISO (YYYY-MM-DD) via `parseTwseDateToIso` in `syncService.ts` |
| PIT gate format | YYYYMMDD via `asOf.replace(/-/g, '')` in `RuleBasedStockAnalyzer.ts:L61` |
| Format mismatch | ✅ YES — ISO stored, YYYYMMDD compared |
| Same-year future data risk | ⚠️ ISO `2026-xx-xx` always < YYYYMMDD `2026xxxx` (ASCII `-`=45 < `0`=48) |
| Confirmed future contamination | ❌ No (sync only writes current-day data) |
| Rolling window calculations | ✅ All backward-looking (MA20, MA60, RSI14, MACD, Momentum20d) |
| Simulation tag | `UNVERIFIED` |
| Simulation blocker | ✅ REMAINS |

**Repair required:** Fix gate to use consistent date format (either normalize all stored dates to YYYYMMDD, or change gate to use ISO).

---

## 5. Regime Classification

| Attribute | Value |
|-----------|-------|
| **Classification** | `PIT_SAFE_VERIFIED` |
| **Risk Level** | LOW |
| DB Table | `MarketIndex` |
| Date field stored format | ISO (YYYY-MM-DD) via `parseTwseDateToIso` / `openapiDate` |
| PIT gate format | ISO direct (`lte: asOf`) in `MarketRegimeEngine.ts:L65-73` |
| Format mismatch | ❌ None — ISO-ISO comparison is lexicographically correct |
| Same-year future data risk | ❌ None — correct format match |
| Rolling window calculations | ✅ All backward-looking (MA50, MA200, Momentum20d, Volatility20d) |
| Simulation tag | `VERIFIED` |
| Simulation blocker | ❌ NOT BLOCKED (Regime alone is safe) |

**No repair needed.** Document ISO format assumption in P29A registry.

---

## 6. Chip Classification

| Attribute | Value |
|-----------|-------|
| **Classification** | `PIT_UNVERIFIED_NEEDS_REPAIR` |
| **Risk Level** | MEDIUM |
| DB Table | `InstitutionalChip` |
| Date field stored format | ISO (YYYY-MM-DD) — `date: isoDate` confirmed in `syncService.ts:L395` |
| Schema comment | ⚠️ WRONG — schema says `// YYYYMMDD` but actual storage is ISO |
| PIT gate format | YYYYMMDD via `asOf.replace(/-/g, '')` in `RuleBasedStockAnalyzer.ts:L84-86` |
| Format mismatch | ✅ YES — same issue as Quote |
| Same-year future data risk | ⚠️ Same latent risk as Quote |
| Rolling window calculations | ✅ Backward-looking (`chips.slice(0, 10)` from `orderBy: date desc`) |
| Simulation tag | `UNVERIFIED` |
| Simulation blocker | ✅ REMAINS |

**Repair required:** Fix gate format and correct schema comment.

---

## 7. MarketIndex vs StockQuote Date Format Consistency Finding

| Source | DB Table | Stored Format | Gate Format | Consistent? |
|--------|----------|---------------|-------------|-------------|
| Quote | StockQuote | ISO (YYYY-MM-DD) | YYYYMMDD | ❌ MISMATCH |
| Regime | MarketIndex | ISO (YYYY-MM-DD) | ISO (YYYY-MM-DD) | ✅ MATCH |
| Chip | InstitutionalChip | ISO (YYYY-MM-DD) | YYYYMMDD | ❌ MISMATCH |

**Key finding:** MarketIndex uses ISO-to-ISO consistent comparison (PIT_SAFE_VERIFIED). StockQuote and InstitutionalChip both store ISO but compare YYYYMMDD — making the gate potentially ineffective for same-year future records due to ASCII ordering (`-` < `0`).

**The format inconsistency is not in the stored data (all three are ISO), but in the gate logic** — Regime engine correctly uses ISO for its gate, while Quote/Chip engines incorrectly use YYYYMMDD.

---

## 8. 是否解除 Simulation Trust-Root Blocker

**No — Trust-root blocker REMAINS.**

- Quote: `PIT_UNVERIFIED_NEEDS_REPAIR` → BLOCKER_REMAINS
- Chip: `PIT_UNVERIFIED_NEEDS_REPAIR` → BLOCKER_REMAINS
- Regime: `PIT_SAFE_VERIFIED` → PERMITTED (but insufficient alone)

Aggregate gate: `UNVERIFIED_NEEDS_REPAIR` — simulation expansion blocked pending Quote + Chip PIT repair.

---

## 9. Tests Result

| Metric | Value |
|--------|-------|
| Test file | `p29f_quote_regime_chip_pit_audit.test.ts` |
| Suites | 1 |
| Tests | 73 |
| Passed | 73 ✅ |
| Failed | 0 |
| Exit code | 0 |
| Pre-existing failing suites | 16 (unchanged from P29E baseline) |

**→ P29F TESTS: PASS**

---

## 10. Invariance Result

| Protected File | Status |
|----------------|--------|
| `prisma/dev.db` | RUNTIME_OK (WAL writes, no schema change) |
| Corpus JSONL files | INVARIANT ✅ |
| `RuleBasedStockAnalyzer.ts` | INVARIANT ✅ |
| `SignalFusionEngine.ts` | INVARIANT ✅ |
| `ActiveScoringSnapshotBuilder.ts` | INVARIANT ✅ |

**→ INVARIANCE GATE: PASS**

---

## 11. Forbidden Claims Scan Result

| Pattern | Found | Violation |
|---------|-------|-----------|
| ROI / win-rate / profit / outperform | ❌ | No |
| investment recommendation | ✅ prohibition context only | No |
| alphaScore (governance) | ✅ governance field only | No |
| 買進 / 賣出 / 買入 | ❌ | No |

**→ FORBIDDEN CLAIMS: CLEAN — PASS**

---

## 12. Boundary Validation Result

All 11 boundary checks PASS:

| Boundary | Result |
|----------|--------|
| Production scoring behavior | ✅ PASS |
| alphaScore behavior | ✅ PASS |
| Bucket behavior | ✅ PASS |
| Optimizer readiness | ✅ PASS |
| Real backtest | ✅ PASS |
| Corpus expansion | ✅ PASS |
| DB migration | ✅ PASS |
| FinancialReport import | ✅ PASS |
| NewsEvent import | ✅ PASS |
| P27 housekeeping | ✅ PASS |
| Scanner consolidation | ✅ PASS |

**→ BOUNDARY VALIDATION: PASS**

---

## 13. 尚未完成事項 (Remaining Work)

| Item | Owner |
|------|-------|
| Quote PIT gate format repair (ISO → ISO or YYYYMMDD → YYYYMMDD) | Next round (P29F-Repair) |
| Chip PIT gate format repair | Next round (P29F-Repair) |
| `prisma/schema.prisma` InstitutionalChip.date comment correction | Next round (P29F-Repair) |
| Integration tests: same-year future record exclusion for Quote + Chip | Next round |
| P29A registry update: document Regime ISO format assumption | Next round |
| Simulation expansion (P29-G Dry-run) | BLOCKED until repair complete |
| Optimizer readiness | BLOCKED until repair complete |

---

## 14. 風險與不確定點 (Risks & Uncertainties)

1. **Latent same-year future data risk:** No confirmed future contamination exists in current DB (sync only writes current-day data). However the gate is structurally non-functional for same-year future records if any appear.
2. **Publication lag (Chip):** Institutional chip for date T is published at ~6pm T. End-of-day scoring is acceptable, but this should be formally documented.
3. **Schema comment mismatch (Chip):** `prisma/schema.prisma` says `// YYYYMMDD` but actual storage is ISO — creates developer confusion and could lead to future gate bugs.
4. **Live API calls without asOf:** `/api/strategy/analyze` and `DailyAlertEngine` call without `asOf` — correct for live use, but creates a separate scoring path that bypasses PIT gates entirely. Acceptable for production live scoring, but must not be used in simulation replay.

---

## 15. 下一輪建議 (Next Round Recommendation)

**Next P0:** `P29F-Repair: Quote / Chip PIT Date Format Repair Plan`

**Actions required:**
1. Decide repair strategy: normalize all YYYYMMDD gate comparisons to ISO, OR normalize all stored dates to YYYYMMDD at sync time
2. Fix `RuleBasedStockAnalyzer.ts` PIT gate (Quote + Chip: lines ~61, 84-86)
3. Correct `prisma/schema.prisma` `InstitutionalChip.date` comment
4. Add integration tests confirming future record exclusion
5. Re-run P29F classification — promote Quote + Chip to `PIT_SAFE_VERIFIED`
6. Lift trust-root blocker → proceed to P29-G Paper Simulation Runner Dry-run Expansion

**Simulation expansion and optimizer readiness remain BLOCKED** until repair is verified.

---

## Classification Summary Table

| Source | Classification | Risk | Simulation Tag | Blocker |
|--------|---------------|------|----------------|---------|
| Quote | `PIT_UNVERIFIED_NEEDS_REPAIR` | MEDIUM_HIGH | UNVERIFIED | ✅ REMAINS |
| Regime | `PIT_SAFE_VERIFIED` | LOW | VERIFIED | ❌ Not blocked |
| Chip | `PIT_UNVERIFIED_NEEDS_REPAIR` | MEDIUM | UNVERIFIED | ✅ REMAINS |

**Aggregate:** `UNVERIFIED_NEEDS_REPAIR` → Trust-root blocker REMAINS

---

**Final Classification: `P29F_QUOTE_REGIME_CHIP_PIT_AUDIT_RISK_FOUND_NEEDS_REPAIR`**
