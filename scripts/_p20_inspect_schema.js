'use strict';
const fs = require('fs');

const p3lines = fs.readFileSync('outputs/online_validation/p3active_scoring_historical_replay_corpus.jsonl','utf8').trim().split('\n');
const p19lines = fs.readFileSync('outputs/online_validation/p19active_scoring_pit_replay_corpus.jsonl','utf8').trim().split('\n');

// P3 top-level vs snapshot bucket for first 5 rows
console.log('=== P3 bucket comparison (first 5) ===');
for (let i = 0; i < 5; i++) {
  const row = JSON.parse(p3lines[i]);
  console.log('row', i, 'topLevel:', row.researchBucket, '| snapshot:', row.activeScoringSnapshot && row.activeScoringSnapshot.researchBucket, '| dupKey:', row.duplicateKey);
}

// P3 snapshot fields
const p3row0 = JSON.parse(p3lines[0]);
const snap = p3row0.activeScoringSnapshot;
console.log('\n=== P3 activeScoringSnapshot field types ===');
if (snap) {
  console.log('signalSnapshot type:', typeof snap.signalSnapshot, Array.isArray(snap.signalSnapshot) ? 'array len=' + snap.signalSnapshot.length : '');
  console.log('factorSnapshot type:', typeof snap.factorSnapshot, Array.isArray(snap.factorSnapshot) ? 'array len=' + snap.factorSnapshot.length : '');
  console.log('reasonSnapshot type:', typeof snap.reasonSnapshot, Array.isArray(snap.reasonSnapshot) ? 'array len=' + snap.reasonSnapshot.length : '');
  console.log('alphaScore:', snap.alphaScore);
  console.log('signalSnapshot[0]:', snap.signalSnapshot && snap.signalSnapshot[0]);
  console.log('reasonSnapshot[0]:', snap.reasonSnapshot && snap.reasonSnapshot[0]);
  if (snap.factorSnapshot && typeof snap.factorSnapshot === 'object' && !Array.isArray(snap.factorSnapshot)) {
    console.log('factorSnapshot keys:', Object.keys(snap.factorSnapshot).join(', '));
  } else if (Array.isArray(snap.factorSnapshot)) {
    console.log('factorSnapshot[0]:', snap.factorSnapshot[0]);
  }
  console.log('completenessStatus:', snap.completenessStatus);
  console.log('usedSources:', snap.usedSources);
  console.log('missingSources:', snap.missingSources);
}

// P19 row check
const p19row0 = JSON.parse(p19lines[0]);
const snap19 = p19row0.activeScoringSnapshot;
console.log('\n=== P19 activeScoringSnapshot additional fields ===');
if (snap19) {
  console.log('pitReplayRunId:', snap19.pitReplayRunId);
  console.log('monthlyRevenuePitGateApplied:', snap19.monthlyRevenuePitGateApplied);
  console.log('monthlyRevenuePitGateStatus:', snap19.monthlyRevenuePitGateStatus);
}

// Check P3 bucket distribution
const p3buckets = {};
for (const line of p3lines) {
  const row = JSON.parse(line);
  const b = row.researchBucket;
  p3buckets[b] = (p3buckets[b] || 0) + 1;
}
console.log('\n=== P3 top-level researchBucket distribution ===');
console.log(JSON.stringify(p3buckets));

// Check P3 snapshot bucket distribution
const p3snapBuckets = {};
for (const line of p3lines) {
  const row = JSON.parse(line);
  const b = row.activeScoringSnapshot && row.activeScoringSnapshot.researchBucket;
  p3snapBuckets[b] = (p3snapBuckets[b] || 0) + 1;
}
console.log('\n=== P3 activeScoringSnapshot.researchBucket distribution ===');
console.log(JSON.stringify(p3snapBuckets));

// Check P3 horizonDays (from duplicateKey)
const horizons = new Set();
for (const line of p3lines.slice(0, 100)) {
  const row = JSON.parse(line);
  const parts = row.duplicateKey && row.duplicateKey.split('|');
  if (parts && parts.length >= 3) horizons.add(parts[2]);
}
console.log('\n=== P3 horizons from duplicateKey (first 100 rows) ===', [...horizons]);

console.log('\nDone.');
