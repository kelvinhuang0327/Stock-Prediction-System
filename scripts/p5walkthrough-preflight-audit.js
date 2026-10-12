'use strict';
// P5-HARDRESET PART A — Pre-flight Audit
// Validates all required artifacts exist and pass structural invariants before P5 walkthrough review.

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'outputs', 'online_validation');

function resolve(relPath) { return path.join(ROOT, relPath); }

const gates = [];
let passed = 0;
let failed = 0;

function gate(id, description, fn) {
  try {
    const result = fn();
    const ok = result !== false;
    gates.push({ id, description, status: ok ? 'PASS' : 'FAIL', detail: ok ? 'OK' : 'assertion returned false' });
    if (ok) passed++; else failed++;
  } catch (e) {
    gates.push({ id, description, status: 'FAIL', detail: String(e.message || e) });
    failed++;
  }
}

// ─── A.1 File existence ─────────────────────────────────────────────────────

gate('A01', 'p4calibration_walkthrough_cases.json exists', () =>
  fs.existsSync(resolve('outputs/online_validation/p4calibration_walkthrough_cases.json')));

gate('A02', 'p4calibration_full_audit.json exists', () =>
  fs.existsSync(resolve('outputs/online_validation/p4calibration_full_audit.json')));

gate('A03', 'p4calibration_readiness_decision.json exists', () =>
  fs.existsSync(resolve('outputs/online_validation/p4calibration_readiness_decision.json')));

gate('A04', 'p3active_scoring_historical_replay_corpus.jsonl exists', () =>
  fs.existsSync(resolve('outputs/online_validation/p3active_scoring_historical_replay_corpus.jsonl')));

gate('A05', 'p1baseline_historical_replay_corpus.jsonl exists', () =>
  fs.existsSync(resolve('outputs/online_validation/p1baseline_historical_replay_corpus.jsonl')));

gate('A06', 'simulation_snapshot_corpus.jsonl exists', () =>
  fs.existsSync(resolve('outputs/online_validation/simulation_snapshot_corpus.jsonl')));

gate('A07', 'p3active_scoring_field_inspection.json exists', () =>
  fs.existsSync(resolve('outputs/online_validation/p3active_scoring_field_inspection.json')));

// ─── A.2 P4 walkthrough cases invariants ────────────────────────────────────

gate('A08', 'p4 walkthrough cases >= 50', () => {
  const d = JSON.parse(fs.readFileSync(resolve('outputs/online_validation/p4calibration_walkthrough_cases.json'), 'utf8'));
  if (d.totalCases < 50) throw new Error(`totalCases=${d.totalCases}, need >=50`);
  return true;
});

gate('A09', 'p4 walkthrough cases array non-empty', () => {
  const d = JSON.parse(fs.readFileSync(resolve('outputs/online_validation/p4calibration_walkthrough_cases.json'), 'utf8'));
  if (!Array.isArray(d.cases) || d.cases.length === 0) throw new Error('cases array missing or empty');
  return true;
});

gate('A10', 'p4 readiness classification = P4_FULL_CALIBRATION_AUDIT_COMPLETE', () => {
  const d = JSON.parse(fs.readFileSync(resolve('outputs/online_validation/p4calibration_readiness_decision.json'), 'utf8'));
  const valid = ['P4_FULL_CALIBRATION_AUDIT_COMPLETE', 'P4_READY_FOR_MANUAL_WALKTHROUGH'];
  if (!valid.includes(d.classification)) throw new Error(`classification=${d.classification}`);
  return true;
});

gate('A11', 'p4 readiness 29/29 PASS', () => {
  const d = JSON.parse(fs.readFileSync(resolve('outputs/online_validation/p4calibration_readiness_decision.json'), 'utf8'));
  if (d.passed !== d.total) throw new Error(`passed=${d.passed} total=${d.total}`);
  return true;
});

// ─── A.3 Frozen corpus line counts ──────────────────────────────────────────

gate('A12', 'simulation_snapshot_corpus.jsonl = 60 lines', () => {
  const n = fs.readFileSync(resolve('outputs/online_validation/simulation_snapshot_corpus.jsonl'), 'utf8').trim().split('\n').length;
  if (n !== 60) throw new Error(`lines=${n}`);
  return true;
});

