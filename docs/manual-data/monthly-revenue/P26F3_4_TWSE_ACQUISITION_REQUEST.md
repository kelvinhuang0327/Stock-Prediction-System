# P26F3-4 TWSE MonthlyRevenue Acquisition Request

**Phase**: P26F3-4-HARDRESET  
**Date**: 2026-05-13  
**Requestor**: Stock Prediction System — Senior Acquisition Operator Agent  
**Status**: AWAITING MANUAL FILE PLACEMENT

---

## Purpose

This package defines what TWSE monthly revenue data must be acquired manually and placed in the system drop-zone before the P26F4 Controlled Import Gate can proceed.

The system has **zero historical revenue coverage** for periods 2025-09 to 2026-01. This data must be sourced directly from the official TWSE (Taiwan Stock Exchange) or MOPS (Market Observation Post System).

---

## 1. Target Periods (5 periods required)

| Period | Revenue For | Estimated Official Release Date |
|---|---|---|
| 2025-09 | September 2025 | ~2025-10-10 |
| 2025-10 | October 2025 | ~2025-11-10 |
| 2025-11 | November 2025 | ~2025-12-10 |
| 2025-12 | December 2025 | ~2026-01-10 |
| 2026-01 | January 2026 | ~2026-02-10 |

⚠️ Estimated release dates are approximate. Always use the **official announcement date** from TWSE/MOPS as `releaseDate`.

---

## 2. Target Symbols (25 symbols)

| Symbol | Notes |
|---|---|
| 0055 | |
| 00712 | |
| 00738U | |
| 00830 | |
| 00891 | |
| 00903 | |
| 1210 | |
| 1308 | |
| 1314 | |
| 1319 | |
| 1326 | |
| 1402 | |
| 1434 | |
| 1513 | |
| 1536 | |
| 1560 | |
| 1598 | |
| 1605 | |
| 1710 | |
| 1717 | |
| 1802 | |
| 2317 | |
| 2330 | |
| 2454 | |
| 6415 | |

Note: Rows for symbols NOT in this list will be rejected by the validator.

---

## 3. Required Fields per Row

| Field | Type | Constraint |
|---|---|---|
| `stockId` or `symbol` | string | Must be in target symbols list |
| `year` | integer | Must be 2025 or 2026 |
| `month` | integer | 1–12, must match target period |
| `revenue` | number or numeric string | Monthly revenue (TWD thousands) |
| `releaseDate` | YYYY-MM-DD | **Official** TWSE release date — must be verified |
| `sourceName` | string | One of: TWSE, MOPS, OFFICIAL, MANUAL |
| `sourceFileName` | string | Original filename for audit trail |

---

## 4. Optional Fields

| Field | Type |
|---|---|
| `companyName` | string |
| `yoyGrowth` | number or null |
| `momGrowth` | number or null |
| `accumulatedRevenue` | number or null |
| `accumulatedYoyGrowth` | number or null |
| `sourceUrl` | string |
| `sourceHash` | string |

---

## 5. Forbidden Fields (REJECT on presence)

❌ The following fields MUST NOT appear in any source file:

| Field | Reason |
|---|---|
| `outcomePrice` | Stock price outcome — not a revenue field |
| `returnPct` | Return calculation — not a revenue field |
| `realizedReturnClass` | Trading outcome — not a revenue field |
| `futureReturn` | Forward-looking — violates PIT safety |
| `priceAfterAsOf` | Post-date price — violates PIT safety |
| `recommendationResult` | Scoring output — not a revenue field |

---

## 6. File Placement Location

```
data/manual/monthly-revenue/p26f3-2-dropzone/
```

Place one or more files in the above directory. Do NOT modify the DB directly.

---

## 7. Validation Commands (run in order)

```bash
# 1. Inventory
node scripts/run-p26f3-3-dropzone-inventory.js

# 2. Schema validation + acceptance
node scripts/run-p26f3-2-manual-source-validator.js

# 3. Coverage preview against P3/P19 corpus
node scripts/run-p26f3-2-accepted-source-coverage-preview.js

# 4. Safety gate
node scripts/run-p26f3-2-manual-source-safety-gate.js

# 5. Scoring invariance
node scripts/run-p26f3-2-scoring-invariance-check.js
```

---

## 8. Requirements for P26F4 Controlled Import Gate

All of the following must be true before P26F4 can proceed:

| Condition | Required Value |
|---|---|
| `acceptedRows` | > 0 |
| `rejectedRows` | 0 (or all rejections documented and explained) |
| `coverage preview matchedRows` | > 0 |
| Safety gate | PASS |
| Scoring invariance | PASS |
| DB write during dry-run | None detected |
| CTO approval | Required |

---

## Disclaimer

This tool does not constitute investment advice.  
It does not compute ROI, profit, win-rate, edge, or outperformance.  
No buy/sell recommendations are generated.
