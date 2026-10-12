#!/bin/bash
set -e
cd /Users/kelvin/Kelvin-WorkSpace/Stock-Prediction-System

git add src/lib/onlineValidation/P18MonthlyRevenueFixtureDbUtils.ts
git add src/lib/onlineValidation/__tests__/p18monthly_revenue_fixture_db_utils.test.ts
git add scripts/run-p18-monthly-revenue-fixture-db-migration.js
git add scripts/run-p18-monthly-revenue-fixture-db-backfill.js
git add scripts/run-p18-monthly-revenue-fixture-db-query-gate-validation.js
git add scripts/run-p18-monthly-revenue-fixture-db-rollback.js
git add outputs/online_validation/p18monthly_revenue_fixture_db_preflight.json
git add outputs/online_validation/p18monthly_revenue_fixture_db_preflight.md
git add outputs/online_validation/p18monthly_revenue_fixture_db_migration.json
git add outputs/online_validation/p18monthly_revenue_fixture_db_migration.md
git add outputs/online_validation/p18monthly_revenue_fixture_db_backfill.json
git add outputs/online_validation/p18monthly_revenue_fixture_db_backfill.md
git add outputs/online_validation/p18monthly_revenue_fixture_db_query_gate.json
git add outputs/online_validation/p18monthly_revenue_fixture_db_query_gate.md
git add outputs/online_validation/p18monthly_revenue_fixture_db_rollback.json
git add outputs/online_validation/p18monthly_revenue_fixture_db_rollback.md
git add outputs/online_validation/fixture_db/p18_monthly_revenue_fixture.sqlite

git status --short | grep "^[AM]"
echo "STAGED OK"
