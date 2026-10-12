# Expected Filename Conventions — FinancialReport Drop-zone

## Data Files

Pattern: `financial_report_{source}_{period}_{YYYYMMDD}.{ext}`

| Segment | Description | Example |
|---|---|---|
| `{source}` | Abbreviated source name | `twse_mops`, `tdcc`, `ifrs` |
| `{period}` | Fiscal period covered | `2024q4`, `2024annual`, `2024h1` |
| `{YYYYMMDD}` | Filing date (PIT gate) | `20250515` |
| `{ext}` | File extension | `csv` or `json` |

### Valid Examples
```
financial_report_twse_mops_2024q4_20250515.csv
financial_report_twse_mops_2024annual_20250327.json
financial_report_tdcc_2024q3_20241115.csv
```

### Invalid — Will Be Rejected
```
financial_report_2024q4.csv              # missing source and date
2024q4_financials.csv                    # wrong format
financial_report_2024q4_periodend.csv    # using periodEndDate — forbidden
TEMPLATE_DO_NOT_IMPORT_*.csv            # templates are never candidates
```

## Manifest File

Exactly one manifest per batch: `SOURCE_MANIFEST.json`
(Copied and renamed from `SOURCE_MANIFEST_TEMPLATE.json`)

## Template Files (Never Import)

Template files are prefixed with `TEMPLATE_DO_NOT_IMPORT_` and are excluded from
candidate selection by the ignore rules. They exist only as structural examples.

## Naming Constraints

- No spaces in filenames (use underscores)
- Lowercase only
- No special characters except `_` and `.`
- Date segment must match `filingDate` field in the file itself
