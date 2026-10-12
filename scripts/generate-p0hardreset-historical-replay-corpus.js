#!/usr/bin/env node
/**
 * generate-p0hardreset-historical-replay-corpus.js — PART D
 *
 * Generates the P0-HARDRESET historical replay corpus.
 *
 * Loads PART A artifacts (universe + asOfDate candidates), runs the
 * ShadowPredictionHistoricalReplayWriter, and writes:
 *   - outputs/online_validation/p0hardreset_historical_replay_corpus.jsonl (>= 1000 lines)
 *   - outputs/online_validation/p0hardreset_historical_replay_artifact.json
 *   - outputs/online_validation/p0hardreset_historical_replay_summary.md
 *
 * Acceptance criteria:
 *   - >= 1000 corpus lines
 *   - >= 20 unique symbols
 *   - >= 20 unique asOfDates
 *   - 5D real price (stockQuote.close) >= 50% of outcome lines
 *   - No mock-deterministic price source
 *   - simulation_snapshot_corpus.jsonl UNTOUCHED (frozen)
 *
 * SAFETY CONTRACT:
 *   - No production DB write
 *   - No external API call
 *   - No forbidden claims (buy/sell/roi/alpha/win_rate/outperform/guaranteed)
 *   - No auto trading
 *   - Not investment advice
 *
 * Usage:
 *   node scripts/generate-p0hardreset-historical-replay-corpus.js
 */

'use strict';

const path = require('path');
const fs = require('fs');

// ─── Require TS via ts-node/register or compiled JS ───────────────────────

// Register ts-node to import TypeScript modules (override bundler → commonjs)
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

// ─── Imports ──────────────────────────────────────────────────────────────

const {
    buildHistoricalReplayConfig,
    runHistoricalReplayShadowWrite,
    buildHistoricalReplayArtifact,
    summarizeHistoricalReplay,
} = require('../src/lib/onlineValidation/ShadowPredictionHistoricalReplayWriter');

// ─── Config ────────────────────────────────────────────────────────────────

const OUTPUT_DIR = path.join(process.cwd(), 'outputs', 'online_validation');
const FROZEN_CORPUS = path.join(OUTPUT_DIR, 'simulation_snapshot_corpus.jsonl');
const CORPUS_OUTPUT = path.join(OUTPUT_DIR, 'p0hardreset_historical_replay_corpus.jsonl');
const ARTIFACT_OUTPUT = path.join(OUTPUT_DIR, 'p0hardreset_historical_replay_artifact.json');
const SUMMARY_MD_OUTPUT = path.join(OUTPUT_DIR, 'p0hardreset_historical_replay_summary.md');

// Max symbols and dates to use (product must be >= 1000 / 3 horizons ≈ 334 pairs → 20×20 = 400 pairs × 3 = 1200)
const MAX_SYMBOLS = 25;
const MAX_ASOFDATES = 60; // use all available

// ─── Main ──────────────────────────────────────────────────────────────────