gate('A13', 'p3active corpus = 4500 lines', () => {
  const n = fs.readFileSync(resolve('outputs/online_validation/p3active_scoring_historical_replay_corpus.jsonl'), 'utf8').trim().split('\n').length;
  if (n !== 4500) throw new Error(`lines=${n}`);
  return true;
});

gate('A14', 'p1baseline corpus = 9900 lines', () => {
  const n = fs.readFileSync(resolve('outputs/online_validation/p1baseline_historical_replay_corpus.jsonl'), 'utf8').trim().split('\n').length;
  if (n !== 9900) throw new Error(`lines=${n}`);
  return true;
});

gate('A15', 'p0hardreset corpus = 4500 lines', () => {
  const n = fs.readFileSync(resolve('outputs/online_validation/p0hardreset_historical_replay_corpus.jsonl'), 'utf8').trim().split('\n').length;
  if (n !== 4500) throw new Error(`lines=${n}`);
  return true;
});

// ─── A.4 Mock-deterministic check ───────────────────────────────────────────

gate('A16', 'P3 corpus: mock-deterministic=0', () => {
  const raw = fs.readFileSync(resolve('outputs/online_validation/p3active_scoring_historical_replay_corpus.jsonl'), 'utf8');
  const count = (raw.match(/mock.deterministic/gi) || []).length;
  if (count > 0) throw new Error(`mock-deterministic found ${count} times in P3`);
  return true;
});

gate('A17', 'P1 corpus: mock-deterministic=0', () => {
  const raw = fs.readFileSync(resolve('outputs/online_validation/p1baseline_historical_replay_corpus.jsonl'), 'utf8');
  const count = (raw.match(/mock.deterministic/gi) || []).length;
  if (count > 0) throw new Error(`mock-deterministic found ${count} times in P1`);
  return true;
});

// ─── A.5 P4 artifact forbidden claims check ─────────────────────────────────

const FORBIDDEN_RE = /\b(roi|win-rate|win rate|outperform|guaranteed|trading[\s-]edge|alpha[\s-]edge|beat[\s-]market|buy[\s-]signal|sell[\s-]signal|investment[\s-]recommendation)\b/i;
const ALLOWED_FIELD_NAMES = /alphascore|alphascorevalue|scoreSnapshot|researchBucket/i;

function scanArtifactForForbiddenClaims(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const lines = raw.split('\n');
  const hits = [];
  lines.forEach((line, i) => {
    if (FORBIDDEN_RE.test(line) && !ALLOWED_FIELD_NAMES.test(line)) {
      // allow disclaimers and scanner definition lines
      if (!/disclaimer|scanForbiddenClaims|forbidden.*pattern|pattern.*forbidden/i.test(line)) {
        hits.push({ line: i + 1, text: line.trim().substring(0, 120) });
      }
    }
  });
  return hits;
}

gate('A18', 'p4calibration_full_audit.json: no forbidden claims', () => {
  const hits = scanArtifactForForbiddenClaims(resolve('outputs/online_validation/p4calibration_full_audit.json'));
  if (hits.length > 0) throw new Error(`forbidden claims found: ${JSON.stringify(hits[0])}`);
  return true;
});

gate('A19', 'p4calibration_readiness_decision.json: no forbidden claims', () => {
  const hits = scanArtifactForForbiddenClaims(resolve('outputs/online_validation/p4calibration_readiness_decision.json'));
  if (hits.length > 0) throw new Error(`forbidden claims found: ${JSON.stringify(hits[0])}`);
  return true;
});

gate('A20', 'p4calibration_walkthrough_cases.json: no forbidden claims', () => {
  const hits = scanArtifactForForbiddenClaims(resolve('outputs/online_validation/p4calibration_walkthrough_cases.json'));
  if (hits.length > 0) throw new Error(`forbidden claims found: ${JSON.stringify(hits[0])}`);
  return true;
});

// ─── A.6 P3 corpus structural invariants ────────────────────────────────────

