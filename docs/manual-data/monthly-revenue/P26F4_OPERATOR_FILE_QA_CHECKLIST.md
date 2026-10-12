# P26F4 Operator File QA Checklist

**Version:** P26F4-OPERATOR-FILE-QA-CHECKLIST-V1  
**Date:** 2026-05-15  
**Purpose:** Pre-submission verification before notifying agent that source files are ready

> Complete all items before notifying agent. Do not provide approval token until dry-run PASS.

---

## Section 1: File Completeness

- [ ] All 5 `revenueMonth` values have corresponding source files:
  - [ ] `2025-09`
  - [ ] `2025-10`
  - [ ] `2025-11`
  - [ ] `2025-12`
  - [ ] `2026-01`
- [ ] Files are placed in the correct drop-zone: `data/manual/monthly-revenue/p26f3-2-dropzone/`
- [ ] No `TEMPLATE_DO_NOT_IMPORT` file has been placed in the drop-zone
- [ ] No synthetic fixture file has been placed in the drop-zone

---

## Section 2: Source Authenticity

- [ ] Each file comes from a real TWSE or MOPS source
- [ ] Each file has a `sourceName` field (must be one of: TWSE, MOPS, OFFICIAL, MANUAL)
- [ ] Each file has either `sourceUrl` or `sourceChecksum` (or both)
- [ ] Source URL or reference is publicly verifiable
- [ ] No revenue values have been manually altered to inflate coverage

---

## Section 3: Field Validation

- [ ] `revenueMonth` format is `YYYY-MM` (e.g., `2025-09`)
- [ ] `releaseDate` is the actual MOPS/TWSE announcement date, or `INFERRED_NEXT_MONTH_10TH` if not known
- [ ] `monthlyRevenue` (or `revenue`) values are numeric (no commas, no currency symbol)
- [ ] `symbol` or `stockId` values are Taiwan stock codes (4–6 digit strings)
- [ ] At least some of the 25 target symbols are covered

---

## Section 4: Forbidden Fields Absent

- [ ] No `outcomePrice` field in any file
- [ ] No `returnPct` field in any file
- [ ] No `realizedReturnClass` field in any file
- [ ] No investment recommendation fields present

---

## Section 5: SHA-256 and Metadata

- [ ] SHA-256 has been computed for each file: `shasum -a 256 <file>`
- [ ] Row count has been verified: `wc -l <file>`
- [ ] `SOURCE_MANIFEST_TEMPLATE.json` has been filled in with all file metadata

---

## Section 6: Approval Token Protocol

- [ ] Dry-run gate has NOT yet been run (agent will run it upon notification)
- [ ] Approval token is NOT provided yet (must wait for dry-run PASS)
- [ ] Approval token will only be provided after reviewing dry-run output

---

## Section 7: Operator Attestation

- [ ] I confirm these files are real TWSE/MOPS source data
- [ ] I confirm these files are NOT synthetic fixtures
- [ ] I confirm these files are NOT template placeholders
- [ ] I confirm no outcome fields are present
- [ ] I am ready for agent to run dry-run gate (no import yet)

---

## Approval Token (to be provided ONLY after dry-run PASS)

After agent reports dry-run PASS, provide this exact token:

```
P26F4_APPROVE_HISTORICAL_MONTHLY_REVENUE_IMPORT_ONLY
```

---

*This checklist does not constitute investment advice. No ROI/buy/sell/guaranteed claims.*