async function main() {
    console.log('=== P0-HARDRESET PART D: Historical Replay Corpus Generation ===\n');

    // Safety: record frozen corpus line count before run
    let frozenLineCount = 0;
    if (fs.existsSync(FROZEN_CORPUS)) {
        const lines = fs.readFileSync(FROZEN_CORPUS, 'utf8')
            .split('\n')
            .filter(l => l.trim());
        frozenLineCount = lines.length;
        console.log(`[FROZEN CORPUS] ${FROZEN_CORPUS}`);
        console.log(`[FROZEN CORPUS] Current line count: ${frozenLineCount} (will verify unchanged after run)`);
    } else {
        console.log(`[FROZEN CORPUS] Not found at: ${FROZEN_CORPUS} (ok — will not be created)`);
    }

    console.log('\n[PART D] Building historical replay config...');

    let config;
    try {
        config = buildHistoricalReplayConfig({
            outputDir: OUTPUT_DIR,
            // Let it load from PART A artifacts
            maxSymbols: MAX_SYMBOLS,
            maxAsOfDates: MAX_ASOFDATES,
        });
    } catch (err) {
        console.error('[PART D] FAIL: Could not build config:', err.message);
        console.error('Make sure to run scripts/p0hardreset-part-a-audit.js first.');
        process.exit(1);
    }

    console.log(`[PART D] Config built:`);
    console.log(`  corpusRunId:    ${config.corpusRunId}`);
    console.log(`  universe:       ${config.universe.length} symbols`);
    console.log(`  asOfDates:      ${config.historicalAsOfDates.length} candidates`);
    console.log(`  horizons:       [${config.horizons.join(', ')}]`);
    console.log(`  universeTier:   ${config.universeTier}`);
    console.log(`  writeMode:      ${config.writeMode}`);
    console.log(`  output:         ${CORPUS_OUTPUT}`);

    const expectedLines = config.universe.length * config.historicalAsOfDates.length * config.horizons.length;
    console.log(`\n[PART D] Expected max corpus lines: ${config.universe.length} × ${config.historicalAsOfDates.length} × ${config.horizons.length} = ${expectedLines}`);

    if (expectedLines < 1000) {
        console.warn(`[PART D] WARN: Expected lines ${expectedLines} < 1000 quality gate. Increase MAX_SYMBOLS or MAX_ASOFDATES.`);
    }

    console.log('\n[PART D] Running historical replay shadow write...');
    console.log('[PART D] This may take a while (DB queries per symbol×date×horizon)...\n');

    const startMs = Date.now();
    let result;
    try {
        result = await runHistoricalReplayShadowWrite(config);
    } catch (err) {
        console.error('[PART D] FAIL: runHistoricalReplayShadowWrite error:', err.message);
        process.exit(1);
    }
    const elapsedMs = Date.now() - startMs;

    console.log(`[PART D] Run complete in ${(elapsedMs / 1000).toFixed(1)}s`);
    console.log(`  Lines written:      ${result.linesWritten}`);
    console.log(`  Unique symbols:     ${result.uniqueSymbols}`);
    console.log(`  Unique asOfDates:   ${result.uniqueAsOfDates}`);
    console.log(`  successCount:       ${result.successCount}`);
    console.log(`  pendingCount:       ${result.pendingCount}`);
    console.log(`  missingCount:       ${result.missingCount}`);
    console.log(`  errorCount:         ${result.errorCount}`);
    console.log(`  priceSourceDist:    ${JSON.stringify(result.priceSourceDistribution)}`);

    if (result.validationMessages.length > 0) {
        console.log(`\n  Validation messages (${result.validationMessages.length}):`);
        result.validationMessages.slice(0, 20).forEach(m => console.log(`    ${m}`));
        if (result.validationMessages.length > 20) {
            console.log(`    ... and ${result.validationMessages.length - 20} more`);
        }
    }

    // ── Build and write artifact ────────────────────────────────────────
    const artifact = buildHistoricalReplayArtifact(result);
    fs.writeFileSync(ARTIFACT_OUTPUT, JSON.stringify(artifact, null, 2), 'utf8');
    console.log(`\n[PART D] Artifact written: ${ARTIFACT_OUTPUT}`);

    // ── Build and write summary MD ─────────────────────────────────────
    const summary = summarizeHistoricalReplay(result);
    const md = buildSummaryMd(artifact, summary, result, elapsedMs);
    fs.writeFileSync(SUMMARY_MD_OUTPUT, md, 'utf8');
    console.log(`[PART D] Summary written: ${SUMMARY_MD_OUTPUT}`);

    // ── Frozen corpus safety check ─────────────────────────────────────
    if (fs.existsSync(FROZEN_CORPUS)) {
        const frozenAfter = fs.readFileSync(FROZEN_CORPUS, 'utf8')
            .split('\n')
            .filter(l => l.trim()).length;
        if (frozenAfter !== frozenLineCount) {
            console.error(`\n[PART D] SAFETY VIOLATION: frozen corpus line count changed! ${frozenLineCount} → ${frozenAfter}`);
            process.exit(2);
        }
        console.log(`\n[PART D] FROZEN CORPUS SAFE: ${FROZEN_CORPUS} unchanged (${frozenLineCount} lines)`);
    }

    // ── Acceptance gate ────────────────────────────────────────────────
    console.log('\n=== PART D Acceptance Gate ===');
    const gates = [];

    gates.push({
        name: 'lines >= 1000',
        pass: result.linesWritten >= 1000,
        actual: result.linesWritten,
    });
    gates.push({
        name: 'unique symbols >= 20',
        pass: result.uniqueSymbols >= 20,
        actual: result.uniqueSymbols,
    });
    gates.push({
        name: 'unique asOfDates >= 20',
        pass: result.uniqueAsOfDates >= 20,
        actual: result.uniqueAsOfDates,
    });
    const totalOutcomes = Object.values(result.priceSourceDistribution).reduce((a, b) => a + b, 0);
    const realCount = result.priceSourceDistribution['stockQuote.close'] ?? 0;
    const realRatio = totalOutcomes > 0 ? realCount / totalOutcomes : 0;
    gates.push({
        name: 'stockQuote.close ratio >= 50%',
        pass: realRatio >= 0.5,
        actual: `${(realRatio * 100).toFixed(1)}%`,
    });
    gates.push({
        name: 'no mock-deterministic',
        pass: !result.priceSourceDistribution['mock-deterministic'],
        actual: result.priceSourceDistribution['mock-deterministic'] ?? 0,
    });

    let allPass = true;
    for (const gate of gates) {
        const icon = gate.pass ? '✓' : '✗';
        console.log(`  ${icon} ${gate.name}: ${gate.actual}`);
        if (!gate.pass) allPass = false;
    }

    if (allPass) {
        console.log('\n[PART D] RESULT: PASS — corpus ready for quality gate (PART E)');
        process.exit(0);
    } else {
        console.log('\n[PART D] RESULT: FAIL — see gate failures above');
        process.exit(1);
    }
}

