# P15 Migration Risk Register

> **Disclaimer:** Does not constitute investment advice. Governance / review only.

**Phase:** P15  
**Register ID:** p15-migration-risk-register-v0  
**Generated:** 2026-05-12  
**HIGH severity risks:** 4  
**Mitigated HIGH risks:** 4  
**Hard blockers:** 1

---

## Risk Items

### R-001: Schema migration breaks existing queries

| Field | Value |
|-------|-------|
| Severity | **HIGH** |
| Likelihood | **MEDIUM** |
| Owner | Engineering |
| Approval Impact | Blocking if patches not applied before migration |

**Evidence:** Adding releaseDate DateTime? to MonthlyRevenue changes the Prisma schema. Existing queries using year/month filter may not be updated.

**Mitigation:** P14 query gate proposal covers RuleBasedStockAnalyzer (HIGH risk) and FundamentalResearchService (HIGH risk) — both require explicit code patch in P16.

**Next Phase Action:** P16: Apply query gate patches before running prisma migrate dev

---

### R-002: Backfill inference introduces systematic date bias

| Field | Value |
|-------|-------|
| Severity | **MEDIUM** |
| Likelihood | **LOW** |
| Owner | Data |
| Approval Impact | Non-blocking if confidence field is populated correctly |

**Evidence:** INFERRED_NEXT_MONTH_10TH rule assumes all Taiwan revenue is released exactly on the 10th. In practice some stocks release earlier or later.

**Mitigation:** Field declared as releaseDateSource=INFERRED with confidence LOW_TO_MEDIUM. Query gate checks releaseDateSource; authoritative data can override.

**Next Phase Action:** P16: Ensure backfill SQL sets releaseDateSource=INFERRED_NEXT_MONTH_10TH and releaseDateConfidence=LOW_TO_MEDIUM

---

### R-003: Query gate regression — existing tests fail after patch

| Field | Value |
|-------|-------|
| Severity | **HIGH** |
| Likelihood | **LOW** |
| Owner | Engineering |
| Approval Impact | Blocking if full suite drops below baseline |

**Evidence:** P14 full suite = 1438/1438 PASS (pre-patch). Post-patch query gate changes to RuleBasedStockAnalyzer may break callers that do not pass asOfDate.

**Mitigation:** P14 fixture dry-run 11/11 PASS covers all gate edge cases. Test coverage must be verified again post-patch in P16.

**Next Phase Action:** P16: Run full test suite after applying query gate patches; target 1438+ PASS

---

### R-004: Historical replay comparability affected by releaseDate backfill

| Field | Value |
|-------|-------|
| Severity | **MEDIUM** |
| Likelihood | **LOW** |
| Owner | Data |
| Approval Impact | Non-blocking if frozen corpus verified unchanged |

**Evidence:** P3 active scoring corpus uses year/month period to filter MonthlyRevenue. After migration, replay results may differ slightly due to date-gated availability.

**Mitigation:** Frozen corpus files (P0/P1/P3/P4) are not modified. Replay comparability is maintained by design — frozen lines verified: P0=4500, P1=9900, P3=4500.

**Next Phase Action:** P16: Verify replay outputs before/after schema migration using frozen corpus

---

### R-005: Rollback incomplete — column DROP may lose backfilled data

| Field | Value |
|-------|-------|
| Severity | **MEDIUM** |
| Likelihood | **LOW** |
| Owner | Engineering |
| Approval Impact | Non-blocking — soft rollback path sufficient |

**Evidence:** Rollback Strategy B (drop columns) is irreversible. Any backfilled releaseDateSource/releaseDateConfidence data would be lost.

**Mitigation:** P14 rollback draft includes Strategy A (set fields to NULL) as soft rollback. Strategy B (drop) is documented as hard rollback requiring explicit decision.

**Next Phase Action:** P16: Default to Strategy A rollback; Strategy B requires explicit DBA approval

---

### R-006: Production DB safety — unintended writes during migration

| Field | Value |
|-------|-------|
| Severity | **HIGH** |
| Likelihood | **LOW** |
| Owner | Engineering |
| Approval Impact | Hard blocker — must not be bypassed |

**Evidence:** P14 approvalStatus=NOT_APPROVED; productionApplyAllowed=false on all artifacts. Current state: no DB writes have occurred.

**Mitigation:** All P14 utilities hardcode productionApplyAllowed=false. P15 utilities maintain this invariant. P16 requires explicit approval token to unlock.

**Next Phase Action:** P16: Only unlock after explicit approval token P14_APPROVE_SCHEMA_MIGRATION_DRY_RUN_ONLY provided

---

### R-007: PIT leakage residual — releaseDate not yet enforced in production code

| Field | Value |
|-------|-------|
| Severity | **HIGH** |
| Likelihood | **HIGH** |
| Owner | Engineering |
| Approval Impact | Non-blocking for approval review — leakage documented and mitigated in P16 plan |

**Evidence:** P13 source audit: RuleBasedStockAnalyzer uses year/month gate (HIGH risk leakage). FundamentalResearchService has no asOf gate (HIGH risk leakage). MonthlyRevenue schema lacks releaseDate.

**Mitigation:** P14 query gate proposal documents all three patch targets. Patches are proposed but not applied — requires P16 schema migration first.

**Next Phase Action:** P16: Apply schema migration, then apply query gate patches; revalidate P13 PIT gate (35/35 target)

---

### R-008: Reason/scoring downstream impact from releaseDate enforcement

| Field | Value |
|-------|-------|
| Severity | **MEDIUM** |
| Likelihood | **MEDIUM** |
| Owner | Engineering |
| Approval Impact | Non-blocking if scoring formulas are not changed |

**Evidence:** alphaScore and recommendationBucket depend on fundamentals. After releaseDate gate enforcement, some records previously available may become gated, potentially changing scores.

**Mitigation:** P15 review confirms scoring formula and alphaScore/recommendationBucket are NOT modified. Impact limited to data availability — not formula changes.

**Next Phase Action:** P16: Post-migration comparison of score distributions before/after; expect minor shifts for asOf dates near the 10th of each month

---

## Summary

| Risk ID | Title | Severity | Likelihood | Approval Impact |
|---------|-------|----------|------------|-----------------|
| R-001 | Schema migration breaks existing queries | HIGH | MEDIUM | Blocking if patches not applied before migration |
| R-002 | Backfill inference introduces systematic date bias | MEDIUM | LOW | Non-blocking if confidence field is populated correctly |
| R-003 | Query gate regression — existing tests fail after patch | HIGH | LOW | Blocking if full suite drops below baseline |
| R-004 | Historical replay comparability affected by releaseDate backfill | MEDIUM | LOW | Non-blocking if frozen corpus verified unchanged |
| R-005 | Rollback incomplete — column DROP may lose backfilled data | MEDIUM | LOW | Non-blocking — soft rollback path sufficient |
| R-006 | Production DB safety — unintended writes during migration | HIGH | LOW | Hard blocker — must not be bypassed |
| R-007 | PIT leakage residual — releaseDate not yet enforced in production code | HIGH | HIGH | Non-blocking for approval review — leakage documented and mitigated in P16 plan |
| R-008 | Reason/scoring downstream impact from releaseDate enforcement | MEDIUM | MEDIUM | Non-blocking if scoring formulas are not changed |

**productionDbWritten:** false  
**approvalGranted:** false (hardcoded)
