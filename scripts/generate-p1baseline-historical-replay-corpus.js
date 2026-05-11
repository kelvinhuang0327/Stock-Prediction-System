'use strict';

/**
 * generate-p1baseline-historical-replay-corpus.js
 *
 * P1-HARDRESET PART C — Corpus generation script.
 *
 * Generates the P1 naive baseline historical replay corpus using
 * NaiveBaselineShadowWriter with 4 baseline types over 25 symbols
 * and 60 historical asOfDates.
 *
 * Outputs:
 *   outputs/online_validation/p1baseline_historical_replay_corpus.jsonl
 *   outputs/online_validation/p1baseline_historical_replay_summary.json
 *   outputs/online_validation/p1baseline_historical_replay_summary.md
 *
 * Safety invariants:
 *   - simulation_snapshot_corpus.jsonl is NEVER written (verified after run)
 *   - 0 mock-deterministic price sources
 *   - No ROI / alpha / win_rate / outperform claims
 *   - qualityStatus never PRODUCTION_READY
 */

// ts-node with bundler→commonjs override
require('ts-node').register({
    transpileOnly: true,
    compilerOptions: {
        module: 'commonjs',
        moduleResolution: 'node',
        esModuleInterop: true,
        paths: {},
    },
});

// tsconfig-paths registration
const tsConfigPaths = require('tsconfig-paths');
const tsConfig = require('../tsconfig.json');
const baseUrl = require('node:path').resolve(__dirname, '..');
tsConfigPaths.register({
    baseUrl,
    paths: tsConfig.compilerOptions.paths || {},
});

const fs = require('node:fs');
const path = require('node:path');

