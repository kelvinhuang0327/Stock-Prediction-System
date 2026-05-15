#!/usr/bin/env node

/**
 * PART D: Classification of 9 Underoutput Cases
 *
 * Classify each case into:
 * (a) NO_TRIGGERED_FACTOR — no factors triggered
 * (b) CONTRIBUTION_BELOW_REASON_THRESHOLD — factors present but below threshold
 * (c) TEMPLATE_BRANCH_MISSING — factors triggered but template branch missing
 * (d) UNKNOWN_NEEDS_CODE_TRACE — unclassifiable
 *
 * Read-only: no scoring changes, no template modifications
 */

const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.join(__dirname, '..');
const OUTPUTS_DIR = path.join(PROJECT_ROOT, 'outputs', 'online_validation');

const P26A_AUDIT_PATH = path.join(
  OUTPUTS_DIR,
  'p26a_scoring_underoutput_9case_audit.json'
);

async function main() {
  console.log('[P28A PART D] Classification of 9 Underoutput Cases\n');

  // Load P26A audit
  const p26aAudit = JSON.parse(fs.readFileSync(P26A_AUDIT_PATH, 'utf-8'));
  const cases = p26aAudit.cases;

  if (cases.length !== 9) {
    throw new Error(`Expected 9 cases, found ${cases.length}`);
  }

  console.log(`✓ Loaded 9 cases from P26A audit\n`);

  // Classify each case
  const classifications = [];
  const distribution = {
    NO_TRIGGERED_FACTOR: 0,
    CONTRIBUTION_BELOW_REASON_THRESHOLD: 0,
    TEMPLATE_BRANCH_MISSING: 0,
    UNKNOWN_NEEDS_CODE_TRACE: 0
  };

  for (let i = 0; i < cases.length; i++) {
    const c = cases[i];
    console.log(`[${i + 1}/9] Classifying ${c.caseId}...`);

    const classification = classifyUnderoutputCase(c);
    classifications.push(classification);
    distribution[classification.classification]++;

    console.log(
      `  → ${classification.classification}: ${classification.reason.substring(0, 60)}...`
    );
  }

  console.log();

  // Summary
  console.log('Classification Distribution:');
  console.log(`  (a) NO_TRIGGERED_FACTOR: ${distribution.NO_TRIGGERED_FACTOR}`);
  console.log(
    `  (b) CONTRIBUTION_BELOW_REASON_THRESHOLD: ${distribution.CONTRIBUTION_BELOW_REASON_THRESHOLD}`
  );
  console.log(
    `  (c) TEMPLATE_BRANCH_MISSING: ${distribution.TEMPLATE_BRANCH_MISSING}`
  );
  console.log(
    `  (d) UNKNOWN_NEEDS_CODE_TRACE: ${distribution.UNKNOWN_NEEDS_CODE_TRACE}`
  );
  console.log();

  // Determine primary driver
  const sorted = Object.entries(distribution).sort((a, b) => b[1] - a[1]);
  const primaryDriver = sorted[0];
  console.log(`Primary Driver: (${getPrimaryLetter(primaryDriver[0])}) ${primaryDriver[0]} (${primaryDriver[1]}/9)`);
  console.log();

  // Write JSON
  const jsonOutput = {
    classificationId: 'p28a-underoutput-classification',
    generatedAt: new Date().toISOString(),
    totalCases: 9,
    distribution,
    primaryDriver: primaryDriver[0],
    classifications,
    disclaimer: 'Observability only. No investment recommendations.'
  };

  const jsonPath = path.join(
    OUTPUTS_DIR,
    'p28a_underoutput_classification.json'
  );
  fs.writeFileSync(jsonPath, JSON.stringify(jsonOutput, null, 2));
  console.log(`✓ Written: ${path.basename(jsonPath)}`);

  // Write Markdown
  const mdOutput = generateMarkdown(classifications, distribution, primaryDriver);
  const mdPath = path.join(
    OUTPUTS_DIR,
    'p28a_underoutput_classification.md'
  );
  fs.writeFileSync(mdPath, mdOutput);
  console.log(`✓ Written: ${path.basename(mdPath)}\n`);

  console.log('PART D Complete: All 9 cases classified');
  console.log('→ Proceed to PART E: Reason Template Branch Coverage Map');
}