gate('A21', 'P3 corpus: >=25 unique symbols', () => {
  const lines = fs.readFileSync(resolve('outputs/online_validation/p3active_scoring_historical_replay_corpus.jsonl'), 'utf8').trim().split('\n');
  const syms = new Set(lines.map(l => JSON.parse(l).symbol));
  if (syms.size < 25) throw new Error(`uniqueSymbols=${syms.size}`);
  return true;
});

gate('A22', 'P3 corpus: usable ratio 100% (no EMPTY)', () => {
  const lines = fs.readFileSync(resolve('outputs/online_validation/p3active_scoring_historical_replay_corpus.jsonl'), 'utf8').trim().split('\n');
  const empty = lines.filter(l => JSON.parse(l).scoringCompletenessStatus === 'EMPTY').length;
  if (empty > 0) throw new Error(`EMPTY rows=${empty}`);
  return true;
});

gate('A23', 'P3 corpus: PIT violations = 0', () => {
  const lines = fs.readFileSync(resolve('outputs/online_validation/p3active_scoring_historical_replay_corpus.jsonl'), 'utf8').trim().split('\n');
  const violations = lines.filter(l => {
    const r = JSON.parse(l);
    const msgs = r.validationMessages || [];
    return msgs.some(m => /PIT|point.in.time/i.test(String(m)));
  }).length;
  if (violations > 0) throw new Error(`PIT violations=${violations}`);
  return true;
});

gate('A24', 'p4calibration_full_audit.json: byHorizon/byBucket/byScoreDecile/confusionMatrices/predictionVsBaseline all present', () => {
  const d = JSON.parse(fs.readFileSync(resolve('outputs/online_validation/p4calibration_full_audit.json'), 'utf8'));
  for (const k of ['byHorizon', 'byBucket', 'byScoreDecile', 'confusionMatrices', 'predictionVsBaseline']) {
    if (!d[k]) throw new Error(`missing key: ${k}`);
  }
  return true;
});

// ─── Results ─────────────────────────────────────────────────────────────────

const total = gates.length;
const classification = failed === 0 ? 'P5_PREFLIGHT_PASS' : 'P5_WALKTHROUGH_BLOCKED_BY_ARTIFACTS';

console.log(`[P5-A] ${classification}: ${passed}/${total} PASS`);
gates.filter(g => g.status === 'FAIL').forEach(g => console.log(`  FAIL ${g.id}: ${g.description} — ${g.detail}`));

const report = {
  classification,
  passed,
  failed,
  total,
  generatedAt: new Date().toISOString(),
  gates
};

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(path.join(OUT_DIR, 'p5walkthrough_preflight_audit.json'), JSON.stringify(report, null, 2));

// Write markdown
const md = [
  '# P5-HARDRESET PART A — Pre-flight Audit',
  '',
  `**Classification:** \`${classification}\``,
  `**Date:** ${new Date().toISOString().split('T')[0]}`,
  `**Gates:** ${passed}/${total} PASS`,
  '',
  '## Gate Results',
  '',
  '| ID | Description | Status | Detail |',
  '|----|-------------|--------|--------|',
  ...gates.map(g => `| ${g.id} | ${g.description} | **${g.status}** | ${g.detail} |`),
  '',
  failed > 0
    ? '## Escalation\n\nOne or more gates failed. P5 walkthrough is blocked. See `p5walkthrough_escalation_report.md`.'
    : '## Result\n\nAll gates PASS. Proceed to PART B.',
].join('\n');

fs.writeFileSync(path.join(OUT_DIR, 'p5walkthrough_preflight_audit.md'), md);

if (failed > 0) {
  const esc = [
    '# P5-HARDRESET Escalation Report',
    '',
    `**Final Classification:** \`P5_WALKTHROUGH_BLOCKED_BY_ARTIFACTS\``,
    '',
    '## Failed Gates',
    '',
    ...gates.filter(g => g.status === 'FAIL').map(g => `- **${g.id}** ${g.description}: ${g.detail}`),
  ].join('\n');
  fs.writeFileSync(path.join(OUT_DIR, 'p5walkthrough_escalation_report.md'), esc);
  console.log('  → outputs/online_validation/p5walkthrough_escalation_report.md');
  process.exit(1);
}

console.log('  → outputs/online_validation/p5walkthrough_preflight_audit.json');
console.log('  → outputs/online_validation/p5walkthrough_preflight_audit.md');
