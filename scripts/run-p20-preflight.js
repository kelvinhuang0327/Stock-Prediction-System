'use strict';
// PART A: P20-HARDRESET Pre-flight Gate
// DISCLAIMER: Does not constitute investment advice. Observability only.

const fs = require('fs');
const path = require('path');

const OUT = 'outputs/online_validation';
const gates = [];
let passed = 0;
let failed = 0;

function gate(name, fn) {
  try {
    fn();
    console.log('  PASS:', name);
    gates.push({ gate: name, status: 'PASS' });
    passed++;
  } catch (e) {
    console.log('  FAIL:', name, '-', e.message);
    gates.push({ gate: name, status: 'FAIL', error: e.message });
    failed++;
  }
}

function fileExists(p) {
  if (!fs.existsSync(p)) throw new Error('Missing: ' + p);
}

function lineCount(p, expected) {
  const content = fs.readFileSync(p, 'utf8').trim();
  if (!content) throw new Error('Empty file: ' + p);
  const lines = content.split('\n').length;
  if (lines !== expected) throw new Error(p + ' expected ' + expected + ' lines, got ' + lines);
}

function jsonParseable(p) {
  fileExists(p);
  JSON.parse(fs.readFileSync(p, 'utf8'));
}

console.log('P20-HARDRESET PART A: Pre-flight Gate');
console.log('Generated:', new Date().toISOString());
console.log('');

// A.1 P19 artifacts
console.log('[A.1] P19 artifacts:');
gate('p19 corpus exists', () => fileExists(path.join(OUT, 'p19active_scoring_pit_replay_corpus.jsonl')));
gate('p19 summary exists', () => jsonParseable(path.join(OUT, 'p19active_scoring_pit_replay_summary.json')));
gate('p19 pit guard validation exists', () => jsonParseable(path.join(OUT, 'p19monthly_revenue_pit_guard_validation.json')));
gate('p19 field inspection exists', () => jsonParseable(path.join(OUT, 'p19active_scoring_pit_replay_field_inspection.json')));
gate('p19 final report exists', () => fileExists(path.join(OUT, 'p19active_scoring_pit_replay_final_report.md')));

// A.2 P3 artifacts
console.log('[A.2] P3 artifacts:');
gate('p3 corpus exists', () => fileExists(path.join(OUT, 'p3active_scoring_historical_replay_corpus.jsonl')));
gate('p3 field inspection exists', () => jsonParseable(path.join(OUT, 'p3active_scoring_field_inspection.json')));
gate('p3 final report exists', () => fileExists(path.join(OUT, 'p3active_scoring_final_report.md')));

// A.3 P19 conclusions
console.log('[A.3] P19 conclusions:');
gate('p19 validationStatus PASS', () => {
  const v = JSON.parse(fs.readFileSync(path.join(OUT, 'p19monthly_revenue_pit_guard_validation.json'), 'utf8'));
  if (v.validationStatus !== 'PASS') throw new Error('validationStatus = ' + v.validationStatus);
});
gate('p19 corpus lines = 4500', () => {
  const content = fs.readFileSync(path.join(OUT, 'p19active_scoring_pit_replay_corpus.jsonl'), 'utf8').trim();
  const n = content.split('\n').length;
  if (n !== 4500) throw new Error('Expected 4500, got ' + n);
});
gate('p19 leakage violations = 0', () => {
  const v = JSON.parse(fs.readFileSync(path.join(OUT, 'p19monthly_revenue_pit_guard_validation.json'), 'utf8'));
  if (v.leakageViolations !== 0) throw new Error('leakageViolations = ' + v.leakageViolations);
});
gate('p19 forbiddenFieldViolations = 0', () => {
  const v = JSON.parse(fs.readFileSync(path.join(OUT, 'p19monthly_revenue_pit_guard_validation.json'), 'utf8'));
  if (v.forbiddenFieldViolations !== 0) throw new Error('forbiddenFieldViolations = ' + v.forbiddenFieldViolations);
});
gate('p19 productionApplyAllowed = false', () => {
  const v = JSON.parse(fs.readFileSync(path.join(OUT, 'p19monthly_revenue_pit_guard_validation.json'), 'utf8'));
  if (v.productionApplyAllowed !== false) throw new Error('productionApplyAllowed = ' + v.productionApplyAllowed);
});
gate('p19 final report contains COMPLETE classification', () => {
  const content = fs.readFileSync(path.join(OUT, 'p19active_scoring_pit_replay_final_report.md'), 'utf8');
  if (!content.includes('P19_ACTIVE_SCORING_PIT_REPLAY_COMPLETE')) throw new Error('Final classification not found');
});

