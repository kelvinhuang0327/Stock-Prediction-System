# P29B-HARDRESET Final Report

**Task:** P29B — NewsEvent / FinancialReport Real Source Acquisition Plan
**Date:** 2026-05-24
**Final Classification:** `P29B_REAL_SOURCE_ACQUISITION_PLAN_READY`

> Not investment advice. Not a trading recommendation. Research observability only.

---

## 1. 本輪目標

建立 FinancialReport 與 NewsEvent 的真實資料來源取得計劃：
- 明確各 source 的 PIT-safe 條件
- 設計 manual drop-zone 路徑與 manifest template
- 設計 validator gates
- 定義 status transition criteria（HIGH_RISK → SOURCE_PRESENT → AVAILABLE）
- 不做下載、不做 import、不改 DB、不改 corpus、不改 scoring

---

## 2. P29A Recap

- P29A commit: `3e02b9d` | Classification: `P29A_PIT_FEATURE_REGISTRY_V1_READY`
- Registry v1: FinancialReport = HIGH_RISK_SOURCE_ABSENT; NewsEvent = HIGH_RISK_SOURCE_ABSENT
- Both entersAlphaScore = false

---

## 3. HIGH_RISK_SOURCE_ABSENT Review

### FinancialReport — root cause
DB schema has **no `filingDate`** field. Using `periodEndDate` as PIT gate is incorrect — Q1 ends Mar 31 but isn't filed with MOPS until ~May 15 (~45-day lag). Look-ahead contamination risk is **HIGH**.

### NewsEvent — root cause  
`publishedAt` in current DB may default to `ingestedAt` (system ingestion time) for RSS sources. Mock events mixed with real events. `ingestedAt` is **NEVER** a valid PIT gate. Risk is **MEDIUM-HIGH**.

---

## 4. FinancialReport Acquisition Plan

| Item | Specification |
| --- | --- |
| Recommended source | MOPS official filings (mops.twse.com.tw) |
| PIT gate field | `filingDate` (MOPS 公告日期) — NOT periodEndDate |
| Disclosure calendar | Q1: ~May 15 · Q2: ~Aug 14 · Q3: ~Nov 14 · Q4/Annual: ~Mar 31+1yr |
| Drop-zone | `data/manual/financial-report/p29b-dropzone/` |
| Filename pattern | `financial_report_<YYYY>_Q<N>_<label>.csv` |
| Mandatory fields | symbol, year, quarter, filingDate, eps, netIncome, sourceName, sourceUrl |
| Forbidden fields | periodEndDate (as gate), outcomePrice, returnPct, realizedReturnClass |
| Schema changes needed | Add `filingDate DateTime?`, `sourceName`, `sourceUrl` to FinancialReport model (paper plan) |
| Approval token | `P29B_APPROVE_FINANCIAL_REPORT_DRY_RUN_ONLY` |

---

## 5. NewsEvent Acquisition Plan

| Item | Specification |
| --- | --- |
| Recommended source | TWSE/MOPS official announcements (mops.twse.com.tw/mops/web/t57sb01_q1) |
| PIT gate field | `publishedAt` (MOPS announcement datetime) — NOT ingestedAt |
| Event taxonomy | 16 official types; no BULLISH_EVENT / BEARISH_EVENT / BUY_SIGNAL / SELL_SIGNAL |
| Drop-zone | `data/manual/news-event/p29b-dropzone/` |
| Filename pattern | `news_events_<YYYY>_<MM>_<label>.csv` |
| Mandatory fields | eventId, symbol, publishedAt, eventType, eventTitle, sourceName, sourceUrl, verificationStatus |
| Forbidden fields | ingestedAt, outcomePrice, returnPct, realizedReturnClass, sentiment labels |
| Existing DB audit | Check `publishedAt ≈ ingestedAt` (within 1 second) — likely defaulted to ingest time |
| Approval token | `P29B_APPROVE_NEWS_EVENT_DRY_RUN_ONLY` |

---

## 6. Unified Source Manifest / Drop-zone Design

Two manifest templates:
- `p29b-financial-report-manifest-v1` — includes attestation: realOfficialSource, filingDateCapturedFromMOPS, noOutcomeFields, readyForDryRunOnly, approvalTokenNotIncluded=true
- `p29b-news-event-manifest-v1` — includes attestation: publishedAtFromMOPSOrTWSE, noMockEventsIncluded, noSentimentLabels, readyForDryRunOnly, approvalTokenNotIncluded=true

