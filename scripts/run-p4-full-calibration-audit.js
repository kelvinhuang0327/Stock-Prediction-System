'use strict';
/**
 * run-p4-full-calibration-audit.js — P4-HARDRESET PART C
 *
 * Full bucket × score-decile calibration audit.
 * Reads P3 active-scoring corpus + P1 baseline corpus.
 * Produces descriptive statistics only — no performance claims.
 *
 * Safety: read-only. No DB write. No external API call.
 * Not investment advice. Not a trading system.
 */

// ── ts-node bootstrap ─────────────────────────────────────────────────────
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
require('ts-node').register({
    transpileOnly: true,
    compilerOptions: { module: 'commonjs', moduleResolution: 'node', esModuleInterop: true },
});
require('tsconfig-paths').register({
    baseUrl: ROOT,
    paths: require(path.join(ROOT, 'tsconfig.json')).compilerOptions?.paths ?? {},
});
// ─────────────────────────────────────────────────────────────────────────────

const fs = require('fs');
const {
    buildBucketReturnStats,
    buildScoreDecileStats,
    buildCompletenessReturnStats,
    buildBucketConfusionMatrix,
    buildScoreDecileConfusionMatrix,
    comparePredictionToBaseline,
    computeDescriptiveStats,
    scanForbiddenClaims,
} = require('../src/lib/onlineValidation/P4CalibrationAuditUtils');

const OUT_DIR = 'outputs/online_validation';

const LIMITATIONS = [
    'All statistics are descriptive only. No causal claims implied.',
    'Return data covers a specific historical window and may not reflect current market conditions.',
    'Score decile assignment uses unique-score percentile mapping; buckets with many tied scores show low unique-score count.',
    'PARTIAL/EMPTY corpus rows may have incomplete signal coverage, affecting bucket/score distributions.',
    'Baseline corpus (P1) uses deterministic random seed and may not capture all market scenarios.',
    'Not investment advice. Not a trading system. Not for production use.',
];

function loadCorpus(filePath) {
    return fs.readFileSync(filePath, 'utf8').trim().split('\n').map(l => JSON.parse(l));
}

function buildOverallStats(p3Lines) {
    const horizons = [...new Set(p3Lines.map(l => l.outcomeSnapshot.horizonDays))].sort((a, b) => a - b);
    const byHorizon = {};
    for (const hz of horizons) {
        const hzRows = p3Lines.filter(l => l.outcomeSnapshot.horizonDays === hz);
        byHorizon[hz] = {
            ...computeDescriptiveStats(hzRows.map(r => r.outcomeSnapshot.returnPct)),
            lines: hzRows.length,
            uniqueSymbols: new Set(hzRows.map(r => r.symbol)).size,
        };
    }
    return byHorizon;
}

