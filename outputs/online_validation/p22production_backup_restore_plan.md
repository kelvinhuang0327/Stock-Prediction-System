# P22-HARDRESET Part C — Production Backup / Restore Plan

**Generated**: 2026-05-12T06:21:37.794Z  
**Target Table**: MonthlyRevenue  
**Target Fields**: releaseDate, releaseDateSource, releaseDateConfidence

## Evidence Sources

| Source | Artifact | Key Result |
|--------|----------|------------|
| Schema patch | p17monthly_revenue_schema_patch.json | addedFields: releaseDate, releaseDateSource, releaseDateConfidence |
| Rollback validation | p18monthly_revenue_fixture_db_rollback.json | passCount=27 |
| Impact comparison | p20pit_impact_comparison.json | alignedRowCount=0 |
| Risk register | p21production_migration_risk_register.json | RISK-02 (HIGH) — production DB migration irreversible without rollback plan |

## Backup Scope

| Item | Value |
|------|-------|
| Tables | MonthlyRevenue, _prisma_migrations |
| Schema file | prisma/schema.prisma |
| Migration history | _prisma_migrations |
| DB provider | SQLite |
| Strategy | file-copy-with-checksum |
| Hash algorithm | sha256 |

### Backup Command (PLACEHOLDER — requires P23 approval)
```
[PLACEHOLDER] cp prisma/dev.db prisma/dev.db.p23_premigration_backup_<YYYYMMDD_HHMMSS>
[PLACEHOLDER] shasum -a 256 prisma/dev.db > prisma/dev.db.p23_backup.sha256
```

## Restore Method

### Steps
1. [PLACEHOLDER — requires P23 approval] Confirm rollback decision with CTO/CEO
2. [PLACEHOLDER — requires P23 approval] Enable maintenance mode / stop application writes
3. [PLACEHOLDER — requires P23 approval] Restore: cp prisma/dev.db.p23_premigration_backup_<timestamp> prisma/dev.db
4. Verify backup checksum: shasum -a 256 prisma/dev.db — must match pre-migration checksum
5. Verify table row count: SELECT COUNT(*) FROM MonthlyRevenue
6. Verify schema state: PRAGMA table_info(MonthlyRevenue)
7. Confirm releaseDate field state matches pre-migration baseline
8. Run query gate sample: verify releaseDate <= asOfDate for sample rows
9. Run RuleBasedStockAnalyzer smoke test
10. [PLACEHOLDER — requires P23 approval] Resume production traffic

### Verification Steps
1. SELECT COUNT(*) FROM MonthlyRevenue — must match pre-migration count
2. PRAGMA table_info(MonthlyRevenue) — must include releaseDate fields
3. SELECT COUNT(*) FROM MonthlyRevenue WHERE releaseDate IS NULL — log count
4. Query gate sample: releaseDate <= asOfDate for 100 random rows
5. Checksum match: sha256(restored DB) === sha256(backup file at creation time)

**Estimated duration**: ~30 minutes  
**Requires approval**: YES

## Rollback Triggers

1. prisma migrate deploy failed with error
2. Backfill script produced incorrect releaseDate values (null or future date violations)
3. Query gate regression: releaseDate > asOfDate found in any row
4. Post-migration row count mismatch vs pre-migration baseline
5. Post-migration validation checklist has 1 or more FAIL items
6. Application error rate increased > 5% within 30 minutes post-migration
7. RuleBasedStockAnalyzer smoke test failed post-migration
8. alphaScore or recommendationBucket changed vs P20 baseline

- **Auto-trigger**: NO (manual approval required)
- **Escalation**: [PLACEHOLDER — CTO/CEO or designated on-call]

## Non-Goals (P22 Phase)

- P22 does NOT apply production migration (plan hardening only)
- P22 does NOT execute prisma migrate deploy
- P22 does NOT write production DB
- P22 does NOT auto-trigger rollback
- P22 does NOT modify scoring formula or alphaScore computation
- P22 does NOT modify P0/P1/P3/P19 corpus files

## Safety Invariants

| Invariant | Value |
|-----------|-------|
| `approvalGranted` | false |
| `productionMigrationApplied` | false |
| All production commands | PLACEHOLDER |