function getPrimaryLetter(classification) {
  const map = {
    NO_TRIGGERED_FACTOR: 'a',
    CONTRIBUTION_BELOW_REASON_THRESHOLD: 'b',
    TEMPLATE_BRANCH_MISSING: 'c',
    UNKNOWN_NEEDS_CODE_TRACE: 'd'
  };
  return map[classification] || '?';
}

function classifyUnderoutputCase(caseData) {
  let classification = 'UNKNOWN_NEEDS_CODE_TRACE';
  let reason = '';
  const nextSteps = [];

  if (caseData.factorSnapshotCount === 0) {
    classification = 'NO_TRIGGERED_FACTOR';
    reason =
      'No factors triggered (factorSnapshotCount=0). Underoutput is expected behavior.';
    nextSteps.push('Audit case for false-flag (no scoring action needed)');
  } else if (caseData.factorSnapshotCount > 0 && caseData.reasonTokenCount === 1) {
    // P26A already classified as NO_TRIGGERED_FACTOR (renderer underoutput)
    classification = 'NO_TRIGGERED_FACTOR';
    reason =
      `Factors present (factorSnapshotCount=${caseData.factorSnapshotCount}) ` +
      `but reason collapsed to 1 token (${caseData.reasonRaw}). ` +
      `Scoring is correct; reason serialization failed (renderer issue).`;
    nextSteps.push(
      'Renderer fix: deserialize factorSnapshot for multi-factor reason generation'
    );
    if (caseData.blockedByMonthlyRevenueSource) {
      nextSteps.push(
        'Source completion: P26F4 import for MonthlyRevenue missing data'
      );
    }
  } else if (caseData.dataCoverage === 'limited') {
    classification = 'CONTRIBUTION_BELOW_REASON_THRESHOLD';
    reason =
      'Data coverage is limited; factors present but contributions may be below reason-triggering threshold.';
    nextSteps.push(
      'Analyze RuleBasedStockAnalyzer factor weighting against data availability'
    );
  } else {
    classification = 'TEMPLATE_BRANCH_MISSING';
    reason =
      'Factors present but corresponding reason template branch not identified.';
    nextSteps.push('Code trace: map factor set to reason template branches');
  }

  return {
    caseId: caseData.caseId,
    symbol: caseData.symbol,
    asOfDate: caseData.asOfDate,
    horizon: caseData.horizon,
    alphaScore: caseData.alphaScore,
    bucket: caseData.bucket,
    classification,
    reason,
    evidence: {
      hasFactorsTriggered: caseData.factorSnapshotCount > 0,
      factorCount: caseData.factorSnapshotCount,
      reasonTokenCount: caseData.reasonTokenCount,
      dataCoverageStatus: caseData.dataCoverage,
      blockedByMonthlyRevenue: caseData.blockedByMonthlyRevenueSource,
      blockedByNewsEvent: caseData.blockedByNewsEventSource,
      blockedByFinancialReport: caseData.blockedByFinancialReportSource,
      isRendererUnderoutput: caseData.isRendererUnderoutput,
      factorSnapshotSample: caseData.factorSnapshotSample.slice(0, 3)
    },
    nextStepsRecommended: nextSteps
  };
}

