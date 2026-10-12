# P22-HARDRESET Part D — Production Migration Runbook

**Generated**: 2026-05-12T06:21:38.055Z  
**Target Table**: MonthlyRevenue  
**Required P23 Token**: `P22_APPROVE_PRODUCTION_MIGRATION_IMPLEMENTATION_REVIEW_ONLY`

> ⚠️ **This runbook is a PLAN artifact only.**  
> All steps marked `[PLACEHOLDER]` require explicit P23 approval before execution.  
> No production commands are executed in P22.

## Summary

| | Count |
|-|-------|
| Total steps | 14 |
| Placeholder steps (requires P23 approval) | 9 |
| Go/No-Go checkpoints | 3 |

## Phase: PRE-MIGRATION

### R01 — Pre-migration system health check
- **Placeholder**: No
- **Go/No-Go checkpoint**: No





Verify production system is healthy. Check DB connectivity, application health endpoints, and error rates.

### R02 — Create production backup
- **Placeholder**: YES — requires P23 approval
- **Go/No-Go checkpoint**: No
- **Command**: `[PLACEHOLDER — requires P23 approval: cp prisma/dev.db prisma/dev.db.p23_premigration_backup_<YYYYMMDD_HHMMSS>]`




Execute backup per p22production_backup_restore_plan.json. SQLite: file copy with sha256 checksum.

### R03 — Verify backup checksum
- **Placeholder**: No
- **Go/No-Go checkpoint**: No
- **Command**: `[PLACEHOLDER: shasum -a 256 prisma/dev.db.p23_premigration_backup_<timestamp>]`




Compute sha256 of backup file. Record checksum in operations log.

### R04 — Go/No-Go checkpoint #1 — before maintenance window
- **Placeholder**: YES — requires P23 approval
- **Go/No-Go checkpoint**: YES





CTO/CEO confirms: backup verified, system healthy, team ready, rollback plan accessible.

### R05 — Enable maintenance mode
- **Placeholder**: YES — requires P23 approval
- **Go/No-Go checkpoint**: No
- **Command**: `[PLACEHOLDER — requires P23 approval: enable maintenance mode / health check returns 503]`




Prevent writes during migration window.

## Phase: MIGRATION

### R06 — Apply production migration
- **Placeholder**: YES — requires P23 approval
- **Go/No-Go checkpoint**: No
- **Command**: `[PLACEHOLDER — requires P23 approval: npx prisma migrate deploy]`

- **On failure**: Immediately trigger rollback runbook (step R12)


Run prisma migrate deploy to apply releaseDate schema changes. Fixture DB dry-run completed in P18 (passCount verified).

### R07 — Backfill releaseDate values
- **Placeholder**: YES — requires P23 approval
- **Go/No-Go checkpoint**: No
- **Command**: `[PLACEHOLDER — requires P23 approval: node scripts/backfill-monthly-revenue-release-date.js]`

- **On failure**: Immediately trigger rollback runbook (step R12)


Run backfill to populate releaseDate for existing MonthlyRevenue rows. Backfill logic validated in P18 fixture DB.

### R08 — Go/No-Go checkpoint #2 — after migration and backfill
- **Placeholder**: YES — requires P23 approval
- **Go/No-Go checkpoint**: YES





CTO/CEO confirms: migration applied without error, backfill completed, ready for validation.

## Phase: VALIDATION

### R09 — Run query gate validation
- **Placeholder**: No
- **Go/No-Go checkpoint**: No

- **Validation**: `SELECT COUNT(*) FROM MonthlyRevenue WHERE releaseDate > asOfDate — must be 0`
- **On failure**: Immediately trigger rollback runbook (step R12)


Validate releaseDate <= asOfDate for all sampled rows. Must be 0 violations. Gate verified in P17 and P18.

### R10 — Run post-migration validation checklist
- **Placeholder**: No
- **Go/No-Go checkpoint**: No


- **On failure**: Trigger rollback runbook if any mandatory item fails


Execute all items in p22production_monitoring_checklist.json. All mandatory items must pass.

### R11 — Go/No-Go checkpoint #3 — before resuming production traffic
- **Placeholder**: YES — requires P23 approval
- **Go/No-Go checkpoint**: YES





CTO/CEO reviews all validation results. Must confirm all mandatory items pass before traffic resumes.

## Phase: POST-MIGRATION

### R12 — Resume production traffic
- **Placeholder**: YES — requires P23 approval
- **Go/No-Go checkpoint**: No
- **Command**: `[PLACEHOLDER — requires P23 approval: disable maintenance mode]`




Disable maintenance mode after successful validation.

### R13 — Post-migration monitoring (T+0 to T+30min)
- **Placeholder**: No
- **Go/No-Go checkpoint**: No





Monitor releaseDate null rate, query gate compliance, and application error rate for 30 minutes.

## Phase: ROLLBACK

### R14 — Rollback (conditional — if any checkpoint fails)
- **Placeholder**: YES — requires P23 approval
- **Go/No-Go checkpoint**: No
- **Command**: `[PLACEHOLDER — requires P23 approval: restore from backup]`


- **Condition**: Only if one or more go/no-go checkpoints (R04, R08, R11) fail, or if validation (R09, R10) fail

Execute rollback per p22production_backup_restore_plan.json restoreMethod. Triggered only on failure.


## Safety Invariants

| Invariant | Value |
|-----------|-------|
| `approvalGranted` | false |
| `productionMigrationApplied` | false |
| All production commands | PLACEHOLDER — requires P23 approval |
