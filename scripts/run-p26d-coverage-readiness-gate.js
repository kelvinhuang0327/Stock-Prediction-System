// scripts/run-p26d-coverage-readiness-gate.js
// P26D: Coverage readiness gate for P26E
// No external dependencies. Plain Node.js.

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'outputs/online_validation');

function safeReadJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    return null;
  }
}

function main() {
  const AS_OF_DATE = '2026-05-13';

  // 1. Load all PART C/D/E/F artifacts
  const monthlyRevCoverage = safeReadJson(path.join(OUT_DIR, 'p26d_monthly_revenue_targeted_coverage.json'));
  const readOnlyCtxCoverage = safeReadJson(path.join(OUT_DIR, 'p26d_read_only_context_coverage.json'));
  const replayCovComparison = safeReadJson(path.join(OUT_DIR, 'p26d_targeted_replay_coverage_comparison.json'));
  const scoringInvariance = safeReadJson(path.join(OUT_DIR, 'p26d_scoring_invariance_check.json'));

  const artifactsLoaded = {
    monthlyRevCoverage: monthlyRevCoverage !== null,
    readOnlyCtxCoverage: readOnlyCtxCoverage !== null,
    replayCovComparison: replayCovComparison !== null,
    scoringInvariance: scoringInvariance !== null,
  };

  const allArtifactsLoaded = Object.values(artifactsLoaded).every(Boolean);

  // 2. Determine scoring invariance status
  const scoringInvariancePass =
    scoringInvariance !== null &&
    scoringInvariance.classification === 'SCORING_INVARIANCE_CONFIRMED' &&
    scoringInvariance.mismatchedAlphaScoreCount === 0 &&
    scoringInvariance.mismatchedBucketCount === 0 &&
    !scoringInvariance.baselineMismatch;

  // 3. Determine MonthlyRevenue corpus evidence
  const monthlyRevenueCorpusRows =
    monthlyRevCoverage !== null ? (monthlyRevCoverage.corpusScanResult?.totalRows || 0) : 0;
  const monthlyRevenueHasCorpusEvidence = monthlyRevenueCorpusRows > 0;

  // 4. Determine source mapping required
  const newsFixtureOnly =
    readOnlyCtxCoverage !== null &&
    (readOnlyCtxCoverage.news?.total || 0) > 0 &&
    readOnlyCtxCoverage.sourceMappingRequired === true;
  const financialFixtureOnly =
    readOnlyCtxCoverage !== null &&
    (readOnlyCtxCoverage.financial?.total || 0) > 0 &&
    readOnlyCtxCoverage.sourceMappingRequired === true;
  const sourceMappingRequired = newsFixtureOnly || financialFixtureOnly;

  // 5. Determine readiness
  let readinessForP26E;
  let readinessReason;

  if (!scoringInvariancePass) {
    readinessForP26E = false;
    readinessReason = 'Scoring invariance check FAILED — cannot proceed to P26E';
  } else if (!monthlyRevenueHasCorpusEvidence) {
    readinessForP26E = 'partial';
    readinessReason = 'MonthlyRevenue context has no corpus evidence in P3/P19 (0 rows). Fixture-only contexts present. Source mapping required before full corpus expansion.';
  } else {
    readinessForP26E = true;
    readinessReason = 'Scoring invariance confirmed and MonthlyRevenue has corpus evidence.';
  }

  // 6. Build output
  const result = {
    phase: 'P26D-HARDRESET',
    generatedAt: AS_OF_DATE,
    artifactsLoaded,
    allArtifactsLoaded,
    scoringInvariancePass,
    monthlyRevenueCorpusRows,
    monthlyRevenueHasCorpusEvidence,
    sourceMappingRequired,
    newsEventFixtureOnly: newsFixtureOnly,
    financialReportFixtureOnly: financialFixtureOnly,
    readinessForP26E,
    readinessReason,
    classification:
      readinessForP26E === true
        ? 'COVERAGE_READY_FOR_CORPUS_EXPANSION'
        : readinessForP26E === 'partial'
        ? 'COVERAGE_PARTIAL_NEEDS_SOURCE_MAPPING'
        : 'SCORING_INVARIANCE_BROKEN',
    disclaimer: 'No investment recommendations. No ROI/win-rate/profit/outperform/buy/sell claims.'
  };

  // 7. Write JSON
  const jsonOut = path.join(OUT_DIR, 'p26d_coverage_readiness_gate.json');
  fs.writeFileSync(jsonOut, JSON.stringify(result, null, 2));

  // 8. Write MD
  const mdOut = path.join(OUT_DIR, 'p26d_coverage_readiness_gate.md');
  const readinessEmoji =
    result.readinessForP26E === true ? '✅' : result.readinessForP26E === 'partial' ? '⚠️' : '❌';
  const md = `# P26D Coverage Readiness Gate

**Phase:** P26D-HARDRESET  
**Generated:** ${AS_OF_DATE}  
**Classification:** ${result.classification}

## Artifact Status

| Artifact | Loaded |
|----------|--------|
| Monthly Revenue Coverage | ${artifactsLoaded.monthlyRevCoverage ? '✅' : '❌'} |
| Read-Only Context Coverage | ${artifactsLoaded.readOnlyCtxCoverage ? '✅' : '❌'} |
| Replay Coverage Comparison | ${artifactsLoaded.replayCovComparison ? '✅' : '❌'} |
| Scoring Invariance Check | ${artifactsLoaded.scoringInvariance ? '✅' : '❌'} |

## Readiness Assessment

| Check | Result |
|-------|--------|
| Scoring Invariance | ${scoringInvariancePass ? '✅ PASS' : '❌ FAIL'} |
| MonthlyRevenue Corpus Evidence | ${monthlyRevenueHasCorpusEvidence ? '✅' : '⚠️ None (0 rows)'} |
| Source Mapping Required | ${sourceMappingRequired ? '⚠️ Yes (fixture-only)' : '✅ No'} |

## Readiness for P26E

${readinessEmoji} **${String(readinessForP26E).toUpperCase()}**

${result.readinessReason}

---
*No investment recommendations. No ROI/win-rate/profit/outperform/buy/sell claims.*
`;
  fs.writeFileSync(mdOut, md);

  console.log('P26D Coverage Readiness Gate:');
  console.log(JSON.stringify(result, null, 2));
  console.log('\n✅ Written:', jsonOut);
  console.log('✅ Written:', mdOut);
}

main();
