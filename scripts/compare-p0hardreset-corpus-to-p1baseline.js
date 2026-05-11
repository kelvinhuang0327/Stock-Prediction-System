'use strict';

/**
 * compare-p0hardreset-corpus-to-p1baseline.js
 *
 * P1-HARDRESET PART D — Observability comparison script.
 *
 * Reads P0 (p0hardreset_historical_replay_corpus.jsonl) and
 * P1 (p1baseline_historical_replay_corpus.jsonl) corpus files.
 *
 * Computes descriptive statistics ONLY:
 *   - count, mean, median, min, max, stddev of returnPct
 *   - by baselineType (P1) and horizon
 *   - coverage ratio and priceSource distribution
 *
 * FORBIDDEN: win_rate, alpha, ROI, profit, outperform, edge,
 *            expected_return, predicted_return, buy, sell claims.
 *
 * Outputs:
 *   outputs/online_validation/p1baseline_comparison_observability.json
 *   outputs/online_validation/p1baseline_comparison_observability.md
 */

const fs = require('node:fs');
const path = require('node:path');

// ── Stats helpers ─────────────────────────────────────────────────────────────

function computeStats(values) {
    if (values.length === 0) return { count: 0, mean: null, median: null, min: null, max: null, stddev: null };
    const sorted = [...values].sort((a, b) => a - b);
    const count = sorted.length;
    const sum = sorted.reduce((acc, v) => acc + v, 0);
    const mean = sum / count;
    const mid = Math.floor(count / 2);
    const median = count % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
    const min = sorted[0];
    const max = sorted[count - 1];
    const variance = sorted.reduce((acc, v) => acc + (v - mean) ** 2, 0) / count;
    const stddev = Math.sqrt(variance);
    return {
        count,
        mean: round4(mean),
        median: round4(median),
        min: round4(min),
        max: round4(max),
        stddev: round4(stddev),
    };
}

function round4(n) {
    return Math.round(n * 10000) / 10000;
}

function priceSourceCoverage(dist) {
    const total = Object.values(dist).reduce((a, b) => a + b, 0);
    const real = dist['stockQuote.close'] ?? 0;
    return total === 0 ? 0 : round4((real / total) * 100);
}

// ── Read JSONL ────────────────────────────────────────────────────────────────

function readJsonlLines(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.trim().split('\n').filter(Boolean);
    const parsed = [];
    let errors = 0;
    for (const line of lines) {
        try {
            parsed.push(JSON.parse(line));
        } catch {
            errors++;
        }
    }
    return { lines: parsed, parseErrors: errors };
}

function buildPriceSourceDist(lines) {
    const dist = {};
    for (const l of lines) {
        const src = l.priceSource ?? 'UNKNOWN';
        dist[src] = (dist[src] ?? 0) + 1;
    }
    return dist;
}

// ── Stats by dimension ────────────────────────────────────────────────────────

function statsBy(lines, keyFn) {
    const groups = {};
    for (const line of lines) {
        const key = keyFn(line);
        if (!groups[key]) groups[key] = [];
        if (line.returnPct !== null && line.returnPct !== undefined) {
            groups[key].push(line.returnPct);
        }
    }
    const result = {};
    for (const [key, vals] of Object.entries(groups)) {
        result[key] = computeStats(vals);
    }
    return result;
}

// ── Main ──────────────────────────────────────────────────────────────────────

