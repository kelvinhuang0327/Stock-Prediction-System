# P29B — HIGH_RISK_SOURCE_ABSENT Review

## FinancialReport

| Dimension | Detail |
| --- | --- |
| Current status | `HIGH_RISK_SOURCE_ABSENT` |
| Enters alphaScore | ❌ NO |
| Root cause | DB schema has no `availabilityDate` / `filingDate` |
| PIT risk | HIGH — `periodEndDate` ≠ filing date; Q1 ends Mar 31 but is filed ~May 15 |
| Leakage risk | HIGH — using period end as asOf gate leaks ~45 days of future information |
| Blocker | No PIT gate field in schema; no systematic MOPS download |

**Minimum to upgrade:** Add `filingDate` column → backfill from MOPS → dry-run import → CTO approval token

## NewsEvent

| Dimension | Detail |
| --- | --- |
| Current status | `HIGH_RISK_SOURCE_ABSENT` |
| Enters alphaScore | ❌ NO |
| Root cause | `publishedAt` may default to ingest time; mock events mixed with real |
| PIT risk | HIGH — if publishedAt = ingestedAt, historical replay is contaminated |
| Leakage risk | MEDIUM-HIGH — post-announcement analysis may have ingest-time timestamps |
| Blocker | No publishedAt reliability audit; no mock/real separation |

**Minimum to upgrade:** Audit publishedAt vs ingestedAt gap → separate mock events → verify official announcement timestamps → dry-run import

*Observability only. Not investment advice.*