function run() {
    const startMs = Date.now();
    console.log('[P4-C] Loading corpora...');

    const p3Lines = loadCorpus('outputs/online_validation/p3active_scoring_historical_replay_corpus.jsonl');
    const p1Lines = loadCorpus('outputs/online_validation/p1baseline_historical_replay_corpus.jsonl');

    console.log(`  P3: ${p3Lines.length} lines`);
    console.log(`  P1: ${p1Lines.length} lines`);

    // ── C.1 Overall stats by horizon ─────────────────────────────────────
    console.log('[P4-C] C.1 Overall descriptive stats...');
    const byHorizon = buildOverallStats(p3Lines);

    // ── C.2 Bucket calibration ───────────────────────────────────────────
    console.log('[P4-C] C.2 Bucket calibration...');
    const byBucket = buildBucketReturnStats(p3Lines);

    // ── C.3 Score decile calibration ─────────────────────────────────────
    console.log('[P4-C] C.3 Score decile calibration...');
    const { stats: byScoreDecile, metadata: scoreDecileMeta } = buildScoreDecileStats(p3Lines);

    // ── C.4 Completeness calibration ─────────────────────────────────────
    console.log('[P4-C] C.4 Completeness calibration...');
    const byCompleteness = buildCompletenessReturnStats(p3Lines);

    // ── C.5 Confusion matrices ───────────────────────────────────────────
    console.log('[P4-C] C.5 Confusion matrices...');
    const bucketConfusion = buildBucketConfusionMatrix(p3Lines);
    const decileConfusion = buildScoreDecileConfusionMatrix(p3Lines);

    // ── C.6 Prediction vs baseline comparison ───────────────────────────
    console.log('[P4-C] C.6 Prediction vs baseline comparison...');
    const predVsBaseline = comparePredictionToBaseline(p3Lines, p1Lines);

    // ── C.7 Summary metadata ─────────────────────────────────────────────
    const uniqueBuckets = [...new Set(p3Lines.map(l => l.researchBucket))];
    const completeCount = p3Lines.filter(l => l.scoringCompletenessStatus === 'COMPLETE').length;
    const partialCount = p3Lines.filter(l => l.scoringCompletenessStatus === 'PARTIAL').length;
    const emptyCount = p3Lines.filter(l => l.scoringCompletenessStatus === 'EMPTY').length;

    // ── Artifact ─────────────────────────────────────────────────────────
    const artifact = {
        auditVersion: 'p4hardreset-calibration-audit-v1',
        runDate: new Date().toISOString().slice(0, 10),
        p3CorpusLines: p3Lines.length,
        p1BaselineLines: p1Lines.length,
        corpusSummary: {
            uniqueSymbols: new Set(p3Lines.map(l => l.symbol)).size,
            uniqueAsOfDates: new Set(p3Lines.map(l => l.originalAsOfDate)).size,
            uniqueBuckets,
            COMPLETE: completeCount,
            PARTIAL: partialCount,
            EMPTY: emptyCount,
            usableRatio: ((completeCount + partialCount) / p3Lines.length).toFixed(4),
        },
        byHorizon,
        byBucket,
        byScoreDecile,
        scoreDecileMeta,
        byCompleteness,
        confusionMatrices: {
            byBucket: bucketConfusion,
            byScoreDecile: decileConfusion,
        },
        predictionVsBaseline: predVsBaseline,
        limitations: LIMITATIONS,
        durationMs: Date.now() - startMs,
    };

    // ── Forbidden claims scan ─────────────────────────────────────────────
    const auditText = JSON.stringify(artifact);
    const forbidden = scanForbiddenClaims(auditText);
    if (forbidden.length > 0) {
        console.error(`\n[P4-C] BLOCKED: Forbidden claims detected in artifact: ${forbidden.join(', ')}`);
        process.exit(1);
    }

    // ── Write artifacts ───────────────────────────────────────────────────
    fs.mkdirSync(OUT_DIR, { recursive: true });
    const jsonPath = `${OUT_DIR}/p4calibration_full_audit.json`;
    fs.writeFileSync(jsonPath, JSON.stringify(artifact, null, 2));

    const md = buildMarkdown(artifact);
    const mdPath = `${OUT_DIR}/p4calibration_full_audit.md`;
    fs.writeFileSync(mdPath, md);

    console.log(`\n[P4-C] P4_CALIBRATION_AUDIT_COMPLETE`);
    console.log(`  → ${jsonPath}`);
    console.log(`  → ${mdPath}`);
    console.log(`  Duration: ${artifact.durationMs}ms`);
}

