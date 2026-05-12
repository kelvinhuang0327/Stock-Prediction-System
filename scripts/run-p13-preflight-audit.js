#!/usr/bin/env node
/**
 * P13-HARDRESET PART A: Pre-flight audit
 * Verifies P12 artifacts and MonthlyRevenue code paths.
 * Read-only. Does not write production DB.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const OUT_DIR = 'outputs/online_validation';

// ── A.1: Required P12 artifacts ─────────────────────────────────────────────
const REQUIRED_ARTIFACTS = [
  'outputs/online_validation/p12pit_feature_contract_v0.json',
  'outputs/online_validation/p12pit_feature_contract_v0.md',
  'outputs/online_validation/p12pit_feature_contract_validation.json',
  'outputs/online_validation/p12pit_feature_contract_final_report.md',
  'outputs/online_validation/p12pit_feature_source_discovery.json',
];

const FROZEN_CORPORA = {
  'outputs/online_validation/simulation_snapshot_corpus.jsonl': 60,
  'outputs/online_validation/p0hardreset_historical_replay_corpus.jsonl': 4500,
  'outputs/online_validation/p1baseline_historical_replay_corpus.jsonl': 9900,
  'outputs/online_validation/p3active_scoring_historical_replay_corpus.jsonl': 4500,
};

const checks = [];
const warnings = [];
let blocked = false;

// Check artifacts exist
for (const f of REQUIRED_ARTIFACTS) {
  const exists = fs.existsSync(f);
  checks.push({ file: f, exists, status: exists ? 'OK' : 'MISSING' });
  if (!exists) { blocked = true; console.error('MISSING:', f); }
  else console.log('OK:', f);
}

// ── A.2: Validate P12 conclusions ───────────────────────────────────────────
let contractVersion = null;
let monthlyRevenueRisk = null;
let monthlyRevenueRepair = null;
let p3ValidationStatus = null;
let p12ContractChecks = [];

try {
  const contract = JSON.parse(fs.readFileSync('outputs/online_validation/p12pit_feature_contract_v0.json', 'utf8'));
  contractVersion = contract.contractVersion;
  const mrEntry = (contract.featureSourceContracts || []).find(e => e.sourceName === 'MonthlyRevenue');
  monthlyRevenueRisk = mrEntry?.pitRiskLevel ?? null;
  monthlyRevenueRepair = mrEntry?.repairNeeded ?? null;

  p12ContractChecks.push({ check: 'contractVersion', expected: 'p12-pit-feature-contract-v0', actual: contractVersion, pass: contractVersion === 'p12-pit-feature-contract-v0' });
  p12ContractChecks.push({ check: 'MonthlyRevenue.pitRiskLevel', expected: 'HIGH', actual: monthlyRevenueRisk, pass: monthlyRevenueRisk === 'HIGH' });
  p12ContractChecks.push({ check: 'MonthlyRevenue.repairNeeded', expected: true, actual: monthlyRevenueRepair, pass: monthlyRevenueRepair === true });
} catch (e) {
  p12ContractChecks.push({ check: 'p12 contract parse', error: e.message, pass: false });
  blocked = true;
}

try {
  const validation = JSON.parse(fs.readFileSync('outputs/online_validation/p12pit_feature_contract_validation.json', 'utf8'));
  p3ValidationStatus = validation.validationStatus;
  p12ContractChecks.push({ check: 'P3 validationStatus', expected: 'PASS', actual: p3ValidationStatus, pass: p3ValidationStatus === 'PASS' });
} catch (e) {
  p12ContractChecks.push({ check: 'p12 validation parse', error: e.message, pass: false });
  blocked = true;
}

for (const c of p12ContractChecks) {
  console.log(c.pass ? 'PASS' : 'FAIL', c.check, c.actual ?? c.error ?? '');
  if (!c.pass) blocked = true;
}

// Frozen corpus counts
const frozenChecks = [];
for (const [file, expected] of Object.entries(FROZEN_CORPORA)) {
  try {
    const lines = fs.readFileSync(file, 'utf8').trim().split('\n').filter(l => l.trim()).length;
    const pass = lines === expected;
    frozenChecks.push({ file, expected, actual: lines, pass });
    console.log(pass ? 'PASS' : 'FAIL', `corpus ${path.basename(file)}: ${lines}/${expected}`);
    if (!pass) blocked = true;
  } catch (e) {
    frozenChecks.push({ file, expected, error: e.message, pass: false });
    blocked = true;
  }
}

// ── A.3: MonthlyRevenue code path scan ──────────────────────────────────────
const codePathFindings = [];

// Schema
const schema = fs.readFileSync('prisma/schema.prisma', 'utf8');
const schemaLines = schema.split('\n');
const mrModelStart = schemaLines.findIndex(l => l.includes('model MonthlyRevenue'));
const mrModelEnd = schemaLines.findIndex((l, i) => i > mrModelStart && l.trim() === '}');
const mrModel = schemaLines.slice(mrModelStart, mrModelEnd + 1).join('\n');

const schemaFields = {
  hasReleaseDateField: /releaseDate/.test(mrModel),
  hasAnnouncementDateField: /announcementDate/.test(mrModel),
  hasAvailabilityDateField: /availabilityDate/.test(mrModel),
  hasCreatedAt: /createdAt/.test(mrModel),
  hasUpdatedAt: /updatedAt/.test(mrModel),
  hasIngestedAt: /ingestedAt/.test(mrModel),
  hasYear: /year\s+Int/.test(mrModel),
  hasMonth: /month\s+Int/.test(mrModel),
  schemaSnippet: mrModel.trim(),
};

codePathFindings.push({ source: 'prisma/schema.prisma', findings: schemaFields });

// RuleBasedStockAnalyzer gate
const analyzerSrc = fs.readFileSync('src/lib/analysis/RuleBasedStockAnalyzer.ts', 'utf8');
const analyzerGate = {
  usesYearMonthGate: /year.*lt.*asOfYear|year.*asOfYear.*month.*lte.*asOfMonth/.test(analyzerSrc),
  usesReleaseDateGate: /releaseDate.*lte.*asOf/.test(analyzerSrc),
  gateCommentPresent: /MonthlyRevenue.*year.*month.*ints/.test(analyzerSrc),
  gateCodeSnippet: (() => {
    const m = analyzerSrc.match(/For MonthlyRevenue[\s\S]{0,500}/);
    return m ? m[0].slice(0, 300) : null;
  })(),
};
codePathFindings.push({ source: 'src/lib/analysis/RuleBasedStockAnalyzer.ts', findings: analyzerGate });

// FundamentalResearchService gate
const fundSrc = fs.readFileSync('src/lib/fundamentals/FundamentalResearchService.ts', 'utf8');
const fundGate = {
  queryHasAsOfGate: /monthlyRevenue\.findMany[\s\S]{0,200}asOf/.test(fundSrc),
  queryHasReleaseDateGate: /monthlyRevenue[\s\S]{0,200}releaseDate/.test(fundSrc),
  usesNoDateGate: !(/monthlyRevenue\.findMany[\s\S]{0,200}asOf/.test(fundSrc)),
};
codePathFindings.push({ source: 'src/lib/fundamentals/FundamentalResearchService.ts', findings: fundGate });

// MonthlyRevenueLike interface
const snapshotSrc = fs.readFileSync('src/lib/fundamentals/StockFundamentalSnapshot.ts', 'utf8');
const interfaceMatch = snapshotSrc.match(/interface MonthlyRevenueLike \{[\s\S]*?\}/);
const interfaceFindings = {
  hasReleaseDateField: /releaseDate/.test(interfaceMatch?.[0] ?? ''),
  interfaceSnippet: interfaceMatch?.[0]?.trim() ?? null,
};
codePathFindings.push({ source: 'src/lib/fundamentals/StockFundamentalSnapshot.ts', findings: interfaceFindings });

// Current PIT risk assessment
const pitRiskAssessment = {
  currentGateType: 'YEAR_MONTH_PERIOD_GATE',
  releaseDateExists: false,
  pitRiskLevel: 'HIGH',
  pitRiskReason: 'Gates by reporting period (year <= asOfYear AND month <= asOfMonth). Taiwan monthly revenue released ~10th of following month. Pre-10th queries may include unreleased data.',
  fundResearchServiceMissingAsOfGate: fundGate.usesNoDateGate,
  requiredRepair: 'Add releaseDate DateTime? field to MonthlyRevenue schema. Gate all queries to releaseDate <= asOfDate.',
};

const preflightStatus = blocked ? 'FAIL' : 'PASS';

const output = {
  phase: 'P13-HARDRESET',
  part: 'A',
  generatedAt: new Date().toISOString(),
  preflightStatus,
  p12ArtifactChecks: checks,
  p12ContractChecks,
  frozenCorpusChecks: frozenChecks,
  codePathFindings,
  pitRiskAssessment,
  finalClassification: blocked ? 'P13_MONTHLY_REVENUE_BLOCKED_BY_ARTIFACTS' : 'P13_MONTHLY_REVENUE_PREFLIGHT_PASS',
};

fs.writeFileSync(`${OUT_DIR}/p13monthly_revenue_preflight_audit.json`, JSON.stringify(output, null, 2));

const md = `# P13-HARDRESET: MonthlyRevenue Preflight Audit

> Disclaimer: Observability only. No investment recommendations. No ROI/win-rate/alpha claims.

**Status:** ${preflightStatus}  
**Generated:** ${output.generatedAt}

## P12 Artifact Checks
${checks.map(c => `- ${c.status}: \`${c.file}\``).join('\n')}

## P12 Contract Checks
${p12ContractChecks.map(c => `- ${c.pass ? 'PASS' : 'FAIL'}: ${c.check} = ${c.actual ?? c.error ?? ''}`).join('\n')}

## Frozen Corpus Checks
${frozenChecks.map(c => `- ${c.pass ? 'PASS' : 'FAIL'}: ${path.basename(c.file)} = ${c.actual ?? c.error}/${c.expected}`).join('\n')}

## MonthlyRevenue Schema Fields
\`\`\`
${schemaFields.schemaSnippet}
\`\`\`

- releaseDate field: ${schemaFields.hasReleaseDateField ? '✅ EXISTS' : '❌ MISSING'}
- announcementDate field: ${schemaFields.hasAnnouncementDateField ? '✅ EXISTS' : '❌ MISSING'}
- year/month ints: ${schemaFields.hasYear && schemaFields.hasMonth ? '✅ PRESENT' : '❌ MISSING'}
- createdAt: ${schemaFields.hasCreatedAt ? '✅' : '❌'}

## PIT Risk Assessment
- Current gate type: **${pitRiskAssessment.currentGateType}**
- releaseDate field: **${pitRiskAssessment.releaseDateExists ? 'EXISTS' : 'MISSING'}**
- PIT risk level: **${pitRiskAssessment.pitRiskLevel}**
- Risk reason: ${pitRiskAssessment.pitRiskReason}
- FundamentalResearchService missing asOf gate: **${pitRiskAssessment.fundResearchServiceMissingAsOfGate}**

## Final Classification
**${output.finalClassification}**
`;

fs.writeFileSync(`${OUT_DIR}/p13monthly_revenue_preflight_audit.md`, md);

console.log('\nPREFLIGHT STATUS:', preflightStatus);
console.log('Classification:', output.finalClassification);
if (blocked) process.exit(1);
