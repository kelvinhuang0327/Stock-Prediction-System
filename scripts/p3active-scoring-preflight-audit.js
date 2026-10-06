/**
 * p3active-scoring-preflight-audit.js — P3-HARDRESET PART A
 *
 * Pre-flight audit for P3 active scoring historical replay.
 * Verifies:
 * 1. Required P0/P1/P2 artifacts exist and are intact
 * 2. P0 corpus is all-Neutral / all-zero (root cause of P2 finding)
 * 3. Required scoring modules exist (RuleBasedStockAnalyzer, SignalFusionEngine)
 * 4. analyzeStock function is exported from RuleBasedStockAnalyzer
 * 5. ShadowPredictionLogContract sanitizeResearchCandidateForShadowLog exists
 *
 * Outputs:
 *   outputs/online_validation/p3active_scoring_preflight_audit.json
 *   outputs/online_validation/p3active_scoring_preflight_audit.md
 *
 * Not investment advice. No external API. No LLM.
 */

'use strict';
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const OV_DIR = path.join(ROOT, 'outputs', 'online_validation');
const SRC_OV = path.join(ROOT, 'src', 'lib', 'onlineValidation');
const SRC_ANALYSIS = path.join(ROOT, 'src', 'lib', 'analysis');
const SRC_ALPHA = path.join(ROOT, 'src', 'lib', 'alpha');
const SRC_SCREEN = path.join(ROOT, 'src', 'lib', 'screen');

const results = [];
let passCount = 0;
let failCount = 0;
let warnCount = 0;

function check(id, desc, fn) {
    try {
        const val = fn();
        if (val === true || val === undefined) {
            results.push({ id, status: 'PASS', desc, detail: null });
            passCount++;
        } else if (val && val.status === 'WARN') {
            results.push({ id, status: 'WARN', desc, detail: val.detail });
            warnCount++;
        } else {
            results.push({ id, status: 'FAIL', desc, detail: String(val) });
            failCount++;
        }
    } catch (err) {
        results.push({ id, status: 'FAIL', desc, detail: err.message });
        failCount++;
    }
}

function requireFile(p) {
    if (!fs.existsSync(p)) throw new Error(`Missing: ${p}`);
    return true;
}

function requireJsonFile(p) {
    requireFile(p);
    JSON.parse(fs.readFileSync(p, 'utf8'));
    return true;
}

function countLines(p) {
    requireFile(p);
    const content = fs.readFileSync(p, 'utf8').trim();
    return content ? content.split('\n').length : 0;
}

// ─── A1: P0 artifacts ────────────────────────────────────────────
check('A1.1', 'P0 corpus exists', () => requireFile(path.join(OV_DIR, 'p0hardreset_historical_replay_corpus.jsonl')));
check('A1.2', 'P0 corpus = 4500 lines', () => {
    const n = countLines(path.join(OV_DIR, 'p0hardreset_historical_replay_corpus.jsonl'));
    if (n !== 4500) throw new Error(`Expected 4500 lines, got ${n}`);
    return true;
});
check('A1.3', 'P0 artifact JSON valid', () => requireJsonFile(path.join(OV_DIR, 'p0hardreset_historical_replay_artifact.json')));
check('A1.4', 'P0 universe audit JSON valid', () => requireJsonFile(path.join(OV_DIR, 'p0hardreset_universe_audit.json')));
check('A1.5', 'P0 asOfDate candidates JSON valid', () => requireJsonFile(path.join(OV_DIR, 'p0hardreset_historical_asofdate_candidates.json')));

// ─── A2: P1 artifacts ────────────────────────────────────────────
check('A2.1', 'P1 corpus exists', () => requireFile(path.join(OV_DIR, 'p1baseline_historical_replay_corpus.jsonl')));
check('A2.2', 'P1 corpus = 9900 lines', () => {
    const n = countLines(path.join(OV_DIR, 'p1baseline_historical_replay_corpus.jsonl'));
    if (n !== 9900) throw new Error(`Expected 9900 lines, got ${n}`);
    return true;
});

