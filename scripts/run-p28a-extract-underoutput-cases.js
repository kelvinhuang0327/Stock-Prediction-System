#!/usr/bin/env node

/**
 * PART B: Extract 9 SCORING_UNDEROUTPUT Cases from P26A
 *
 * Loads p26a_scoring_underoutput_9case_audit.json, validates exactly 9 cases,
 * and produces case list output (JSON + Markdown).
 *
 * Usage: node scripts/run-p28a-extract-underoutput-cases.js
 */

const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.join(__dirname, '..');
const OUTPUTS_DIR = path.join(PROJECT_ROOT, 'outputs', 'online_validation');
const P26A_ARTIFACT_PATH = path.join(
  OUTPUTS_DIR,
  'p26a_scoring_underoutput_9case_audit.json'
);

async function main() {
  console.log('[P28A PART B] Extract 9 SCORING_UNDEROUTPUT Cases\n');

  // Load P26A artifact
  if (!fs.existsSync(P26A_ARTIFACT_PATH)) {
    throw new Error(`P26A artifact not found: ${P26A_ARTIFACT_PATH}`);
  }

  const p26aArtifact = JSON.parse(fs.readFileSync(P26A_ARTIFACT_PATH, 'utf-8'));

  if (!Array.isArray(p26aArtifact.cases)) {
    throw new Error('P26A artifact.cases is not an array');
  }

  const cases = p26aArtifact.cases;

  if (cases.length !== 9) {
    throw new Error(
      `Expected exactly 9 cases, found ${cases.length}. ` +
        'P26A artifact may be corrupted or modified.'
    );
  }

  console.log(`✓ Loaded exactly 9 cases from P26A artifact\n`);

  // Extract case list
  const caseList = cases.map((c) => ({
    caseId: c.caseId,
    symbol: c.symbol,
    asOfDate: c.asOfDate,
    horizon: c.horizon,
    alphaScore: c.alphaScore,
    bucket: c.bucket,
    auditClassification: c.auditClassification,
    reasonRaw: c.reasonRaw
  }));

  // JSON output
  const jsonOutput = {
    extractionId: 'p28a-extract-underoutput-cases',
    generatedAt: new Date().toISOString(),
    totalCases: 9,
    uniqueSymbols: [...new Set(cases.map((c) => c.symbol))].length,
    symbols: [...new Set(cases.map((c) => c.symbol))].sort(),
    uniqueSymbolDateCombinations: new Set(
      cases.map((c) => `${c.symbol}/${c.asOfDate}`)
    ).size,
    caseList,
    summary: {
      allNoTriggeredFactor: cases.every(
        (c) => c.auditClassification === 'NO_TRIGGERED_FACTOR'
      ),
      allBlockedByMonthlyRevenue: cases.every((c) =>
        c.missingSources.includes('MonthlyRevenue')
      ),
      allRendererUnderoutput: cases.every((c) => c.isRendererUnderoutput),
      allFixableWithoutScoringChange: cases.every(
        (c) => c.fixableWithoutScoringChange
      )
    },
    disclaimer: 'Observability only. No investment recommendations.'
  };

  // Write JSON
  const jsonPath = path.join(OUTPUTS_DIR, 'p28a_underoutput_case_list.json');
  fs.writeFileSync(jsonPath, JSON.stringify(jsonOutput, null, 2));
  console.log(`✓ Written: ${path.basename(jsonPath)}`);

  // Write Markdown
  const mdOutput = generateMarkdown(caseList, jsonOutput);
  const mdPath = path.join(OUTPUTS_DIR, 'p28a_underoutput_case_list.md');
  fs.writeFileSync(mdPath, mdOutput);
  console.log(`✓ Written: ${path.basename(mdPath)}\n`);

  console.log('PART B Complete: 9 cases extracted and listed');
  console.log('→ Proceed to PART C: Per-Case Detailed Audit Snapshot');
}

function generateMarkdown(caseList, summary) {
  let md = `# P28A Underoutput Case List

**Generated:** ${new Date().toISOString()}
**Total Cases:** 9
**Unique Symbols:** ${summary.uniqueSymbols}

## Summary

- **All NO_TRIGGERED_FACTOR:** ${summary.summary.allNoTriggeredFactor ? '✅ Yes' : '❌ No'}
- **All blocked by MonthlyRevenue:** ${summary.summary.allBlockedByMonthlyRevenue ? '✅ Yes' : '❌ No'}
- **All renderer underoutput:** ${summary.summary.allRendererUnderoutput ? '✅ Yes' : '❌ No'}
- **Fixable without scoring change:** ${summary.summary.allFixableWithoutScoringChange ? '✅ Yes' : '❌ No'}

## Symbols

${summary.symbols.map((s) => `- ${s}`).join('\n')}

## Cases

| # | Case ID | Symbol | As Of Date | Horizon | Alpha | Bucket | Classification |
|---|---------|--------|------------|---------|-------|--------|-----------------|
`;

  caseList.forEach((c, i) => {
    md += `| ${i + 1} | ${c.caseId} | ${c.symbol} | ${c.asOfDate} | ${c.horizon} | ${c.alphaScore} | ${c.bucket} | ${c.auditClassification} |\n`;
  });

  md += `\n## Disclaimer

Observability only. No investment recommendations.
`;

  return md;
}

main().catch((err) => {
  console.error('ERROR:', err.message);
  process.exit(1);
});
