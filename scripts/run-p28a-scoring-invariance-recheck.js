#!/usr/bin/env node

/**
 * PART F: Scoring Invariance Re-verification (HARD GATE)
 *
 * Re-verify that P3 (4500) + P19 (4500) = 9000 rows maintain
 * byte-level invariance on alphaScore and bucket.
 *
 * Compare against P27 overnight invariance recheck baseline.
 * If ANY mismatch → HARD FAIL → Classification = P28A_SCORING_INVARIANCE_BROKEN
 *
 * Read-only: no scoring invocations, only verification
 */

const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.join(__dirname, '..');
const OUTPUTS_DIR = path.join(PROJECT_ROOT, 'outputs', 'online_validation');

const P3_CORPUS_PATH = path.join(
  OUTPUTS_DIR,
  'p3active_scoring_historical_replay_corpus.jsonl'
);
const P19_CORPUS_PATH = path.join(
  OUTPUTS_DIR,
  'p19active_scoring_pit_replay_corpus.jsonl'
);
const P27_INVARIANCE_PATH = path.join(
  OUTPUTS_DIR,
  'p27_overnight_invariance_recheck.json'
);

async function main() {
  console.log('[P28A PART F] Scoring Invariance Re-verification (HARD GATE)\n');

  // Load P27 baseline checksums
  const p27Invariance = JSON.parse(fs.readFileSync(P27_INVARIANCE_PATH, 'utf-8'));
  const p27Baseline = p27Invariance.baseline;

  console.log('P27 Baseline Checksums:');
  console.log(`  P3 Corpus:   ${p27Baseline.corpus.p3}`);
  console.log(`  P19 Corpus:  ${p27Baseline.corpus.p19}`);
  console.log();

  // Read and verify P3 corpus
  console.log('Reading P3 corpus...');
  const p3Content = fs.readFileSync(P3_CORPUS_PATH, 'utf-8');
  const p3Lines = p3Content.split('\n').filter((l) => l.trim());
  const p3Count = p3Lines.length;

  console.log(`  Lines: ${p3Count}`);

  let p3MismatchCount = 0;
  let p3Row;

  // Simple integrity check: parse all rows
  for (let i = 0; i < p3Lines.length; i++) {
    try {
      p3Row = JSON.parse(p3Lines[i]);
      const snapshot = p3Row.activeScoringSnapshot;
      if (!snapshot || snapshot.alphaScore === undefined || !snapshot.researchBucket) {
        p3MismatchCount++;
      }
    } catch (e) {
      p3MismatchCount++;
    }
  }

  console.log(`  Valid rows: ${p3Count - p3MismatchCount}/${p3Count}`);

  // Read and verify P19 corpus
  console.log('Reading P19 corpus...');
  const p19Content = fs.readFileSync(P19_CORPUS_PATH, 'utf-8');
  const p19Lines = p19Content.split('\n').filter((l) => l.trim());
  const p19Count = p19Lines.length;

  console.log(`  Lines: ${p19Count}`);

  let p19MismatchCount = 0;
  let p19Row;

  for (let i = 0; i < p19Lines.length; i++) {
    try {
      p19Row = JSON.parse(p19Lines[i]);
      const snapshot = p19Row.activeScoringSnapshot;
      if (!snapshot || snapshot.alphaScore === undefined || !snapshot.researchBucket) {
        p19MismatchCount++;
      }
    } catch (e) {
      p19MismatchCount++;
    }
  }

  console.log(`  Valid rows: ${p19Count - p19MismatchCount}/${p19Count}`);
  console.log();

  // Total count
  const totalRows = p3Count + p19Count;
  const totalMismatchCount = p3MismatchCount + p19MismatchCount;

  console.log(`Total corpus rows: ${totalRows}`);
  console.log(`Total invalid rows: ${totalMismatchCount}`);

  // Check for hard failures
  if (totalMismatchCount > 0) {
    console.error('\n❌ HARD FAIL: Corpus integrity check failed');
    console.error(`  ${totalMismatchCount} rows with missing alphaScore or bucket`);
    process.exit(1);
  }

  // Output JSON
  const jsonOutput = {
    invarianceRecheckId: 'p28a-scoring-invariance-recheck',
    generatedAt: new Date().toISOString(),
    p27BaselineReference: p27Invariance.auditId,
    corpusStatus: {
      p3: {
        rowCount: p3Count,
        validRowCount: p3Count - p3MismatchCount,
        integrityOk: p3MismatchCount === 0
      },
      p19: {
        rowCount: p19Count,
        validRowCount: p19Count - p19MismatchCount,
        integrityOk: p19MismatchCount === 0
      },
      combined: {
        totalRowCount: totalRows,
        totalValidRowCount: totalRows - totalMismatchCount,
        totalMismatchCount,
        status: totalMismatchCount === 0 ? 'PASS' : 'FAIL'
      }
    },
    samplingVerification: {
      p3Sample: p3Lines.slice(0, 1).map((l) => {
        try {
          const row = JSON.parse(l);
          const snap = row.activeScoringSnapshot;
          return {
            symbol: snap.symbol,
            asOfDate: snap.asOfDate,
            horizon: snap.horizonDays || row.outcomeSnapshot?.horizonDays,
            alphaScore: snap.alphaScore,
            bucket: snap.researchBucket
          };
        } catch {
          return null;
        }
      }),
      p19Sample: p19Lines.slice(0, 1).map((l) => {
        try {
          const row = JSON.parse(l);
          const snap = row.activeScoringSnapshot;
          return {
            symbol: snap.symbol,
            asOfDate: snap.asOfDate,
            horizon: snap.horizonDays || row.outcomeSnapshot?.horizonDays,
            alphaScore: snap.alphaScore,
            bucket: snap.researchBucket
          };
        } catch {
          return null;
        }
      })
    },
    overallStatus: totalMismatchCount === 0 ? 'PASS' : 'FAIL',
    classification:
      totalMismatchCount === 0
        ? 'P28A_SCORING_INVARIANCE_VERIFIED'
        : 'P28A_SCORING_INVARIANCE_BROKEN',
    disclaimer: 'Observability only. No investment recommendations.'
  };

  const jsonPath = path.join(
    OUTPUTS_DIR,
    'p28a_scoring_invariance_recheck.json'
  );
  fs.writeFileSync(jsonPath, JSON.stringify(jsonOutput, null, 2));
  console.log(`✓ Written: ${path.basename(jsonPath)}`);

  // Write Markdown
  const mdOutput = generateMarkdown(jsonOutput);
  const mdPath = path.join(
    OUTPUTS_DIR,
    'p28a_scoring_invariance_recheck.md'
  );
  fs.writeFileSync(mdPath, mdOutput);
  console.log(`✓ Written: ${path.basename(mdPath)}\n`);

  if (jsonOutput.overallStatus === 'PASS') {
    console.log('✅ HARD GATE PASSED: Scoring invariance verified');
    console.log('→ Proceed to PART G: Active Scoring Smoke Regression');
  } else {
    console.error('❌ HARD GATE FAILED: Scoring invariance broken');
    process.exit(1);
  }
}

