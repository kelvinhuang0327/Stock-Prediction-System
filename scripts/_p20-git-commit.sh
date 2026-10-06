#!/usr/bin/env bash
set -e
cd "$(dirname "$0")/.."

git add \
  src/lib/onlineValidation/P20PitImpactComparisonUtils.ts \
  "src/lib/onlineValidation/__tests__/p20pit_impact_comparison_utils.test.ts" \
  scripts/run-p20-preflight.js \
  scripts/run-p20-pre-post-pit-impact-comparison.js \
  scripts/sample-p20-pit-impact-changed-cases.js \
  scripts/decide-p20-production-migration-readiness.js \
  scripts/validate-p20-artifacts.js \
  outputs/online_validation/p20pit_impact_preflight.json \
  outputs/online_validation/p20pit_impact_preflight.md \
  outputs/online_validation/p20pit_impact_comparison.json \
  outputs/online_validation/p20pit_impact_comparison.md \
  outputs/online_validation/p20pit_impact_changed_cases.json \
  outputs/online_validation/p20pit_impact_changed_cases.md \
  outputs/online_validation/p20production_migration_readiness_decision.json \
  outputs/online_validation/p20production_migration_readiness_decision.md

git commit -m "P20-HARDRESET: Compare pre/post PIT MonthlyRevenue availability impact

Parts A-H complete:
- A: Pre-flight gates 19/19 PASS
- B: P20PitImpactComparisonUtils.ts (TS comparison utility)
- C: Pre/post PIT comparison — 4500 aligned, 0 scoring changes
- D: Changed case sampling — MONTHLY_REVENUE_EXCLUDED=4500, NO_SCORING_CHANGE=4500
- E: Production migration readiness — P20_READY_FOR_PRODUCTION_MIGRATION_APPROVAL_REVIEW
- F: 59/59 unit tests PASS
- G: Forbidden claims scan CLEAN
- H: Artifact validation ALL PASS

Key finding: P19 is a pure metadata addition to P3. PIT gate patch did not
change any scoring results because MonthlyRevenue was already absent from all
4500 P3 active scoring rows (monthlyRevenuePitGateStatus=NOT_APPLICABLE_NO_DATA).

productionApplyAllowed=false | productionDbWritten=false
DISCLAIMER: Observability only. Not investment advice."

echo "Git commit complete"
git log --oneline -3
