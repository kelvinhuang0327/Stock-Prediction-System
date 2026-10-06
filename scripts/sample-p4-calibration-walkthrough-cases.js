'use strict';
/**
 * sample-p4-calibration-walkthrough-cases.js — P4-HARDRESET PART D
 *
 * Deterministic (no Math.random) sampling of illustrative cases from the
 * P3 corpus, cross-referenced with the full calibration audit output.
 *
 * Selection criteria:
 *  - Per horizon (5/20/60): ≥12 cases
 *  - Per bucket: ≥5 cases
 *  - Per decile: ≥3 cases
 *  - Must include: high-score+negative, low-score+positive, high-score+positive,
 *    neutral/insufficient-data, COMPLETE, PARTIAL examples
 *
 * Safety: read-only. No DB write. No external API call.
 * Not investment advice. Not a trading system.
 */

const fs = require('fs');
const path = require('path');

const OUT_DIR = 'outputs/online_validation';

// ── Deterministic hash (djb2) ────────────────────────────────────────────────
function djb2(str) {
    let h = 5381;
    for (let i = 0; i < str.length; i++) {
        h = ((h << 5) + h + str.charCodeAt(i)) >>> 0;
    }
    return h;
}

function stableKey(row) {
    return `${row.symbol}|${row.originalAsOfDate}|${row.outcomeSnapshot.horizonDays}|${row.researchBucket}`;
}

function sortedByKey(rows) {
    return [...rows].sort((a, b) => {
        const ha = djb2(stableKey(a));
        const hb = djb2(stableKey(b));
        return ha - hb || stableKey(a).localeCompare(stableKey(b));
    });
}

// ── Score decile assignment (must mirror P4CalibrationAuditUtils logic) ───────
function extractScore(row) {
    if (row.activeScoringSnapshot && row.activeScoringSnapshot.alphaScore !== undefined) {
        return row.activeScoringSnapshot.alphaScore;
    }
    if (row.scoreSnapshot && row.scoreSnapshot.researchScore !== undefined) {
        return row.scoreSnapshot.researchScore;
    }
    return 0;
}

function assignDeciles(rows, horizonDays) {
    const hzRows = rows.filter(r => r.outcomeSnapshot.horizonDays === horizonDays);
    const scores = hzRows.map(extractScore);
    const uniqueScores = [...new Set(scores)].sort((a, b) => a - b);
    const n = uniqueScores.length;
    const decileMap = new Map();
    uniqueScores.forEach((score, i) => {
        const d = n <= 1 ? 5 : Math.min(10, Math.floor((i / (n - 1)) * 9) + 1);
        decileMap.set(score, d);
    });
    return { decileMap };
}

function classifyReturn(returnPct) {
    if (returnPct === null || returnPct === undefined) return 'MISSING';
    if (returnPct < 0) return 'NEGATIVE';
    if (returnPct <= 1.0) return 'FLAT';
    return 'POSITIVE';
}

// ── Build scenarios ──────────────────────────────────────────────────────────
function buildScenario(row, label, reason, horizonDecileMap) {
    const score = extractScore(row);
    const decile = horizonDecileMap ? (horizonDecileMap.get(score) ?? 5) : null;
    return {
        label,
        reason,
        symbol: row.symbol,
        originalAsOfDate: row.originalAsOfDate,
        horizonDays: row.outcomeSnapshot.horizonDays,
        researchBucket: row.researchBucket,
        activeScoringBucket: row.activeScoringSnapshot?.researchBucket ?? null,
        primaryScore: score,
        scoreDecile: decile,
        returnPct: row.outcomeSnapshot.returnPct,
        returnClass: classifyReturn(row.outcomeSnapshot.returnPct),
        scoringCompletenessStatus: row.scoringCompletenessStatus,
        signalCount: row.activeScoringSnapshot?.signalSnapshot?.length ?? 0,
        factorCount: row.activeScoringSnapshot?.factorSnapshot?.length ?? 0,
        reasonSnapshot: row.activeScoringSnapshot?.reasonSnapshot ?? null,
        closePriceAtPrediction: row.closePriceAtPrediction ?? null,
        stableHashKey: stableKey(row),
        factorSnapshot: row.activeScoringSnapshot?.factorSnapshot ?? undefined,
        usedSources: row.activeScoringSnapshot?.usedSources ?? undefined,
        missingSources: row.activeScoringSnapshot?.missingSources ?? undefined,
    };
}

function pickFirst(candidates, n) {
    return sortedByKey(candidates).slice(0, n);
}

