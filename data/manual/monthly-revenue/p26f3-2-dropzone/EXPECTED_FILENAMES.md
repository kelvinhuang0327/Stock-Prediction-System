# P26F3-4 Expected Filenames for Drop-zone

**Version**: v1 (P26F3-4-HARDRESET)  
**Date**: 2026-05-13

---

## Recommended Filename Convention

### Option A: One file per period (recommended)

```
twse_monthly_revenue_2025_09.csv
twse_monthly_revenue_2025_10.csv
twse_monthly_revenue_2025_11.csv
twse_monthly_revenue_2025_12.csv
twse_monthly_revenue_2026_01.csv
```

### Option B: Single combined file

```
twse_monthly_revenue_2025_09_to_2026_01.jsonl
twse_monthly_revenue_2025_09_to_2026_01.csv
twse_monthly_revenue_2025_09_to_2026_01.json
```

---

## Filename Pattern (Regex)

Period extraction pattern: `(\d{4})[_\-]?(0[1-9]|1[0-2])`

Examples:
- `twse_monthly_revenue_2025_09.csv` → period: `2025-09`
- `mops_2026_01_revenue.json` → period: `2026-01`
- `revenue_2025-12.jsonl` → period: `2025-12`

---

## Accepted Extensions

| Extension | Format |
|---|---|
| `.csv` | Comma-separated, first row = header |
| `.json` | Array of row objects |
| `.jsonl` | One JSON object per line |

---

## Files Ignored by Validator

The following are automatically excluded:
- `.gitkeep`
- `README.md`
- `EXPECTED_SCHEMA.json`
- `EXPECTED_FILENAMES.md`
- Any file with `DO_NOT_IMPORT` or `TEMPLATE` in the name

---

## Required sourceName Values

Each row must include a `sourceName` field set to one of:

| Value | Meaning |
|---|---|
| `TWSE` | Taiwan Stock Exchange official data |
| `MOPS` | Market Observation Post System data |
| `OFFICIAL` | Other official regulatory source |
| `MANUAL` | Manually transcribed from official source |

`UNKNOWN` is **not accepted**.

---

## Duplicate File Handling

If multiple files contain data for the same `stockId + year + month`:
- The **last row processed** wins (deterministic within a file; last file alphabetically wins across files)
- Duplicate hash is logged in the manifest for audit

---

## Disclaimer

This file does not constitute investment advice.  
No buy/sell recommendations are generated.
