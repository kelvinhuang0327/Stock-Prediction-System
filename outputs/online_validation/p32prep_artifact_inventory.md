# P32PREP Artifact Inventory

**inventoryId:** p32prep_artifact_inventory  
**capturedAt:** 2026-05-21T00:00:00.000Z  
**scanRoot:** outputs/online_validation/  
**scopedPhases:** P29G, P29I, P30, P31

> Disclaimer: Design-only artifact inventory. Does not constitute investment advice. No profit, return, or investment performance claims are made.

---

## Summary

| Metric | Count |
|--------|-------|
| Total artifacts scanned | 22 |
| Phase P29G | 4 |
| Phase P29I | 6 |
| Phase P30 | 6 |
| Phase P31 | 6 |
| Type: source-gate | 3 |
| Type: dry-run-sample | 5 |
| Type: pit-audit | 4 |
| Type: other (governance / preflight / test baseline) | 10 |
| Golden fixture candidates | 5 |
| Non-candidates | 17 |

---

## P29G Artifacts

| Filename | Top-Level Keys | Type | Fixture Candidate |
|----------|---------------|------|-------------------|
| p29g_dry_run_sample_output.json | output (nested: runId, asOfDate, simulationMode, contractVersion, candidateId, sourceFeatureSet, sourceFeaturePitStatus, inputSnapshotRef, outputRef, leakageGateStatus, scoringMutation, corpusMutation, optimizerExecuted, realBacktestExecuted, generatedAt, warnings, notInvestmentRecommendation, scaffoldNotes, p29gContractVersion, sourceClassifications) | dry-run-sample | YES |
| p29g_invariance_baseline.json | phase, capturedAt, invariants | other | no |
| p29g_test_baseline.json | phase, capturedAt, totalTests, passed, failed, result, testGroups, fullSuiteBaseline | other | no |
| p29g_preflight_scaffold_inventory.json | phase, capturedAt, scaffoldFiles, preflight | other | no |

---

## P29I Artifacts

| Filename | Top-Level Keys | Type | Fixture Candidate |
|----------|---------------|------|-------------------|
| p29i_pit_audit_scan.json | phase, scannerVersion, capturedAt, disclaimer, overallResult, allowedAlphaScoreSources, blockedSources, sourceOutputs | pit-audit | YES |
| p29i_source_path_inventory.json | phase, capturedAt, sources | source-gate | YES |
| p29i_preflight_mainline_status.json | phase, capturedAt, gitHead, currentBranch, branchCheck, lastCommits, localBranches, runtimeDirtyFiles, runtimeDirtyClassification, preconditions, preflight | other | no |
| p29i_test_baseline.json | phase, capturedAt, testFile, testSuite, testCommand, totalTests, passed, failed, result, testGroups, regressionSuites, fullSuiteBaseline, baselineChange | pit-audit | no |
| p29i_forbidden_claims_scan.json | phase, capturedAt, scanScope, filesScanned, forbiddenTermGroups, violations, falsePositivesResolved, result | other | no |
| p29i_pit_safety_rules.md | *(markdown — PSR-01..15 rule table, forbidden field pattern groups)* | pit-audit | no |

---

## P30 Artifacts

| Filename | Top-Level Keys | Type | Fixture Candidate |
|----------|---------------|------|-------------------|
| p30_chip_schema_migration_readiness.json | phase, capturedAt, schemaModel, hadAvailableAtBefore, availableAtAddedInP30, migrationArtifactCreated, migrationFile, migrationAppliedToDevDb, migrationAppliedToProdDb, schemaChangeType, breakingChange, indexAdded, lagWarningMaintained, canClaimChipLagConfirmed, prodLogsRequired, entersAlphaScore, classification, disclaimer | source-gate | no |
| p30_monthly_revenue_backfill_dry_run.json | phase, capturedAt, dryRun, authorizationPhrase, authorizationReceived, gate, totalNullRows, wouldUpdateRows, safeToApply, applyCommand, applyNote, executionNote, dbQueryMethod, tsNodeCompileError, totalMonthlyRevenueRows, entersAlphaScore, disclaimer | dry-run-sample | no |
| p30_reaudit_result.json | phase, capturedAt, chipAvailableAt, monthlyRevenueBackfill, tests, finalClassification, entersAlphaScore, disclaimer | pit-audit | no |
| p30_preflight_mainline_status.json | phase, capturedAt, repo, branch, headCommit, detachedHead, canonicalRepoMatch, canonicalBranchMatch, dirtyFiles, stagedFiles, preflightStatus, stopConditions | other | no |
| p30_forbidden_claims_scan.json | phase, capturedAt, scanTargets, forbiddenTerms, findings | other | no |
| p30_test_baseline.json | phase, capturedAt, p30NewTests, p29lRegression, fullSuite, finalClassification | other | no |

---

## P31 Artifacts

| Filename | Top-Level Keys | Type | Fixture Candidate |
|----------|---------------|------|-------------------|
| p31_monthly_revenue_dry_run_sample.json | phase, capturedAt, mode, paperOnly, dryRun, entersAlphaScore, notInvestmentRecommendation, rowCount, releaseDateCoverage, releaseDateSourceCoverage, releaseDateConfidenceCoverage, blockedRows, dryRunStatus, overallClassification, auditConclusion, disclaimer | dry-run-sample | YES |
| p31_monthly_revenue_dry_run_gate_scan.json | phase, capturedAt, source, dbQueryMethod, dbQuery, totalRows, withReleaseDate, withReleaseDateSource, withReleaseDateConfidence, coveragePct, readyRows, blockedRows, overallClassification, policy, entersAlphaScore, paperOnly, dryRun, disclaimer | dry-run-sample | YES |
| p31_monthly_revenue_artifact_review.json | phase, capturedAt, artifactChain, policyInEffect, releaseDateSource, releaseDateConfidence, entersAlphaScore, disclaimer | other | no |
| p31_preflight_mainline_status.json | phase, capturedAt, repo, branch, headCommit, detachedHead, canonicalRepoMatch, canonicalBranchMatch, stagedFiles, preflightStatus, stopConditions, priorState, monthlyRevenueCoverage | other | no |
| p31_forbidden_claims_scan.json | phase, capturedAt, scanTargets, forbiddenTerms, findings, result | other | no |
| p31_test_baseline.json | phase, capturedAt, p31NewTests, p30Regression, p29lRegression, p29kRegression, fullSuite, preExistingFailures, forbiddenDiff, newFilesCreated | other | no |

---

## Golden Fixture Candidates (5 total)

1. **p29g_dry_run_sample_output.json** — dry-run-sample; scaffold baseline
2. **p29i_pit_audit_scan.json** — pit-audit; PSR rule-check baseline at HEAD a6fb753
3. **p29i_source_path_inventory.json** — source-gate; canonical source status map
4. **p31_monthly_revenue_dry_run_sample.json** — dry-run-sample; compact P31 summary anchor
5. **p31_monthly_revenue_dry_run_gate_scan.json** — dry-run-sample; DB-level gate scan companion

---

## Artifact Type Definitions

| Type | Meaning |
|------|---------|
| source-gate | Gate result determining whether a data source is approved (PIT-safe, schema-ready, or blocked) |
| dry-run-sample | Output from a paper-only execution — no real DB writes, no scoring mutations, no corpus changes |
| pit-audit | Structured PIT-safety scan result evaluating a source against PSR-01..15 forbidden-field and gate-effectiveness rules |
| other | Preflight snapshot, test baseline, forbidden-claims scan, or provenance chain review |
