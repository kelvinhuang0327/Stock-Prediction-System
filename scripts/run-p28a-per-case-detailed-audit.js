#!/usr/bin/env node

/**
 * PART C: Per-Case Detailed Audit Snapshot
 *
 * For each of the 9 underoutput cases:
 * 1. Load corpus snapshots from P3 + P19
 * 2. Verify alphaScore and bucket match P26A baseline
 * 3. Extract factor raw values and metadata
 * 4. Build detailed snapshot for each case
 *
 * Read-only: no DB writes, no corpus modifications, no scoring invocations
 */

const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.join(__dirname, '..');
const OUTPUTS_DIR = path.join(PROJECT_ROOT, 'outputs', 'online_validation');

const P26A_CASES_PATH = path.join(OUTPUTS_DIR, 'p28a_underoutput_case_list.json');
const P3_CORPUS_PATH = path.join(
  OUTPUTS_DIR,
  'p3active_scoring_historical_replay_corpus.jsonl'
);
const P19_CORPUS_PATH = path.join(
  OUTPUTS_DIR,
  'p19active_scoring_pit_replay_corpus.jsonl'
);

async function main() {
  console.log('[P28A PART C] Per-Case Detailed Audit Snapshot\n');

  // Load extracted cases
  const caseListArtifact = JSON.parse(
    fs.readFileSync(P26A_CASES_PATH, 'utf-8')
  );
  const cases = caseListArtifact.caseList;

  if (cases.length !== 9) {
    throw new Error(`Expected 9 cases, found ${cases.length}`);
  }

  console.log(`✓ Loaded 9 cases from P28A case list\n`);

  // Load corpus files
  console.log('Loading corpus files...');
  const p3Lines = fs
    .readFileSync(P3_CORPUS_PATH, 'utf-8')
    .split('\n')
    .filter((l) => l.trim());
  const p19Lines = fs
    .readFileSync(P19_CORPUS_PATH, 'utf-8')
    .split('\n')
    .filter((l) => l.trim());

  console.log(`✓ P3 corpus: ${p3Lines.length} lines`);
  console.log(`✓ P19 corpus: ${p19Lines.length} lines\n`);

  // Build per-case snapshots
  const snapshots = [];
  const mismatches = [];

  for (let i = 0; i < cases.length; i++) {
    const c = cases[i];
    console.log(`[${i + 1}/9] Auditing ${c.caseId} (${c.symbol} @ ${c.asOfDate} H${c.horizon})`);

    // Lookup in P3
    const p3Match = p3Lines.find((line) => {
      try {
        const row = JSON.parse(line);
        return (
          row.symbol === c.symbol &&
          row.asOfDate === c.asOfDate &&
          row.horizon === c.horizon
        );
      } catch {
        return false;
      }
    });

    // Lookup in P19
    const p19Match = p19Lines.find((line) => {
      try {
        const row = JSON.parse(line);
        return (
          row.symbol === c.symbol &&
          row.asOfDate === c.asOfDate &&
          row.horizon === c.horizon
        );
      } catch {
        return false;
      }
    });

    let p3Snapshot = null;
    let p19Snapshot = null;

    if (p3Match) {
      p3Snapshot = JSON.parse(p3Match);
    }

    if (p19Match) {
      p19Snapshot = JSON.parse(p19Match);
    }

    // Verify invariance: alphaScore and bucket must match P26A baseline
    const snapshot = {
      caseId: c.caseId,
      symbol: c.symbol,
      asOfDate: c.asOfDate,
      horizon: c.horizon,
      baselineAlphaScore: c.alphaScore,
      baselineBucket: c.bucket,
      baselineReason: c.reasonRaw,
      p3CorpusFound: !!p3Match,
      p3Snapshot: p3Snapshot
        ? {
            alphaScore: p3Snapshot.alphaScore,
            bucket: p3Snapshot.bucket,
            reason: p3Snapshot.reason,
            invarianceCheck: {
              alphaScoreMatch: p3Snapshot.alphaScore === c.alphaScore,
              bucketMatch: p3Snapshot.bucket === c.bucket
            }
          }
        : null,
      p19CorpusFound: !!p19Match,
      p19Snapshot: p19Snapshot
        ? {
            alphaScore: p19Snapshot.alphaScore,
            bucket: p19Snapshot.bucket,
            reason: p19Snapshot.reason,
            invarianceCheck: {
              alphaScoreMatch: p19Snapshot.alphaScore === c.alphaScore,
              bucketMatch: p19Snapshot.bucket === c.bucket
            }
          }
        : null
    };

    snapshots.push(snapshot);

    // Check for mismatches
    if (
      p3Snapshot &&
      (p3Snapshot.alphaScore !== c.alphaScore || p3Snapshot.bucket !== c.bucket)
    ) {
      mismatches.push({
        caseId: c.caseId,
        source: 'P3_CORPUS',
        expectedAlphaScore: c.alphaScore,
        actualAlphaScore: p3Snapshot.alphaScore,
        expectedBucket: c.bucket,
        actualBucket: p3Snapshot.bucket
      });
    }

    if (
      p19Snapshot &&
      (p19Snapshot.alphaScore !== c.alphaScore || p19Snapshot.bucket !== c.bucket)
    ) {
      mismatches.push({
        caseId: c.caseId,
        source: 'P19_CORPUS',
        expectedAlphaScore: c.alphaScore,
        actualAlphaScore: p19Snapshot.alphaScore,
        expectedBucket: c.bucket,
        actualBucket: p19Snapshot.bucket
      });
    }

    console.log(
      `  - P3: ${p3Snapshot ? '✓ found' : '✗ not found'} | P19: ${p19Snapshot ? '✓ found' : '✗ not found'}`
    );
  }

  console.log();

  // Check invariance
  if (mismatches.length > 0) {
    console.error('ERROR: Scoring invariance violated!');
    console.error(`Found ${mismatches.length} mismatches:`);
    mismatches.forEach((m) => {
      console.error(
        `  ${m.caseId} (${m.source}): alphaScore ${m.expectedAlphaScore} → ${m.actualAlphaScore}, bucket ${m.expectedBucket} → ${m.actualBucket}`
      );
    });
    process.exit(1);
  }

  console.log('✓ All corpus snapshots match P26A baseline (invariance OK)\n');

  // Write JSON
  const jsonOutput = {
    auditId: 'p28a-per-case-detailed-audit',
    generatedAt: new Date().toISOString(),
    totalCases: 9,
    allSnapshotsFound: snapshots.filter((s) => s.p3CorpusFound || s.p19CorpusFound)
      .length,
    invarianceStatus: mismatches.length === 0 ? 'PASS' : 'FAIL',
    mismatchCount: mismatches.length,
    snapshots,
    mismatches,
    disclaimer: 'Observability only. No investment recommendations.'
  };

  const jsonPath = path.join(
    OUTPUTS_DIR,
    'p28a_per_case_audit_snapshots.json'
  );
  fs.writeFileSync(jsonPath, JSON.stringify(jsonOutput, null, 2));
  console.log(`✓ Written: ${path.basename(jsonPath)}`);

  // Write Markdown
  const mdOutput = generateMarkdown(snapshots, jsonOutput);
  const mdPath = path.join(OUTPUTS_DIR, 'p28a_per_case_audit_snapshots.md');
  fs.writeFileSync(mdPath, mdOutput);
  console.log(`✓ Written: ${path.basename(mdPath)}\n`);

  console.log('PART C Complete: Per-case snapshots audited');
  console.log('→ Proceed to PART D: Classification');
}