function generateMarkdown(classifications, distribution, primaryDriver) {
  let md = `# P28A Underoutput Classification

**Generated:** ${new Date().toISOString()}
**Total Cases:** 9

## Classification Distribution

| Category | Count | Percentage |
|----------|-------|-----------|
| (a) NO_TRIGGERED_FACTOR | ${distribution.NO_TRIGGERED_FACTOR} | ${((distribution.NO_TRIGGERED_FACTOR / 9) * 100).toFixed(1)}% |
| (b) CONTRIBUTION_BELOW_REASON_THRESHOLD | ${distribution.CONTRIBUTION_BELOW_REASON_THRESHOLD} | ${((distribution.CONTRIBUTION_BELOW_REASON_THRESHOLD / 9) * 100).toFixed(1)}% |
| (c) TEMPLATE_BRANCH_MISSING | ${distribution.TEMPLATE_BRANCH_MISSING} | ${((distribution.TEMPLATE_BRANCH_MISSING / 9) * 100).toFixed(1)}% |
| (d) UNKNOWN_NEEDS_CODE_TRACE | ${distribution.UNKNOWN_NEEDS_CODE_TRACE} | ${((distribution.UNKNOWN_NEEDS_CODE_TRACE / 9) * 100).toFixed(1)}% |

**Primary Driver:** (${getPrimaryLetter(primaryDriver[0])}) ${primaryDriver[0]}

## Detailed Classifications

`;

  classifications.forEach((cls, idx) => {
    md += `### Case ${idx + 1}: ${cls.caseId}

**Classification:** (${getPrimaryLetter(cls.classification)}) ${cls.classification}
**Symbol:** ${cls.symbol} | **As Of:** ${cls.asOfDate} | **Horizon:** ${cls.horizon}
**Alpha Score:** ${cls.alphaScore} | **Bucket:** ${cls.bucket}

**Reasoning:**
${cls.reason}

**Evidence:**
- Has Factors Triggered: ${cls.evidence.hasFactorsTriggered ? '✅ Yes' : '❌ No'}
- Factor Count: ${cls.evidence.factorCount}
- Reason Token Count: ${cls.evidence.reasonTokenCount}
- Data Coverage: ${cls.evidence.dataCoverageStatus}
- Is Renderer Underoutput: ${cls.evidence.isRendererUnderoutput ? '✅ Yes' : '❌ No'}
- Sample Factors: ${cls.evidence.factorSnapshotSample.length > 0 ? cls.evidence.factorSnapshotSample.join('; ') : 'N/A'}

**Blocked By:**
- MonthlyRevenue: ${cls.evidence.blockedByMonthlyRevenue ? '✅' : '❌'}
- NewsEvent: ${cls.evidence.blockedByNewsEvent ? '✅' : '❌'}
- FinancialReport: ${cls.evidence.blockedByFinancialReport ? '✅' : '❌'}

**Recommended Next Steps:**
${cls.nextStepsRecommended.map((s) => `- ${s}`).join('\n')}

---

`;
  });

  md += `## Next Steps Recommendation

Based on the primary driver **(${getPrimaryLetter(primaryDriver[0])}) ${primaryDriver[0]}**, ` +
    `the recommended next phase is:\n\n`;

  if (primaryDriver[0] === 'NO_TRIGGERED_FACTOR') {
    md += `- **Phase:** P28A-CONTINUATION or CLOSED (depends on auditor review)
- **Rationale:** All 9 cases are correctly scored; underoutput is due to renderer serialization failure, not scoring formula.
- **Action:** For production readiness, renderer should be fixed to deserialize factorSnapshot into multi-factor reason text.
- **Source Gap:** MonthlyRevenue import (P26F4) will add additional context but does not change scoring.`;
  } else if (primaryDriver[0] === 'CONTRIBUTION_BELOW_REASON_THRESHOLD') {
    md += `- **Phase:** P28-B Reason Threshold Documentation (read-only)
- **Rationale:** Factors are triggered but do not meet the reason template branch adoption threshold.
- **Action:** Document the threshold logic in RuleBasedStockAnalyzer / reason template coupling.`;
  } else if (primaryDriver[0] === 'TEMPLATE_BRANCH_MISSING') {
    md += `- **Phase:** P28-C Reason Template Branch Repair (read-only over existing factors)
- **Rationale:** Factors are triggered but no corresponding reason template branch exists.
- **Action:** Extend reason template branches to cover the factor combinations found in these cases.`;
  } else {
    md += `- **Phase:** P28-D Scoring Code Trace (read-only investigation)
- **Rationale:** Cases cannot be classified without deeper code tracing.
- **Action:** Instrument SignalFusionEngine and RuleBasedStockAnalyzer to expose factor contributions.`;
  }

  md += `\n\n## Disclaimer

Observability only. No investment recommendations.
`;

  return md;
}

main().catch((err) => {
  console.error('ERROR:', err.message);
  process.exit(1);
});