// A.4 Frozen corpus line counts
console.log('[A.4] Frozen corpus line counts:');
const frozen = [
  ['simulation_snapshot_corpus.jsonl', 60],
  ['p0hardreset_historical_replay_corpus.jsonl', 4500],
  ['p1baseline_historical_replay_corpus.jsonl', 9900],
  ['p3active_scoring_historical_replay_corpus.jsonl', 4500],
  ['p19active_scoring_pit_replay_corpus.jsonl', 4500]
];
for (const [fname, expected] of frozen) {
  gate('frozen: ' + fname + ' = ' + expected, () => lineCount(path.join(OUT, fname), expected));
}

// Summary
console.log('');
console.log('=== PART A SUMMARY ===');
console.log('Gates passed:', passed);
console.log('Gates total:', passed + failed);
console.log('Status:', failed === 0 ? 'PASS' : 'FAIL');

const result = {
  phase: 'P20-HARDRESET',
  part: 'A',
  generatedAt: new Date().toISOString(),
  gatesPassed: passed,
  gatesTotal: passed + failed,
  gatesFailed: gates.filter(g => g.status === 'FAIL'),
  allGates: gates,
  validationStatus: failed === 0 ? 'PASS' : 'FAIL',
  productionApplyAllowed: false,
  productionDbWritten: false,
  nextStep: failed === 0 ? 'P20_PART_B' : 'P20_PIT_IMPACT_BLOCKED_BY_ARTIFACTS'
};

fs.writeFileSync(path.join(OUT, 'p20pit_impact_preflight.json'), JSON.stringify(result, null, 2));
console.log('Written:', path.join(OUT, 'p20pit_impact_preflight.json'));

const md = [
  '# P20-HARDRESET Part A: Pre-flight Gate',
  '',
  '> DISCLAIMER: Does not constitute investment advice. Observability only.',
  '',
  `**Generated**: ${result.generatedAt}`,
  `**Phase**: P20-HARDRESET`,
  '',
  '## Gate Results',
  '',
  '| Gate | Status |',
  '|------|--------|',
  ...gates.map(g => `| ${g.gate} | ${g.status}${g.error ? ': ' + g.error : ''} |`),
  '',
  '## Summary',
  '',
  `- Gates passed: ${passed} / ${passed + failed}`,
  `- Status: **${result.validationStatus}**`,
  `- Next step: ${result.nextStep}`,
].join('\n');

fs.writeFileSync(path.join(OUT, 'p20pit_impact_preflight.md'), md);
console.log('Written:', path.join(OUT, 'p20pit_impact_preflight.md'));

if (failed > 0) {
  const esc = [
    '# P20-HARDRESET: Pre-flight Escalation Report',
    '',
    `Generated: ${result.generatedAt}`,
    '',
    '## Reason',
    'One or more pre-flight gates failed. P20 cannot proceed until artifacts are complete.',
    '',
    '## Failed Gates',
    ...gates.filter(g => g.status === 'FAIL').map(g => `- ${g.gate}: ${g.error}`),
    '',
    '## Final Classification',
    'P20_PIT_IMPACT_BLOCKED_BY_ARTIFACTS',
  ].join('\n');
  fs.writeFileSync(path.join(OUT, 'p20pit_impact_escalation_report.md'), esc);
  console.log('Written escalation report.');
  process.exit(1);
}
