'use strict';
/**
 * decide-p4-calibration-readiness.js — P4-HARDRESET PART E
 *
 * Readiness decision gate. Reads p4calibration_full_audit.json and
 * p4calibration_walkthrough_cases.json to classify P4 readiness.
 *
 * Classifications:
 *   P4_FULL_CALIBRATION_AUDIT_COMPLETE          — all gates pass
 *   P4_READY_FOR_MANUAL_WALKTHROUGH             — audit done, minor gaps only
 *   P4_REQUIRES_SCORE_DISTRIBUTION_FIX          — decile distribution anomaly
 *   P4_REQUIRES_BUCKET_SCHEMA_FIX               — bucket schema incomplete
 *   P4_REQUIRES_CORPUS_EXPANSION                — corpus too small
 *   P4_CALIBRATION_BLOCKED                      — blocking structural issues
 *
 * Safety: read-only. No DB write. No external API call.
 * Not investment advice. Not a trading system.
 */

const fs = require('fs');

const OUT_DIR = 'outputs/online_validation';

function loadJson(p) {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function gate(ok, name, detail) {
    return { name, ok: Boolean(ok), detail: ok ? 'PASS' : String(detail) };
}

function run() {
    const start = Date.now();

    // ── Load artifacts ────────────────────────────────────────────────────
    const auditPath = `${OUT_DIR}/p4calibration_full_audit.json`;
    const walkthroughPath = `${OUT_DIR}/p4calibration_walkthrough_cases.json`;
    const preflightPath = `${OUT_DIR}/p4calibration_preflight_audit.json`;

    if (!fs.existsSync(auditPath)) {
        console.error('[P4-E] BLOCKED: p4calibration_full_audit.json not found. Run PART C first.');
        process.exit(1);
    }
    if (!fs.existsSync(walkthroughPath)) {
        console.error('[P4-E] BLOCKED: p4calibration_walkthrough_cases.json not found. Run PART D first.');
        process.exit(1);
    }

    const audit = loadJson(auditPath);
    const walkthrough = loadJson(walkthroughPath);
    const preflight = fs.existsSync(preflightPath) ? loadJson(preflightPath) : null;

    const gates = [];
    const issues = [];

    // ── E.1 Pre-flight pass ───────────────────────────────────────────────
    if (preflight) {
        gates.push(gate(
            preflight.classification === 'P4_PREFLIGHT_PASS',
            'PREFLIGHT_PASS',
            `Preflight: ${preflight.classification}`,
        ));
    }

    // ── E.2 Corpus size ───────────────────────────────────────────────────
    gates.push(gate(audit.p3CorpusLines >= 4500, 'P3_LINES_OK', `Got ${audit.p3CorpusLines}`));
    gates.push(gate(audit.p1BaselineLines >= 9900, 'P1_LINES_OK', `Got ${audit.p1BaselineLines}`));
    gates.push(gate(audit.corpusSummary.uniqueSymbols >= 25, 'SYMBOLS_OK', `Got ${audit.corpusSummary.uniqueSymbols}`));

    // ── E.3 Score distribution ────────────────────────────────────────────
    // Check that decile metadata has at least 5 unique scores per horizon
    const decileMeta = audit.scoreDecileMeta ?? [];
    for (const meta of decileMeta) {
        const ok = meta.uniqueScoreCount >= 5;
        gates.push(gate(ok,
            `DECILE_UNIQUE_SCORES_HZ${meta.horizonDays}`,
            `uniqueScoreCount=${meta.uniqueScoreCount} (need ≥5)`,
        ));
        if (!ok) issues.push('score-distribution-too-few-unique');
    }

    // Score decile spread: check at least 5 distinct deciles populated per horizon
    const horizons = [5, 20, 60];
    for (const hz of horizons) {
        const decileStats = (audit.byScoreDecile ?? []).filter(d => d.horizonDays === hz);
        const distinctDeciles = new Set(decileStats.map(d => d.decile)).size;
        gates.push(gate(
            distinctDeciles >= 5,
            `DECILE_SPREAD_HZ${hz}`,
            `${distinctDeciles} distinct deciles populated (need ≥5)`,
        ));
        if (distinctDeciles < 5) issues.push('score-distribution-low-spread');
    }

    // ── E.4 Bucket schema ─────────────────────────────────────────────────
    // Known valid buckets. InsufficientData is valid but may be absent when
    // all corpus symbols have enough data — that is NOT a schema error.
    const knownBuckets = new Set(['Strong', 'Watch', 'Neutral', 'LowPriority', 'InsufficientData']);
    const foundBuckets = new Set((audit.corpusSummary?.uniqueBuckets ?? []));
    const unknownBuckets = [...foundBuckets].filter(b => !knownBuckets.has(b));
    const missingCritical = ['Strong', 'Watch', 'Neutral', 'LowPriority'].filter(b => !foundBuckets.has(b));
    gates.push(gate(
        unknownBuckets.length === 0,
        'NO_UNKNOWN_BUCKETS',
        `Unknown buckets in corpus: ${unknownBuckets.join(', ') || 'none'}`,
    ));
    gates.push(gate(
        missingCritical.length === 0,
        'CRITICAL_BUCKETS_PRESENT',
        `Missing critical buckets: ${missingCritical.join(', ') || 'none'}`,
    ));
    if (unknownBuckets.length > 0 || missingCritical.length > 0) issues.push('bucket-schema-incomplete');

    // Check each horizon has at least 3 distinct buckets in byBucket
    for (const hz of horizons) {
        const bucketsInHz = new Set((audit.byBucket ?? []).filter(b => b.horizonDays === hz).map(b => b.researchBucket)).size;
        gates.push(gate(
            bucketsInHz >= 3,
            `BUCKET_VARIETY_HZ${hz}`,
            `${bucketsInHz} distinct buckets in horizon ${hz}d (need ≥3)`,
        ));
    }

    // ── E.5 Walkthrough completeness ─────────────────────────────────────
    const wv = walkthrough.validation ?? {};
    gates.push(gate(walkthrough.totalCases >= 30, 'WALKTHROUGH_MIN_CASES_30', `Got ${walkthrough.totalCases}`));

    for (const hz of horizons) {
        const n = wv.perHorizon?.[hz] ?? 0;
        gates.push(gate(n >= 12, `WALKTHROUGH_HZ${hz}_MIN_12`, `Got ${n}`));
    }

    const mandatoryLabels = ['high-score-negative', 'low-score-positive', 'high-score-positive', 'neutral-or-insufficient', 'completeness-COMPLETE', 'completeness-PARTIAL'];
    for (const lbl of mandatoryLabels) {
        const n = wv.mandatoryScenariosFound?.[lbl] ?? 0;
        gates.push(gate(n >= 1, `WALKTHROUGH_SCENARIO_${lbl.toUpperCase().replace(/-/g, '_')}`, `Found ${n}`));
    }

    // ── E.6 Usable ratio ──────────────────────────────────────────────────
    const usableRatio = parseFloat(audit.corpusSummary?.usableRatio ?? '0');
    gates.push(gate(usableRatio >= 0.5, 'USABLE_RATIO_GE_50PCT', `${(usableRatio * 100).toFixed(1)}%`));
    if (usableRatio < 0.5) issues.push('corpus-usable-ratio-low');

    // ── E.7 predictionVsBaseline horizons present ─────────────────────────
    const pvbHorizons = (audit.predictionVsBaseline?.horizons ?? []).map(h => h.horizonDays);
    for (const hz of horizons) {
        gates.push(gate(pvbHorizons.includes(hz), `BASELINE_COMPARISON_HZ${hz}`, `Horizons found: ${pvbHorizons.join(',')}`));
    }

    // ── Determine classification ──────────────────────────────────────────
    const passed = gates.filter(g => g.ok).length;
    const failed = gates.filter(g => !g.ok).length;

    const uniqueIssues = [...new Set(issues)];
    let classification;

    if (failed === 0) {
        classification = 'P4_FULL_CALIBRATION_AUDIT_COMPLETE';
    } else if (uniqueIssues.includes('corpus-usable-ratio-low') || audit.p3CorpusLines < 4500) {
        classification = 'P4_REQUIRES_CORPUS_EXPANSION';
    } else if (uniqueIssues.includes('score-distribution-too-few-unique') || uniqueIssues.includes('score-distribution-low-spread')) {
        classification = 'P4_REQUIRES_SCORE_DISTRIBUTION_FIX';
    } else if (uniqueIssues.includes('bucket-schema-incomplete')) {
        classification = 'P4_REQUIRES_BUCKET_SCHEMA_FIX';
    } else if (failed > 0 && failed <= 5) {
        classification = 'P4_READY_FOR_MANUAL_WALKTHROUGH';
    } else {
        classification = 'P4_CALIBRATION_BLOCKED';
    }

    const artifact = {
        auditVersion: 'p4hardreset-readiness-v1',
        runDate: new Date().toISOString().slice(0, 10),
        classification,
        passed,
        failed,
        total: gates.length,
        gates,
        issues: uniqueIssues,
        auditRef: 'p4calibration_full_audit.json',
        walkthroughRef: 'p4calibration_walkthrough_cases.json',
        durationMs: Date.now() - start,
        note: 'Not investment advice. Not a trading system.',
    };

    fs.mkdirSync(OUT_DIR, { recursive: true });
    fs.writeFileSync(
        `${OUT_DIR}/p4calibration_readiness_decision.json`,
        JSON.stringify(artifact, null, 2),
    );

    const md = buildMarkdown(artifact);
    fs.writeFileSync(`${OUT_DIR}/p4calibration_readiness_decision.md`, md);

    console.log(`\n[P4-E] ${classification}: ${passed}/${gates.length} PASS`);
    if (failed > 0) {
        const failedGates = gates.filter(g => !g.ok);
        console.error('\nFailed gates:');
        for (const g of failedGates) console.error(`  FAIL: ${g.name} — ${g.detail}`);
    }
    console.log(`  → ${OUT_DIR}/p4calibration_readiness_decision.json`);
    console.log(`  → ${OUT_DIR}/p4calibration_readiness_decision.md`);
}

function buildMarkdown(artifact) {
    return [
        `# P4 Calibration Readiness Decision`,
        ``,
        `**Classification**: \`${artifact.classification}\``,
        `**Date**: ${artifact.runDate}  **Gates**: ${artifact.passed}/${artifact.total} PASS`,
        ``,
        `## Gate Results`,
        `| Gate | Result | Detail |`,
        `|------|--------|--------|`,
        ...artifact.gates.map(g => `| ${g.name} | ${g.ok ? '✓ PASS' : '✗ FAIL'} | ${g.detail} |`),
        ``,
        ...(artifact.issues.length > 0 ? [`## Issues Detected`, ...artifact.issues.map(i => `- \`${i}\``), ``] : []),
        `## Classification`,
        ``,
        `\`${artifact.classification}\``,
        ``,
        `| Classification | Meaning |`,
        `|----------------|---------|`,
        `| P4_FULL_CALIBRATION_AUDIT_COMPLETE | All gates pass, corpus and statistics complete |`,
        `| P4_READY_FOR_MANUAL_WALKTHROUGH | Minor gaps only (≤5 failed gates) |`,
        `| P4_REQUIRES_SCORE_DISTRIBUTION_FIX | Score decile spread or unique-score count too low |`,
        `| P4_REQUIRES_BUCKET_SCHEMA_FIX | Expected buckets missing from corpus |`,
        `| P4_REQUIRES_CORPUS_EXPANSION | Usable ratio <50% or corpus lines <4500 |`,
        `| P4_CALIBRATION_BLOCKED | Multiple structural issues |`,
        ``,
        `---`,
        `*Not investment advice. Not a trading system.*`,
    ].join('\n');
}

run();
