# P26F3-2 Drop-zone Operator Guide

**Version**: v1 (P26F3-3-HARDRESET)  
**Date**: 2026-05-13  
**Status**: TRACKED (committed to repository)

> Note: The `data/manual/monthly-revenue/p26f3-2-dropzone/README.md` contains the same content but is excluded by `~/.gitignore_global`. This file is the committed, auditable version.

---

## 1. File Placement Location

Place TWSE monthly revenue source files in:

```
data/manual/monthly-revenue/p26f3-2-dropzone/
```

Do NOT place files anywhere else. Do NOT modify DB directly.

---

## 2. Supported Formats

| Format | Extension | Notes |
|---|---|---|
| CSV | `.csv` | First row must be header |
| JSON | `.json` | Array of row objects |
| JSONL | `.jsonl` | One JSON object per line |

---

## 3. Required Fields per Row

| Field | Type | Notes |
|---|---|---|
| `stockId` or `symbol` | string | Taiwan stock code |
| `year` | integer | Revenue year (2025 or 2026) |
| `month` | integer | Revenue month (1–12) |
| `revenue` | number or numeric string | Monthly revenue (TWD thousands) |
| `releaseDate` | YYYY-MM-DD string | **Official** TWSE release date — must be verified, not inferred |
| `sourceName` | string | One of: `TWSE`, `MOPS`, `OFFICIAL`, `MANUAL` |
| `sourceFileName` | string | Original filename for audit trail |

---

## 4. Target Periods

| Period | Estimated Release Date |
|---|---|
| 2025-09 | 2025-10-10 |
| 2025-10 | 2025-11-10 |
| 2025-11 | 2025-12-10 |
| 2025-12 | 2026-01-10 |
| 2026-01 | 2026-02-10 |

⚠️ Estimated dates are for reference only. Always use the **official** TWSE release date.

---

## 5. Target Symbols (25)

```
0055, 00712, 00738U, 00830, 00891, 00903,
1210, 1308, 1314, 1319, 1326, 1402, 1434,
1513, 1536, 1560, 1598, 1605, 1710, 1717,
1802, 2317, 2330, 2454, 6415
```

Rows for symbols NOT in this list will be rejected.

---

## 6. Validator Commands

After placing files in the drop-zone, run in order:

```bash
# Step 1: Inventory what's in the drop-zone
node scripts/run-p26f3-3-dropzone-inventory.js

# Step 2: Validate schema + acceptance
node scripts/run-p26f3-2-manual-source-validator.js

# Step 3: Check coverage against P3/P19 corpus
node scripts/run-p26f3-2-accepted-source-coverage-preview.js

# Step 4: Safety gate (DB/corpus/sha256 unchanged)
node scripts/run-p26f3-2-manual-source-safety-gate.js

# Step 5: Scoring invariance
node scripts/run-p26f3-2-scoring-invariance-check.js
```

---

## 7. Success / Failure Classifications

| Classification | Meaning |
|---|---|
| `P26F3_2_SOURCE_NOT_PROVIDED_PACKAGE_READY` | Drop-zone empty — place files and re-run |
| `P26F3_2_MANUAL_SOURCE_ACCEPTED_DRY_RUN` | Files valid, accepted for dry-run |
| `P26F3_2_SOURCE_FILES_REJECTED` | Files present but invalid — check violations |
| `P26F3_2_ACCEPTED_SOURCE_COVERAGE_AVAILABLE` | Accepted rows match P3/P19 corpus |
| `P26F3_2_ACCEPTED_SOURCE_NO_COVERAGE` | Accepted but no PIT-date match with corpus |
| `P26F3_2_UNEXPECTED_WRITE_DETECTED` | Safety gate failure — investigate immediately |

---

## 8. Prohibited Actions

❌ **Do NOT directly modify the database**  
❌ **Do NOT apply Prisma migrations**  
❌ **Do NOT overwrite frozen corpus files**  
❌ **Do NOT include any of these fields in source files:**
- `outcomePrice`
- `returnPct`
- `realizedReturnClass`

---

## 9. Requirements for P26F4 Controlled Import Gate

To proceed to P26F4 (DB import), **ALL** of the following must be true:

1. `classification = P26F3_2_MANUAL_SOURCE_ACCEPTED_DRY_RUN`
2. `acceptedRows > 0`
3. `readyForP26F4 = true`
4. Safety gate: PASS
5. Scoring invariance: PASS
6. Coverage preview: `P26F3_2_ACCEPTED_SOURCE_COVERAGE_AVAILABLE`
7. No forbidden fields detected
8. CTO approval obtained

P26F4 will apply the `20260512000000_monthly_revenue_release_date_pit_draft` migration and perform controlled DB upsert.

---

## Disclaimer

This tool does not constitute investment advice.  
It does not compute ROI, profit, win-rate, edge, or outperformance.  
No buy/sell recommendations are generated.
