# P26F3-4 Expected Filename Manifest

Suggested: `twse_monthly_revenue_2025_09.csv` (one per period)  
Or combined: `twse_monthly_revenue_2025_09_to_2026_01.jsonl`  
Period regex: `(\d{4})[_\-]?(0[1-9]|1[0-2])`  
Ignored: DO_NOT_IMPORT, TEMPLATE, EXPECTED_*, README, .gitkeep  
Duplicate: last row wins per stockId+year+month
