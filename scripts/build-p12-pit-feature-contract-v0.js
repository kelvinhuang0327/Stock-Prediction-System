'use strict';
/**
 * scripts/build-p12-pit-feature-contract-v0.js
 * PART D — P12-HARDRESET Build PIT Feature Contract v0
 *
 * Reads:
 *   - outputs/online_validation/p12pit_feature_source_discovery.json
 *   - outputs/online_validation/p6lite_bucket_contract_freeze.json
 *   - outputs/online_validation/p8preflight_signal_reason_diagnosis.json
 *
 * Writes:
 *   - outputs/online_validation/p12pit_feature_contract_v0.json
 *   - outputs/online_validation/p12pit_feature_contract_v0.md
 *
 * NO scoring changes. NO corpus modifications. NO investment claims.
 */

require('ts-node').register({
  transpileOnly: true,
  compilerOptions: { module: 'commonjs', moduleResolution: 'node', esModuleInterop: true },
});
require('tsconfig-paths').register({ baseUrl: __dirname + '/../', paths: { '@/*': ['src/*'] } });

const fs = require('fs');
const path = require('path');

const {
  normalizeFeatureSourceName,
  classifyPitRisk,
  buildPitFeatureContract,
  summarizePitFeatureContract,
  FORBIDDEN_SNAPSHOT_FIELDS,
} = require('../src/lib/onlineValidation/P12PitFeatureContractUtils');

const OUT = 'outputs/online_validation';
const NOW = '2026-05-12';

// Load prerequisites
const discovery = JSON.parse(fs.readFileSync(`${OUT}/p12pit_feature_source_discovery.json`, 'utf8'));
const cf = JSON.parse(fs.readFileSync(`${OUT}/p6lite_bucket_contract_freeze.json`, 'utf8'));
const p8 = JSON.parse(fs.readFileSync(`${OUT}/p8preflight_signal_reason_diagnosis.json`, 'utf8'));

// Build FeatureContractEntry[] from discovery
const featureSourceContracts = discovery.featureSources.map(src => {
  const sourceName = normalizeFeatureSourceName(src.sourceName);
  const pitRiskLevel = classifyPitRisk(sourceName);

  let repairNeeded = false;
  let repairDescription = undefined;
  let forbiddenSnapshotFields = undefined;

  if (sourceName === 'MonthlyRevenue') {
    repairNeeded = true;
    repairDescription = 'Add releaseDate (DateTime) field to MonthlyRevenue prisma schema. Gate queries to releaseDate <= asOfDate. Taiwan monthly revenue is released on the 10th of the following month — the current year+month composite gate may include unreleased data.';
  }
  if (sourceName === 'NewsEvent') {
    repairNeeded = true;
    repairDescription = 'Not currently used in scoring. If activated: gate by publishedAt <= asOfDate. Never use ingestedAt. Validate relatedSymbols JSON parse.';
  }
  if (sourceName === 'FinancialReport') {
    repairNeeded = true;
    repairDescription = 'Not currently used in scoring. If activated: add availabilityDate (DateTime) field (released 45-60 days after quarter end) and gate by availabilityDate <= asOfDate.';
  }
  if (sourceName === 'ActiveScoringSnapshot' || sourceName === 'ReasonSignalFactorSnapshot') {
    forbiddenSnapshotFields = [...FORBIDDEN_SNAPSHOT_FIELDS];
  }

  return {
    sourceName,
    dateField: src.dateField || null,
    asOfRule: src.asOfRule,
    pitRiskLevel,
    repairNeeded,
    repairDescription,
    forbiddenSnapshotFields,
    // Carry metadata from discovery
    _meta: {
      currentlyUsedInScoring: src.currentlyUsedInScoring,
      currentlyCapturedInSnapshot: src.currentlyCapturedInSnapshot,
      notes: src.notes,
    },
  };
});

// Build the full contract
const contract = buildPitFeatureContract(featureSourceContracts, `${NOW}T00:00:00.000Z`);

// Enrich with bucket contract cross-reference
contract['bucketContractRef'] = {
  contractSource: 'p6lite_bucket_contract_freeze.json',
  verdict: 'BY_DESIGN_BOUNDARY',
  canonicalBucketLabels: cf.canonicalBucketLabels,
  nonGoals: cf.nonGoals,
};