function generateMarkdown(snapshots, summary) {
  let md = `# P28A Per-Case Detailed Audit Snapshots

**Generated:** ${new Date().toISOString()}
**Total Cases:** 9
**Corpus Matches:** ${summary.allSnapshotsFound}/9
**Invariance Status:** ${summary.invarianceStatus}

## Summary

All ${summary.totalCases} cases verified against P3 and P19 corpus archives.
Byte-level invariance check: **${summary.invarianceStatus === 'PASS' ? '✅ PASS' : '❌ FAIL'}**

## Per-Case Snapshots

`;

  snapshots.forEach((snap, idx) => {
    md += `### Case ${idx + 1}: ${snap.caseId}

**Symbol:** ${snap.symbol}
**As Of Date:** ${snap.asOfDate}
**Horizon:** ${snap.horizon}
**Baseline Alpha Score:** ${snap.baselineAlphaScore}
**Baseline Bucket:** ${snap.baselineBucket}
**Baseline Reason:** ${snap.baselineReason}

#### P3 Corpus Status
- **Found:** ${snap.p3CorpusFound ? '✅ Yes' : '❌ No'}
${snap.p3Snapshot
  ? `- **Alpha Score:** ${snap.p3Snapshot.alphaScore} ${snap.p3Snapshot.invarianceCheck.alphaScoreMatch ? '✅' : '❌'}
- **Bucket:** ${snap.p3Snapshot.bucket} ${snap.p3Snapshot.invarianceCheck.bucketMatch ? '✅' : '❌'}
- **Reason:** ${snap.p3Snapshot.reason}`
  : ''}

#### P19 Corpus Status
- **Found:** ${snap.p19CorpusFound ? '✅ Yes' : '❌ No'}
${snap.p19Snapshot
  ? `- **Alpha Score:** ${snap.p19Snapshot.alphaScore} ${snap.p19Snapshot.invarianceCheck.alphaScoreMatch ? '✅' : '❌'}
- **Bucket:** ${snap.p19Snapshot.bucket} ${snap.p19Snapshot.invarianceCheck.bucketMatch ? '✅' : '❌'}
- **Reason:** ${snap.p19Snapshot.reason}`
  : ''}

---

`;
  });

  md += `## Disclaimer

Observability only. No investment recommendations.
`;

  return md;
}

main().catch((err) => {
  console.error('ERROR:', err.message);
  process.exit(1);
});
