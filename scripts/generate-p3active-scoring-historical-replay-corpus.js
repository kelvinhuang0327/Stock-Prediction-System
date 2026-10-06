#!/usr/bin/env node
/**
 * generate-p3active-scoring-historical-replay-corpus.js — P3-HARDRESET PART D
 *
 * Generates the P3 active-scoring historical replay corpus.
 *
 * Loads PART A artifacts (universe + asOfDate candidates), runs the
 * ShadowPredictionHistoricalReplayWriter with useActiveScoringSnapshot=true,
 * calling RuleBasedStockAnalyzer.analyzeStock(symbol, asOfDate) per entry for
 * PIT-safe active scoring.
 *
 * Writes:
 *   outputs/online_validation/p3active_scoring_historical_replay_corpus.jsonl
 *   outputs/online_validation/p3active_scoring_historical_replay_artifact.json
 *   outputs/online_validation/p3active_scoring_historical_replay_summary.md
 *
 * Acceptance criteria (P3):
 *   - >= 4500 corpus lines (same as P0: 25 symbols × 60 dates × 3 horizons)
 *   - >= 25 unique symbols
 *   - >= 60 unique asOfDates
 *   - stockQuote.close ratio >= 50% of outcome lines
 *   - No mock-deterministic price source
 *   - scoringCompletenessStatus present on every line
 *   - COMPLETE + PARTIAL >= 50% of entries (if < 50%: classification = P3_ACTIVE_SCORING_CAPTURE_PARTIAL)
 *   - simulation_snapshot_corpus.jsonl UNTOUCHED (frozen, 60 lines)
 *   - p0hardreset_historical_replay_corpus.jsonl UNTOUCHED (frozen, 4500 lines)
 *   - p1baseline_historical_replay_corpus.jsonl UNTOUCHED (frozen, 9900 lines)
 *
 * SAFETY CONTRACT:
 *   - No production DB write
 *   - No external API call — no LLM call
 *   - No forbidden claims (buy/sell/roi/alpha/win_rate/outperform/guaranteed)
 *   - No auto trading
 *   - Not investment advice
 *   - PIT-safe: analyzeStock called with asOf = asOfDate (stockQuote capped at asOfDate)
 *   - Does NOT overwrite P0, P1, or frozen corpus
 *
 * Usage:
 *   node scripts/generate-p3active-scoring-historical-replay-corpus.js
 */

'use strict';

const path = require('path');
const fs = require('node:fs');

// ─── Register ts-node for TypeScript module imports ────────────────────────

require('ts-node').register({
    transpileOnly: true,
    compilerOptions: {
        module: 'commonjs',
        moduleResolution: 'node',
        esModuleInterop: true,
        paths: {},
    },
});

// Set up path aliases (for @/lib/...)
const tsConfig = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'tsconfig.json'), 'utf8'));
try {
    const pathAliasRegistration = require('tsconfig-paths');
    const baseUrl = path.join(process.cwd(), tsConfig.compilerOptions?.baseUrl ?? '.');
    pathAliasRegistration.register({
        baseUrl,
        paths: tsConfig.compilerOptions?.paths ?? {},
    });
} catch {
    // tsconfig-paths not available — path aliases may not work
}

// ─── Imports ───────────────────────────────────────────────────────────────

const {
    buildHistoricalReplayConfig,
    runHistoricalReplayShadowWrite,
    buildHistoricalReplayArtifact,
    summarizeHistoricalReplay,
} = require('../src/lib/onlineValidation/ShadowPredictionHistoricalReplayWriter');

// ─── Config ────────────────────────────────────────────────────────────────