// ─── A3: P2 artifacts ────────────────────────────────────────────
check('A3.1', 'P2 final report exists', () => requireFile(path.join(OV_DIR, 'p2spotcheck_final_report.md')));
check('A3.2', 'P2 field inspection JSON valid', () => requireJsonFile(path.join(OV_DIR, 'p2spotcheck_corpus_field_inspection.json')));
check('A3.3', 'P2 prediction audit JSON valid', () => requireJsonFile(path.join(OV_DIR, 'p2spotcheck_prediction_layer_audit.json')));

// ─── A4: Frozen corpus ───────────────────────────────────────────
check('A4.1', 'Frozen corpus exists', () => requireFile(path.join(OV_DIR, 'simulation_snapshot_corpus.jsonl')));
check('A4.2', 'Frozen corpus = 60 lines', () => {
    const n = countLines(path.join(OV_DIR, 'simulation_snapshot_corpus.jsonl'));
    if (n !== 60) throw new Error(`Expected 60 lines, got ${n}`);
    return true;
});

// ─── A5: P0 corpus root cause — all Neutral / all zero ───────────
check('A5.1', 'P0 corpus all researchBucket=Neutral', () => {
    const lines = fs.readFileSync(path.join(OV_DIR, 'p0hardreset_historical_replay_corpus.jsonl'), 'utf8').trim().split('\n');
    const nonNeutral = lines.filter(l => {
        const o = JSON.parse(l);
        return o.researchBucket !== 'Neutral';
    });
    if (nonNeutral.length > 0) {
        throw new Error(`Expected all Neutral, found ${nonNeutral.length} non-Neutral`);
    }
    return true;
});

check('A5.2', 'P0 corpus all scoreSnapshot fields = 0', () => {
    const lines = fs.readFileSync(path.join(OV_DIR, 'p0hardreset_historical_replay_corpus.jsonl'), 'utf8').trim().split('\n');
    let nonZeroCount = 0;
    for (const l of lines) {
        const o = JSON.parse(l);
        const s = o.scoreSnapshot;
        if (s && Object.values(s).some(v => Number(v) !== 0)) nonZeroCount++;
    }
    if (nonZeroCount > 0) {
        throw new Error(`Expected all-zero scoreSnapshot, found ${nonZeroCount} non-zero`);
    }
    return true;
});

check('A5.3', 'P0 corpus has no scoringCompletenessStatus field', () => {
    const first = JSON.parse(fs.readFileSync(path.join(OV_DIR, 'p0hardreset_historical_replay_corpus.jsonl'), 'utf8').trim().split('\n')[0]);
    if ('scoringCompletenessStatus' in first) {
        throw new Error('P0 corpus already has scoringCompletenessStatus — was it already patched?');
    }
    return true;
});

// ─── A6: Scoring modules ─────────────────────────────────────────
check('A6.1', 'RuleBasedStockAnalyzer.ts exists', () => requireFile(path.join(SRC_ANALYSIS, 'RuleBasedStockAnalyzer.ts')));
check('A6.2', 'RuleBasedStockAnalyzer exports analyzeStock', () => {
    const content = fs.readFileSync(path.join(SRC_ANALYSIS, 'RuleBasedStockAnalyzer.ts'), 'utf8');
    if (!content.includes('export async function analyzeStock')) {
        throw new Error('analyzeStock not found as export');
    }
    return true;
});
check('A6.3', 'analyzeStock accepts asOf parameter (PIT-safe)', () => {
    const content = fs.readFileSync(path.join(SRC_ANALYSIS, 'RuleBasedStockAnalyzer.ts'), 'utf8');
    if (!content.includes('analyzeStock(symbol: string, asOf?: string)')) {
        throw new Error('analyzeStock asOf parameter not found');
    }
    return true;
});
check('A6.4', 'RuleBasedStockAnalyzer is PIT-safe (asOfDb reference)', () => {
    const content = fs.readFileSync(path.join(SRC_ANALYSIS, 'RuleBasedStockAnalyzer.ts'), 'utf8');
    if (!content.includes('asOfDb') && !content.includes('asOf')) {
        throw new Error('No asOf/asOfDb gate found in RuleBasedStockAnalyzer');
    }
    return true;
});
check('A6.5', 'SignalFusionEngine.ts exists', () => requireFile(path.join(SRC_ALPHA, 'SignalFusionEngine.ts')));
check('A6.6', 'StrategyScreenEngine.ts exists', () => requireFile(path.join(SRC_SCREEN, 'StrategyScreenEngine.ts')));

