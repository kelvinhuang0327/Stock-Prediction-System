# Expected Filename Conventions — NewsEvent Drop-zone

## Data Files

Pattern: `news_event_{source}_{YYYYMM}_{YYYYMMDD}.{ext}`

| Segment | Description | Example |
|---|---|---|
| `{source}` | Abbreviated source name | `twse_ann`, `moneydj`, `edn` |
| `{YYYYMM}` | Month of events covered | `202501` |
| `{YYYYMMDD}` | Collection date | `20250519` |
| `{ext}` | File extension | `csv` or `json` |

### Valid Examples
```
news_event_twse_ann_202501_20250210.csv
news_event_moneydj_202412_20250115.json
news_event_edn_202411_20250105.csv
```

### Invalid — Will Be Rejected
```
news_2025.csv                             # wrong format
news_event_2025.csv                       # missing source and dates
news_event_twse_ingested_20250519.csv     # using ingestedAt — forbidden marker
TEMPLATE_DO_NOT_IMPORT_*.csv             # templates are never candidates
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
- The collection date segment should reflect when the operator collected/curated the file
