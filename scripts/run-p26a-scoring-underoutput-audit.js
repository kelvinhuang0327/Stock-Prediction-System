#!/usr/bin/env node
/**
 * run-p26a-scoring-underoutput-audit.js
 * P26A-HARDRESET PART D — Scoring Engine Underoutput Audit (Read-Only)
 *
 * Reads P8-tagged SCORING_UNDEROUTPUT cases and classifies why the scoring
 * engine produced underspecified reasons. Does NOT modify scores, thresholds,
 * or reason templates.
 *
 * Output:
 *   outputs/online_validation/p26a_scoring_underoutput_audit.json
 *   outputs/online_validation/p26a_scoring_underoutput_audit.md
 */

'use strict';

const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, '..', 'outputs', 'online_validation');
const P8_AUDIT_PATH = path.join(OUT, 'p8preflight_signal_reason_diagnosis.json');

// ─── Load P8 audit ────────────────────────────────────────────────────────────

if (!fs.existsSync(P8_AUDIT_PATH)) {
    console.error('ERROR: P8 audit not found at', P8_AUDIT_PATH);
    process.exit(1);
}

const p8Data = JSON.parse(fs.readFileSync(P8_AUDIT_PATH, 'utf8'));
const allCases = p8Data.cases || [];

const UNDEROUTPUT_CATEGORY = 'SCORING_ENGINE_UNDEROUTPUT';
const underoutputCases = allCases.filter(c => c.diagnosisCategory === UNDEROUTPUT_CATEGORY);

console.log(`P8 total cases: ${allCases.length}`);
console.log(`SCORING_UNDEROUTPUT cases: ${underoutputCases.length}`);

// ─── Classify each underoutput case ──────────────────────────────────────────

/**
 * Classification categories:
 * a) NO_TRIGGERED_FACTOR — no SignalFusionEngine factor reached threshold
 * b) CONTRIBUTION_BELOW_REASON_THRESHOLD — factor triggered but contribution too small
 * c) TEMPLATE_BRANCH_MISSING — factor triggered but no reason template branch exists
 * d) UNKNOWN_NEEDS_CODE_TRACE — cannot classify without deeper trace
 */
function classifyUnderoutput(c) {
    const factorCount = c.factorCount || 0;
    const evidence = c.evidence || {};
    const factorSummary = c.factorSummary || '';

    // If factorCount <= 1 and single-token reason: likely no triggered factor
    if (factorCount <= 1) {
        return {
            classification: 'NO_TRIGGERED_FACTOR',
            rationale: `factorCount=${factorCount}. Single-token reason suggests no SignalFusionEngine signal reached threshold for multi-factor snapshot output.`,
            canFixByTemplateBranch: false,
        };
    }

    // If factorCount >= 2 but reason is still single-token: contribution likely below threshold
    if (factorCount >= 2 && (c.reasonNormalized || '').split('/').length <= 1) {
        return {
            classification: 'CONTRIBUTION_BELOW_REASON_THRESHOLD',
            rationale: `factorCount=${factorCount} but reason is single-token. Factors computed but no contribution met the reason inclusion threshold.`,
            canFixByTemplateBranch: false,
        };
    }

    return {
        classification: 'UNKNOWN_NEEDS_CODE_TRACE',
        rationale: 'Cannot classify without live DB trace.',
        canFixByTemplateBranch: false,
    };
}

const classifiedCases = underoutputCases.map(c => {
    const cls = classifyUnderoutput(c);
    return {
        caseId: c.caseId,
        symbol: c.symbol,
        asOf: c.asOf,
        horizon: c.horizon,
        p8Category: UNDEROUTPUT_CATEGORY,
        reasonRaw: c.reasonRaw,
        factorCount: c.factorCount,
        factorSummary: c.factorSummary,
        auditClassification: cls.classification,
        classificationRationale: cls.rationale,
        canBeFixedByTemplateBranch: cls.canFixByTemplateBranch,
        repairAction: 'READ_ONLY_AUDIT — no score/threshold/template modification',
    };
});

// ─── Build summary ────────────────────────────────────────────────────────────

const summary = classifiedCases.reduce((acc, c) => {
    acc[c.auditClassification] = (acc[c.auditClassification] || 0) + 1;
    return acc;
}, { NO_TRIGGERED_FACTOR: 0, CONTRIBUTION_BELOW_REASON_THRESHOLD: 0, TEMPLATE_BRANCH_MISSING: 0, UNKNOWN_NEEDS_CODE_TRACE: 0 });

const auditOutput = {
    phase: 'P26A-HARDRESET PART D',
    generatedAt: new Date().toISOString(),
    disclaimer: 'Read-only scoring underoutput audit. No scores, thresholds, or templates were modified. No investment recommendations.',
    totalCases: classifiedCases.length,
    classificationSummary: summary,
    cases: classifiedCases,
    verdict: 'AUDIT_COMPLETE_NO_MODIFICATION',
    nextSteps: 'SCORING_UNDEROUTPUT cases remain read-only. CONTRIBUTION_BELOW_REASON_THRESHOLD cases may be addressed in a future sprint via template deepening — not this sprint.',
};

// ─── Write JSON ───────────────────────────────────────────────────────────────

const jsonPath = path.join(OUT, 'p26a_scoring_underoutput_audit.json');
fs.writeFileSync(jsonPath, JSON.stringify(auditOutput, null, 2), 'utf8');
console.log('Wrote:', jsonPath);

// ─── Write MD ────────────────────────────────────────────────────────────────

const mdLines = [
    '# P26A-HARDRESET: Scoring Underoutput Audit (PART D)',
    '',
    `**Generated:** ${auditOutput.generatedAt}  `,
    `**Phase:** P26A-HARDRESET PART D  `,
    `**Total Cases:** ${auditOutput.totalCases}  `,
    '',
    '> Read-only audit. No scores, thresholds, or templates modified.',
    '',
    '## Classification Summary',
    '',
    '| Category | Count |',
    '|----------|-------|',
    ...Object.entries(summary).map(([k, v]) => `| ${k} | ${v} |`),
    '',
    '## Case Details',
    '',
    '| Case ID | Symbol | asOf | Classification | Can Fix by Template? |',
    '|---------|--------|------|---------------|---------------------|',
    ...classifiedCases.map(c =>
        `| ${c.caseId} | ${c.symbol} | ${c.asOf} | ${c.auditClassification} | ${c.canBeFixedByTemplateBranch ? 'YES' : 'NO'} |`
    ),
    '',
    '## Verdict',
    '',
    `**${auditOutput.verdict}**`,
    '',
    auditOutput.nextSteps,
];

const mdPath = path.join(OUT, 'p26a_scoring_underoutput_audit.md');
fs.writeFileSync(mdPath, mdLines.join('\n'), 'utf8');
console.log('Wrote:', mdPath);

console.log('\nSummary:', JSON.stringify(summary));
console.log('DONE: P26A PART D audit complete.');