Key rule: Manifest does NOT pre-grant approval. CTO provides token separately.

---

## 7. PIT Gate / Validator Plan

**FinancialReport:** 14 validator gates (FR-V01..V14) including:
- filingDate > period end date (Q1: > Mar 31)
- No periodEndDate substitution (FR-V14)
- No outcome fields (FR-V11)

**NewsEvent:** 13 validator gates (NE-V01..V13) including:
- publishedAt is valid ISO-8601 and not in future (NE-V03, NE-V04)
- No ingestedAt field in source CSV (NE-V08)
- No outcome / sentiment fields (NE-V09, NE-V10)

---

## 8. Registry Update Proposal

Both sources remain `HIGH_RISK_SOURCE_ABSENT` — no change in P29B.
`entersAlphaScore = false` maintained for both.
Status upgrade is conditional on source files + validator pass + approval token.

---

## 9. Tests Result

| Command | Tests | Result |
| --- | ---: | :---: |
| P29B targeted | 28/28 | ✅ PASS |
| Full onlineValidation suite | **3055/3055** (102 suites) | ✅ PASS |

Delta from P29A: 3027 → 3055 (+28).

---

## 10. Invariance Result

All frozen files UNCHANGED:
- `prisma/dev.db` sha256 ✅ | 3 scoring files ✅ | 5 corpus (60/4500/9900/4500/4499) ✅

---

## 11. Forbidden Claims Scan

**CLEAN** — 0 non-disclaimer violations.

2 raw hits reviewed: `neither_enters_alpha_score` (key name), `Gross profit / revenue` (accounting term). Both benign.

---

## 12. Boundary Validation

**8/8 PASS** — BOUNDARY_SAFE. No scoring files, DB, or corpus modified. No import scripts created.

---

## 13. New/Modified Files

| File | Type |
| --- | --- |
| `p29b_real_source_plan_preflight.json/.md` | Preflight |
| `p29b_high_risk_source_absent_review.json/.md` | Analysis |
| `p29b_financial_report_source_acquisition_plan.json/.md` | Plan |
| `p29b_news_event_source_acquisition_plan.json/.md` | Plan |
| `p29b_unified_source_manifest_design.json/.md` | Design |
| `p29b_pit_gate_validator_plan.json/.md` | Design |
| `p29b_registry_update_proposal.json/.md` | Proposal |
| `p29b_real_source_plan_tests.json/.md` | Tests |
| `p29b_real_source_plan_invariance.json/.md` | Invariance |
| `p29b_real_source_plan_forbidden_claims_scan.json/.md` | Scan |
| `p29b_real_source_plan_boundary_validation.json/.md` | Validation |
| `p29b_real_source_plan_final_report.md` | Final report |
| `p29_next_prompt_after_real_source_plan.md` | Next prompt |
| `src/lib/onlineValidation/__tests__/p29b_real_source_acquisition_plan.test.ts` | Test |

---

## 14. Remaining Blockers

| Blocker | Status |
| --- | --- |
| MonthlyRevenue 2025-09 to 2026-01 historical data | WAITING_FOR_OPERATOR_SOURCE |
| FinancialReport filingDate in DB schema | Paper plan only — needs P30 schema migration |
| FinancialReport source files | Not yet in drop-zone |
| NewsEvent publishedAt reliability audit | Not yet done |
| NewsEvent mock/real separation | Not yet done |
| NewsEvent verified-official source files | Not yet in drop-zone |

---

## 15. Contribution to CEO Two Strategic Axes

### Axis A — Taiwan Stock Prediction Research
**Direct.** P29B provides the concrete acquisition roadmap for FinancialReport and NewsEvent — the two `HIGH_RISK_SOURCE_ABSENT` sources blocking full 5-dimensional prediction coverage. Operator now has precise drop-zone paths, manifest templates, validator gates, and status transition criteria.

### Axis B — Strategy Simulation and Optimization
**Indirect.** P29-C (Backtest Contract Paper Design) is next. Registry update proposal ensures both sources stay excluded from alphaScore until formally audited, preventing simulation contamination.

---

## 16. Final Classification

```
P29B_REAL_SOURCE_ACQUISITION_PLAN_READY
```
