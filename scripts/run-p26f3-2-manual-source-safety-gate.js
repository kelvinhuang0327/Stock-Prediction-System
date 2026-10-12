#!/usr/bin/env node
// P26F3-2-HARDRESET: Manual Source Safety Gate
// DISCLAIMER: Does not constitute investment advice.
// Verifies: DB unchanged, frozen corpus unchanged, scoring sha256 unchanged, no outcome fields.

'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'outputs/online_validation');

const PREFLIGHT_PATH = path.join(OUT, 'p26f3_2_manual_source_acquisition_preflight.json');
const MANIFEST_PATH = path.join(OUT, 'p26f3_2_manual_source_manifest.json');

const FROZEN_CORPUS = [
  { name: 'simulation_snapshot_corpus.jsonl', expectedLines: 60 },
  { name: 'p0hardreset_historical_replay_corpus.jsonl', expectedLines: 4500 },
  { name: 'p1baseline_historical_replay_corpus.jsonl', expectedLines: 9900 },
  { name: 'p3active_scoring_historical_replay_corpus.jsonl', expectedLines: 4500 },
  { name: 'p19active_scoring_pit_replay_corpus.jsonl', expectedLines: 4500 },
];

const SCORING_FILES = [
  'src/lib/onlineValidation/ActiveScoringSnapshotBuilder.ts',
  'src/lib/analysis/RuleBasedStockAnalyzer.ts',
  'src/lib/alpha/SignalFusionEngine.ts',
];

const BASELINE_SHA256 = {
  'ActiveScoringSnapshotBuilder.ts': '063a3bd524d20e9d0dfc847e342a93b36bd086bab042d9fde88282963156bf5d',
  'RuleBasedStockAnalyzer.ts': 'bc3716cc8e74be304f2e262aac586a61760bb59d6c95e82a575c38e03ea7373d',
  'SignalFusionEngine.ts': 'b8ce3fa3ae63fd7edf6b6067dd8ccea63c02741454b93792e87bfbc1e95d2bf4',
};

const P26F3_2_FORBIDDEN_FIELDS = ['outcomePrice','returnPct','realizedReturnClass'];

function sha256(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function countLines(filePath) {
  if (!fs.existsSync(filePath)) return -1;
  return fs.readFileSync(filePath,'utf8').split('\n').filter(l => l.trim()).length;
}

async function main() {
  const violations = [];
  const checks = [];

  // 1. DB row count
  const prisma = new PrismaClient();
  let dbRowCount = -1;
  try {
    dbRowCount = await prisma.monthlyRevenue.count();
    await prisma.$disconnect();
  } catch(e) {
    await prisma.$disconnect();
    violations.push(`DB query failed: ${e.message}`);
  }

  let baselineCount = 2143;
  if (fs.existsSync(PREFLIGHT_PATH)) {
    try {
      const pre = JSON.parse(fs.readFileSync(PREFLIGHT_PATH,'utf8'));
      if (pre.dbMonthlyRevenueRowCount) baselineCount = pre.dbMonthlyRevenueRowCount;
    } catch(e) {}
  }

  if (dbRowCount !== baselineCount) violations.push(`DB MonthlyRevenue row count changed: ${baselineCount} → ${dbRowCount}`);
  checks.push({ check: 'DB_ROW_COUNT', expected: baselineCount, actual: dbRowCount, pass: dbRowCount === baselineCount });

  // 2. Frozen corpus
  const CORPUS_OUT = path.join(ROOT, 'outputs/online_validation');
  for (const c of FROZEN_CORPUS) {
    const fp = path.join(CORPUS_OUT, c.name);
    const actual = countLines(fp);
    const pass = actual === c.expectedLines;
    if (!pass) violations.push(`Frozen corpus ${c.name}: expected ${c.expectedLines}, got ${actual}`);
    checks.push({ check: `CORPUS_${c.name}`, expected: c.expectedLines, actual, pass });
  }

  // 3. Scoring sha256
  for (const sf of SCORING_FILES) {
    const fp = path.join(ROOT, sf);
    const baseName = path.basename(sf);
    const expected = BASELINE_SHA256[baseName];
    const actual = fs.existsSync(fp) ? sha256(fp) : null;
    const pass = actual === expected;
    if (!pass) violations.push(`Scoring file sha256 changed: ${sf}`);
    checks.push({ check: `SHA256_${baseName}`, expected, actual, pass });
  }

  // 4. Manifest no outcome fields
  let acceptedRows = [];
  if (fs.existsSync(MANIFEST_PATH)) {
    try { acceptedRows = JSON.parse(fs.readFileSync(MANIFEST_PATH,'utf8')).rows || []; } catch(e) {}
  }
  let outcomeViolations = 0;
  for (const r of acceptedRows) {
    for (const f of P26F3_2_FORBIDDEN_FIELDS) {
      if (f in r && r[f] != null) outcomeViolations++;
    }
  }
  const outcomePass = outcomeViolations === 0;
  if (!outcomePass) violations.push(`Accepted rows have forbidden outcome fields: ${outcomeViolations} violations`);
  checks.push({ check: 'NO_OUTCOME_FIELDS', violations: outcomeViolations, pass: outcomePass });

  // 5. dryRunOnly
  const dryRunViolations = acceptedRows.filter(r => r.dryRunOnly !== true || r.dbWriteAllowed !== false || r.corpusWriteAllowed !== false).length;
  const dryRunPass = dryRunViolations === 0;
  if (!dryRunPass) violations.push(`${dryRunViolations} accepted rows violate dryRunOnly contract`);
  checks.push({ check: 'DRY_RUN_ONLY', violations: dryRunViolations, pass: dryRunPass });

  const allPass = violations.length === 0;
  const result = {
    generatedAt: new Date().toISOString(),
    allPass,
    classification: allPass ? 'P26F3_2_SAFETY_GATE_PASS' : 'P26F3_2_UNEXPECTED_WRITE_DETECTED',
    checks,
    violations,
    dbWriteAllowed: false,
    corpusWriteAllowed: false,
  };

  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT,'p26f3_2_manual_source_safety_gate.json'), JSON.stringify(result,null,2));
  fs.writeFileSync(path.join(OUT,'p26f3_2_manual_source_safety_gate.md'),
    `# P26F3-2 Safety Gate\n\nAll pass: **${allPass}**\nViolations: ${violations.length}\n${violations.map(v=>`- ${v}`).join('\n')}\nDB write: false | Corpus write: false\n`
  );
  console.log(`Safety gate: ${allPass ? 'PASS' : 'FAIL'}`);
  if (!allPass) { violations.forEach(v => console.error('VIOLATION:', v)); process.exit(1); }
}
main().catch(e => { console.error(e); process.exit(1); });
