# P26F4 Readiness — Waiting for Operator Source

**Phase:** P26F4-READINESS-RECHECK-HARDRESET  
**Date:** 2026-05-15  
**Classification:** P26F4_WAITING_FOR_OPERATOR_SOURCE

---

## Current State

- **Drop-zone path:** `data/manual/monthly-revenue/p26f3-2-dropzone/`
- **candidateSourceFiles:** `0` — only scaffold files present
- **DB write:** BLOCKED
- **Import gate:** BLOCKED

---

## Required Source Files

The following real TWSE/MOPS monthly revenue CSV files are needed:

| Month | Expected Filename |
|-------|-------------------|
| 2025-09 | `twse_monthly_revenue_2025_09.csv` |
| 2025-10 | `twse_monthly_revenue_2025_10.csv` |
| 2025-11 | `twse_monthly_revenue_2025_11.csv` |
| 2025-12 | `twse_monthly_revenue_2025_12.csv` |
| 2026-01 | `twse_monthly_revenue_2026_01.csv` |

See expected schema: `data/manual/monthly-revenue/p26f3-2-dropzone/EXPECTED_SCHEMA.json`  
See expected filenames: `data/manual/monthly-revenue/p26f3-2-dropzone/EXPECTED_FILENAMES.md`

---

## Operator Next Steps

1. **Obtain** real TWSE/MOPS monthly revenue CSV files for months 2025-09 through 2026-01
2. **Place** files in drop-zone: `data/manual/monthly-revenue/p26f3-2-dropzone/`
3. **Re-run** drop-zone scan: `node scripts/run-p26f3-5-dropzone-conditional-scan.js`
4. **Review** dry-run gate output (auto-runs when files present): `outputs/online_validation/p26f4_readiness_dry_run_gate.json`
5. **Provide** approval token to authorize DB import: `P26F4_APPROVE_HISTORICAL_MONTHLY_REVENUE_IMPORT_ONLY`

Full instructions: `docs/manual-data/monthly-revenue/P26F3_5_OPERATOR_HANDOFF_PACKET.md`

---

## What Happens After Source Is Provided

```
[files placed] → drop-zone scan → inventory
              → validator (acceptedRows / rejectedRows)
              → coverage preview (matchedRows)
              → safety gate
              → scoring invariance dry-run
              → [if token provided] → controlled import gate
              → [if import OK] → P26F4_IMPORT_COMPLETE_READY_FOR_COVERAGE_PREVIEW
```

---

*DB unchanged. No synthetic fixture. No auto-download. No investment recommendations.*