function buildSummaryMd(artifact, summary, result, elapsedMs) {
    const now = new Date().toISOString();
    const passIcon = artifact.pass ? '✅ PASS' : '❌ FAIL';

    return `# P0-HARDRESET Historical Replay Corpus — Generation Summary

Generated: ${now}  
Elapsed: ${(elapsedMs / 1000).toFixed(1)}s  
Status: **${passIcon}**

## Corpus Run Info

| Field | Value |
|-------|-------|
| corpusRunId | \`${result.config.corpusRunId}\` |
| writerVersion | \`p0hardreset-historical-replay-writer-v1\` |
| universeTier | \`${result.config.universeTier}\` |
| horizons | \`[${result.config.horizons.join(', ')}]\` |

## Corpus Stats

| Metric | Value |
|--------|-------|
| Lines written | ${result.linesWritten} |
| Unique symbols | ${result.uniqueSymbols} |
| Unique asOfDates | ${result.uniqueAsOfDates} |
| Success count | ${result.successCount} |
| Pending count | ${result.pendingCount} |
| Missing count | ${result.missingCount} |
| Error count | ${result.errorCount} |

## Price Source Distribution

${Object.entries(result.priceSourceDistribution).map(([k, v]) => `- \`${k}\`: ${v}`).join('\n')}

## Quality Gate

${artifact.pass ? '**PASS** — All acceptance criteria met.' : `**FAIL** — Issues:\n${artifact.failReasons.map(r => `- ${r}`).join('\n')}`}

## Frozen Corpus

\`simulation_snapshot_corpus.jsonl\` is UNCHANGED (frozen per P0-HARDRESET safety contract).  
ManualReview* modules: NOT modified (frozen).

## Notes

${summary.notes.map(n => `- ${n}`).join('\n')}

---
*Not investment advice. Not a trading system. Research corpus only.*
`;
}

main().catch(err => {
    console.error('[PART D] Unexpected error:', err);
    process.exit(1);
});
