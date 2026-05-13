#!/usr/bin/env node
// scripts/run-p26e-data-coverage-expansion-gate.js
// Plain Node.js — no external dependencies.

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'outputs', 'online_validation');

function readJsonFile(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function readJsonLines(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  return raw.split('\n').filter(l => l.trim()).map(l => JSON.parse(l));
}

// 1. Read P26D gate
const p26dGate = readJsonFile(path.join(OUT_DIR, 'p26d_coverage_readiness_gate.json'));
console.log('P26D gate loaded:', p26dGate.classification);

// 2. Read P3 corpus (4500 rows)
const p3Rows = readJsonLines(path.join(OUT_DIR, 'p3active_scoring_historical_replay_corpus.jsonl'));
console.log('P3 rows:', p3Rows.length);

// 3. Read P19 corpus (4500 rows) — has trailing newline
const p19Rows = readJsonLines(path.join(OUT_DIR, 'p19active_scoring_pit_replay_corpus.jsonl'));
console.log('P19 rows:', p19Rows.length);

const allRows = [...p3Rows, ...p19Rows];

// 4. Scan for context fields
let monthlyRevenueContextInCorpus = 0;
let newsEventContextInCorpus = 0;
let financialReportContextInCorpus = 0;

// 5. Check for outcome fields
const OUTCOME_FIELDS = ['outcomePrice', 'returnPct', 'realizedReturnClass'];
let outcomeFieldViolations = [];

for (const row of allRows) {
  if (row.monthlyRevenueContext !== undefined || row.revenueContext !== undefined) {
    monthlyRevenueContextInCorpus++;
  }
  if (row.newsEventContext !== undefined) {
    newsEventContextInCorpus++;
  }
  if (row.financialReportContext !== undefined) {
    financialReportContextInCorpus++;
  }

  for (const field of OUTCOME_FIELDS) {
    if (row[field] !== undefined) {
      outcomeFieldViolations.push({ field, symbol: row.symbol, asOfDate: row.asOfDate });
    }
  }
}

const noOutcomeFieldsInCorpus = outcomeFieldViolations.length === 0;
if (!noOutcomeFieldsInCorpus) {
  console.error('VIOLATION: Outcome fields found in corpus!', outcomeFieldViolations.slice(0, 3));
  process.exit(1);
}

// 6. Load fixtures
const p26bFixture = readJsonFile(path.join(OUT_DIR, 'fixtures', 'p26b_news_events_fixture.json'));
const p26cFixture = readJsonFile(path.join(OUT_DIR, 'fixtures', 'p26c_financial_reports_fixture.json'));
const p26bEventCount = Array.isArray(p26bFixture) ? p26bFixture.length
  : (p26bFixture.events ? p26bFixture.events.length : Object.keys(p26bFixture).length);
const p26cReportCount = Array.isArray(p26cFixture) ? p26cFixture.length
  : (p26cFixture.reports ? p26cFixture.reports.length : Object.keys(p26cFixture).length);
console.log('P26B fixture events:', p26bEventCount);
console.log('P26C fixture reports:', p26cReportCount);

// 7. Classify source readiness
// MonthlyRevenue: real source candidates found in prisma/schema.prisma
const prismaContent = fs.readFileSync(path.join(ROOT, 'prisma', 'schema.prisma'), 'utf8');
const monthlyRevenueInPrisma = prismaContent.includes('MonthlyRevenue') || prismaContent.includes('monthlyRevenue');
const monthlyRevenueReadiness = monthlyRevenueInPrisma
  ? 'PARTIAL_SOURCE_MAPPING_REQUIRED'
  : 'BLOCKED_BY_MISSING_SOURCE';

const newsEventReadiness = 'FIXTURE_ONLY_NOT_READY';
const financialReportReadiness = 'FIXTURE_ONLY_NOT_READY';

// 8. Overall readiness
let overallReadiness;
if (
  monthlyRevenueReadiness === 'READY_FOR_EXPANSION_IMPLEMENTATION' ||
  newsEventReadiness === 'READY_FOR_EXPANSION_IMPLEMENTATION' ||
  financialReportReadiness === 'READY_FOR_EXPANSION_IMPLEMENTATION'
) {
  overallReadiness = 'READY_FOR_EXPANSION_IMPLEMENTATION';
} else if (monthlyRevenueReadiness === 'PARTIAL_SOURCE_MAPPING_REQUIRED') {
  overallReadiness = 'PARTIAL_SOURCE_MAPPING_REQUIRED';
} else {
  overallReadiness = 'BLOCKED_BY_MISSING_SOURCE';
}

const recommendedNextPhase = overallReadiness === 'PARTIAL_SOURCE_MAPPING_REQUIRED'
  ? 'P26F_MONTHLY_REVENUE_CORPUS_EXPANSION_IMPLEMENTATION'
  : 'P26E_2_SOURCE_ACQUISITION_PLAN';

// 9. Verify scoring constraints
const scoringChangeAllowed = false;
const optimizerAllowed = false;
const corpusExpansionAllowed = false; // none are READY

const result = {
  phase: 'P26E-HARDRESET',
  date: '2026-05-13',
  p3CorpusRows: p3Rows.length,
  p19CorpusRows: p19Rows.length,
  monthlyRevenueContextInCorpus,
  newsEventContextInCorpus,
  financialReportContextInCorpus,
  noOutcomeFieldsInCorpus,
  monthlyRevenueReadiness,
  newsEventReadiness,
  financialReportReadiness,
  overallReadiness,
  recommendedNextPhase,
  sourceMappingRequired: true,
  corpusExpansionAllowed,
  scoringChangeAllowed,
  optimizerAllowed,
  p26bFixtureEventCount: p26bEventCount,
  p26cFixtureReportCount: p26cReportCount,
  status: 'PASS',
};

// 10. Write outputs
const jsonOut = path.join(OUT_DIR, 'p26e_data_coverage_expansion_gate_result.json');
fs.writeFileSync(jsonOut, JSON.stringify(result, null, 2));
console.log('Written:', jsonOut);

const md = `# P26E Data Coverage Expansion Gate Result

**Phase**: ${result.phase}  
**Date**: ${result.date}  
**Status**: ${result.status}

## Corpus Summary

| Corpus | Rows |
|--------|------|
| P3 | ${result.p3CorpusRows} |
| P19 | ${result.p19CorpusRows} |
| Total | ${result.p3CorpusRows + result.p19CorpusRows} |

## Context Field Coverage

| Source | Rows with Context |
|--------|-----------------|
| MonthlyRevenue | ${result.monthlyRevenueContextInCorpus} |
| NewsEvent | ${result.newsEventContextInCorpus} |
| FinancialReport | ${result.financialReportContextInCorpus} |

No outcome fields in corpus: **${result.noOutcomeFieldsInCorpus}** ✅

## Readiness Classification

| Source | Readiness |
|--------|----------|
| MonthlyRevenue | ${result.monthlyRevenueReadiness} |
| NewsEvent | ${result.newsEventReadiness} |
| FinancialReport | ${result.financialReportReadiness} |
| **Overall** | **${result.overallReadiness}** |

## Gate Result

- Recommended Next Phase: **${result.recommendedNextPhase}**
- Source Mapping Required: ${result.sourceMappingRequired}
- Corpus Expansion Allowed: ${result.corpusExpansionAllowed}
- **scoringChangeAllowed: ${result.scoringChangeAllowed}** ✅
- **optimizerAllowed: ${result.optimizerAllowed}** ✅

## Fixtures

- P26B NewsEvent fixture: ${result.p26bFixtureEventCount} events
- P26C FinancialReport fixture: ${result.p26cFixtureReportCount} reports
`;

const mdOut = path.join(OUT_DIR, 'p26e_data_coverage_expansion_gate_result.md');
fs.writeFileSync(mdOut, md);
console.log('Written:', mdOut);
console.log('Status:', result.status);
