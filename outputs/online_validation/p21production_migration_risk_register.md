# P21 Production Migration Risk Register

**Phase**: P21-HARDRESET Part D  
**Generated**: 2026-05-12T05:45:38.189Z  
**Total Risks**: 10  
**Critical/High**: 7  
**Required Before Production**: 4 (RISK-01, RISK-02, RISK-08, RISK-10)

---

## Risk Summary

| Severity | Count |
|----------|-------|
| CRITICAL | 2 |
| HIGH | 5 |
| MEDIUM | 3 |
| LOW | 0 |

---

## Risk Items

### RISK-01: Production schema migration failure

| Field | Value |
|-------|-------|
| Severity | 🔴 CRITICAL |
| Likelihood | LOW |
| Required Before Production | ✅ YES |
| Owner | Engineering Lead |

**Description**: Prisma migration may fail on production SQLite/PostgreSQL if the DB state diverges from migration history.

**Evidence**: P18 fixture DB migration passed (16/16). No production migration attempted yet.

**Mitigation**: Run migration in a staging environment first. Capture full DB backup before applying. Verify schema idempotency.

**Next Phase Action**: P22: Define staging migration runbook

**Approval Impact**: Must be resolved before CTO approval token is used

---

### RISK-02: Production data backup not documented

| Field | Value |
|-------|-------|
| Severity | 🔴 CRITICAL |
| Likelihood | MEDIUM |
| Required Before Production | ✅ YES |
| Owner | DevOps / Engineering Lead |

**Description**: No production DB backup procedure is documented in current artifacts. If migration causes data loss, recovery path is unclear.

**Evidence**: P18 rollback tested on fixture DB only (27/27 PASS). Production backup not in scope for P17-P21.

**Mitigation**: Document production backup procedure before applying migration. Verify backup is restorable.

**Next Phase Action**: P22: Document and test production backup/restore procedure

**Approval Impact**: CTO/CEO token should not be used until backup plan is documented

---

### RISK-03: releaseDate inferred backfill accuracy

| Field | Value |
|-------|-------|
| Severity | 🟠 HIGH |
| Likelihood | MEDIUM |
| Required Before Production | No |
| Owner | Data Engineering |

**Description**: releaseDate values were inferred from filing metadata. Inferred dates may differ from actual announcement dates for a subset of records.

**Evidence**: P17 schema patch adds releaseDateSource and releaseDateConfidence fields to track inference quality. P18 backfill 23/23 PASS (fixture data).

**Mitigation**: Review releaseDateConfidence distribution in production data. Flag LOW-confidence records for manual review.

**Next Phase Action**: P22: Sample production releaseDateConfidence distribution

**Approval Impact**: Informational — does not block approval token if backup and staging are complete

---

### RISK-04: Query gate regression in production

| Field | Value |
|-------|-------|
| Severity | 🟠 HIGH |
| Likelihood | LOW |
| Required Before Production | No |
| Owner | Engineering |

**Description**: Production query gate behavior may differ from fixture DB if data volumes or indexing diverge.

**Evidence**: P17 query gate validation ALL_PASS (18/18). P18 query gate PASS (22/22). Gate logic is purely field-existence based.

**Mitigation**: Run query gate checks against production DB shadow after migration (read-only). Gate logic does not depend on row values.

**Next Phase Action**: P22: Add production query gate smoke test step to runbook

**Approval Impact**: Low risk; gate logic validated thoroughly in prior phases

---

### RISK-05: FundamentalResearchService behavior change

| Field | Value |
|-------|-------|
| Severity | 🟠 HIGH |
| Likelihood | LOW |
| Required Before Production | No |
| Owner | Backend Engineering |

**Description**: FundamentalResearchService may begin including MonthlyRevenue fields post-migration, changing data returned to callers.

**Evidence**: P20 comparison showed 0 signal changes and 0 bucket changes across 4500 rows. MonthlyRevenue gated out by PIT guard.

**Mitigation**: PIT guard remains active post-migration. Only releaseDate < queryDate rows admitted. No behavior change expected at service boundary.

**Next Phase Action**: P22: Add FundamentalResearchService integration test in staging

