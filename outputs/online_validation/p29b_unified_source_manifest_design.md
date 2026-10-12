# p29b_unified_source_manifest_design

**Phase:** P29B | Paper design only | *Not investment advice*

See corresponding JSON for full specification.

Key points:
- FinancialReport: PIT gate = `filingDate` (MOPS 公告日期), NOT `periodEndDate`
- NewsEvent: PIT gate = `publishedAt` (MOPS announcement time), NOT `ingestedAt`
- Both sources remain `HIGH_RISK_SOURCE_ABSENT` until source files + validator pass + approval token
- No production import scripts created in P29B
- Approval tokens required before any import can proceed
