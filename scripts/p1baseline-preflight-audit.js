/**
 * P1-HARDRESET PART A: Pre-flight Audit
 *
 * Verifies P0 artifacts exist and meet quality gates before P1 baseline generation.
 *
 * SAFETY: read-only, no DB writes, no production writes.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, '..', 'outputs', 'online_validation');

const REQUIRED_ARTIFACTS = [
    'p0hardreset_universe_audit.json',
    'p0hardreset_historical_asofdate_candidates.json',
    'p0hardreset_historical_replay_corpus.jsonl',
    'p0hardreset_historical_replay_summary.md',
    'p0hardreset_corpus_quality_gate_rerun.json',
    'p0hardreset_final_report.md',
];

console.log('=== P1-HARDRESET PART A: Pre-flight Audit ===\n');

// ── A.1 Artifact existence check ──────────────────────────────────────────

const artifactChecks = {};
let allExist = true;

for (const f of REQUIRED_ARTIFACTS) {
    const fp = path.join(OUT, f);
    const exists = fs.existsSync(fp);
    artifactChecks[f] = exists ? 'EXISTS' : 'MISSING';
    if (!exists) allExist = false;
    console.log(`[A.1] ${exists ? '✅' : '❌'} ${f}`);
}

if (!allExist) {
    console.error('\n[ABORT] Missing required P0 artifacts. Cannot proceed with P1.');
    const escalation = {
        generatedAt: new Date().toISOString(),
        classification: 'P1_BASELINE_BLOCKED_BY_P0_ARTIFACTS',
        artifactChecks,
        failReason: 'Missing required P0 artifacts',
    };
    const escPath = path.join(OUT, 'p1baseline_escalation_report.md');
    fs.writeFileSync(escPath,
        `# P1-HARDRESET Escalation Report\n\n` +
        `**Classification:** \`P1_BASELINE_BLOCKED_BY_P0_ARTIFACTS\`\n\n` +
        `Generated: ${escalation.generatedAt}\n\n` +
        `## Missing Artifacts\n\n` +
        Object.entries(artifactChecks)
            .filter(([, v]) => v === 'MISSING')
            .map(([k]) => `- ${k}`)
            .join('\n') + '\n'
    );
    console.error(`[ABORT] Escalation report: ${escPath}`);
    process.exit(1);
}

console.log('\n[A.1] All required P0 artifacts exist ✅\n');

// ── A.2 Corpus validation ─────────────────────────────────────────────────

console.log('[A.2] Validating P0 corpus...');

const corpusPath = path.join(OUT, 'p0hardreset_historical_replay_corpus.jsonl');
const corpusRaw = fs.readFileSync(corpusPath, 'utf8').trim();
const corpusLines = corpusRaw.split('\n');

const symbols = new Set();
const dates = new Set();
let mockCount = 0;
let realCount = 0;
let missingCount = 0;
let pendingCount = 0;
let parseErrors = 0;

for (const l of corpusLines) {
    try {
        const o = JSON.parse(l);
        symbols.add(o.symbol);
        dates.add(o.originalAsOfDate);
        const ps = o.outcomeSnapshot?.priceSource || o.priceSource || '';
        if (ps === 'mock-deterministic') mockCount++;
        else if (ps === 'stockQuote.close') realCount++;
        else if (ps === 'MISSING') missingCount++;
        else if (ps === 'PENDING') pendingCount++;
    } catch {
        parseErrors++;
    }
}

const coveragePct = realCount / corpusLines.length;

const frozenPath = path.join(OUT, 'simulation_snapshot_corpus.jsonl');
const frozenLines = fs.readFileSync(frozenPath, 'utf8').trim().split('\n').length;

const corpusValidation = {
    lines: corpusLines.length,
    linesPass: corpusLines.length >= 4500,
    symbols: symbols.size,
    symbolsPass: symbols.size >= 25,
    dates: dates.size,
    datesPass: dates.size >= 60,
    mockDeterministic: mockCount,
    mockPass: mockCount === 0,
    coveragePct: parseFloat((coveragePct * 100).toFixed(2)),
    coveragePass: coveragePct >= 0.90,
    frozenLines,
    frozenPass: frozenLines === 60,
    parseErrors,
};

const corpusPass = (
    corpusValidation.linesPass &&
    corpusValidation.symbolsPass &&
    corpusValidation.datesPass &&
    corpusValidation.mockPass &&
    corpusValidation.coveragePass &&
    corpusValidation.frozenPass &&
    parseErrors === 0
);

console.log(`  lines:         ${corpusLines.length} (need >= 4500) ${corpusValidation.linesPass ? '✅' : '❌'}`);
console.log(`  symbols:       ${symbols.size} (need >= 25) ${corpusValidation.symbolsPass ? '✅' : '❌'}`);
console.log(`  dates:         ${dates.size} (need >= 60) ${corpusValidation.datesPass ? '✅' : '❌'}`);
console.log(`  mock-determ:   ${mockCount} (need = 0) ${corpusValidation.mockPass ? '✅' : '❌'}`);
console.log(`  coverage:      ${corpusValidation.coveragePct}% (need >= 90%) ${corpusValidation.coveragePass ? '✅' : '❌'}`);
console.log(`  frozen:        ${frozenLines} lines (need = 60) ${corpusValidation.frozenPass ? '✅' : '❌'}`);

if (!corpusPass) {
    console.error('\n[ABORT] P0 corpus quality gate not met. Cannot proceed with P1.');
    const escalation = { classification: 'P1_BASELINE_BLOCKED_BY_P0_ARTIFACTS', corpusValidation };
    const escPath = path.join(OUT, 'p1baseline_escalation_report.md');
    fs.writeFileSync(escPath,
        `# P1-HARDRESET Escalation Report\n\n` +
        `**Classification:** \`P1_BASELINE_BLOCKED_BY_P0_ARTIFACTS\`\n\n` +
        `Generated: ${new Date().toISOString()}\n\n` +
        `## P0 Corpus Quality Gate Failed\n\n` +
        `\`\`\`json\n${JSON.stringify(corpusValidation, null, 2)}\n\`\`\`\n`
    );
    process.exit(1);
}

console.log('\n[A.2] P0 corpus quality gate PASS ✅\n');

// ── A.3 Write artifacts ────────────────────────────────────────────────────

const result = {
    generatedAt: new Date().toISOString(),
    auditVersion: 'p1baseline-preflight-v1',
    artifactChecks,
    allArtifactsExist: allExist,
    corpusValidation,
    overallPass: true,
    nextStep: 'Proceed with P1 baseline corpus generation',
};

const jsonPath = path.join(OUT, 'p1baseline_preflight_audit.json');
fs.writeFileSync(jsonPath, JSON.stringify(result, null, 2));
console.log(`[A.3] JSON written: ${jsonPath}`);

const mdLines = [
    '# P1-HARDRESET Pre-flight Audit',
    '',
    `Generated: ${result.generatedAt}`,
    `Status: **✅ PASS**`,
    '',
    '## P0 Artifact Checks',
    '',
    '| File | Status |',
    '|------|--------|',
    ...REQUIRED_ARTIFACTS.map(f => `| \`${f}\` | ${artifactChecks[f] === 'EXISTS' ? '✅ EXISTS' : '❌ MISSING'} |`),
    '',
    '## P0 Corpus Validation',
    '',
    '| Check | Value | Threshold | Status |',
    '|-------|-------|-----------|--------|',
    `| Lines | ${corpusLines.length} | ≥ 4500 | ${corpusValidation.linesPass ? '✅' : '❌'} |`,
    `| Unique symbols | ${symbols.size} | ≥ 25 | ${corpusValidation.symbolsPass ? '✅' : '❌'} |`,
    `| Unique asOfDates | ${dates.size} | ≥ 60 | ${corpusValidation.datesPass ? '✅' : '❌'} |`,
    `| mock-deterministic | ${mockCount} | = 0 | ${corpusValidation.mockPass ? '✅' : '❌'} |`,
    `| stockQuote.close coverage | ${corpusValidation.coveragePct}% | ≥ 90% | ${corpusValidation.coveragePass ? '✅' : '❌'} |`,
    `| Frozen corpus lines | ${frozenLines} | = 60 | ${corpusValidation.frozenPass ? '✅' : '❌'} |`,
    '',
    '## Conclusion',
    '',
    '**All P0 quality gates passed. Proceeding with P1 baseline corpus generation.**',
    '',
    '---',
    '*Not investment advice. Research corpus only.*',
    '',
];

const mdPath = path.join(OUT, 'p1baseline_preflight_audit.md');
fs.writeFileSync(mdPath, mdLines.join('\n'));
console.log(`[A.3] MD written: ${mdPath}`);

console.log('\n[PART A] PASS ✅ — P0 artifacts verified. Proceed with P1.\n');
