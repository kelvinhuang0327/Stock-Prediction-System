# P26F4 Operator Source Packet V2 — Final Report

**Phase:** P26F4-OPERATOR-SOURCE-PACKET-V2-HARDRESET  
**Date:** 2026-05-15  
**Final Classification:** `P26F4_OPERATOR_SOURCE_PACKET_V2_READY_WAITING_FOR_SOURCE`

---

## 1. 本輪目標

Build an auditable, operator-executable source acquisition packet for TWSE/MOPS monthly revenue data. This includes:
- Operator-facing source packet v2 with explicit requirements
- File QA checklist with checkboxes
- Agent-controlled import runbook with rollback
- Source manifest template for operator attestation
- No DB write, no corpus change, no scoring change

---

## 2. 前一輪 P26F4 Readiness Recap

| Item | Status |
|------|--------|
| Final Classification | `P26F4_WAITING_FOR_OPERATOR_SOURCE` |
| `candidateSourceFiles` | 0 |
| `routeDecision` | WAITING_FOR_OPERATOR_SOURCE |
| Approval token | NOT PROVIDED |
| DB write | BLOCKED |
| Tests | 2856/2856 PASS |
| Commit | `12dcb27` |

---

## 3. Existing Docs Audit (Part B)

| Finding | Result |
|---------|--------|
| Target months documented | ✅ 2025-09 through 2026-01 |
| Filename convention documented | ✅ `twse_monthly_revenue_YYYY_MM.csv` |
| Schema documented | ✅ 25 symbols, required/optional/forbidden fields |
| releaseDate mapping documented | ✅ INFERRED_NEXT_MONTH_10TH rule |
| Source authenticity requirement | ✅ sourceName must be TWSE/MOPS/OFFICIAL/MANUAL |
| Approval token timing | ✅ after dry-run PASS |
| Gaps identified | 4 items addressed in V2 |

---

## 4. New Operator Packet (Part C)

**Created:** `docs/manual-data/monthly-revenue/P26F4_OPERATOR_SOURCE_PACKET_V2.md`

Key sections:
- Purpose and disclaimer
- Required months (5) and target symbols (25)
- Official TWSE/MOPS source URLs
- Recommended filenames and accepted file formats
- Required fields with type and examples
- releaseDate mapping table
- Prohibited actions
- Operator completion report requirements
- Agent gate sequence (10 steps)
- Approval token with exact string

---

## 5. New File QA Checklist (Part D)

**Created:** `docs/manual-data/monthly-revenue/P26F4_OPERATOR_FILE_QA_CHECKLIST.md`

7 sections with manual-checkable items:
1. File completeness (5 months)
2. Source authenticity
3. Field validation
4. Forbidden fields absent
5. SHA-256 and metadata
6. Approval token protocol
7. Operator attestation

---

## 6. New Agent Import Runbook (Part E)

**Created:** `docs/manual-data/monthly-revenue/P26F4_AGENT_CONTROLLED_IMPORT_RUNBOOK.md`

12-step runbook:
1. Pre-flight commands
2. Drop-zone scan
3. Inventory
4. Dry-run gate
5. JSON validation
6. No-write invariance
7. Approval token check
8. DB backup procedure
9. Controlled import
10. Post-import checks
11. Rollback/restore procedure
12. Final classification mapping

No auto-download commands included.

---

## 7. New Source Manifest Template (Part F)

**Created:** `data/manual/monthly-revenue/p26f3-2-dropzone/SOURCE_MANIFEST_TEMPLATE.json`

- Contains operator attestation fields
- Excluded from scanner (TEMPLATE in filename)
- Provides per-file metadata template (filename, revenueMonth, releaseDate, sourceName, sourceUrl, sha256, rowCount)
- `approvalTokenNotIncluded: true` by default

---

## 8. No-write Smoke Validation (Part G)

| Check | Result |
|-------|--------|
| `node scripts/run-p26f3-5-dropzone-conditional-scan.js` | ✅ `candidateSourceFiles=0` |
| `SOURCE_MANIFEST_TEMPLATE.json` treated as candidate? | ✅ No — excluded |
| `prisma/dev.db` SHA256 | ✅ Unchanged |
| Corpus line counts | ✅ All unchanged |
| Scoring files SHA256 | ✅ Unchanged |

---

## 9. Invariance Results

| Item | Baseline | Current | Match |
|------|----------|---------|-------|
| `prisma/dev.db` | `a5cf277...` | `a5cf277...` | ✅ |
| `simulation_snapshot_corpus.jsonl` | 60 | 60 | ✅ |
| `p0hardreset...jsonl` | 4500 | 4500 | ✅ |
| `p1baseline...jsonl` | 9900 | 9900 | ✅ |
| `p3active...jsonl` | 4500 | 4500 | ✅ |
| `p19active...jsonl` | 4500 (canonical) | 4500 (canonical) | ✅ |
| `RuleBasedStockAnalyzer.ts` | `bc3716c...` | `bc3716c...` | ✅ |
| `SignalFusionEngine.ts` | `b8ce3fa...` | `b8ce3fa...` | ✅ |

---

## 10. Tests Results

```
Test Suites: 93 passed, 93 total
Tests:       2856 passed, 2856 total
Status:      ALL PASS
```

---

## 11. Forbidden Claims Scan

| Pattern | Hits | Verdict |
|---------|------|---------|
| ROI | 2 | ✅ Disclaimer context only |
| win-rate, outperform, beat, profit, guaranteed | 0 | ✅ CLEAN |
| buy, sell | 0 | ✅ CLEAN |
| investment recommendation | 0 | ✅ CLEAN |

**Status: CLEAN** — No investment claims detected.

---

## 12. 仍未解事項

| Issue | Status |
|-------|--------|
| Source files not provided | ❌ PENDING — operator must provide 5 CSV files |
| Approval token not provided | ❌ PENDING — only after dry-run PASS |
| DB coverage for 2025-09 ~ 2026-01 = 0 | ❌ PENDING — awaiting source files |
| P26F4 import gate blocked | ❌ PENDING — awaiting source + token |

---

## 13. 下一輪建議

1. Operator reviews `P26F4_OPERATOR_SOURCE_PACKET_V2.md` and `P26F4_OPERATOR_FILE_QA_CHECKLIST.md`
2. Operator downloads real TWSE/MOPS monthly revenue for 2025-09 to 2026-01
3. Operator fills in `SOURCE_MANIFEST_TEMPLATE.json` and places files in drop-zone
4. Operator notifies agent
5. Agent runs `run-p26f3-5-dropzone-conditional-scan.js` → confirms `candidateSourceFiles > 0`
6. Agent runs dry-run gate (no DB write)
7. Operator reviews dry-run output
8. Operator provides approval token: `P26F4_APPROVE_HISTORICAL_MONTHLY_REVENUE_IMPORT_ONLY`
9. Agent runs controlled import
10. Post-import checks → P26F4_IMPORT_COMPLETE

Use `outputs/online_validation/p26f4_next_prompt_when_source_present.md` for the exact next-round prompt.

---

## 14. Final Classification

```
P26F4_OPERATOR_SOURCE_PACKET_V2_READY_WAITING_FOR_SOURCE
```

All infrastructure is ready. Blocking factor: operator-provided source files.

---

*This report is for audit and observability purposes only.*  
*No investment recommendations are generated. No ROI/buy/sell/guaranteed claims.*
