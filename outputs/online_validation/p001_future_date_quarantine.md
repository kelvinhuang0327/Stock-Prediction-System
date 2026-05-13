# P0-01 Future-Date Quarantine

**Task**: P0-01 — Future-Date Quarantine
**Date**: 2026-05-07 | **asOfDate**: 2026-05-07

**Safety Labels**: P0-01 | future-date quarantine | read-only | no DB write | research tool only

---

## Quarantine Policy

- **Detection**: `detectFutureDateRows()` identifies rows with date > asOfDate
- **Exclusion**: `buildAsOfWhereClause()` enforces `date <= asOfDate` in all queries
- **Deletion**: **NONE** — rows remain in DB; excluded at query layer only
- **DB Writes**: **NONE** — read-only quarantine observability

## Known Future-Date Observations

| Table | Observed Future Date | Days Ahead | Gate Can Exclude | Status |
|---|---|---|---|---|
| StockQuote | 2026-05-18 | 11 | YES (WHERE date <= '20260507') | WARN |
| MarketIndex | 2026-05-18 | 11 | YES | WARN |
| InstitutionalChip | needs runtime check | - | YES | WARN |

## Overall Status: WARN

Future-date rows exist in DB. Query layer exclusion via `buildAsOfWhereClause()` ensures they do not contaminate MVP research flows. WARN status expected until data pipeline removes future rows at source.

---

*Research tool only. Not investment advice. Not a trading system.*