function run() {
    console.log('[P4-D] Loading corpora...');
    const p3Lines = fs.readFileSync('outputs/online_validation/p3active_scoring_historical_replay_corpus.jsonl', 'utf8')
        .trim().split('\n').map(l => JSON.parse(l));

    // Load full audit for context
    const auditExists = fs.existsSync(`${OUT_DIR}/p4calibration_full_audit.json`);
    const audit = auditExists ? JSON.parse(fs.readFileSync(`${OUT_DIR}/p4calibration_full_audit.json`, 'utf8')) : null;
    if (!audit) {
        console.warn('[P4-D] WARNING: p4calibration_full_audit.json not found — proceeding without audit context');
    }

    const HORIZONS = [5, 20, 60];
    const decileMaps = {};
    for (const hz of HORIZONS) {
        const { decileMap } = assignDeciles(p3Lines, hz);
        decileMaps[hz] = decileMap;
    }

    const cases = [];
    const caseKeys = new Set();

    function addCase(row, label, reason) {
        // Use label-scoped key so mandatory scenarios can appear even if row was
        // already added under a different label (e.g., Neutral bucket row can
        // appear as both 'neutral-or-insufficient' AND 'completeness-PARTIAL').
        const key = `${label}|${stableKey(row)}`;
        if (caseKeys.has(key)) return;
        caseKeys.add(key);
        cases.push(buildScenario(row, label, reason, decileMaps[row.outcomeSnapshot.horizonDays]));
    }

    // ── Per-horizon: ≥12 cases each ──────────────────────────────────────
    for (const hz of HORIZONS) {
        const hzRows = p3Lines.filter(r => r.outcomeSnapshot.horizonDays === hz);

        // High score + negative return
        const highScoreNeg = hzRows.filter(r => {
            const d = decileMaps[hz].get(extractScore(r)) ?? 5;
            return d >= 8 && classifyReturn(r.outcomeSnapshot.returnPct) === 'NEGATIVE';
        });
        pickFirst(highScoreNeg, 3).forEach(r => addCase(r, 'high-score-negative', `Decile≥8, return<0, horizon=${hz}d`));

        // Low score + positive return
        const lowScorePos = hzRows.filter(r => {
            const d = decileMaps[hz].get(extractScore(r)) ?? 5;
            return d <= 3 && classifyReturn(r.outcomeSnapshot.returnPct) === 'POSITIVE';
        });
        pickFirst(lowScorePos, 3).forEach(r => addCase(r, 'low-score-positive', `Decile≤3, return>1, horizon=${hz}d`));

        // High score + positive return
        const highScorePos = hzRows.filter(r => {
            const d = decileMaps[hz].get(extractScore(r)) ?? 5;
            return d >= 8 && classifyReturn(r.outcomeSnapshot.returnPct) === 'POSITIVE';
        });
        pickFirst(highScorePos, 3).forEach(r => addCase(r, 'high-score-positive', `Decile≥8, return>1, horizon=${hz}d`));

        // Neutral/InsufficientData bucket
        const neutralInsuf = hzRows.filter(r =>
            r.researchBucket === 'Neutral' || r.researchBucket === 'InsufficientData'
        );
        pickFirst(neutralInsuf, 2).forEach(r => addCase(r, 'neutral-or-insufficient', `Bucket=${r.researchBucket}, horizon=${hz}d`));

        // COMPLETE completeness
        const complete = hzRows.filter(r => r.scoringCompletenessStatus === 'COMPLETE');
        pickFirst(complete, 1).forEach(r => addCase(r, 'completeness-COMPLETE', `status=COMPLETE, horizon=${hz}d`));

        // PARTIAL completeness
        const partial = hzRows.filter(r => r.scoringCompletenessStatus === 'PARTIAL');
        pickFirst(partial, 1).forEach(r => addCase(r, 'completeness-PARTIAL', `status=PARTIAL, horizon=${hz}d`));
    }

    // ── Per-bucket: ≥5 cases ─────────────────────────────────────────────
    const allBuckets = [...new Set(p3Lines.map(r => r.researchBucket))];
    for (const bucket of allBuckets) {
        const bRows = p3Lines.filter(r => r.researchBucket === bucket);
        const needed = Math.max(0, 5 - cases.filter(c => c.researchBucket === bucket).length);
        pickFirst(bRows, needed).forEach(r => addCase(r, `bucket-coverage-${bucket}`, `Ensuring ≥5 for bucket=${bucket}`));
    }

    // ── Per-decile: ≥3 cases ─────────────────────────────────────────────
    // Use horizon=5 as representative for decile coverage
    const hz5Rows = p3Lines.filter(r => r.outcomeSnapshot.horizonDays === 5);
    for (let d = 1; d <= 10; d++) {
        const dRows = hz5Rows.filter(r => decileMaps[5].get(extractScore(r)) === d);
        const needed = Math.max(0, 3 - cases.filter(c => c.scoreDecile === d && c.horizonDays === 5).length);
        pickFirst(dRows, needed).forEach(r => addCase(r, `decile-${d}-coverage`, `Ensuring ≥3 for decile=${d}, horizon=5d`));
    }

    // ── Validate minimums ────────────────────────────────────────────────
    const validation = {
        totalCases: cases.length,
        perHorizon: {},
        perBucket: {},
        perDecile: {},
        mandatoryScenariosFound: {},
    };

    for (const hz of HORIZONS) {
        validation.perHorizon[hz] = cases.filter(c => c.horizonDays === hz).length;
    }
    for (const b of allBuckets) {
        validation.perBucket[b] = cases.filter(c => c.researchBucket === b).length;
    }
    for (let d = 1; d <= 10; d++) {
        validation.perDecile[d] = cases.filter(c => c.scoreDecile === d && c.horizonDays === 5).length;
    }

    const mandatoryLabels = ['high-score-negative', 'low-score-positive', 'high-score-positive', 'neutral-or-insufficient', 'completeness-COMPLETE', 'completeness-PARTIAL'];
    for (const lbl of mandatoryLabels) {
        validation.mandatoryScenariosFound[lbl] = cases.filter(c => c.label === lbl).length;
    }

    // ── Artifact ─────────────────────────────────────────────────────────
    const artifact = {
        auditVersion: 'p4hardreset-walkthrough-v1',
        runDate: new Date().toISOString().slice(0, 10),
        totalCases: cases.length,
        validation,
        cases,
        note: 'Deterministic selection via djb2 stable hash. No Math.random used. Not investment advice.',
    };

    fs.mkdirSync(OUT_DIR, { recursive: true });
    fs.writeFileSync(
        `${OUT_DIR}/p4calibration_walkthrough_cases.json`,
        JSON.stringify(artifact, null, 2),
    );

    // Markdown summary
    const md = buildMarkdown(artifact);
    fs.writeFileSync(`${OUT_DIR}/p4calibration_walkthrough_cases.md`, md);

    console.log(`\n[P4-D] Walkthrough cases complete`);
    console.log(`  Total cases: ${cases.length}`);
    console.log(`  → ${OUT_DIR}/p4calibration_walkthrough_cases.json`);
    console.log(`  → ${OUT_DIR}/p4calibration_walkthrough_cases.md`);
}

