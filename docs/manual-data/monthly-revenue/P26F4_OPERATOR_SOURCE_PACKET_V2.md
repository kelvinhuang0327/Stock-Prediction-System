# P26F4 Operator Source Acquisition Packet V2

**Version:** P26F4-OPERATOR-SOURCE-PACKET-V2  
**Status:** AWAITING_OPERATOR_ACTION  
**Date:** 2026-05-15  
**Supersedes:** `P26F3_5_OPERATOR_HANDOFF_PACKET.md`

> **Disclaimer:** This packet is for data acquisition purposes only.  
> It does not constitute investment advice. No buy/sell recommendations are generated.  
> No ROI, performance, or return claims are made.

---

## 1. Purpose

Acquire real TWSE/MOPS monthly revenue (月營收) CSV data to:
- Unblock the P26F4 MonthlyRevenue source gate
- Enable coverage preview for P3/P19 corpus symbols
- Allow controlled import into the system database under explicit operator approval

This packet does **not** authorize any DB write. Import requires a separate approval token after dry-run PASS.

---

## 2. Required Months

| Month | Period | Expected Release Date |
|-------|--------|-----------------------|
| September 2025 | `2025-09` | ~2025-10-10 |
| October 2025 | `2025-10` | ~2025-11-10 |
| November 2025 | `2025-11` | ~2025-12-10 |
| December 2025 | `2025-12` | ~2026-01-10 |
| January 2026 | `2026-01` | ~2026-02-10 |

**All 5 months are required.** Partial coverage will be accepted for dry-run but import effectiveness depends on coverage.

---

## 3. Target Symbols (25 symbols)

```
0055, 00712, 00738U, 00830, 00891, 00903,
1210, 1308, 1314, 1319, 1326, 1402, 1434,
1513, 1536, 1560, 1598, 1605, 1710, 1717,
1802, 2317, 2330, 2454, 6415
```

Files covering more symbols are acceptable; the validator will filter to this set.

---

## 4. Official Source URLs

### TWSE (Taiwan Stock Exchange)
- Main portal: https://www.twse.com.tw
- Navigate to: 月營收 / Monthly Revenue statistics
- TWSE OpenAPI: https://openapi.twse.com.tw/ (search "monthlyRevenue")

### MOPS (Market Observation Post System)
- Main portal: https://mops.twse.com.tw
- Navigate to: 財務報告 → 月營收 / 每月營業收入彙總表
- Direct path candidate: https://mops.twse.com.tw/mops/web/t05st10_1

> If URLs have changed, search for "月營收" on the respective sites.  
> If you cannot confirm the URL, mark `sourceUrl` as `URL_TBD` and document in the manifest.

---

## 5. Recommended Filenames

```
twse_monthly_revenue_2025_09.csv
twse_monthly_revenue_2025_10.csv
twse_monthly_revenue_2025_11.csv
twse_monthly_revenue_2025_12.csv
twse_monthly_revenue_2026_01.csv
```

**Combined file (alternative):**
```
twse_monthly_revenue_2025_09_to_2026_01.csv
```

**Accepted extensions:** `.csv`, `.json`, `.jsonl`

---

## 6. Drop-zone Location

```
data/manual/monthly-revenue/p26f3-2-dropzone/
```

Place source files directly in this directory. Do **not** create subdirectories.

---

## 7. Required Fields

| Field | Type | Example | Notes |
|-------|------|---------|-------|
| `stockId` or `symbol` | string | `2330` | Taiwan stock code |
| `year` | integer | `2025` | 4-digit year |
| `month` | integer | `9` | 1–12 |
| `revenue` | number | `123456789` | Monthly revenue in TWD (no commas) |
| `releaseDate` | date | `2025-10-10` | Actual MOPS announcement date or INFERRED_NEXT_MONTH_10TH |
| `sourceName` | string | `TWSE` | Must be one of: TWSE, MOPS, OFFICIAL, MANUAL |
| `sourceFileName` | string | `twse_monthly_revenue_2025_09.csv` | Audit trail |

**Optional but recommended:**