async function main() {
    const {
        buildNaiveBaselineConfig,
        runNaiveBaselineShadowWrite,
        buildNaiveBaselineArtifact,
        summarizeNaiveBaseline,
        BASELINE_WRITER_VERSION,
    } = require('../src/lib/onlineValidation/NaiveBaselineShadowWriter');

    const { PrismaClient } = require('@prisma/client');

    // ── Paths ──────────────────────────────────────────────────────────────────
    const OUTPUTS_DIR = path.resolve(__dirname, '../outputs/online_validation');
    const P0_UNIVERSE_PATH = path.join(OUTPUTS_DIR, 'p0hardreset_universe_audit.json');
    const P0_ASOFDATES_PATH = path.join(OUTPUTS_DIR, 'p0hardreset_historical_asofdate_candidates.json');
    const FROZEN_CORPUS_PATH = path.join(OUTPUTS_DIR, 'simulation_snapshot_corpus.jsonl');

    // ── Load P0 artifacts ──────────────────────────────────────────────────────
    console.log('[P1-PART-C] Loading P0 universe audit...');
    const universeAudit = JSON.parse(fs.readFileSync(P0_UNIVERSE_PATH, 'utf8'));
    const rawUniverse = universeAudit.universeResult.universe;

    // Use same top-25 as P0 (sorted by quoteDays desc)
    const top25Universe = [...rawUniverse]
        .sort((a, b) => b.quoteDays - a.quoteDays)
        .slice(0, 25)
        .map(e => ({
            symbol: e.symbol,
            quoteDays: e.quoteDays,
            chipDays: e.chipDays,
            overlapDays: e.overlapDays,
        }));

    console.log(`[P1-PART-C] Universe: ${top25Universe.length} symbols`);
    console.log(`[P1-PART-C]   Symbols: ${top25Universe.map(e => e.symbol).join(', ')}`);

    console.log('[P1-PART-C] Loading P0 asOfDate candidates...');
    const asOfDateAudit = JSON.parse(fs.readFileSync(P0_ASOFDATES_PATH, 'utf8'));
    const rawCandidates = asOfDateAudit.candidates;
    const historicalAsOfDates = rawCandidates.map(c => ({
        asOfDate: c.asOfDate,
        outcome5dDate: c.outcome5dDate,
        outcome20dDate: c.outcome20dDate,
        outcome60dDate: c.outcome60dDate,
        outcome5dAvailable: c.outcome5dAvailable,
        outcome20dAvailable: c.outcome20dAvailable,
        outcome60dAvailable: c.outcome60dAvailable,
    }));

    console.log(`[P1-PART-C] AsOfDates: ${historicalAsOfDates.length} candidates`);

    // ── Prisma ─────────────────────────────────────────────────────────────────
    console.log('[P1-PART-C] Connecting to database...');
    const prisma = new PrismaClient();

    const today = new Date().toISOString().slice(0, 10);
    console.log(`[P1-PART-C] Today: ${today}`);

    // ── Config ─────────────────────────────────────────────────────────────────
    const config = buildNaiveBaselineConfig({
        outputDir: OUTPUTS_DIR,
        universe: top25Universe,
        historicalAsOfDates,
        horizons: [5, 20, 60],
        topN: 10,
        today,
        resolverOptions: { prisma, today },
    });

    console.log(`[P1-PART-C] Config: baselineRunId=${config.baselineRunId}`);
    console.log(`[P1-PART-C] Config: writerVersion=${BASELINE_WRITER_VERSION}`);
    console.log(`[P1-PART-C] Config: ${config.baselineTypes.length} baseline types`);
    console.log(`[P1-PART-C] Expected ≥9900 lines (4500 BUY_AND_HOLD + 1800×3 typed)`);

    // ── Generate ───────────────────────────────────────────────────────────────
    console.log('\n[P1-PART-C] Running NaiveBaselineShadowWrite...');
    const startMs = Date.now();
    const result = await runNaiveBaselineShadowWrite(config);
    const elapsedSec = ((Date.now() - startMs) / 1000).toFixed(1);

    console.log(`[P1-PART-C] Generation complete in ${elapsedSec}s`);
    console.log(`[P1-PART-C] Total lines: ${result.totalLines}`);
    console.log(`[P1-PART-C] priceSourceDist: ${JSON.stringify(result.priceSourceDist)}`);

    // ── Acceptance gates ───────────────────────────────────────────────────────
    console.log('\n[P1-PART-C] Checking acceptance gates...');
    const artifact = buildNaiveBaselineArtifact(result);
    console.log(`[P1-PART-C] Artifact pass: ${artifact.pass}`);
    if (!artifact.pass) {
        console.error('[P1-PART-C] FAIL — gate failures:');
        for (const reason of artifact.failReasons) {
            console.error(`  - ${reason}`);
        }
    }

    // Additional mandatory checks
    const mockCount = result.priceSourceDist['mock-deterministic'] ?? 0;
    if (mockCount > 0) {
        throw new Error(`FATAL: ${mockCount} mock-deterministic entries found in corpus!`);
    }

    // Check frozen corpus untouched
    const frozenLinesBefore = fs.readFileSync(FROZEN_CORPUS_PATH, 'utf8').trim().split('\n').length;
    if (frozenLinesBefore !== 60) {
        throw new Error(`FATAL: Frozen corpus has ${frozenLinesBefore} lines (expected 60)!`);
    }
    console.log(`[P1-PART-C] Frozen corpus: ${frozenLinesBefore} lines (UNCHANGED ✓)`);

    // ── Summary ────────────────────────────────────────────────────────────────
    const summary = summarizeNaiveBaseline(result);

    // Type-breakdown
    const typeCounts = {};
    for (const line of result.corpusLines) {
        typeCounts[line.baselineType] = (typeCounts[line.baselineType] ?? 0) + 1;
    }

    // ── Write summary JSON ─────────────────────────────────────────────────────
    const summaryJson = {
        generatedAt: new Date().toISOString(),
        scriptVersion: 'generate-p1baseline-historical-replay-corpus-v1',
        baselineRunId: config.baselineRunId,
        writerVersion: BASELINE_WRITER_VERSION,
        totalLines: result.totalLines,
        uniqueSymbols: artifact.stats.uniqueSymbols,
        uniqueAsOfDates: artifact.stats.uniqueAsOfDates,
        typeCounts,
        horizonCounts: artifact.stats.horizonCounts,
        priceSourceDist: result.priceSourceDist,
        coveragePct: summary.coveragePct,
        gatePass: artifact.pass,
        failReasons: artifact.failReasons,
        frozenCorpusLines: frozenLinesBefore,
        frozenCorpusStatus: 'UNCHANGED',
        elapsedSec: Number(elapsedSec),
        safetyNote: summary.safetyNote,
        limitations: summary.limitations,
    };

    const summaryJsonPath = path.join(OUTPUTS_DIR, 'p1baseline_historical_replay_summary.json');
    fs.writeFileSync(summaryJsonPath, JSON.stringify(summaryJson, null, 2));
    console.log(`\n[P1-PART-C] Written: ${summaryJsonPath}`);

    // ── Write summary MD ───────────────────────────────────────────────────────
    const typeTable = Object.entries(typeCounts)
        .map(([t, c]) => `| ${t} | ${c} |`)
        .join('\n');

    const horizonTable = Object.entries(artifact.stats.horizonCounts ?? {})
        .map(([h, c]) => `| ${h}d | ${c} |`)
        .join('\n');

    const priceTable = Object.entries(result.priceSourceDist)
        .map(([src, c]) => `| ${src} | ${c} |`)
        .join('\n');

    const summaryMd = `# P1 Baseline Historical Replay Corpus — Generation Summary

Generated: ${summaryJson.generatedAt}
Script: generate-p1baseline-historical-replay-corpus-v1
Writer: ${BASELINE_WRITER_VERSION}
Run ID: ${config.baselineRunId}

## Acceptance Gate: ${artifact.pass ? '✅ PASS' : '❌ FAIL'}

${artifact.pass ? '' : `### Fail Reasons\n${artifact.failReasons.map(r => `- ${r}`).join('\n')}`}

## Corpus Stats

| Metric | Value |
|--------|-------|
| Total Lines | ${result.totalLines} |
| Unique Symbols | ${artifact.stats.uniqueSymbols} |
| Unique AsOfDates | ${artifact.stats.uniqueAsOfDates} |
| Coverage % | ${summary.coveragePct.toFixed(2)}% |
| Elapsed | ${elapsedSec}s |

## Baseline Type Counts

| Type | Count |
|------|-------|
${typeTable}

## Horizon Counts

| Horizon | Count |
|---------|-------|
${horizonTable}

## Price Source Distribution

| Source | Count |
|--------|-------|
${priceTable}

## Frozen Corpus

simulation_snapshot_corpus.jsonl: **${frozenLinesBefore} lines — UNCHANGED ✓**

## Safety Note

${summary.safetyNote}

## Limitations

${summary.limitations.map(l => `- ${l}`).join('\n')}

---
*Observability-only. No investment advice, ROI claims, or alpha claims.*
`;

    const summaryMdPath = path.join(OUTPUTS_DIR, 'p1baseline_historical_replay_summary.md');
    fs.writeFileSync(summaryMdPath, summaryMd);
    console.log(`[P1-PART-C] Written: ${summaryMdPath}`);
    console.log(`[P1-PART-C] Corpus:  ${result.outputPath}`);

    await prisma.$disconnect();

    // Final status
    if (!artifact.pass) {
        console.error('\n[P1-PART-C] ⚠️  Gate FAILED — review failReasons above');
        process.exit(1);
    } else {
        console.log('\n[P1-PART-C] ✅  All gates PASSED — P1 corpus generation complete');
    }
}

main().catch(err => {
    console.error('[P1-PART-C] FATAL:', err);
    process.exit(1);
});