// Enrich with P8 repair context
const p8Summary = {
  diagnosisSource: 'p8preflight_signal_reason_diagnosis.json',
  totalCases: p8.cases ? p8.cases.length : 0,
  categoryCounts: {},
};
if (p8.cases) {
  for (const c of p8.cases) {
    p8Summary.categoryCounts[c.diagnosis] = (p8Summary.categoryCounts[c.diagnosis] || 0) + 1;
  }
}
contract['p8SignalReasonRef'] = p8Summary;

// Summary
const summary = summarizePitFeatureContract(contract);
contract['summary'] = summary;

// Write JSON
fs.writeFileSync(`${OUT}/p12pit_feature_contract_v0.json`, JSON.stringify(contract, null, 2));

// Build markdown
const entryTable = featureSourceContracts.map(e =>
  `| ${e.sourceName} | ${e.pitRiskLevel} | ${e.repairNeeded ? '⚠️ Yes' : '✅ No'} | ${e._meta.currentlyUsedInScoring ? 'Yes' : 'No'} |`
).join('\n');

const reqTable = contract.pitSafetyRequirements.map(r =>
  `| ${r.requirementId} | ${r.enforcement} | ${r.description.slice(0, 80)} |`
).join('\n');

const repairTable = contract.repairPriorities.map(r =>
  `| ${r.priority} | ${r.sourceName} | ${r.repairAction.slice(0, 80)} |`
).join('\n');

const md = `# P12-HARDRESET PIT Feature Contract v0

**Contract Version:** ${contract.contractVersion}  
**Generated:** ${NOW}  
**Verdict:** ${summary.verdict}

> **Disclaimer:** ${contract.disclaimer}

## Summary

| Metric | Value |
|--------|-------|
| Total Sources | ${summary.totalSources} |
| LOW Risk Sources | ${summary.byRiskLevel.LOW} |
| MEDIUM Risk Sources | ${summary.byRiskLevel.MEDIUM} |
| HIGH Risk Sources | ${summary.byRiskLevel.HIGH} |
| Sources Requiring Repair | ${summary.repairNeededSources.length} |
| P0 Repairs | ${summary.repairPriorityP0} |
| P1 Repairs | ${summary.repairPriorityP1} |
| PIT Safety Requirements | ${summary.requirementCount} |
| Snapshot Capture Rules | ${summary.snapshotCaptureRuleCount} |

## Feature Source Contracts

| Source | PIT Risk | Repair Needed | Used in Scoring |
|--------|----------|--------------|-----------------|
${entryTable}

### HIGH Risk Sources

${summary.highRiskSources.map(s => `- **${s}** — ${featureSourceContracts.find(e => e.sourceName === s)?.repairDescription || 'See contract'}`).join('\n')}

## PIT Safety Requirements

| ID | Enforcement | Description |
|----|-------------|-------------|
${reqTable}

## Snapshot Capture Rules

**Forbidden fields in activeScoringSnapshot:**

${FORBIDDEN_SNAPSHOT_FIELDS.map(f => `- \`${f}\` — belongs only in outcomeSnapshot, never in activeScoringSnapshot`).join('\n')}

## Repair Priorities

| Priority | Source | Action |
|----------|--------|--------|
${repairTable}

## Bucket Contract Reference (P6-LITE)

- **Source:** p6lite_bucket_contract_freeze.json
- **Verdict:** BY_DESIGN_BOUNDARY
- **Canonical Labels:** ${(cf.canonicalBucketLabels || []).join(', ')}

## P8 Signal/Reason Reference

- **Source:** p8preflight_signal_reason_diagnosis.json
- **Total Cases:** ${p8Summary.totalCases}
- **Category Counts:** ${JSON.stringify(p8Summary.categoryCounts)}

## Non-Goals

${contract.nonGoals.map((g, i) => `${i + 1}. ${g}`).join('\n')}
`;

fs.writeFileSync(`${OUT}/p12pit_feature_contract_v0.md`, md);

console.log('PART D complete. Contract version:', contract.contractVersion);
console.log('Verdict:', summary.verdict);
console.log('Sources:', summary.totalSources, '| High risk:', summary.byRiskLevel.HIGH, '| Repair needed:', summary.repairNeededSources.length);
console.log('Output: p12pit_feature_contract_v0.json + .md');
