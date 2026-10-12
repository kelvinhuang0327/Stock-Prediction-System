# P26F4 Operator Source Docs Audit

**Phase:** P26F4-OPERATOR-SOURCE-PACKET-V2-HARDRESET  
**Date:** 2026-05-15

---

## Documents Reviewed

1. `docs/manual-data/monthly-revenue/P26F3_5_OPERATOR_HANDOFF_PACKET.md`
2. `data/manual/monthly-revenue/p26f3-2-dropzone/README.md`
3. `data/manual/monthly-revenue/p26f3-2-dropzone/EXPECTED_SCHEMA.json`
4. `data/manual/monthly-revenue/p26f3-2-dropzone/EXPECTED_FILENAMES.md`
5. `data/manual/monthly-revenue/p26f3-2-dropzone/TEMPLATE_DO_NOT_IMPORT_monthly_revenue.csv`
6. `outputs/online_validation/p26f4_waiting_for_operator_source.md`

---

## Findings

| Question | Answer |
|----------|--------|
| Operator knows which months to provide? | ✅ Yes — 2025-09 through 2026-01 is explicit |
| Filename convention clear? | ✅ Yes — `twse_monthly_revenue_YYYY_MM.csv` |
| Field schema clear? | ✅ Yes — EXPECTED_SCHEMA.json documents all required/optional/forbidden fields |
| releaseDate/revenueMonth mapping clear? | ✅ Yes — INFERRED_NEXT_MONTH_10TH rule documented |
| Source authenticity requirement clear? | ✅ Yes — sourceName must be TWSE/MOPS/OFFICIAL/MANUAL; UNKNOWN not accepted |
| Approval token timing clear? | ✅ Yes — token only after dry-run PASS |
| Target symbols documented? | ✅ Yes — 25 symbols explicitly listed |

---

## Gaps Addressed in V2

| Gap | Fix in V2 |
|-----|-----------|
| No operator attestation form | Added `SOURCE_MANIFEST_TEMPLATE.json` |
| No checkbox QA checklist | Added `P26F4_OPERATOR_FILE_QA_CHECKLIST.md` |
| No agent import runbook | Added `P26F4_AGENT_CONTROLLED_IMPORT_RUNBOOK.md` |
| Token timing may be unclear | Explicit in V2 packet — dry-run PASS first, then token |
| No next-round prompt artifact | Added `p26f4_next_prompt_when_source_present.md` |

---

## Potential Operator Misunderstandings

1. **.json/.jsonl also accepted** — operator may assume CSV only; V2 clarifies all 3 formats
2. **sourceUrl per file** — not explicitly prompted in V1; V2 manifest template makes this a required field
3. **SHA256 per file** — operator may not know to compute this; V2 checklist makes it explicit
4. **Dry-run vs import** — operator may not know dry-run runs automatically; V2 explains agent gate sequence
5. **DB backup** — operator may wonder if DB is protected; V2 runbook documents backup-before-import procedure

---

*Observability audit only. No investment recommendations.*