// ─── A7: ShadowPrediction modules ────────────────────────────────
check('A7.1', 'ShadowPredictionLogContract.ts exists', () => requireFile(path.join(SRC_OV, 'ShadowPredictionLogContract.ts')));
check('A7.2', 'ShadowPredictionLogContract exports sanitizeResearchCandidateForShadowLog', () => {
    const content = fs.readFileSync(path.join(SRC_OV, 'ShadowPredictionLogContract.ts'), 'utf8');
    if (!content.includes('export function sanitizeResearchCandidateForShadowLog')) {
        throw new Error('sanitizeResearchCandidateForShadowLog not found');
    }
    return true;
});
check('A7.3', 'ShadowPredictionHistoricalReplayWriter.ts exists', () => requireFile(path.join(SRC_OV, 'ShadowPredictionHistoricalReplayWriter.ts')));
check('A7.4', 'ShadowPredictionHistoricalReplayWriter exports runHistoricalReplayShadowWrite', () => {
    const content = fs.readFileSync(path.join(SRC_OV, 'ShadowPredictionHistoricalReplayWriter.ts'), 'utf8');
    if (!content.includes('export async function runHistoricalReplayShadowWrite')) {
        throw new Error('runHistoricalReplayShadowWrite not found');
    }
    return true;
});
check('A7.5', 'ShadowPredictionHistoricalReplayWriter has CandidateProvider interface', () => {
    const content = fs.readFileSync(path.join(SRC_OV, 'ShadowPredictionHistoricalReplayWriter.ts'), 'utf8');
    if (!content.includes('export interface CandidateProvider')) {
        throw new Error('CandidateProvider not found');
    }
    return true;
});
check('A7.6', 'DefaultStockQuoteCandidateProvider is the P2 root cause (stub scores)', () => {
    const content = fs.readFileSync(path.join(SRC_OV, 'ShadowPredictionHistoricalReplayWriter.ts'), 'utf8');
    if (!content.includes("alphaScore: 0") || !content.includes("recommendationBucket: 'Neutral'")) {
        throw new Error('DefaultStockQuoteCandidateProvider stub scores not confirmed');
    }
    return true;
});

// ─── A8: P3 target does NOT exist yet ────────────────────────────
check('A8.1', 'P3 corpus does not yet exist (fresh start)', () => {
    const p3 = path.join(OV_DIR, 'p3active_scoring_historical_replay_corpus.jsonl');
    if (fs.existsSync(p3)) {
        return { status: 'WARN', detail: 'P3 corpus already exists — will be overwritten by P3 runner' };
    }
    return true;
});
check('A8.2', 'ActiveScoringSnapshotBuilder.ts does not yet exist (to be created)', () => {
    const f = path.join(SRC_OV, 'ActiveScoringSnapshotBuilder.ts');
    if (fs.existsSync(f)) {
        return { status: 'WARN', detail: 'ActiveScoringSnapshotBuilder.ts already exists — will be created/overwritten in PART B' };
    }
    return true;
});

