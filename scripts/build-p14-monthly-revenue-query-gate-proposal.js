'use strict';
/**
 * P14-HARDRESET PART D: Build MonthlyRevenue Query Gate Proposal
 *
 * Produces patch proposals for:
 * - RuleBasedStockAnalyzer (MonthlyRevenue query path)
 * - FundamentalResearchService (MonthlyRevenue query path)
 *
 * Does NOT directly modify production scoring logic.
 * Produces proposal artifacts only.
 *
 * Disclaimer: Does not write production DB. Does not constitute investment advice.
 * No ROI/profit/alpha/win-rate claims.
 */

require('ts-node').register({
  transpileOnly: true,
  compilerOptions: { module: 'commonjs', moduleResolution: 'node', esModuleInterop: true },
});
require('tsconfig-paths').register({
  baseUrl: require('path').resolve(__dirname, '..'),
  paths: { '@/*': ['src/*'] },
});

const fs = require('fs');
const path = require('path');
const { buildMonthlyRevenueQueryGateContract } = require('../src/lib/onlineValidation/P14MonthlyRevenueMigrationGateUtils');

const OUTPUTS_DIR = 'outputs/online_validation';

function run() {
  console.log('\n=== P14 PART D: Build Query Gate Proposal ===\n');

  const contract = buildMonthlyRevenueQueryGateContract({ allowInferredReleaseDate: true });
  console.log('Query gate contract id:', contract.contractId);
  console.log('Rules count:', contract.rules.length);

  const queryGateRules = contract.rules;

  const proposals = [
    {
      targetFile: 'src/lib/analysis/RuleBasedStockAnalyzer.ts',
      targetFunction: 'analyzeStock()',
      currentRisk: 'HIGH',
      currentImplementation: {
        description: 'Gates MonthlyRevenue by year/month period (revenueAsOfWhere). Uses OR [{year<asOfYear}, {year=asOfYear AND month<=asOfMonth}]. This treats the reporting period as the availability date, which is not correct for Taiwan monthly revenue released on the 10th of the following month.',
        codeLocation: 'Line ~62-74 in RuleBasedStockAnalyzer.ts',
        currentWhere: [
          '{ year: { lt: asOfYear } }',
          '{ year: asOfYear, month: { lte: asOfMonth } }',
        ],
        pitLeakage: 'If asOf=2024-02-05, Jan 2024 revenue (released 2024-02-10) is included. This is a PIT leakage.',
      },
      proposedChange: {
        description: 'Replace year/month period gate with releaseDate gate. After schema migration adds releaseDate, use: where: { stockId, releaseDate: { lte: asOfDate } }.',
        proposedWhere: [
          "{ stockId: symbol }",
          "...(asOf ? { releaseDate: { lte: asOf } } : {})",
        ],
        proposedCode: `// PROPOSED PATCH — requires schema migration (P15) before applying
// Current: year/month period gate (HIGH PIT risk)
// Proposed: releaseDate gate (PIT-safe)
const revenueAsOfWhere = asOf
  ? { stockId: symbol, releaseDate: { lte: asOf } }
  : { stockId: symbol };`,
        fallbackIfReleaseDateMissing: 'If releaseDate is null after backfill, fall back to INFERRED_NEXT_MONTH_10TH via application-layer filter (not DB query).',
        releaseDateFieldRequired: true,
      },
      whyNotAppliedYet: 'MonthlyRevenue.releaseDate field does not exist in production schema. Schema migration (P15) must be completed and approved before this patch can be applied.',
      approvalRequirement: 'Requires P15 schema migration approval and completion.',
      testCasesToAdd: [
        { desc: 'asOf=2024-02-09 → Jan 2024 revenue NOT included (inferred releaseDate=2024-02-10)', expected: 'unavailable' },
        { desc: 'asOf=2024-02-10 → Jan 2024 revenue included (inferred releaseDate=2024-02-10)', expected: 'available' },
        { desc: 'asOf=2024-01-15 → Dec 2023 revenue included (inferred releaseDate=2024-01-10)', expected: 'available' },
        { desc: 'asOf=2024-01-09 → Dec 2023 revenue NOT included (inferred releaseDate=2024-01-10)', expected: 'unavailable' },
      ],
    },
    {
      targetFile: 'src/lib/fundamentals/FundamentalResearchService.ts',
      targetFunction: 'buildFundamentalResearchContextForSymbol()',
      currentRisk: 'HIGH',
      currentImplementation: {
        description: 'No asOf parameter. prisma.monthlyRevenue.findMany({ where: { stockId: input.symbol }, ... }) with no date gate at all. Returns all revenue records regardless of when they were released.',
        codeLocation: 'Line ~76-81 in FundamentalResearchService.ts',
        currentWhere: ['{ stockId: input.symbol }'],
        pitLeakage: 'All historical MonthlyRevenue records returned regardless of asOf. Unreleased future revenue data may be included in analysis context.',
      },
      proposedChange: {
        description: 'Add optional asOf parameter to buildFundamentalResearchContextForSymbol. Gate MonthlyRevenue query by releaseDate <= asOf.',
        proposedWhere: [
          "{ stockId: input.symbol }",
          "...(input.asOf ? { releaseDate: { lte: input.asOf } } : {})",
        ],
        proposedCode: `// PROPOSED PATCH — requires schema migration (P15) before applying
// Add asOf to input type:
// input: { symbol: string; name: string; industry: string; asOf?: string }
//
// Current: no asOf gate (HIGH PIT risk)
// Proposed: gate by releaseDate
const revenueWhere = input.asOf
  ? { stockId: input.symbol, releaseDate: { lte: input.asOf } }
  : { stockId: input.symbol };
prisma.monthlyRevenue.findMany({ where: revenueWhere, ... })`,
        fallbackIfReleaseDateMissing: 'If releaseDate is null after backfill, include records only if inferred releaseDate <= asOf.',
        releaseDateFieldRequired: true,
      },
      whyNotAppliedYet: 'MonthlyRevenue.releaseDate field does not exist in production schema. Schema migration (P15) required. Also requires adding asOf parameter to function signature.',
      approvalRequirement: 'Requires P15 schema migration approval + interface update for MonthlyRevenueLike.',
      testCasesToAdd: [
        { desc: 'asOf provided → only revenue with releaseDate <= asOf returned', expected: 'filtered' },
        { desc: 'asOf not provided → all revenue returned (legacy behavior)', expected: 'all' },
        { desc: 'asOf=2024-02-09 → Jan 2024 revenue excluded', expected: 'excluded' },
        { desc: 'asOf=2024-02-10 → Jan 2024 revenue included', expected: 'included' },
      ],
    },
    {
      targetFile: 'src/lib/fundamentals/StockFundamentalSnapshot.ts',
      targetFunction: 'MonthlyRevenueLike interface',
      currentRisk: 'MEDIUM',
      currentImplementation: {
        description: 'MonthlyRevenueLike interface does not include releaseDate field. After schema migration, the interface must be updated to propagate releaseDate through the application layer.',
        codeLocation: 'MonthlyRevenueLike type definition',
        currentWhere: ['No releaseDate field'],
        pitLeakage: 'Even after schema migration, code consuming MonthlyRevenueLike will not see releaseDate without interface update.',
      },
      proposedChange: {
        description: 'Add optional releaseDate field to MonthlyRevenueLike interface.',
        proposedCode: `// PROPOSED PATCH — requires schema migration (P15) before applying
export interface MonthlyRevenueLike {
  year: number;
  month: number;
  revenue: number;
  yoyGrowth?: number | null;
  momGrowth?: number | null;
  releaseDate?: string | null;         // ADD: ISO date YYYY-MM-DD
  releaseDateSource?: string | null;   // ADD: AUTHORITATIVE | INFERRED_NEXT_MONTH_10TH
  releaseDateConfidence?: string | null; // ADD: HIGH | MEDIUM | LOW_TO_MEDIUM
}`,
        releaseDateFieldRequired: true,
      },
      whyNotAppliedYet: 'Requires schema migration first. Interface change is backward compatible (optional fields).',
      approvalRequirement: 'Requires P15 schema migration completion.',
      testCasesToAdd: [
        { desc: 'MonthlyRevenueLike with releaseDate field compiles and passes type check', expected: 'valid' },
        { desc: 'Existing code consuming MonthlyRevenueLike without releaseDate still compiles', expected: 'backward-compatible' },
      ],
    },
  ];

  console.log(`\nGenerated ${proposals.length} patch proposals.`);
  proposals.forEach(p => {
    console.log(`  - ${p.targetFile}: risk=${p.currentRisk}`);
  });

  const output = {
    phase: 'P14',
    part: 'D',
    generatedAt: new Date().toISOString(),
    queryGateContractId: contract.contractId,
    queryGateRules,
    proposals,
    productionApplyAllowed: false,
    approvalRequired: 'All proposals require P15 schema migration approval before implementation.',
    nonGoals: [
      'Does not directly modify production scoring logic.',
      'Does not modify alphaScore or recommendationBucket.',
      'Does not write production DB.',
      'Does not modify frozen corpora.',
      'Does not compute ROI, profit, win-rate, or alpha.',
      'Does not constitute investment advice.',
    ],
  };

  const jsonPath = path.join(OUTPUTS_DIR, 'p14monthly_revenue_query_gate_proposal.json');
  fs.writeFileSync(jsonPath, JSON.stringify(output, null, 2), 'utf8');
  console.log('\nWrote:', jsonPath);

  // Write MD
  const md = `# P14-HARDRESET: MonthlyRevenue Query Gate Patch Proposals

> **Disclaimer:** Proposals only. Does not modify production code or DB. Does not constitute investment advice.
> **productionApplyAllowed = false**

**Generated:** ${output.generatedAt}
**Query Gate Contract:** ${contract.contractId}

---

## Query Gate Rules

| ID | Condition | Result |
|----|-----------|--------|
${queryGateRules.map(r => `| ${r.id} | ${r.condition} | ${r.result} |`).join('\n')}

---

## Patch Proposals

${proposals.map((p, i) => `
### Proposal ${i + 1}: \`${p.targetFile}\`

**Function:** \`${p.targetFunction}\`
**Current Risk:** ${p.currentRisk}

#### Current Implementation

${p.currentImplementation.description}

**Code Location:** ${p.currentImplementation.codeLocation}
**PIT Leakage:** ${p.currentImplementation.pitLeakage}

#### Proposed Change

${p.proposedChange.description}

\`\`\`typescript
${p.proposedChange.proposedCode}
\`\`\`

${p.proposedChange.fallbackIfReleaseDateMissing ? `**Fallback:** ${p.proposedChange.fallbackIfReleaseDateMissing}` : ''}

#### Why Not Applied Yet

${p.whyNotAppliedYet}

**Approval Requirement:** ${p.approvalRequirement}

#### Test Cases to Add

| Description | Expected |
|-------------|---------|
${p.testCasesToAdd.map(t => `| ${t.desc} | ${t.expected} |`).join('\n')}
`).join('\n---\n')}

---

## Non-Goals

${output.nonGoals.map(g => `- ${g}`).join('\n')}
`;

  const mdPath = path.join(OUTPUTS_DIR, 'p14monthly_revenue_query_gate_proposal.md');
  fs.writeFileSync(mdPath, md, 'utf8');
  console.log('Wrote:', mdPath);

  console.log('\n✓ PART D complete.');
}

run();
