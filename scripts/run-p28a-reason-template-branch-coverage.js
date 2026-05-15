#!/usr/bin/env node

/**
 * PART E: Reason Template Branch Coverage Map
 *
 * Read-only AST scan of:
 * 1. SignalFusionEngine.ts — collect all factor identifiers
 * 2. RuleBasedStockAnalyzer.ts — collect all factor checks/returns
 * 3. Reason template patterns in ActiveScoringSnapshotBuilder + related files
 *
 * Build mapping: factor → reason branches that reference it
 * Identify: uncovered factors (no reason branch) and dead branches (reason references non-existent factors)
 *
 * No scoring changes, no template modifications.
 */

const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.join(__dirname, '..');
const SRC_DIR = path.join(PROJECT_ROOT, 'src');

const ANALYZER_PATH = path.join(SRC_DIR, 'lib', 'analysis', 'RuleBasedStockAnalyzer.ts');
const FUSION_PATH = path.join(SRC_DIR, 'lib', 'alpha', 'SignalFusionEngine.ts');
const SNAPSHOT_BUILDER_PATH = path.join(
  SRC_DIR,
  'lib',
  'onlineValidation',
  'ActiveScoringSnapshotBuilder.ts'
);

async function main() {
  console.log('[P28A PART E] Reason Template Branch Coverage Map\n');

  // Read source files
  console.log('Scanning source files...');
  const analyzerContent = fs.readFileSync(ANALYZER_PATH, 'utf-8');
  const fusionContent = fs.readFileSync(FUSION_PATH, 'utf-8');
  const snapshotContent = fs.readFileSync(SNAPSHOT_BUILDER_PATH, 'utf-8');

  console.log(`✓ RuleBasedStockAnalyzer.ts (${analyzerContent.length} bytes)`);
  console.log(`✓ SignalFusionEngine.ts (${fusionContent.length} bytes)`);
  console.log(`✓ ActiveScoringSnapshotBuilder.ts (${snapshotContent.length} bytes)\n`);

  // Extract factors from source code
  const factorsFromAnalyzer = extractFactorsFromAnalyzer(analyzerContent);
  const factorsFromFusion = extractFactorsFromFusion(fusionContent);
  const allFactors = new Set([...factorsFromAnalyzer, ...factorsFromFusion]);

  console.log(`Found factors: ${allFactors.size}`);
  const allFactorsArray = Array.from(allFactors);
  console.log(allFactorsArray.sort().slice(0, 10).join(', ') + (allFactorsArray.size > 10 ? ', ...' : ''));
  console.log();

  // Extract reason branches from snapshot builder
  const reasonBranches = extractReasonBranches(snapshotContent);

  console.log(`Found reason branches: ${reasonBranches.length}\n`);

  // Build coverage map
  const factorToReasonBranches = {};
  const branchToFactorsReferenced = {};

  allFactors.forEach((factor) => {
    factorToReasonBranches[factor] = reasonBranches.filter((branch) =>
      branch.content.includes(factor)
    );
  });

  reasonBranches.forEach((branch) => {
    const referencedFactors = Array.from(allFactors).filter((factor) =>
      branch.content.includes(factor)
    );
    branchToFactorsReferenced[branch.id] = referencedFactors;
  });

  // Identify uncovered factors
  const uncoveredFactors = Array.from(allFactors).filter(
    (f) => factorToReasonBranches[f].length === 0
  );

  // Identify dead branches
  const deadBranches = reasonBranches.filter((b) =>
    branchToFactorsReferenced[b.id].length === 0
  );

  console.log(`Coverage Statistics:`);
  console.log(`  Total factors: ${allFactors.size}`);
  console.log(`  Covered factors: ${allFactors.size - uncoveredFactors.length}`);
  console.log(`  Uncovered factors: ${uncoveredFactors.length}`);
  console.log(`  Total reason branches: ${reasonBranches.length}`);
  console.log(`  Dead branches (no factors): ${deadBranches.length}\n`);

  // Output JSON
  const jsonOutput = {
    coverageMapId: 'p28a-reason-template-branch-coverage',
    generatedAt: new Date().toISOString(),
    statistics: {
      totalFactors: allFactors.size,
      coveredFactors: allFactors.size - uncoveredFactors.length,
      uncoveredFactors: uncoveredFactors.length,
      totalReasonBranches: reasonBranches.length,
      deadBranches: deadBranches.length,
      coveragePercentage:
        allFactors.size > 0
          ? (
              ((allFactors.size - uncoveredFactors.length) / allFactors.size) * 100
            ).toFixed(2)
          : 'N/A'
    },
    factors: {
      all: Array.from(allFactors).sort(),
      fromRuleBasedStockAnalyzer: Array.from(factorsFromAnalyzer).sort(),
      fromSignalFusionEngine: Array.from(factorsFromFusion).sort(),
      uncovered: uncoveredFactors.sort()
    },
    reasonBranches: reasonBranches.map((b) => ({
      id: b.id,
      location: b.location,
      referencedFactorsCount: branchToFactorsReferenced[b.id].length,
      referencedFactors: branchToFactorsReferenced[b.id]
    })),
    deadBranches: deadBranches.map((b) => ({
      id: b.id,
      location: b.location,
      content: b.content.substring(0, 100) + '...'
    })),
    disclaimer: 'Observability only. No investment recommendations.'
  };

  const jsonPath = path.join(
    PROJECT_ROOT,
    'outputs',
    'online_validation',
    'p28a_reason_template_branch_coverage.json'
  );
  fs.writeFileSync(jsonPath, JSON.stringify(jsonOutput, null, 2));
  console.log(`✓ Written: ${path.basename(jsonPath)}`);

  // Output Markdown
  const mdOutput = generateMarkdown(jsonOutput);
  const mdPath = path.join(
    PROJECT_ROOT,
    'outputs',
    'online_validation',
    'p28a_reason_template_branch_coverage.md'
  );
  fs.writeFileSync(mdPath, mdOutput);
  console.log(`✓ Written: ${path.basename(mdPath)}\n`);

  console.log('PART E Complete: Reason template branch coverage mapped');
  console.log('→ Proceed to PART F: Scoring Invariance Re-verification');
}