const OUTPUT_DIR = path.join(process.cwd(), 'outputs', 'online_validation');
const FROZEN_CORPUS = path.join(OUTPUT_DIR, 'simulation_snapshot_corpus.jsonl');
const P0_CORPUS = path.join(OUTPUT_DIR, 'p0hardreset_historical_replay_corpus.jsonl');
const P1_CORPUS = path.join(OUTPUT_DIR, 'p1baseline_historical_replay_corpus.jsonl');
const P3_CORPUS_FILENAME = 'p3active_scoring_historical_replay_corpus.jsonl';
const P3_CORPUS = path.join(OUTPUT_DIR, P3_CORPUS_FILENAME);
const ARTIFACT_OUTPUT = path.join(OUTPUT_DIR, 'p3active_scoring_historical_replay_artifact.json');
const SUMMARY_MD_OUTPUT = path.join(OUTPUT_DIR, 'p3active_scoring_historical_replay_summary.md');

const MAX_SYMBOLS = 25;
const MAX_ASOFDATES = 60;

// ─── Main ──────────────────────────────────────────────────────────────────

async function main() {
    console.log('=== P3-HARDRESET PART D: Active Scoring Historical Replay Corpus Generation ===\n');

    // Safety: record frozen corpus line counts before run
    const frozenBefore = countLines(FROZEN_CORPUS);
    const p0Before = countLines(P0_CORPUS);
    const p1Before = countLines(P1_CORPUS);

    console.log(`[FROZEN CHECK] simulation_snapshot_corpus.jsonl: ${frozenBefore} lines (must stay ${frozenBefore})`);
    console.log(`[FROZEN CHECK] p0hardreset_historical_replay_corpus.jsonl: ${p0Before} lines (must stay ${p0Before})`);
    console.log(`[FROZEN CHECK] p1baseline_historical_replay_corpus.jsonl: ${p1Before} lines (must stay ${p1Before})`);

    // Safety: P3 corpus should NOT be the same path as P0/P1/frozen
    if (P3_CORPUS === FROZEN_CORPUS || P3_CORPUS === P0_CORPUS || P3_CORPUS === P1_CORPUS) {
        console.error('[SAFETY] FAIL: P3 corpus path collision with frozen/P0/P1 corpus!');
        process.exit(2);
    }

    console.log('\n[PART D] Building historical replay config (useActiveScoringSnapshot=true)...');

    let config;
    try {
        config = buildHistoricalReplayConfig({
            outputDir: OUTPUT_DIR,
            maxSymbols: MAX_SYMBOLS,
            maxAsOfDates: MAX_ASOFDATES,
            useActiveScoringSnapshot: true,
            outputFilename: P3_CORPUS_FILENAME,
            corpusRunId: `p3active-historical-replay-batch`,
            universeTier: 'P3_ACTIVE_SCORING_HISTORICAL_REPLAY',
        });
    } catch (err) {
        console.error('[PART D] FAIL: Could not build config:', err.message);
        console.error('Make sure PART A artifacts exist (run scripts/p0hardreset-part-a-audit.js first).');
        process.exit(1);
    }

    console.log('[PART D] Config built:');
    console.log(`  corpusRunId:             ${config.corpusRunId}`);
    console.log(`  universe:                ${config.universe.length} symbols`);
    console.log(`  asOfDates:               ${config.historicalAsOfDates.length} candidates`);
    console.log(`  horizons:                [${config.horizons.join(', ')}]`);
    console.log(`  universeTier:            ${config.universeTier}`);
    console.log(`  useActiveScoringSnapshot:${config.useActiveScoringSnapshot}`);
    console.log(`  outputFilename:          ${config.outputFilename}`);
    console.log(`  output:                  ${P3_CORPUS}`);

    const expectedLines = config.universe.length * config.historicalAsOfDates.length * config.horizons.length;
    console.log(`\n[PART D] Expected max corpus lines: ${config.universe.length} × ${config.historicalAsOfDates.length} × ${config.horizons.length} = ${expectedLines}`);
    console.log('[PART D] Running historical replay shadow write with active scoring...');
    console.log('[PART D] This may take a while (DB queries + analyzeStock per symbol×date)...\n');

    const startMs = Date.now();
    let result;
    try {
        result = await runHistoricalReplayShadowWrite(config);
    } catch (err) {
        console.error('[PART D] FAIL: runHistoricalReplayShadowWrite error:', err.message);
        console.error(err.stack);
        process.exit(1);
    }
    const elapsedMs = Date.now() - startMs;

    console.log(`\n[PART D] Run complete in ${(elapsedMs / 1000).toFixed(1)}s`);
    console.log(`  Lines written:           ${result.linesWritten}`);
    console.log(`  Unique symbols:          ${result.uniqueSymbols}`);
    console.log(`  Unique asOfDates:        ${result.uniqueAsOfDates}`);
    console.log(`  successCount:            ${result.successCount}`);
    console.log(`  pendingCount:            ${result.pendingCount}`);
    console.log(`  missingCount:            ${result.missingCount}`);
    console.log(`  errorCount:              ${result.errorCount}`);
    console.log(`  priceSourceDist:         ${JSON.stringify(result.priceSourceDistribution)}`);

    if (result.scoringCompletenessDistribution) {
        console.log(`  scoringCompletenessDist: ${JSON.stringify(result.scoringCompletenessDistribution)}`);
    }

    if (result.validationMessages.length > 0) {
        console.log(`\n  Validation messages (${result.validationMessages.length}):`);
        result.validationMessages.slice(0, 20).forEach(m => console.log(`    ${m}`));
        if (result.validationMessages.length > 20) {
            console.log(`    ... and ${result.validationMessages.length - 20} more`);
        }
    }

    // ── Frozen corpus safety check ─────────────────────────────────────
    const frozenAfter = countLines(FROZEN_CORPUS);
    const p0After = countLines(P0_CORPUS);
    const p1After = countLines(P1_CORPUS);

    const frozenSafe = frozenAfter === frozenBefore;
    const p0Safe = p0After === p0Before;
    const p1Safe = p1After === p1Before;

    console.log('\n[FROZEN CHECK after run]:');
    console.log(`  simulation_snapshot_corpus.jsonl:           ${frozenBefore} → ${frozenAfter} ${frozenSafe ? '✓ SAFE' : '✗ CHANGED!'}`);
    console.log(`  p0hardreset_historical_replay_corpus.jsonl: ${p0Before} → ${p0After} ${p0Safe ? '✓ SAFE' : '✗ CHANGED!'}`);
    console.log(`  p1baseline_historical_replay_corpus.jsonl:  ${p1Before} → ${p1After} ${p1Safe ? '✓ SAFE' : '✗ CHANGED!'}`);

    if (!frozenSafe || !p0Safe || !p1Safe) {
        console.error('[PART D] SAFETY VIOLATION: frozen/P0/P1 corpus was modified!');
        process.exit(2);
    }

    // ── Compute scoring completeness stats ────────────────────────────
    const completenessStats = computeCompletenessFromCorpus(P3_CORPUS);
    console.log('\n[PART D] Scoring completeness from corpus:');
    console.log(`  COMPLETE: ${completenessStats.COMPLETE}`);
    console.log(`  PARTIAL:  ${completenessStats.PARTIAL}`);
    console.log(`  EMPTY:    ${completenessStats.EMPTY}`);
    console.log(`  MISSING:  ${completenessStats.MISSING}`);
    const totalScored = completenessStats.COMPLETE + completenessStats.PARTIAL + completenessStats.EMPTY;
    const usableCount = completenessStats.COMPLETE + completenessStats.PARTIAL;
    const usableRatio = totalScored > 0 ? usableCount / totalScored : 0;
    console.log(`  Usable (COMPLETE+PARTIAL): ${usableCount}/${totalScored} = ${(usableRatio * 100).toFixed(1)}%`);

    // ── Build and write artifact ────────────────────────────────────────
    const artifact = buildHistoricalReplayArtifact(result);
    // Augment artifact with P3-specific scoring completeness
    artifact.scoringCompletenessDistribution = result.scoringCompletenessDistribution;
    artifact.scoringUsableRatio = usableRatio;
    fs.writeFileSync(ARTIFACT_OUTPUT, JSON.stringify(artifact, null, 2), 'utf8');
    console.log(`\n[PART D] Artifact written: ${ARTIFACT_OUTPUT}`);

    // ── Build and write summary MD ─────────────────────────────────────
    const summary = summarizeHistoricalReplay(result);
    const md = buildSummaryMd(artifact, summary, result, elapsedMs, completenessStats, usableRatio);
    fs.writeFileSync(SUMMARY_MD_OUTPUT, md, 'utf8');
    console.log(`[PART D] Summary written: ${SUMMARY_MD_OUTPUT}`);

    // ── Acceptance gate ────────────────────────────────────────────────
    console.log('\n=== P3 PART D Acceptance Gate ===');
    const gates = [];

    gates.push({ name: 'lines >= 4500', pass: result.linesWritten >= 4500, actual: result.linesWritten });
    gates.push({ name: 'unique symbols >= 25', pass: result.uniqueSymbols >= 25, actual: result.uniqueSymbols });
    gates.push({ name: 'unique asOfDates >= 60', pass: result.uniqueAsOfDates >= 60, actual: result.uniqueAsOfDates });

    const totalOutcomes = Object.values(result.priceSourceDistribution).reduce((a, b) => a + b, 0);
    const realCount = result.priceSourceDistribution['stockQuote.close'] ?? 0;
    const realRatio = totalOutcomes > 0 ? realCount / totalOutcomes : 0;
    gates.push({ name: 'stockQuote.close ratio >= 50%', pass: realRatio >= 0.5, actual: `${(realRatio * 100).toFixed(1)}%` });
    gates.push({ name: 'no mock-deterministic', pass: !(result.priceSourceDistribution['mock-deterministic']), actual: result.priceSourceDistribution['mock-deterministic'] ?? 0 });
    gates.push({ name: 'scoringCompletenessStatus present in corpus', pass: completenessStats.MISSING === 0, actual: `${completenessStats.MISSING} missing` });
    gates.push({ name: 'frozen corpus unchanged (60 lines)', pass: frozenAfter === 60, actual: frozenAfter });
    gates.push({ name: 'P0 corpus unchanged (4500 lines)', pass: p0After === p0Before, actual: p0After });
    gates.push({ name: 'P1 corpus unchanged (9900 lines)', pass: p1After === p1Before, actual: p1After });

    let allPass = true;
    for (const gate of gates) {
        const icon = gate.pass ? '✓' : '✗';
        console.log(`  ${icon} ${gate.name}: ${gate.actual}`);
        if (!gate.pass) allPass = false;
    }

    // Determine P3 classification
    let classification;
    if (!allPass) {
        classification = 'P3_ACTIVE_SCORING_BLOCKED_BY_ARTIFACTS';
    } else if (completenessStats.COMPLETE === 0 && completenessStats.PARTIAL === 0) {
        classification = 'P3_ACTIVE_SCORING_STILL_NOOP';
    } else if (usableRatio < 0.5) {
        classification = 'P3_ACTIVE_SCORING_CAPTURE_PARTIAL';
    } else {
        classification = 'P3_ACTIVE_SCORING_REPLAY_COMPLETE';
    }

    console.log(`\n[PART D] P3 CLASSIFICATION: ${classification}`);

    if (allPass) {
        console.log('\n[PART D] RESULT: PASS — P3 corpus ready');
        process.exit(0);
    } else {
        console.log('\n[PART D] RESULT: FAIL — see gate failures above');
        process.exit(1);
    }
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function countLines(filePath) {
    if (!fs.existsSync(filePath)) return 0;
    const content = fs.readFileSync(filePath, 'utf8').trim();
    return content ? content.split('\n').length : 0;
}

function computeCompletenessFromCorpus(corpusPath) {
    const stats = { COMPLETE: 0, PARTIAL: 0, EMPTY: 0, MISSING: 0 };
    if (!fs.existsSync(corpusPath)) return stats;
    const lines = fs.readFileSync(corpusPath, 'utf8').trim().split('\n');
    for (const line of lines) {
        try {
            const obj = JSON.parse(line);
            const status = obj.scoringCompletenessStatus;
            if (status === 'COMPLETE') stats.COMPLETE++;
            else if (status === 'PARTIAL') stats.PARTIAL++;
            else if (status === 'EMPTY') stats.EMPTY++;
            else stats.MISSING++;
        } catch {
            stats.MISSING++;
        }
    }
    return stats;
}

function buildSummaryMd(artifact, summary, result, elapsedMs, completenessStats, usableRatio) {
    const now = new Date().toISOString();
    const passIcon = artifact.pass ? 'PASS' : 'FAIL';
    const usablePct = (usableRatio * 100).toFixed(1);
    const p3class = usableRatio >= 0.5
        ? 'P3_ACTIVE_SCORING_REPLAY_COMPLETE'
        : (completenessStats.COMPLETE === 0 && completenessStats.PARTIAL === 0
            ? 'P3_ACTIVE_SCORING_STILL_NOOP'
            : 'P3_ACTIVE_SCORING_CAPTURE_PARTIAL');

    return [
        '# P3-HARDRESET Active Scoring Historical Replay Corpus — Generation Summary',
        '',
        `Generated: ${now}`,
        `Elapsed: ${(elapsedMs / 1000).toFixed(1)}s`,
        `Status: **${passIcon}**`,
        `P3 Classification: \`${p3class}\``,
        '',
        '## Corpus Run Info',
        '',
        '| Field | Value |',
        '|-------|-------|',
        `| corpusRunId | \`${result.config.corpusRunId}\` |`,
        `| writerVersion | \`p0hardreset-historical-replay-writer-v1\` |`,
        `| useActiveScoringSnapshot | \`${result.config.useActiveScoringSnapshot}\` |`,
        `| universeTier | \`${result.config.universeTier}\` |`,
        `| horizons | \`[${result.config.horizons.join(', ')}]\` |`,
        '',
        '## Corpus Stats',
        '',
        '| Metric | Value |',
        '|--------|-------|',
        `| Lines written | ${result.linesWritten} |`,
        `| Unique symbols | ${result.uniqueSymbols} |`,
        `| Unique asOfDates | ${result.uniqueAsOfDates} |`,
        `| Success count | ${result.successCount} |`,
        `| Pending count | ${result.pendingCount} |`,
        `| Missing count | ${result.missingCount} |`,
        `| Error count | ${result.errorCount} |`,
        '',
        '## Scoring Completeness',
        '',
        '| Status | Count |',
        '|--------|-------|',
        `| COMPLETE | ${completenessStats.COMPLETE} |`,
        `| PARTIAL | ${completenessStats.PARTIAL} |`,
        `| EMPTY | ${completenessStats.EMPTY} |`,
        `| MISSING (no field) | ${completenessStats.MISSING} |`,
        `| Usable (COMPLETE+PARTIAL) | ${completenessStats.COMPLETE + completenessStats.PARTIAL} (${usablePct}%) |`,
        '',
        '## Price Source Distribution',
        '',
        Object.entries(result.priceSourceDistribution).map(([k, v]) => `- \`${k}\`: ${v}`).join('\n'),
        '',
        '## Frozen Corpus Safety',
        '',
        '- `simulation_snapshot_corpus.jsonl`: UNTOUCHED',
        '- `p0hardreset_historical_replay_corpus.jsonl`: UNTOUCHED',
        '- `p1baseline_historical_replay_corpus.jsonl`: UNTOUCHED',
        '- ManualReview* modules: NOT modified',
        '',
        '---',
        '*P3-HARDRESET PART D — Not investment advice.*',
    ].join('\n');
}

main().catch(err => {
    console.error('[PART D] Unhandled error:', err.message);
    console.error(err.stack);
    process.exit(1);
});
