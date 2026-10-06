/**
 * P26F-HARDRESET: Candidate Corpus Quality Gate
 *
 * Validates candidate JSONL files for structural correctness.
 * Verifies original corpus sha256 unchanged.
 * No ROI/win-rate/profit/outperform/buy/sell claims.
 */
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const OUT_DIR = 'outputs/online_validation';
const RESULT_JSON = path.join(OUT_DIR, 'p26f_candidate_corpus_quality_gate.json');
const RESULT_MD = path.join(OUT_DIR, 'p26f_candidate_corpus_quality_gate.md');

const P3_ORIGINAL = path.join(OUT_DIR, 'p3active_scoring_historical_replay_corpus.jsonl');
const P19_ORIGINAL = path.join(OUT_DIR, 'p19active_scoring_pit_replay_corpus.jsonl');
const P3_CANDIDATE = path.join(OUT_DIR, 'p26f_monthly_revenue_candidate_p3_enriched.jsonl');
const P19_CANDIDATE = path.join(OUT_DIR, 'p26f_monthly_revenue_candidate_p19_enriched.jsonl');

// Record original sha256 before we read candidates
const originalP3Sha256 = crypto.createHash('sha256').update(fs.readFileSync(P3_ORIGINAL)).digest('hex');
const originalP19Sha256 = crypto.createHash('sha256').update(fs.readFileSync(P19_ORIGINAL)).digest('hex');

function readJSONLRaw(filePath) {
  return fs.readFileSync(filePath, 'utf8').split('\n').filter(l => l.trim());
}

// Read candidate files
const p3RawLines = readJSONLRaw(P3_CANDIDATE);
const p19RawLines = readJSONLRaw(P19_CANDIDATE);

let allRowsParseable = true;
let allRowsHaveContext = true;
let allContextReadOnly = true;
let allContextEntersAlphaScoreFalse = true;
let noOutcomeFieldsInContext = true;
const FORBIDDEN_OUTCOME_FIELDS = ['outcomePrice', 'returnPct', 'realizedReturnClass'];
const FORBIDDEN_CLAIMS = ['scoringChangeAllowed: true', 'optimizerAllowed: true', 'overwritesFrozenCorpus: true'];

let noForbiddenClaims = true;

function processLines(lines, label) {
  for (const line of lines) {
    let row;
    try {
      row = JSON.parse(line);
    } catch (e) {
      allRowsParseable = false;
      console.error(`[P26F QG] Parse error in ${label}: ${e.message}`);
      continue;
    }

    if (!row.p26fMonthlyRevenueContext) {
      allRowsHaveContext = false;
      continue;
    }

    const ctx = row.p26fMonthlyRevenueContext;

    if (ctx.readOnly !== true) allContextReadOnly = false;
    if (ctx.entersAlphaScore !== false) allContextEntersAlphaScoreFalse = false;

    for (const f of FORBIDDEN_OUTCOME_FIELDS) {
      if (f in ctx) {
        noOutcomeFieldsInContext = false;
        console.error(`[P26F QG] Forbidden outcome field "${f}" found in ${label} row`);
      }
    }

    const ctxStr = JSON.stringify(ctx);
    for (const claim of FORBIDDEN_CLAIMS) {
      if (ctxStr.includes(claim)) {
        noForbiddenClaims = false;
        console.error(`[P26F QG] Forbidden claim "${claim}" in ${label}`);
      }
    }
  }
}

processLines(p3RawLines, 'P3_CANDIDATE');
processLines(p19RawLines, 'P19_CANDIDATE');

// Verify original files unchanged after reads
const currentP3Sha256 = crypto.createHash('sha256').update(fs.readFileSync(P3_ORIGINAL)).digest('hex');
const currentP19Sha256 = crypto.createHash('sha256').update(fs.readFileSync(P19_ORIGINAL)).digest('hex');
const originalP3Sha256Unchanged = currentP3Sha256 === originalP3Sha256;
const originalP19Sha256Unchanged = currentP19Sha256 === originalP19Sha256;

const allPass = p3RawLines.length === 4500 &&
  p19RawLines.length === 4500 &&
  allRowsParseable &&
  allRowsHaveContext &&
  allContextReadOnly &&
  allContextEntersAlphaScoreFalse &&
  noOutcomeFieldsInContext &&
  originalP3Sha256Unchanged &&
  originalP19Sha256Unchanged &&
  noForbiddenClaims;

const result = {
  phase: 'P26F-HARDRESET',
  p3CandidateRowCount: p3RawLines.length,
  p19CandidateRowCount: p19RawLines.length,
  allRowsParseable,
  allRowsHaveContext,
  allContextReadOnly,
  allContextEntersAlphaScoreFalse,
  noOutcomeFieldsInContext,
  originalP3Sha256Unchanged,
  originalP19Sha256Unchanged,
  noForbiddenClaims,
  status: allPass ? 'QUALITY_GATE_PASS' : 'QUALITY_GATE_FAIL',
};

fs.writeFileSync(RESULT_JSON, JSON.stringify(result, null, 2));

const md = `# P26F Candidate Corpus Quality Gate

**Phase:** P26F-HARDRESET  
**Status:** ${result.status}

## Checks

| Check | Result |
|---|---|
| P3 candidate row count = 4500 | ${p3RawLines.length === 4500 ? '✅ ' + p3RawLines.length : '❌ ' + p3RawLines.length} |
| P19 candidate row count = 4500 | ${p19RawLines.length === 4500 ? '✅ ' + p19RawLines.length : '❌ ' + p19RawLines.length} |
| All rows parseable | ${allRowsParseable ? '✅' : '❌'} |
| All rows have p26fMonthlyRevenueContext | ${allRowsHaveContext ? '✅' : '❌'} |
| All context readOnly=true | ${allContextReadOnly ? '✅' : '❌'} |
| All context entersAlphaScore=false | ${allContextEntersAlphaScoreFalse ? '✅' : '❌'} |
| No outcome fields in context | ${noOutcomeFieldsInContext ? '✅' : '❌'} |
| Original P3 sha256 unchanged | ${originalP3Sha256Unchanged ? '✅' : '❌'} |
| Original P19 sha256 unchanged | ${originalP19Sha256Unchanged ? '✅' : '❌'} |
| No forbidden claims | ${noForbiddenClaims ? '✅' : '❌'} |

*Disclaimer: No investment recommendations. No ROI/win-rate/profit/outperform/buy/sell claims.*
`;
fs.writeFileSync(RESULT_MD, md);

console.log(`[P26F] Candidate Corpus Quality Gate: ${result.status}`);
console.log(`  P3: ${p3RawLines.length} rows, P19: ${p19RawLines.length} rows`);
console.log(`  allParseable: ${allRowsParseable}, allHaveContext: ${allRowsHaveContext}`);
console.log(`  readOnly: ${allContextReadOnly}, entersAlphaFalse: ${allContextEntersAlphaScoreFalse}`);
console.log(`  noOutcomeFields: ${noOutcomeFieldsInContext}, origP3Unchanged: ${originalP3Sha256Unchanged}, origP19Unchanged: ${originalP19Sha256Unchanged}`);

if (!allPass) {
  console.error('[P26F] QUALITY GATE FAIL');
  process.exit(1);
}