function main() {
    const OUTPUTS_DIR = path.resolve(__dirname, '../outputs/online_validation');
    const P0_CORPUS = path.join(OUTPUTS_DIR, 'p0hardreset_historical_replay_corpus.jsonl');
    const P1_CORPUS = path.join(OUTPUTS_DIR, 'p1baseline_historical_replay_corpus.jsonl');

    console.log('[P1-PART-D] Reading P0 corpus...');
    const { lines: p0Lines, parseErrors: p0Errors } = readJsonlLines(P0_CORPUS);
    console.log(`[P1-PART-D] P0: ${p0Lines.length} lines, ${p0Errors} parse errors`);

    console.log('[P1-PART-D] Reading P1 corpus...');
    const { lines: p1Lines, parseErrors: p1Errors } = readJsonlLines(P1_CORPUS);
    console.log(`[P1-PART-D] P1: ${p1Lines.length} lines, ${p1Errors} parse errors`);

    // ── P0 stats ───────────────────────────────────────────────────────────────
    const p0PriceSourceDist = buildPriceSourceDist(p0Lines);
    const p0CoveragePct = priceSourceCoverage(p0PriceSourceDist);
    const p0ByHorizon = statsBy(p0Lines, l => `horizon_${l.horizonDays}d`);
    const p0BySymbol = statsBy(p0Lines, l => `symbol_${l.symbol}`);

    // ── P1 stats ───────────────────────────────────────────────────────────────
    const p1PriceSourceDist = buildPriceSourceDist(p1Lines);
    const p1CoveragePct = priceSourceCoverage(p1PriceSourceDist);
    const p1ByType = statsBy(p1Lines, l => `type_${l.baselineType}`);
    const p1ByHorizon = statsBy(p1Lines, l => `horizon_${l.horizonDays}d`);
    const p1ByTypeAndHorizon = statsBy(p1Lines, l => `${l.baselineType}__${l.horizonDays}d`);

    // ── Unique dimensions ──────────────────────────────────────────────────────
    const p0Symbols = new Set(p0Lines.map(l => l.symbol));
    const p0Dates = new Set(p0Lines.map(l => l.asOfDate ?? l.originalAsOfDate));
    const p1Symbols = new Set(p1Lines.map(l => l.symbol));
    const p1Dates = new Set(p1Lines.map(l => l.originalAsOfDate));
    const p1Types = new Set(p1Lines.map(l => l.baselineType));

    // ── P1 type/date counts ────────────────────────────────────────────────────
    const p1TypeCounts = {};
    for (const l of p1Lines) {
        p1TypeCounts[l.baselineType] = (p1TypeCounts[l.baselineType] ?? 0) + 1;
    }

    // ── Overall P0/P1 returnPct stats ──────────────────────────────────────────
    const p0ReturnPctVals = p0Lines.filter(l => l.returnPct !== null).map(l => l.returnPct);
    const p1ReturnPctVals = p1Lines.filter(l => l.returnPct !== null).map(l => l.returnPct);

    const report = {
        generatedAt: new Date().toISOString(),
        scriptVersion: 'compare-p0hardreset-corpus-to-p1baseline-v1',
        observabilityOnly: true,
        disclaimer: 'Descriptive statistics only. No investment recommendations, ROI claims, alpha claims, or predictions.',
        p0: {
            file: 'p0hardreset_historical_replay_corpus.jsonl',
            totalLines: p0Lines.length,
            parseErrors: p0Errors,
            uniqueSymbols: p0Symbols.size,
            uniqueAsOfDates: p0Dates.size,
            priceSourceDist: p0PriceSourceDist,
            coveragePct: p0CoveragePct,
            returnPctStats: computeStats(p0ReturnPctVals),
            returnPctByHorizon: p0ByHorizon,
            returnPctTop5SymbolsByMean: Object.entries(p0BySymbol)
                .filter(([, s]) => s.count >= 3)
                .sort(([, a], [, b]) => (b.mean ?? 0) - (a.mean ?? 0))
                .slice(0, 5)
                .map(([k, s]) => ({ symbol: k.replace('symbol_', ''), ...s })),
        },
        p1: {
            file: 'p1baseline_historical_replay_corpus.jsonl',
            totalLines: p1Lines.length,
            parseErrors: p1Errors,
            uniqueSymbols: p1Symbols.size,
            uniqueAsOfDates: p1Dates.size,
            uniqueBaselineTypes: [...p1Types],
            typeCounts: p1TypeCounts,
            priceSourceDist: p1PriceSourceDist,
            coveragePct: p1CoveragePct,
            returnPctStats: computeStats(p1ReturnPctVals),
            returnPctByType: p1ByType,
            returnPctByHorizon: p1ByHorizon,
            returnPctByTypeAndHorizon: p1ByTypeAndHorizon,
        },
        crossCorpus: {
            note: 'Observability bridge — P0 is system predictions corpus, P1 is naive reference baseline corpus. No alpha, ROI, or outperformance claims made.',
            p0VsP1LineDelta: p0Lines.length - p1Lines.length,
            p0CoveragePct,
            p1CoveragePct,
            p0OverallMeanReturnPct: computeStats(p0ReturnPctVals).mean,
            p1OverallMeanReturnPct: computeStats(p1ReturnPctVals).mean,
            limitations: [
                'P0 corpus contains system-generated prediction entries — not a strategy recommendation.',
                'P1 corpus is a naive reference baseline — not a strategy recommendation.',
                'Return % figures are back-computed from historical TWSE close prices and are observational only.',
                'No live trading, no buy/sell signals, no investment advice derived from this comparison.',
                'Past statistical summaries do not predict future returns.',
                'Coverage gaps (MISSING/PENDING) affect completeness of statistics.',
            ],
        },
    };

    // ── Write JSON ─────────────────────────────────────────────────────────────
    const outJsonPath = path.join(OUTPUTS_DIR, 'p1baseline_comparison_observability.json');
    fs.writeFileSync(outJsonPath, JSON.stringify(report, null, 2));
    console.log(`[P1-PART-D] Written: ${outJsonPath}`);

    // ── Write MD ───────────────────────────────────────────────────────────────
    function fmtStats(s) {
        if (!s || s.count === 0) return 'n/a';
        return `n=${s.count}, mean=${s.mean}%, median=${s.median}%, min=${s.min}%, max=${s.max}%, σ=${s.stddev}%`;
    }

    const p1ByTypeTable = Object.entries(p1ByType)
        .map(([k, s]) => `| ${k.replace('type_', '')} | ${fmtStats(s)} |`)
        .join('\n');

    const p1ByHorizonTable = Object.entries(p1ByHorizon)
        .map(([k, s]) => `| ${k} | ${fmtStats(s)} |`)
        .join('\n');

    const p0ByHorizonTable = Object.entries(p0ByHorizon)
        .map(([k, s]) => `| ${k} | ${fmtStats(s)} |`)
        .join('\n');

    const md = `# P1 Baseline vs P0 — Observability Comparison

Generated: ${report.generatedAt}
Script: compare-p0hardreset-corpus-to-p1baseline-v1

> **Observability only.** No investment recommendations, ROI claims, alpha claims, or predictions.

## Corpus Overview

| Metric | P0 (System Predictions) | P1 (Naive Baseline) |
|--------|------------------------|---------------------|
| Total Lines | ${report.p0.totalLines} | ${report.p1.totalLines} |
| Unique Symbols | ${report.p0.uniqueSymbols} | ${report.p1.uniqueSymbols} |
| Unique AsOfDates | ${report.p0.uniqueAsOfDates} | ${report.p1.uniqueAsOfDates} |
| Coverage % | ${report.p0.coveragePct}% | ${report.p1.coveragePct}% |
| Parse Errors | ${report.p0.parseErrors} | ${report.p1.parseErrors} |

## P0 Price Source Distribution

${Object.entries(p0PriceSourceDist).map(([k, v]) => `- ${k}: ${v}`).join('\n')}

## P1 Price Source Distribution

${Object.entries(p1PriceSourceDist).map(([k, v]) => `- ${k}: ${v}`).join('\n')}

## P0 Return% — Overall & By Horizon

Overall: ${fmtStats(computeStats(p0ReturnPctVals))}

| Horizon | Stats |
|---------|-------|
${p0ByHorizonTable}

## P1 Return% — By Baseline Type

| Type | Stats |
|------|-------|
${p1ByTypeTable}

## P1 Return% — By Horizon

| Horizon | Stats |
|---------|-------|
${p1ByHorizonTable}

## Cross-Corpus Notes

${report.crossCorpus.limitations.map(l => `- ${l}`).join('\n')}

---
*P0 file:* p0hardreset_historical_replay_corpus.jsonl  
*P1 file:* p1baseline_historical_replay_corpus.jsonl
`;

    const outMdPath = path.join(OUTPUTS_DIR, 'p1baseline_comparison_observability.md');
    fs.writeFileSync(outMdPath, md);
    console.log(`[P1-PART-D] Written: ${outMdPath}`);
    console.log('[P1-PART-D] ✅  Comparison observability report complete');
}

main();
