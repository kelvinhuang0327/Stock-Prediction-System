#!/bin/bash
set -e
cd /Users/kelvin/Kelvin-WorkSpace/Stock-Prediction-System

git add \
  src/lib/onlineValidation/MonthlyRevenueAvailability.ts \
  src/lib/onlineValidation/__tests__/p17monthly_revenue_availability.test.ts \
  src/lib/analysis/RuleBasedStockAnalyzer.ts \
  src/lib/fundamentals/FundamentalResearchService.ts \
  src/lib/fundamentals/StockFundamentalSnapshot.ts \
  prisma/schema.prisma \
  prisma/migrations/20260512000000_monthly_revenue_release_date_pit_draft/migration.sql \
  scripts/validate-p17-monthly-revenue-query-gate-patch.js \
  scripts/run-p17-artifact-validation.js \
  outputs/online_validation/p17monthly_revenue_patch_preflight.json \
  outputs/online_validation/p17monthly_revenue_patch_preflight.md \
  outputs/online_validation/p17monthly_revenue_schema_patch.json \
  outputs/online_validation/p17monthly_revenue_schema_patch.md \
  outputs/online_validation/p17monthly_revenue_query_gate_patch.json \
  outputs/online_validation/p17monthly_revenue_query_gate_patch.md \
  outputs/online_validation/p17monthly_revenue_query_gate_validation.json \
  outputs/online_validation/p17monthly_revenue_query_gate_validation.md

git commit -m "P17-HARDRESET: MonthlyRevenue releaseDate schema and query gate patch

- New: MonthlyRevenue availability helper
- Patch: Prisma MonthlyRevenue releaseDate fields
- Patch: MonthlyRevenue query gate uses releaseDate <= asOfDate
- New: query gate validation
- Frozen: P0/P1/P3/P4/frozen corpus unchanged
- Frozen: scoring formula / alphaScore / recommendationBucket unchanged
- No production DB writes
- productionApplyAllowed=false
- No ROI / alpha / edge / win-rate claims"

echo "COMMIT DONE: $(git log -1 --format='%H %s')"