function buildMarkdown(artifact) {
    const v = artifact.validation;
    const lines = [
        `# P4 Calibration Walkthrough Cases`,
        ``,
        `**Version**: \`${artifact.auditVersion}\`  **Date**: ${artifact.runDate}`,
        `**Total cases**: ${artifact.totalCases}`,
        `**Selection**: Deterministic (djb2 hash, no Math.random)`,
        ``,
        `> ${artifact.note}`,
        ``,
        `## Coverage Summary`,
        ``,
        `**Per horizon:**`,
        ...Object.entries(v.perHorizon).map(([hz, n]) => `- ${hz}d: ${n} cases ${n >= 12 ? '✓' : '✗ (<12)'}`),
        ``,
        `**Per bucket:**`,
        ...Object.entries(v.perBucket).map(([b, n]) => `- ${b}: ${n} cases ${n >= 5 ? '✓' : '✗ (<5)'}`),
        ``,
        `**Mandatory scenario coverage:**`,
        ...Object.entries(v.mandatoryScenariosFound).map(([lbl, n]) => `- ${lbl}: ${n} cases ${n >= 1 ? '✓' : '✗'}`),
        ``,
        `## Sample Cases`,
        ``,
        `| # | Label | Symbol | Date | Horizon | Bucket | Score | Decile | ReturnPct | ReturnClass | Status |`,
        `|---|-------|--------|------|---------|--------|-------|--------|-----------|-------------|--------|`,
        ...artifact.cases.map((c, i) =>
            `| ${i + 1} | ${c.label} | ${c.symbol} | ${c.originalAsOfDate} | ${c.horizonDays}d | ${c.researchBucket} | ${c.primaryScore} | ${c.scoreDecile ?? '-'} | ${fmtN(c.returnPct)} | ${c.returnClass} | ${c.scoringCompletenessStatus} |`
        ),
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

run();