| Field | Example |
|-------|---------|
| `sourceUrl` | `https://mops.twse.com.tw/...` |
| `sourceHash` / `sha256` | SHA-256 of source file |
| `releaseDateSource` | `EXPLICIT` or `INFERRED_NEXT_MONTH_10TH` |
| `releaseDateConfidence` | `HIGH` or `LOW_TO_MEDIUM` |
| `companyName` | `台積電` |
| `yoyGrowth` | `-5.2` |

---

## 8. releaseDate Mapping Rule

| revenueMonth | Expected releaseDate |
|--------------|---------------------|
| 2025-09 | ~2025-10-10 |
| 2025-10 | ~2025-11-10 |
| 2025-11 | ~2025-12-10 |
| 2025-12 | ~2026-01-10 |
| 2026-01 | ~2026-02-10 |

- If the actual MOPS announcement date is available, use it and set `releaseDateSource=EXPLICIT`
- If not known, use the 10th of the following month and set `releaseDateSource=INFERRED_NEXT_MONTH_10TH`
- If the 10th falls on a weekend/holiday, use the next business day

---

## 9. Forbidden Fields

These fields must **NOT** appear in source files:

- `outcomePrice`
- `returnPct`
- `realizedReturnClass`

Files containing these fields will be **rejected** by the validator.

---

## 10. Prohibited Actions

| Action | Status |
|--------|--------|
| Place `TEMPLATE_DO_NOT_IMPORT` files in drop-zone | ❌ PROHIBITED |
| Use synthetic fixture as real source | ❌ PROHIBITED |
| Manually alter revenue values to inflate coverage | ❌ PROHIBITED |
| Rename unverified files to expected filenames | ❌ PROHIBITED |
| Remove source metadata (sourceName, sourceUrl) | ❌ PROHIBITED |
| Provide approval token before dry-run PASS | ❌ PROHIBITED |
| Request import without dry-run gate | ❌ PROHIBITED |

---

## 11. Operator Completion Report (Required)

After placing files, please provide:

- [ ] List of files placed (filename + size)
- [ ] SHA-256 of each file: `shasum -a 256 <file>`
- [ ] sourceName for each file (TWSE/MOPS/OFFICIAL/MANUAL)
- [ ] sourceUrl or source reference
- [ ] Row count per file
- [ ] Whether each file covers all 25 symbols or a subset
- [ ] Whether source is publicly verifiable

Fill in `SOURCE_MANIFEST_TEMPLATE.json` in the drop-zone and include in your report.

---

## 12. Agent Gate Sequence (After Files Are Placed)

Agent will automatically run:

```
1. drop-zone scan    → candidateSourceFiles > 0
2. inventory         → file list + row estimate
3. validator         → acceptedRows / rejectedRows
4. coverage preview  → matchedRows for P3/P19 symbols
5. safety gate       → schema/forbidden-field check
6. scoring invariance dry-run → 0 alphaScore/bucket mismatch
7. [await operator: review dry-run output]
8. [await operator: provide approval token]
9. DB backup         → sha256 snapshot before import
10. controlled import → only acceptedRows
11. post-import check → row count / releaseDate coverage
```

No DB write occurs until step 9–10, and only after explicit token is provided.

---

## 13. Approval Token

After reviewing dry-run output and confirming results are acceptable, provide this exact token:

```
P26F4_APPROVE_HISTORICAL_MONTHLY_REVENUE_IMPORT_ONLY
```

- Token is case-sensitive and must match exactly
- Token authorizes import of **historical MonthlyRevenue only**
- Token does **not** authorize corpus expansion, scoring changes, or any other DB write
- Dry-run gate must PASS before token is accepted

---

## 14. Files in This Package

| File | Purpose |
|------|---------|
| `P26F4_OPERATOR_SOURCE_PACKET_V2.md` | This document |
| `P26F4_OPERATOR_FILE_QA_CHECKLIST.md` | Operator pre-submission checklist |
| `P26F4_AGENT_CONTROLLED_IMPORT_RUNBOOK.md` | Agent import procedure (for reference) |
| `data/.../SOURCE_MANIFEST_TEMPLATE.json` | Operator attestation manifest template |