function extractFactorsFromAnalyzer(content) {
  const factors = new Set();

  // Pattern: factor names typically follow "if (" or ".includes(" or similar
  // Typical patterns: MA_TREND, RSI, MACD, ADX, Volume, Momentum, Support, Resistance, etc.
  const patterns = [
    /\b([A-Z_]+TREND[A-Z_]*)\b/g,
    /\b([A-Z_]*RSI[A-Z_]*)\b/g,
    /\b([A-Z_]*MACD[A-Z_]*)\b/g,
    /\b([A-Z_]*ADX[A-Z_]*)\b/g,
    /\b([A-Z_]*VOLUME[A-Z_]*)\b/g,
    /\b([A-Z_]*MOMENTUM[A-Z_]*)\b/g,
    /\b([A-Z_]*SUPPORT[A-Z_]*)\b/g,
    /\b([A-Z_]*RESISTANCE[A-Z_]*)\b/g,
    /\b([A-Z_]*VOLATILITY[A-Z_]*)\b/g,
    /\b(technicalScore|fundamentalScore|sentimentScore)\b/g
  ];

  patterns.forEach((pattern) => {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      factors.add(match[1]);
    }
  });

  return factors;
}

function extractFactorsFromFusion(content) {
  const factors = new Set();

  // SignalFusionEngine combines signals from different sources
  // Look for patterns like: signal, weight, contribution
  const patterns = [
    /signals?\.\w+/g,
    /\bweight(?:ed)?By\w+/g,
    /\b([a-zA-Z]+)(?:Signal|Weight|Contribution)\b/g
  ];

  patterns.forEach((pattern) => {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      if (match[1]) {
        factors.add(match[1]);
      }
    }
  });

  return factors;
}

function extractReasonBranches(content) {
  const branches = [];
  let branchCounter = 1;

  // Reason branches are typically in conditionals that return reason strings
  // Pattern: if (...) { ... reason = '...' ... }

  // Simple regex to capture reason string assignments
  const reasonPattern =
    /(?:reason|reasonText|returnedReason)\s*=\s*['"](.*?)['"]/g;
  let match;

  while ((match = reasonPattern.exec(content)) !== null) {
    branches.push({
      id: `reason_branch_${branchCounter++}`,
      location: `line ${content.substring(0, match.index).split('\n').length}`,
      content: match[1]
    });
  }

  return branches;
}

function generateMarkdown(jsonOutput) {
  let md = `# P28A Reason Template Branch Coverage Map

**Generated:** ${jsonOutput.generatedAt}

## Coverage Summary

| Metric | Value |
|--------|-------|
| Total Factors | ${jsonOutput.statistics.totalFactors} |
| Covered Factors | ${jsonOutput.statistics.coveredFactors} |
| Uncovered Factors | ${jsonOutput.statistics.uncoveredFactors} |
| Coverage % | ${jsonOutput.statistics.coveragePercentage}% |
| Total Reason Branches | ${jsonOutput.statistics.totalReasonBranches} |
| Dead Branches | ${jsonOutput.statistics.deadBranches} |

## All Factors

### From RuleBasedStockAnalyzer
${jsonOutput.factors.fromRuleBasedStockAnalyzer.length > 0
  ? jsonOutput.factors.fromRuleBasedStockAnalyzer.map((f) => `- ${f}`).join('\n')
  : '(none)'}

### From SignalFusionEngine
${jsonOutput.factors.fromSignalFusionEngine.length > 0
  ? jsonOutput.factors.fromSignalFusionEngine.map((f) => `- ${f}`).join('\n')
  : '(none)'}

## Uncovered Factors

Factors that exist in scoring logic but have no corresponding reason template branch:

${
  jsonOutput.factors.uncovered.length > 0
    ? jsonOutput.factors.uncovered.map((f) => `- **${f}** (no reason branch)`).join('\n')
    : '✅ All factors are covered'
}

## Reason Branches

| Branch | Referenced Factors | Coverage |
|--------|-------------------|----------|
${jsonOutput.reasonBranches.map((b) => `| ${b.id} | ${b.referencedFactorsCount} | ${b.referencedFactors.length > 0 ? '✅' : '❌'} |`).join('\n')}

## Dead Branches

Reason branches that don't reference any factors:

${
  jsonOutput.deadBranches.length > 0
    ? jsonOutput.deadBranches.map((b) => `- **${b.id}** (${b.location})`).join('\n')
    : '✅ No dead branches found'
}

## Recommendations

${
  jsonOutput.statistics.uncoveredFactors > 0
    ? `### Uncovered Factors
Consider adding reason template branches for the following factors:
${jsonOutput.factors.uncovered.map((f) => `- ${f}`).join('\n')}`
    : '✅ All factors have corresponding reason branches'
}

${
  jsonOutput.deadBranches.length > 0
    ? `### Dead Branches
The following reason branches don't reference any factors (likely unreachable or deprecated):
${jsonOutput.deadBranches.map((b) => `- ${b.id} (${b.location})`).join('\n')}`
    : ''
}

## Disclaimer

Observability only. No investment recommendations.
`;

  return md;
}

main().catch((err) => {
  console.error('ERROR:', err.message);
  process.exit(1);
});
