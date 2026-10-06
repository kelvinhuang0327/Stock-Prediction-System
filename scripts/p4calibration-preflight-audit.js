'use strict';
/**
 * p4calibration-preflight-audit.js — P4-HARDRESET PART A
 *
 * Pre-flight audit: verifies all required artifacts exist and P3/P1 corpora
 * meet invariants before running the full calibration audit.
 *
 * Safety: read-only. No DB write. No external API call.
 * Not investment advice. Not a trading system.
 */
const fs = require('fs');
const path = require('path');

const OUT_DIR = 'outputs/online_validation';

function gate(ok, name, detail) {
    return { name, ok: Boolean(ok), detail: ok ? 'PASS' : String(detail) };
}

function run() {
    const start = Date.now();
    const gates = [];

    // ── A.1 File existence ───────────────────────────────────────────────
    const required = [
        'outputs/online_validation/p3active_scoring_historical_replay_corpus.jsonl',
        'outputs/online_validation/p3active_scoring_field_inspection.json',
        'outputs/online_validation/p3active_scoring_final_report.md',
        'outputs/online_validation/p1baseline_historical_replay_corpus.jsonl',
        'outputs/online_validation/simulation_snapshot_corpus.jsonl',
        'outputs/online_validation/p0hardreset_historical_replay_corpus.jsonl',
    ];
    for (const f of required) {
        gates.push(gate(fs.existsSync(f), `FILE_EXISTS:${path.basename(f)}`, `MISSING: ${f}`));
    }
    // p1 summary (either name acceptable)
    const p1Sum = fs.existsSync('outputs/online_validation/p1baseline_historical_replay_summary.json') ||
        fs.existsSync('outputs/online_validation/p1baseline_comparison_observability.json');
    gates.push(gate(p1Sum, 'P1_SUMMARY_OR_COMPARISON_EXISTS', 'Neither p1baseline_historical_replay_summary.json nor p1baseline_comparison_observability.json found'));

    // ── A.2 P3 corpus validation ─────────────────────────────────────────
    console.log('Loading P3 corpus...');
    const p3Raw = fs.readFileSync('outputs/online_validation/p3active_scoring_historical_replay_corpus.jsonl', 'utf8');
    const p3Lines = p3Raw.trim().split('\n').map(l => JSON.parse(l));

    gates.push(gate(p3Lines.length >= 4500, 'P3_MIN_LINES_4500', `Got ${p3Lines.length}`));

    const p3Symbols = new Set(p3Lines.map(l => l.symbol));
    gates.push(gate(p3Symbols.size >= 25, 'P3_MIN_SYMBOLS_25', `Got ${p3Symbols.size}`));

    const p3Dates = new Set(p3Lines.map(l => l.originalAsOfDate));
    gates.push(gate(p3Dates.size >= 60, 'P3_MIN_ASOFDATES_60', `Got ${p3Dates.size}`));

    const p3MockDet = p3Lines.filter(l => JSON.stringify(l).includes('mock-deterministic')).length;
    gates.push(gate(p3MockDet === 0, 'P3_NO_MOCK_DETERMINISTIC', `Found ${p3MockDet} lines`));

    const p3HasStatus = p3Lines.filter(l => l.scoringCompletenessStatus).length;
    gates.push(gate(p3HasStatus === p3Lines.length, 'P3_COMPLETENESS_STATUS_PRESENT_ALL', `${p3HasStatus}/${p3Lines.length}`));

    const p3Complete = p3Lines.filter(l => l.scoringCompletenessStatus === 'COMPLETE').length;
    const p3Partial = p3Lines.filter(l => l.scoringCompletenessStatus === 'PARTIAL').length;
    const p3Empty = p3Lines.filter(l => l.scoringCompletenessStatus === 'EMPTY').length;
    gates.push(gate(p3Complete + p3Partial > 0, 'P3_COMPLETE_OR_PARTIAL_POSITIVE', `COMPLETE=${p3Complete} PARTIAL=${p3Partial}`));

    const p3EmptyRatio = p3Empty / p3Lines.length;
    gates.push(gate(p3EmptyRatio < 1.0, 'P3_EMPTY_RATIO_NOT_100PCT', `empty=${p3Empty}/${p3Lines.length} (${(p3EmptyRatio * 100).toFixed(1)}%)`));

    const p3NonZeroScore = p3Lines.filter(l => l.scoreSnapshot && l.scoreSnapshot.researchScore > 0).length;
    gates.push(gate(p3NonZeroScore > 0, 'P3_NON_ZERO_SCORES_EXIST', `${p3NonZeroScore} non-zero`));

    const p3UniqueBuckets = [...new Set(p3Lines.map(l => l.researchBucket))];
    const allNeutral = p3UniqueBuckets.every(b => b === 'Neutral');
    gates.push(gate(!allNeutral, 'P3_BUCKET_NOT_ALL_NEUTRAL', `Buckets: ${p3UniqueBuckets.join(', ')}`));

    const p3PitViolations = p3Lines.filter(l =>
        l.activeScoringSnapshot && l.activeScoringSnapshot.pitGateDate !== l.originalAsOfDate
    ).length;
    gates.push(gate(p3PitViolations === 0, 'P3_PIT_VIOLATIONS_ZERO', `Found ${p3PitViolations}`));

    // ── A.3 P1 baseline corpus ───────────────────────────────────────────
    console.log('Loading P1 corpus...');
    const p1Raw = fs.readFileSync('outputs/online_validation/p1baseline_historical_replay_corpus.jsonl', 'utf8');
    const p1Lines = p1Raw.trim().split('\n').map(l => JSON.parse(l));

    gates.push(gate(p1Lines.length >= 9900, 'P1_MIN_LINES_9900', `Got ${p1Lines.length}`));

    const p1BTypes = new Set(p1Lines.map(l => l.baselineType));
    gates.push(gate(p1BTypes.size >= 4, 'P1_MIN_BASELINE_TYPES_4', `Got ${p1BTypes.size}: ${[...p1BTypes].join(', ')}`));

    const p1MockDet = p1Lines.filter(l => JSON.stringify(l).includes('mock-deterministic')).length;
    gates.push(gate(p1MockDet === 0, 'P1_NO_MOCK_DETERMINISTIC', `Found ${p1MockDet} lines`));

    // ── A.4 Frozen line counts ───────────────────────────────────────────
    const frozen = [
        { key: 'FROZEN', file: 'outputs/online_validation/simulation_snapshot_corpus.jsonl', expected: 60 },
        { key: 'P0', file: 'outputs/online_validation/p0hardreset_historical_replay_corpus.jsonl', expected: 4500 },
        { key: 'P1', file: 'outputs/online_validation/p1baseline_historical_replay_corpus.jsonl', expected: 9900 },
        { key: 'P3', file: 'outputs/online_validation/p3active_scoring_historical_replay_corpus.jsonl', expected: 4500 },
    ];
    for (const fc of frozen) {
        const n = fs.readFileSync(fc.file, 'utf8').trim().split('\n').length;
        gates.push(gate(n === fc.expected, `FROZEN_${fc.key}_LINES_${fc.expected}`, `Expected ${fc.expected}, got ${n}`));
    }

    // ── Build artifact ───────────────────────────────────────────────────
    const passed = gates.filter(g => g.ok).length;
    const failed = gates.filter(g => !g.ok).length;
    const classification = failed === 0 ? 'P4_PREFLIGHT_PASS' : 'P4_CALIBRATION_BLOCKED_BY_ARTIFACTS';

    const p3BucketDist = {};
    for (const l of p3Lines) {
        p3BucketDist[l.researchBucket] = (p3BucketDist[l.researchBucket] || 0) + 1;
    }

    const artifact = {
        auditVersion: 'p4hardreset-preflight-v1',
        classification,
        runDate: new Date().toISOString().slice(0, 10),
        passed,
        failed,
        total: gates.length,
        gates,
        p3Stats: {
            lines: p3Lines.length,
            uniqueSymbols: p3Symbols.size,
            uniqueAsOfDates: p3Dates.size,
            COMPLETE: p3Complete,
            PARTIAL: p3Partial,
            EMPTY: p3Empty,
            usableRatio: ((p3Complete + p3Partial) / p3Lines.length).toFixed(4),
            nonZeroScore: p3NonZeroScore,
            uniqueBuckets: p3UniqueBuckets,
            bucketDistribution: p3BucketDist,
            pitViolations: p3PitViolations,
        },
        p1Stats: {
            lines: p1Lines.length,
            baselineTypes: [...p1BTypes],
        },
        durationMs: Date.now() - start,
    };

    fs.mkdirSync(OUT_DIR, { recursive: true });
    fs.writeFileSync(
        path.join(OUT_DIR, 'p4calibration_preflight_audit.json'),
        JSON.stringify(artifact, null, 2),
    );

    const failedGates = gates.filter(g => !g.ok);
    const md = [
        `# P4 Calibration Pre-flight Audit`,
        ``,
        `**Classification**: \`${classification}\``,
        `**Date**: ${artifact.runDate}  **Gates**: ${passed}/${gates.length} PASS`,
        ``,
        `## Gate Results`,
        ``,
        `| Gate | Result | Detail |`,
        `|------|--------|--------|`,
        ...gates.map(g => `| ${g.name} | ${g.ok ? '✓ PASS' : '✗ FAIL'} | ${g.detail} |`),
        ``,
        `## P3 Active-Scoring Corpus`,
        `| Field | Value |`,
        `|-------|-------|`,
        `| Lines | ${p3Lines.length} |`,
        `| Unique symbols | ${p3Symbols.size} |`,
        `| Unique asOfDates | ${p3Dates.size} |`,
        `| COMPLETE | ${p3Complete} |`,
        `| PARTIAL | ${p3Partial} |`,
        `| EMPTY | ${p3Empty} |`,
        `| Usable ratio | ${(parseFloat(artifact.p3Stats.usableRatio) * 100).toFixed(1)}% |`,
        `| Non-zero score | ${p3NonZeroScore} |`,
        `| Unique buckets | ${p3UniqueBuckets.join(', ')} |`,
        `| PIT violations | ${p3PitViolations} |`,
        ``,
        `## P1 Baseline Corpus`,
        `| Field | Value |`,
        `|-------|-------|`,
        `| Lines | ${p1Lines.length} |`,
        `| Baseline types | ${[...p1BTypes].join(', ')} |`,
        ``,
        ...(failedGates.length > 0 ? [
            `## Failed Gates`,
            ...failedGates.map(g => `- **${g.name}**: ${g.detail}`),
        ] : []),
        ``,
        `---`,
        `*Not investment advice. Not a trading system.*`,
    ].join('\n');

    fs.writeFileSync(path.join(OUT_DIR, 'p4calibration_preflight_audit.md'), md);

    console.log(`\n${classification}: ${passed}/${gates.length} PASS`);
    if (failedGates.length > 0) {
        console.error('\nFAILED GATES:');
        for (const g of failedGates) console.error(`  FAIL: ${g.name} — ${g.detail}`);
        process.exit(1);
    }
    console.log('  → outputs/online_validation/p4calibration_preflight_audit.json');
    console.log('  → outputs/online_validation/p4calibration_preflight_audit.md');
}

run();
