#!/usr/bin/env node
// P26F3-2-HARDRESET: Accepted Source Coverage Preview
// DISCLAIMER: Does not constitute investment advice.
// No DB write. No corpus write. No scoring change. No external API.

'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'outputs/online_validation');
const P3_CORPUS = path.join(ROOT, 'outputs/online_validation/p3active_scoring_historical_replay_corpus.jsonl');
const P19_CORPUS = path.join(ROOT, 'outputs/online_validation/p19active_scoring_pit_replay_corpus.jsonl');
const MANIFEST_PATH = path.join(OUT, 'p26f3_2_manual_source_manifest.json');

function readCorpusRows(filePath) {
  if (!fs.existsSync(filePath)) return [];
  return fs.readFileSync(filePath, 'utf8').split('\n').filter(l => l.trim()).map(l => JSON.parse(l));
}

let manifest = { acceptedRows: 0, rows: [], classification: 'P26F3_2_SOURCE_NOT_PROVIDED_PACKAGE_READY' };
if (fs.existsSync(MANIFEST_PATH)) {
  try { manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8')); } catch(e) {}
}

if (!manifest.rows || manifest.acceptedRows === 0) {
  const result = {
    generatedAt: new Date().toISOString(),
    classification: 'P26F3_2_SOURCE_NOT_PROVIDED',
    acceptedRows: 0,
    coveredSnapshotRows: 0,
    coveragePct: 0,
    readyForP26F4: false,
    dbWriteAllowed: false,
    corpusWriteAllowed: false,
  };
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT,'p26f3_2_accepted_source_coverage_preview.json'), JSON.stringify(result,null,2));
  fs.writeFileSync(path.join(OUT,'p26f3_2_accepted_source_coverage_preview.md'), `# P26F3-2 Accepted Source Coverage Preview\n\nClassification: **P26F3_2_SOURCE_NOT_PROVIDED**\nNo accepted source rows — place TWSE files in drop-zone and re-run validator first.\n`);
  console.log('Classification: P26F3_2_SOURCE_NOT_PROVIDED');
  process.exit(0);
}

// PIT-safe latest-as-of match
const revenueRows = manifest.rows;
const p3Rows = readCorpusRows(P3_CORPUS);
const p19Rows = readCorpusRows(P19_CORPUS);
const allSnapshotRows = [...p3Rows, ...p19Rows];

let coveredCount = 0;
const coverageDetails = [];

for (const snap of allSnapshotRows) {
  const asOfDate = snap.asOfDate || snap.snapshotDate;
  if (!asOfDate) continue;
  const stockId = snap.stockId || snap.symbol;
  const relevant = revenueRows.filter(r =>
    r.stockId === stockId &&
    new Date(r.releaseDate) <= new Date(asOfDate)
  );
  if (relevant.length > 0) {
    const latest = relevant.sort((a,b) => new Date(b.releaseDate).getTime() - new Date(a.releaseDate).getTime())[0];
    coveredCount++;
    coverageDetails.push({ stockId, asOfDate, matchedPeriod: latest.period, releaseDate: latest.releaseDate });
  }
}

const pct = allSnapshotRows.length > 0 ? Math.round(coveredCount / allSnapshotRows.length * 100) : 0;
const classification = coveredCount > 0 ? 'P26F3_2_ACCEPTED_SOURCE_COVERAGE_AVAILABLE' : 'P26F3_2_ACCEPTED_SOURCE_NO_COVERAGE';

const result = {
  generatedAt: new Date().toISOString(),
  classification,
  acceptedRows: revenueRows.length,
  totalSnapshotRows: allSnapshotRows.length,
  coveredSnapshotRows: coveredCount,
  coveragePct: pct,
  readyForP26F4: coveredCount > 0,
  dbWriteAllowed: false,
  corpusWriteAllowed: false,
  sampleCoverageDetails: coverageDetails.slice(0, 20),
};

fs.writeFileSync(path.join(OUT,'p26f3_2_accepted_source_coverage_preview.json'), JSON.stringify(result,null,2));
fs.writeFileSync(path.join(OUT,'p26f3_2_accepted_source_coverage_preview.md'),
  `# P26F3-2 Accepted Source Coverage Preview\n\nClassification: **${classification}**\nAccepted rows: ${revenueRows.length}\nSnapshot rows: ${allSnapshotRows.length}\nCovered: ${coveredCount} (${pct}%)\nReady for P26F4: ${coveredCount > 0}\nDB write: false | Corpus write: false\n`
);
console.log(`Classification: ${classification}`);
console.log(`Covered: ${coveredCount}/${allSnapshotRows.length} (${pct}%)`);