**Approval Impact**: PIT guard is the primary control; validated at P19

---

### RISK-06: RuleBasedStockAnalyzer behavior change

| Field | Value |
|-------|-------|
| Severity | 🟡 MEDIUM |
| Likelihood | LOW |
| Required Before Production | No |
| Owner | Scoring Engineering |

**Description**: RuleBasedStockAnalyzer may change scoring behavior if MonthlyRevenue fields are exposed post-migration.

**Evidence**: P20 confirmed 0 scoring changes (snapshotImpact.signalChangedCount=0, bucketImpact.bucketChangedCount=0).

**Mitigation**: Scoring formula is not modified by migration. MonthlyRevenue remains gated until releaseDate is available.

**Next Phase Action**: Monitor scoring output in production after migration via canary check

**Approval Impact**: Low risk; scoring verified unchanged at P20

---

### RISK-07: Active scoring replay comparability

| Field | Value |
|-------|-------|
| Severity | 🟡 MEDIUM |
| Likelihood | LOW |
| Required Before Production | No |
| Owner | Validation Engineering |

**Description**: Post-migration replay results may drift if production data differs from the p3/p19 frozen corpora.

**Evidence**: p3active_scoring_historical_replay_corpus.jsonl=4500 rows. p19active_scoring_pit_replay_corpus.jsonl=4500 rows. Both frozen.

**Mitigation**: Freeze corpora before migration. Post-migration comparison uses same corpus so drift is detectable.

**Next Phase Action**: P22: Re-run P20 comparison after production migration to verify 0 drift

**Approval Impact**: Baseline frozen — comparison methodology preserved

---

### RISK-08: Rollback execution risk

| Field | Value |
|-------|-------|
| Severity | 🟠 HIGH |
| Likelihood | LOW |
| Required Before Production | ✅ YES |
| Owner | Engineering Lead / DevOps |

**Description**: Production rollback may not be fully reversible if migration is partially applied before failure.

**Evidence**: P18 rollback tested (27/27 PASS) on fixture DB. Prisma down migrations are additive-only.

**Mitigation**: Ensure full DB backup before migration. Test rollback on staging before production. Document exact rollback steps.

**Next Phase Action**: P22: Rollback staging rehearsal as a prerequisite step

**Approval Impact**: Required: staging rollback rehearsal before production token use

---

### RISK-09: Monitoring / observability gap post-migration

| Field | Value |
|-------|-------|
| Severity | 🟡 MEDIUM |
| Likelihood | MEDIUM |
| Required Before Production | No |
| Owner | Platform Engineering |

**Description**: No specific monitoring for MonthlyRevenue PIT gate activation is documented for production environment.

**Evidence**: P19 PIT guard validated on corpus. No production monitoring dashboards created in P17-P21.

**Mitigation**: Add monitoring for: MonthlyRevenue rows admitted vs excluded, releaseDateConfidence distribution, query gate errors.

**Next Phase Action**: P22: Define MonthlyRevenue observability checklist

**Approval Impact**: Recommended before Go-Live but not a hard blocker for token request

---

### RISK-10: Deployment approval ambiguity

| Field | Value |
|-------|-------|
| Severity | 🟠 HIGH |
| Likelihood | MEDIUM |
| Required Before Production | ✅ YES |
| Owner | CTO / CEO |

**Description**: If P22 proceeds without a clear CTO/CEO approval token hand-off process, the production migration may be applied without proper authorization.

**Evidence**: recommendedApprovalToken=P21_APPROVE_PRODUCTION_MIGRATION_PLAN_ONLY must be provided by CTO/CEO.

**Mitigation**: Document token hand-off process. P22 script must validate token before proceeding. Token must not be auto-generated.

**Next Phase Action**: CTO/CEO to provide token after reviewing this P21 report. P22 must gate on token.

**Approval Impact**: Hard blocker: production migration MUST NOT proceed without explicit token


---

## Production Safety Statement

- approvalGranted: **false**
- productionMigrationApplied: **false**
- Production DB not written at any phase (P17-P21)
- CTO/CEO must provide token `P21_APPROVE_PRODUCTION_MIGRATION_PLAN_ONLY` before P22 execution