function buildMarkdown(artifact) {
    const lines = [
        `# P4 Full Calibration Audit`,
        ``,
        `**Audit Version**: \`${artifact.auditVersion}\`  **Date**: ${artifact.runDate}`,
        `**P3 corpus**: ${artifact.p3CorpusLines} lines  **P1 corpus**: ${artifact.p1BaselineLines} lines`,
        ``,
        `> ${artifact.predictionVsBaseline.disclaimer}`,
        ``,
        `## Corpus Summary`,
        `| Field | Value |`,
        `|-------|-------|`,
        `| Unique symbols | ${artifact.corpusSummary.uniqueSymbols} |`,
        `| Unique asOfDates | ${artifact.corpusSummary.uniqueAsOfDates} |`,
        `| Unique buckets | ${artifact.corpusSummary.uniqueBuckets.join(', ')} |`,
        `| COMPLETE | ${artifact.corpusSummary.COMPLETE} |`,
        `| PARTIAL | ${artifact.corpusSummary.PARTIAL} |`,
        `| EMPTY | ${artifact.corpusSummary.EMPTY} |`,
        `| Usable ratio | ${(parseFloat(artifact.corpusSummary.usableRatio) * 100).toFixed(1)}% |`,
        ``,
        `## C.1 Overall Descriptive Stats by Horizon`,
        ``,
        `| HorizonDays | Lines | Mean | Median | StdDev | +Ratio | -Ratio | FlatRatio | MissingRatio |`,
        `|-------------|-------|------|--------|--------|--------|--------|-----------|--------------|`,
        ...Object.entries(artifact.byHorizon).map(([hz, s]) =>
            `| ${hz} | ${s.lines} | ${fmtN(s.mean)} | ${fmtN(s.median)} | ${fmtN(s.standardDeviation)} | ${fmtPct(s.positiveReturnRatio)} | ${fmtPct(s.negativeReturnRatio)} | ${fmtPct(s.flatReturnRatio)} | ${fmtPct(s.missingRatio)} |`
        ),
        ``,
        `## C.2 Bucket Calibration`,
        ``,
        `| Bucket | HorizonDays | Count | Mean | Median | +Ratio | -Ratio | FlatRatio |`,
        `|--------|-------------|-------|------|--------|--------|--------|-----------|`,
        ...artifact.byBucket.map(b =>
            `| ${b.researchBucket} | ${b.horizonDays} | ${b.count} | ${fmtN(b.mean)} | ${fmtN(b.median)} | ${fmtPct(b.positiveReturnRatio)} | ${fmtPct(b.negativeReturnRatio)} | ${fmtPct(b.flatReturnRatio)} |`
        ),
        ``,
        `## C.3 Score Decile Calibration`,
        ``,
        `| Decile | HorizonDays | Count | ScoreMin | ScoreMax | Mean | Median | +Ratio | -Ratio |`,
        `|--------|-------------|-------|----------|----------|------|--------|--------|--------|`,
        ...artifact.byScoreDecile.map(d =>
            `| ${d.decile} | ${d.horizonDays} | ${d.count} | ${fmtN(d.scoreMin)} | ${fmtN(d.scoreMax)} | ${fmtN(d.mean)} | ${fmtN(d.median)} | ${fmtPct(d.positiveReturnRatio)} | ${fmtPct(d.negativeReturnRatio)} |`
        ),
        ``,
        `## C.4 Completeness Calibration`,
        ``,
        `| Status | HorizonDays | Count | Mean | Median | +Ratio | -Ratio |`,
        `|--------|-------------|-------|------|--------|--------|--------|`,
        ...artifact.byCompleteness.map(c =>
            `| ${c.scoringCompletenessStatus} | ${c.horizonDays} | ${c.count} | ${fmtN(c.mean)} | ${fmtN(c.median)} | ${fmtPct(c.positiveReturnRatio)} | ${fmtPct(c.negativeReturnRatio)} |`
        ),
        ``,
        `## C.5 Bucket Confusion Matrix (return classes)`,
        ``,
        `| Bucket | HorizonDays | NEGATIVE | FLAT | POSITIVE | MISSING | Total |`,
        `|--------|-------------|----------|------|----------|---------|-------|`,
        ...artifact.confusionMatrices.byBucket.map(e =>
            `| ${e.key} | ${e.horizonDays} | ${e.NEGATIVE} | ${e.FLAT} | ${e.POSITIVE} | ${e.MISSING} | ${e.total} |`
        ),
        ``,
        `## C.5b Score Decile Confusion Matrix`,
        ``,
        `| Decile | HorizonDays | NEGATIVE | FLAT | POSITIVE | MISSING | Total |`,
        `|--------|-------------|----------|------|----------|---------|-------|`,
        ...artifact.confusionMatrices.byScoreDecile.map(e =>
            `| ${e.key} | ${e.horizonDays} | ${e.NEGATIVE} | ${e.FLAT} | ${e.POSITIVE} | ${e.MISSING} | ${e.total} |`
        ),
        ``,
        `## C.6 Prediction vs Baseline Distribution Comparison`,
        ``,
        `*${artifact.predictionVsBaseline.disclaimer}*`,
        ``,
        `Coverage: prediction=${artifact.predictionVsBaseline.predictionCoverageRatio * 100}%  baselines=${JSON.stringify(Object.fromEntries(Object.entries(artifact.predictionVsBaseline.baselineCoverageRatios).map(([k, v]) => [k, `${(v * 100).toFixed(1)}%`])))}`,
        ``,
        `| Horizon | Group | Count | Mean | Median | StdDev | +Ratio | -Ratio |`,
        `|---------|-------|-------|------|--------|--------|--------|--------|`,
        ...artifact.predictionVsBaseline.horizons.flatMap(h => [
            `| ${h.horizonDays} | prediction | ${h.prediction.count} | ${fmtN(h.prediction.mean)} | ${fmtN(h.prediction.median)} | ${fmtN(h.prediction.standardDeviation)} | ${fmtPct(h.prediction.positiveReturnRatio)} | ${fmtPct(h.prediction.negativeReturnRatio)} |`,
            ...h.baselines.map(b =>
                `| ${h.horizonDays} | ${b.baselineType} | ${b.count} | ${fmtN(b.mean)} | ${fmtN(b.median)} | ${fmtN(b.standardDeviation)} | ${fmtPct(b.positiveRatio)} | ${fmtPct(b.negativeRatio)} |`
            ),
        ]),
        ``,
        `## C.7 Limitations`,
        ``,
        ...artifact.limitations.map(l => `- ${l}`),
        ``,
        `---`,
        `*Not investment advice. Not a trading system.*`,
    ];
    return lines.join('\n');
}

function fmtN(v) {
    if (v === null || v === undefined) return 'N/A';
    return Number(v).toFixed(4);
}
function fmtPct(v) {
    if (v === null || v === undefined) return 'N/A';
    return `${(Number(v) * 100).toFixed(1)}%`;
}

run();
