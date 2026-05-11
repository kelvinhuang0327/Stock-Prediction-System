#!/usr/bin/env node
/**
 * inspect-p3active-scoring-corpus-fields.js — P3-HARDRESET PART E
 *
 * Inspects field coverage in the P3 active scoring corpus. Produces a
 * structured JSON report and a human-readable Markdown summary.
 *
 * Outputs:
 *   outputs/online_validation/p3active_scoring_field_inspection.json
 *   outputs/online_validation/p3active_scoring_field_inspection.md
 *
 * SAFETY CONTRACT: Read-only. No DB writes. No corpus modification.
 *
 * Usage:
 *   node scripts/inspect-p3active-scoring-corpus-fields.js
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');

// ─── Config ────────────────────────────────────────────────────────────────

const OUTPUT_DIR = path.join(process.cwd(), 'outputs', 'online_validation');
const P3_CORPUS = path.join(OUTPUT_DIR, 'p3active_scoring_historical_replay_corpus.jsonl');
const INSPECTION_JSON = path.join(OUTPUT_DIR, 'p3active_scoring_field_inspection.json');
const INSPECTION_MD = path.join(OUTPUT_DIR, 'p3active_scoring_field_inspection.md');

// ─── Main ──────────────────────────────────────────────────────────────────

function main() {
    console.log('=== P3-HARDRESET PART E: P3 Active Scoring Corpus Field Inspection ===\n');

    if (!fs.existsSync(P3_CORPUS)) {
        console.error(`[PART E] FAIL: P3 corpus not found at ${P3_CORPUS}`);
        console.error('Run generate-p3active-scoring-historical-replay-corpus.js first.');
        process.exit(1);
    }

    const raw = fs.readFileSync(P3_CORPUS, 'utf8').trim();
    const lines = raw.split('\n').filter(l => l.trim().length > 0);
    console.log(`[PART E] Corpus loaded: ${lines.length} lines`);

    // Parse all lines
    const entries = [];
    const parseErrors = [];
    for (let i = 0; i < lines.length; i++) {
        try {
            entries.push(JSON.parse(lines[i]));
        } catch (err) {
            parseErrors.push({ line: i + 1, error: err.message });
        }
    }

    if (parseErrors.length > 0) {
        console.error(`[PART E] WARNING: ${parseErrors.length} JSON parse errors`);
    }

    const total = entries.length;

    // ── Core fields ──────────────────────────────────────────────────────
    const fieldPresence = computeFieldPresence(entries, [
        'duplicateKey',
        'symbol',
        'originalAsOfDate',
        'createdAt',
        'researchBucket',
        'scoreSnapshot',
        'entryPriceSource',
        'closePriceAtPrediction',
        'outcomeSnapshot',
        'validationMessages',
        'scoringCompletenessStatus',
        'activeScoringSnapshot',
    ]);

    // ── Bucket distribution ──────────────────────────────────────────────
    const bucketDist = computeDist(entries, e => e.researchBucket ?? '__missing__');

    // ── Scoring completeness distribution ────────────────────────────────
    const completenessDistribution = computeDist(entries, e => e.scoringCompletenessStatus ?? '__missing__');

    // ── researchScore distribution ───────────────────────────────────────
    const scoreStats = computeNumericStats(entries, e => e.scoreSnapshot?.researchScore);

    // ── Non-zero score coverage ──────────────────────────────────────────
    const nonZeroScore = entries.filter(e => typeof e.scoreSnapshot?.researchScore === 'number' && e.scoreSnapshot.researchScore > 0).length;

    // ── Score distribution buckets ────────────────────────────────────────
    const scoreBuckets = { '0': 0, '1-25': 0, '26-50': 0, '51-75': 0, '76-100': 0 };
    for (const e of entries) {
        const s = e.scoreSnapshot?.researchScore ?? 0;
        if (s === 0) scoreBuckets['0']++;
        else if (s <= 25) scoreBuckets['1-25']++;
        else if (s <= 50) scoreBuckets['26-50']++;
        else if (s <= 75) scoreBuckets['51-75']++;
        else scoreBuckets['76-100']++;
    }

    // ── activeScoringSnapshot sub-fields ────────────────────────────────
    const withSnapshot = entries.filter(e => e.activeScoringSnapshot != null);
    const snapshotFieldPresence = computeFieldPresence(withSnapshot, [
        'builderVersion',
        'scoringMode',
        'scoringEngineSource',
        'researchBucket',
        'alphaScore',
        'scoreSnapshot',
        'signalSnapshot',
        'factorSnapshot',
        'reasonSnapshot',
        'limitations',
        'dataCoverage',
        'dataPoints',
        'usedSources',
        'missingSources',
        'pitGateDate',
        'scoringAvailable',
        'completenessStatus',
        'scoringNote',
    ], e => e.activeScoringSnapshot);

    // Snapshot completeness status distribution
    const snapshotComplDist = computeDist(withSnapshot, e => e.activeScoringSnapshot?.completenessStatus ?? '__missing__');

    // Non-zero alphaScore in snapshot
    const nonZeroAlpha = withSnapshot.filter(
        e => typeof e.activeScoringSnapshot?.alphaScore === 'number' && e.activeScoringSnapshot.alphaScore > 0
    ).length;

    // scoreSnapshot sub-fields non-zero coverage
    const withScoreSnap = entries.filter(e => e.activeScoringSnapshot?.scoreSnapshot != null);
    const scoreSnapStats = {
        researchScore: computeNumericStats(withScoreSnap, e => e.activeScoringSnapshot.scoreSnapshot.researchScore),
        confidenceScore: computeNumericStats(withScoreSnap, e => e.activeScoringSnapshot.scoreSnapshot.confidenceScore),
        technicalScore: computeNumericStats(withScoreSnap, e => e.activeScoringSnapshot.scoreSnapshot.technicalScore),
        chipScore: computeNumericStats(withScoreSnap, e => e.activeScoringSnapshot.scoreSnapshot.chipScore),
        fundamentalScore: computeNumericStats(withScoreSnap, e => e.activeScoringSnapshot.scoreSnapshot.fundamentalScore),
        marketAdjustment: computeNumericStats(withScoreSnap, e => e.activeScoringSnapshot.scoreSnapshot.marketAdjustment),
    };

    // ── factorSnapshot coverage ──────────────────────────────────────────
    // factorSnapshot is an array of strings in the corpus
    const withFactors = entries.filter(
        e => Array.isArray(e.activeScoringSnapshot?.factorSnapshot) && e.activeScoringSnapshot.factorSnapshot.length > 0
    );
    const factorCounts = withFactors.map(e => e.activeScoringSnapshot.factorSnapshot.length);
    const factorStats = computeArrayStats(factorCounts);

    // ── signalSnapshot coverage ──────────────────────────────────────────
    // signalSnapshot is an array of strings in the corpus
    const withSignals = entries.filter(
        e => Array.isArray(e.activeScoringSnapshot?.signalSnapshot) && e.activeScoringSnapshot.signalSnapshot.length > 0
    );
    // Count unique signal labels
    const signalTypes = {};
    for (const e of withSignals) {
        for (const sig of e.activeScoringSnapshot.signalSnapshot) {
            signalTypes[sig] = (signalTypes[sig] ?? 0) + 1;
        }
    }

    // ── reasonSnapshot coverage ──────────────────────────────────────────
    // reasonSnapshot is a string in the corpus
    const withReasons = entries.filter(
        e => typeof e.activeScoringSnapshot?.reasonSnapshot === 'string' && e.activeScoringSnapshot.reasonSnapshot.length > 0
    );
    const reasonTypes = {};
    for (const e of withReasons) {
        const r = e.activeScoringSnapshot.reasonSnapshot;
        reasonTypes[r] = (reasonTypes[r] ?? 0) + 1;
    }

    // ── Outcome price source distribution ───────────────────────────────
    const outcomeDist = computeDist(entries, e => e.outcomeSnapshot?.priceSource ?? '__missing__');

    // ── returnPct coverage ───────────────────────────────────────────────
    const withReturnPct = entries.filter(
        e => typeof e.outcomeSnapshot?.returnPct === 'number'
    );
    const returnPctStats = computeNumericStats(withReturnPct, e => e.outcomeSnapshot.returnPct);

    // ── horizon distribution ────────────────────────────────────────────
    const horizonDist = computeDist(entries, e => String(e.outcomeSnapshot?.horizonDays ?? '__missing__'));

    // ── unique symbols / dates ───────────────────────────────────────────
    const uniqueSymbols = new Set(entries.map(e => e.symbol)).size;
    const uniqueDates = new Set(entries.map(e => e.originalAsOfDate)).size;

    // ── Forbidden field checks ───────────────────────────────────────────
    const FORBIDDEN = ['alphaScore', 'recommendationBucket', 'buy', 'sell', 'roi', 'win_rate', 'outperform', 'guaranteed'];
    const forbiddenHits = {};
    for (const key of FORBIDDEN) {
        const count = entries.filter(e => key in e).length;
        if (count > 0) forbiddenHits[key] = count;
    }

    // ── duplicateKey format check ─────────────────────────────────────
    const malformedDuplicateKey = entries.filter(e => {
        if (!e.duplicateKey) return true;
        const parts = e.duplicateKey.split('|');
        return parts.length !== 3;
    }).length;

    // ── createdAt format check ────────────────────────────────────────
    const malformedCreatedAt = entries.filter(e => {
        if (!e.createdAt) return true;
        return !e.createdAt.endsWith('T00:00:00.000Z');
    }).length;

    // ── PIT gate check ────────────────────────────────────────────────
    const pitViolations = entries.filter(e => {
        const snap = e.activeScoringSnapshot;
        if (!snap) return false;
        return snap.pitGateDate !== e.originalAsOfDate;
    }).length;

    // ── Build report ────────────────────────────────────────────────────
    const report = {
        meta: {
            generatedAt: new Date().toISOString(),
            corpusPath: P3_CORPUS,
            totalLines: total,
            parseErrors: parseErrors.length,
            uniqueSymbols,
            uniqueAsOfDates: uniqueDates,
        },
        fieldPresence,
        bucketDistribution: bucketDist,
        completenessDistribution,
        scoreDistribution: {
            stats: scoreStats,
            nonZeroCount: nonZeroScore,
            nonZeroRatio: total > 0 ? nonZeroScore / total : 0,
            buckets: scoreBuckets,
        },
        activeScoringSnapshot: {
            presentCount: withSnapshot.length,
            presentRatio: total > 0 ? withSnapshot.length / total : 0,
            subFieldPresence: snapshotFieldPresence,
            completenessDistribution: snapshotComplDist,
            nonZeroAlphaScore: nonZeroAlpha,
            nonZeroAlphaRatio: withSnapshot.length > 0 ? nonZeroAlpha / withSnapshot.length : 0,
            scoreSnapshotCoverage: {
                presentCount: withScoreSnap.length,
                fieldStats: scoreSnapStats,
            },
            factorSnapshotCoverage: {
                presentCount: withFactors.length,
                presentRatio: total > 0 ? withFactors.length / total : 0,
                factorCountStats: factorStats,
            },
            signalSnapshotCoverage: {
                presentCount: withSignals.length,
                fieldKeys: signalTypes,
            },
            reasonSnapshotCoverage: {
                presentCount: withReasons.length,
                fieldKeys: reasonTypes,
            },
        },
        outcomeDistribution: {
            priceSource: outcomeDist,
            withReturnPct: withReturnPct.length,
            returnPctStats,
        },
        horizonDistribution: horizonDist,
        invariantChecks: {
            forbiddenFields: Object.keys(forbiddenHits).length === 0 ? 'PASS' : 'FAIL',
            forbiddenFieldHits: forbiddenHits,
            malformedDuplicateKey,
            malformedCreatedAt,
            pitViolations,
        },
    };

    // Write JSON
    fs.writeFileSync(INSPECTION_JSON, JSON.stringify(report, null, 2), 'utf8');
    console.log(`[PART E] Inspection JSON written: ${INSPECTION_JSON}`);

    // Write MD
    const md = buildMarkdown(report);
    fs.writeFileSync(INSPECTION_MD, md, 'utf8');
    console.log(`[PART E] Inspection MD written: ${INSPECTION_MD}`);

    // Print summary
    console.log('\n=== P3 PART E Summary ===');
    console.log(`  Total corpus lines:          ${total}`);
    console.log(`  Unique symbols:              ${uniqueSymbols}`);
    console.log(`  Unique asOfDates:            ${uniqueDates}`);
    console.log(`  Parse errors:                ${parseErrors.length}`);
    console.log(`  Non-zero scoreSnapshot.researchScore: ${nonZeroScore}/${total} (${(nonZeroScore / total * 100).toFixed(1)}%)`);
    console.log(`  COMPLETE completeness:       ${completenessDistribution['COMPLETE'] ?? 0}`);
    console.log(`  PARTIAL completeness:        ${completenessDistribution['PARTIAL'] ?? 0}`);
    console.log(`  EMPTY completeness:          ${completenessDistribution['EMPTY'] ?? 0}`);
    console.log(`  activeScoringSnapshot pres:  ${withSnapshot.length}/${total} (${(withSnapshot.length / total * 100).toFixed(1)}%)`);
    console.log(`  factorSnapshot (non-empty):  ${withFactors.length}/${total} (${(withFactors.length / total * 100).toFixed(1)}%)`);
    console.log(`  signalSnapshot (non-empty):  ${withSignals.length}/${total} (${(withSignals.length / total * 100).toFixed(1)}%)`);
    console.log(`  reasonSnapshot (non-empty):  ${withReasons.length}/${total} (${(withReasons.length / total * 100).toFixed(1)}%)`);
    console.log(`  stockQuote.close outcomes:   ${outcomeDist['stockQuote.close'] ?? 0}`);
    console.log(`  forbiddenFields:             ${report.invariantChecks.forbiddenFields}`);
    console.log(`  malformedDuplicateKey:       ${malformedDuplicateKey}`);
    console.log(`  malformedCreatedAt:          ${malformedCreatedAt}`);
    console.log(`  pitViolations:               ${pitViolations}`);

    const allClear = parseErrors.length === 0
        && report.invariantChecks.forbiddenFields === 'PASS'
        && malformedDuplicateKey === 0
        && malformedCreatedAt === 0
        && pitViolations === 0;

    if (allClear) {
        console.log('\n[PART E] RESULT: PASS — all invariant checks clear');
        process.exit(0);
    } else {
        console.log('\n[PART E] RESULT: FAIL — invariant check failures above');
        process.exit(1);
    }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function computeFieldPresence(entries, fields, accessor) {
    const result = {};
    for (const field of fields) {
        const count = entries.filter(e => {
            const obj = accessor ? accessor(e) : e;
            return obj != null && field in obj && obj[field] != null;
        }).length;
        result[field] = { count, ratio: entries.length > 0 ? count / entries.length : 0 };
    }
    return result;
}

function computeDist(entries, keyFn) {
    const dist = {};
    for (const e of entries) {
        const k = keyFn(e);
        dist[k] = (dist[k] ?? 0) + 1;
    }
    return dist;
}

function computeNumericStats(entries, valueFn) {
    const values = entries
        .map(e => valueFn(e))
        .filter(v => typeof v === 'number' && !isNaN(v));
    if (values.length === 0) return { count: 0, min: null, max: null, mean: null, nonZeroCount: 0 };
    const sum = values.reduce((a, b) => a + b, 0);
    return {
        count: values.length,
        min: Math.min(...values),
        max: Math.max(...values),
        mean: sum / values.length,
        nonZeroCount: values.filter(v => v > 0).length,
    };
}

function computeArrayStats(arr) {
    if (arr.length === 0) return { count: 0, min: null, max: null, mean: null };
    const sum = arr.reduce((a, b) => a + b, 0);
    return {
        count: arr.length,
        min: Math.min(...arr),
        max: Math.max(...arr),
        mean: sum / arr.length,
    };
}

function buildMarkdown(r) {
    const pct = (n, d) => d > 0 ? `${(n / d * 100).toFixed(1)}%` : '0%';
    const total = r.meta.totalLines;
    const snap = r.activeScoringSnapshot;

    const bucketRows = Object.entries(r.bucketDistribution)
        .map(([k, v]) => `| ${k} | ${v} | ${pct(v, total)} |`)
        .join('\n');

    const complRows = Object.entries(r.completenessDistribution)
        .map(([k, v]) => `| ${k} | ${v} | ${pct(v, total)} |`)
        .join('\n');

    const fieldRows = Object.entries(r.fieldPresence)
        .map(([k, v]) => `| \`${k}\` | ${v.count} | ${pct(v.count, total)} |`)
        .join('\n');

    const snapshotRows = Object.entries(snap.subFieldPresence)
        .map(([k, v]) => `| \`${k}\` | ${v.count} | ${pct(v.count, snap.presentCount)} |`)
        .join('\n');

    const scoreSnapRows = Object.entries(r.activeScoringSnapshot.scoreSnapshotCoverage.fieldStats)
        .map(([k, v]) => `| \`${k}\` | ${v.min?.toFixed(1) ?? '-'} | ${v.max?.toFixed(1) ?? '-'} | ${v.mean?.toFixed(1) ?? '-'} | ${v.nonZeroCount} |`)
        .join('\n');

    const outcomeRows = Object.entries(r.outcomeDistribution.priceSource)
        .map(([k, v]) => `| ${k} | ${v} | ${pct(v, total)} |`)
        .join('\n');

    const horizonRows = Object.entries(r.horizonDistribution)
        .map(([k, v]) => `| ${k} | ${v} |`)
        .join('\n');

    const invResult = r.invariantChecks.forbiddenFields === 'PASS'
        && r.invariantChecks.malformedDuplicateKey === 0
        && r.invariantChecks.malformedCreatedAt === 0
        && r.invariantChecks.pitViolations === 0
        ? 'PASS' : 'FAIL';

    return [
        '# P3-HARDRESET Active Scoring Corpus — Field Inspection',
        '',
        `Generated: ${r.meta.generatedAt}`,
        `Corpus: \`${path.basename(r.meta.corpusPath)}\``,
        `Invariant checks: **${invResult}**`,
        '',
        '## Corpus Meta',
        '',
        '| Field | Value |',
        '|-------|-------|',
        `| Total lines | ${total} |`,
        `| Unique symbols | ${r.meta.uniqueSymbols} |`,
        `| Unique asOfDates | ${r.meta.uniqueAsOfDates} |`,
        `| Parse errors | ${r.meta.parseErrors} |`,
        '',
        '## Research Bucket Distribution',
        '',
        '| Bucket | Count | % |',
        '|--------|-------|---|',
        bucketRows,
        '',
        '## Scoring Completeness Distribution',
        '',
        '| Status | Count | % |',
        '|--------|-------|---|',
        complRows,
        '',
        '## researchScore Coverage',
        '',
        `- Non-zero: **${r.scoreDistribution.nonZeroCount}/${total}** (${pct(r.scoreDistribution.nonZeroCount, total)})`,
        `- Min: ${r.scoreDistribution.stats.min?.toFixed(1) ?? '-'}`,
        `- Max: ${r.scoreDistribution.stats.max?.toFixed(1) ?? '-'}`,
        `- Mean: ${r.scoreDistribution.stats.mean?.toFixed(1) ?? '-'}`,
        '',
        '| Range | Count |',
        '|-------|-------|',
        ...Object.entries(r.scoreDistribution.buckets).map(([k, v]) => `| ${k} | ${v} |`),
        '',
        '## Core Field Presence',
        '',
        '| Field | Count | Coverage |',
        '|-------|-------|----------|',
        fieldRows,
        '',
        '## activeScoringSnapshot Coverage',
        '',
        `Present on: **${snap.presentCount}/${total}** (${pct(snap.presentCount, total)})`,
        `Non-zero alphaScore: **${snap.nonZeroAlphaScore}** (${pct(snap.nonZeroAlphaScore, snap.presentCount)} of snapshots)`,
        '',
        '### Snapshot Sub-field Presence',
        '',
        '| Field | Count | Coverage (of snapshots) |',
        '|-------|-------|--------------------------|',
        snapshotRows,
        '',
        '### scoreSnapshot Field Stats',
        '',
        '| Field | Min | Max | Mean | Non-zero |',
        '|-------|-----|-----|------|----------|',
        scoreSnapRows,
        '',
        `### factorSnapshot: ${snap.factorSnapshotCoverage.presentCount}/${total} entries have factors (${pct(snap.factorSnapshotCoverage.presentCount, total)})`,
        '',
        `- Min factors per entry: ${snap.factorSnapshotCoverage.factorCountStats.min ?? '-'}`,
        `- Max factors per entry: ${snap.factorSnapshotCoverage.factorCountStats.max ?? '-'}`,
        `- Mean factors per entry: ${snap.factorSnapshotCoverage.factorCountStats.mean?.toFixed(1) ?? '-'}`,
        '',
        `### signalSnapshot: ${snap.signalSnapshotCoverage.presentCount}/${total} entries`,
        '',
        Object.entries(snap.signalSnapshotCoverage.fieldKeys).length > 0
            ? Object.entries(snap.signalSnapshotCoverage.fieldKeys).map(([k, v]) => `- \`${k}\`: ${v}`).join('\n')
            : '*(none)*',
        '',
        `### reasonSnapshot: ${snap.reasonSnapshotCoverage.presentCount}/${total} entries`,
        '',
        Object.entries(snap.reasonSnapshotCoverage.fieldKeys).length > 0
            ? Object.entries(snap.reasonSnapshotCoverage.fieldKeys).map(([k, v]) => `- \`${k}\`: ${v}`).join('\n')
            : '*(none)*',
        '',
        '## Outcome Distribution',
        '',
        '| priceSource | Count | % |',
        '|-------------|-------|---|',
        outcomeRows,
        '',
        `returnPct coverage: ${r.outcomeDistribution.withReturnPct}/${total}`,
        '',
        '## Horizon Distribution',
        '',
        '| Horizon | Count |',
        '|---------|-------|',
        horizonRows,
        '',
        '## Invariant Checks',
        '',
        `| Check | Result |`,
        `|-------|--------|`,
        `| forbiddenFields | ${r.invariantChecks.forbiddenFields} |`,
        `| malformedDuplicateKey | ${r.invariantChecks.malformedDuplicateKey === 0 ? 'PASS (0)' : `FAIL (${r.invariantChecks.malformedDuplicateKey})`} |`,
        `| malformedCreatedAt | ${r.invariantChecks.malformedCreatedAt === 0 ? 'PASS (0)' : `FAIL (${r.invariantChecks.malformedCreatedAt})`} |`,
        `| pitViolations | ${r.invariantChecks.pitViolations === 0 ? 'PASS (0)' : `FAIL (${r.invariantChecks.pitViolations})`} |`,
        '',
        `**Overall: ${invResult}**`,
        '',
        '---',
        '*P3-HARDRESET PART E — Not investment advice.*',
    ].join('\n');
}

main();