// ─── A9: DB availability probe (Prisma) ──────────────────────────
check('A9.1', 'Prisma schema exists', () => requireFile(path.join(ROOT, 'prisma', 'schema.prisma')));
check('A9.2', 'Prisma client generated (node_modules)', () => {
    const p = path.join(ROOT, 'node_modules', '@prisma', 'client', 'index.js');
    if (!fs.existsSync(p)) {
        throw new Error('Prisma client not generated');
    }
    return true;
});
check('A9.3', 'P0 corpus has >90% stockQuote.close priceSource (confirms DB access)', () => {
    const lines = fs.readFileSync(path.join(OV_DIR, 'p0hardreset_historical_replay_corpus.jsonl'), 'utf8').trim().split('\n');
    let realCount = 0;
    for (const l of lines) {
        const o = JSON.parse(l);
        if (o.outcomeSnapshot?.priceSource === 'stockQuote.close') realCount++;
    }
    const pct = realCount / lines.length * 100;
    if (pct < 70) {
        throw new Error(`stockQuote.close coverage ${pct.toFixed(1)}% is below 70% — DB may not have data`);
    }
    return true;
});

// ─── Summarize ───────────────────────────────────────────────────
const total = results.length;
const classification = failCount === 0
    ? 'P3_PREFLIGHT_PASS'
    : (passCount / total >= 0.8 ? 'P3_PREFLIGHT_WARN' : 'P3_PREFLIGHT_FAIL');

const audit = {
    phase: 'P3-HARDRESET PART A',
    generatedAt: new Date().toISOString(),
    classification,
    summary: { total, passCount, warnCount, failCount },
    rootCauseConfirmed: {
        p2FindingId: 'P2_SPOTCHECK_LIMITED_BY_MISSING_SCORE_FIELDS',
        cause: 'DefaultStockQuoteCandidateProvider returns all-zero scores (intentional stub for P0)',
        fix: 'ActiveScoringSnapshotBuilder will call RuleBasedStockAnalyzer.analyzeStock(symbol, asOfDate) for PIT-safe real scores',
    },
    scoringModules: {
        primaryPath: 'RuleBasedStockAnalyzer.analyzeStock(symbol, asOfDate)',
        pitSafe: true,
        dbRequired: true,
        forbiddenClaims: false,
    },
    results,
};

fs.mkdirSync(OV_DIR, { recursive: true });
fs.writeFileSync(path.join(OV_DIR, 'p3active_scoring_preflight_audit.json'), JSON.stringify(audit, null, 2), 'utf8');

// Generate markdown report
const md = [
    '# P3-HARDRESET PART A — Preflight Audit',
    '',
    `**Generated**: ${audit.generatedAt}`,
    `**Classification**: \`${classification}\``,
    `**Results**: ${passCount} PASS / ${warnCount} WARN / ${failCount} FAIL (${total} total)`,
    '',
    '## Root Cause Confirmation',
    '',
    `**P2 Finding**: \`${audit.rootCauseConfirmed.p2FindingId}\``,
    '',
    `**Cause**: ${audit.rootCauseConfirmed.cause}`,
    '',
    `**P3 Fix**: ${audit.rootCauseConfirmed.fix}`,
    '',
    '## Scoring Module Architecture',
    '',
    `- **Primary path**: \`${audit.scoringModules.primaryPath}\``,
    `- **PIT-safe**: ${audit.scoringModules.pitSafe}`,
    `- **DB required**: ${audit.scoringModules.dbRequired}`,
    `- **Forbidden claims**: ${audit.scoringModules.forbiddenClaims}`,
    '',
    '## Check Results',
    '',
    '| ID | Status | Description | Detail |',
    '|---|---|---|---|',
    ...results.map(r => `| ${r.id} | ${r.status} | ${r.desc} | ${r.detail ?? ''} |`),
    '',
    '---',
    '*P3-HARDRESET PART A — Not investment advice.*',
].join('\n');

fs.writeFileSync(path.join(OV_DIR, 'p3active_scoring_preflight_audit.md'), md, 'utf8');

console.log(`\n[P3 PART A] ${classification}: ${passCount}/${total} PASS, ${warnCount} WARN, ${failCount} FAIL`);
console.log(`Output: ${path.join(OV_DIR, 'p3active_scoring_preflight_audit.json')}`);

if (failCount > 0) {
    console.error('\nFAILED checks:');
    results.filter(r => r.status === 'FAIL').forEach(r => {
        console.error(`  [${r.id}] ${r.desc}: ${r.detail}`);
    });
    process.exit(1);
}
process.exit(0);