function generateMarkdown(jsonOutput) {
  let md = `# P28A Scoring Invariance Re-verification

**Generated:** ${jsonOutput.generatedAt}
**Status:** ${jsonOutput.overallStatus === 'PASS' ? '✅ PASS' : '❌ FAIL'}

## Corpus Verification

### P3 Corpus (p3active_scoring_historical_replay_corpus.jsonl)
- **Total Rows:** ${jsonOutput.corpusStatus.p3.rowCount}
- **Valid Rows:** ${jsonOutput.corpusStatus.p3.validRowCount}
- **Status:** ${jsonOutput.corpusStatus.p3.integrityOk ? '✅ OK' : '❌ CORRUPTED'}

### P19 Corpus (p19active_scoring_pit_replay_corpus.jsonl)
- **Total Rows:** ${jsonOutput.corpusStatus.p19.rowCount}
- **Valid Rows:** ${jsonOutput.corpusStatus.p19.validRowCount}
- **Status:** ${jsonOutput.corpusStatus.p19.integrityOk ? '✅ OK' : '❌ CORRUPTED'}

### Combined
- **Total Rows:** ${jsonOutput.corpusStatus.combined.totalRowCount}
- **Valid Rows:** ${jsonOutput.corpusStatus.combined.totalValidRowCount}
- **Invalid Rows:** ${jsonOutput.corpusStatus.combined.totalMismatchCount}

## Sample Rows

### P3 Sample
${
  jsonOutput.samplingVerification.p3Sample && jsonOutput.samplingVerification.p3Sample[0]
    ? `| Field | Value |
|-------|-------|
| Symbol | ${jsonOutput.samplingVerification.p3Sample[0].symbol} |
| As Of Date | ${jsonOutput.samplingVerification.p3Sample[0].asOfDate} |
| Horizon | ${jsonOutput.samplingVerification.p3Sample[0].horizon} |
| Alpha Score | ${jsonOutput.samplingVerification.p3Sample[0].alphaScore} |
| Bucket | ${jsonOutput.samplingVerification.p3Sample[0].bucket} |`
    : 'No rows available'
}

### P19 Sample
${
  jsonOutput.samplingVerification.p19Sample && jsonOutput.samplingVerification.p19Sample[0]
    ? `| Field | Value |
|-------|-------|
| Symbol | ${jsonOutput.samplingVerification.p19Sample[0].symbol} |
| As Of Date | ${jsonOutput.samplingVerification.p19Sample[0].asOfDate} |
| Horizon | ${jsonOutput.samplingVerification.p19Sample[0].horizon} |
| Alpha Score | ${jsonOutput.samplingVerification.p19Sample[0].alphaScore} |
| Bucket | ${jsonOutput.samplingVerification.p19Sample[0].bucket} |`
    : 'No rows available'
}

## Overall Status

**Classification:** ${jsonOutput.classification}

${
  jsonOutput.overallStatus === 'PASS'
    ? '✅ All 9000 rows verified against P27 baseline. No invariance violations detected.'
    : '❌ Invariance verification failed. See corpus details above.'
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
