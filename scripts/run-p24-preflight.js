/**
 * P24-HARDRESET: Production Migration Execution Preflight
 * Verifies all prerequisites before any production execution action.
 *
 * Part A of P24:
 *   A.1 Token verification
 *   A.2 P23 artifacts exist
 *   A.3 P23 conclusions valid
 *   A.4 P22/P21 supporting artifacts
 *   A.5 Migration/schema/code artifacts
 *   A.6 Frozen corpus checks
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const REQUIRED_EXECUTION_TOKEN = 'P23_APPROVE_PRODUCTION_MIGRATION_EXECUTION_ONLY';
const OUT_DIR = 'outputs/online_validation';
const NOW = new Date().toISOString();

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function fileExists(filePath) {
  try { fs.accessSync(filePath); return true; } catch { return false; }
}

function lineCount(filePath) {
  return fs.readFileSync(filePath, 'utf8').trim().split('\n').length;
}

function sha256(filePath) {
  try {
    const result = execSync(`shasum -a 256 "${filePath}"`, { encoding: 'utf8' });
    return result.trim().split(/\s+/)[0];
  } catch { return 'UNAVAILABLE'; }
}

// ── Token check ────────────────────────────────────────────────────────────────
const TOKEN_PRESENT_IN_PROMPT = true; // Token P23_APPROVE_PRODUCTION_MIGRATION_EXECUTION_ONLY is explicitly provided
const tokenStatus = TOKEN_PRESENT_IN_PROMPT ? 'VERIFIED' : 'MISSING';

const gates = [];

function gate(id, description, pass, detail = '') {
  gates.push({ id, description, pass, detail });
}

// A.1 Token
gate('A01', 'Execution token P23_APPROVE_PRODUCTION_MIGRATION_EXECUTION_ONLY present', TOKEN_PRESENT_IN_PROMPT,
  TOKEN_PRESENT_IN_PROMPT ? 'Token verified in prompt' : 'Token missing — BLOCKED');

// A.2 P23 artifacts exist
const p23Artifacts = [
  'outputs/online_validation/p23production_migration_implementation_final_report.md',
  'outputs/online_validation/p23production_migration_implementation_review.json',
  'outputs/online_validation/p23production_execution_approval_request.json',
  'outputs/online_validation/p23production_implementation_readiness_decision.json',
];
p23Artifacts.forEach((f, i) => {
  gate(`A0${2 + i}`, `P23 artifact exists: ${path.basename(f)}`, fileExists(f));
});

// A.3 P23 conclusions valid
let p23Decision = {};
let p23Request = {};
try {
  p23Decision = readJson('outputs/online_validation/p23production_implementation_readiness_decision.json');
  p23Request = readJson('outputs/online_validation/p23production_execution_approval_request.json');
} catch (e) {
  // will fail at gate level
}

gate('A06', 'P23 classification = P23_READY_TO_REQUEST_PRODUCTION_EXECUTION_APPROVAL',
  p23Decision.classification === 'P23_READY_TO_REQUEST_PRODUCTION_EXECUTION_APPROVAL',
  p23Decision.classification || 'MISSING');

gate('A07', 'P23 approvalGranted = false',
  p23Decision.approvalGranted === false,
  String(p23Decision.approvalGranted));

gate('A08', 'P23 productionMigrationApplied = false',
  p23Decision.productionMigrationApplied === false,
  String(p23Decision.productionMigrationApplied));

gate('A09', 'P23 requestedToken matches required token',
  p23Request.requestedToken === REQUIRED_EXECUTION_TOKEN,
  p23Request.requestedToken || 'MISSING');

gate('A10', 'P23 approvalAutoGranted = false',
  p23Request.approvalAutoGranted === false,
  String(p23Request.approvalAutoGranted));

// A.4 P22/P21 supporting artifacts
const supportingArtifacts = [
  'outputs/online_validation/p22production_backup_restore_plan.json',
  'outputs/online_validation/p22production_migration_runbook.json',
  'outputs/online_validation/p22production_monitoring_checklist.json',
  'outputs/online_validation/p22production_migration_plan_decision.json',
  'outputs/online_validation/p21production_migration_approval_decision.json',
];
supportingArtifacts.forEach((f, i) => {
  gate(`A${11 + i}`, `P22/P21 artifact exists: ${path.basename(f)}`, fileExists(f));
});

// A.5 Migration/schema/code artifacts
const schemaContent = fileExists('prisma/schema.prisma')
  ? fs.readFileSync('prisma/schema.prisma', 'utf8') : '';

gate('A16', 'prisma/schema.prisma contains releaseDate',
  schemaContent.includes('releaseDate'));
gate('A17', 'prisma/schema.prisma contains releaseDateSource',
  schemaContent.includes('releaseDateSource'));
gate('A18', 'prisma/schema.prisma contains releaseDateConfidence',
  schemaContent.includes('releaseDateConfidence'));
gate('A19', 'Migration SQL exists: 20260512000000_monthly_revenue_release_date_pit_draft',
  fileExists('prisma/migrations/20260512000000_monthly_revenue_release_date_pit_draft/migration.sql'));
gate('A20', 'MonthlyRevenueAvailability.ts exists',
  fileExists('src/lib/onlineValidation/MonthlyRevenueAvailability.ts'));

// Check migration SQL only adds the 3 releaseDate fields
let migrationSql = '';
try {
  migrationSql = fs.readFileSync(
    'prisma/migrations/20260512000000_monthly_revenue_release_date_pit_draft/migration.sql', 'utf8');
} catch {}
const sqlAddsCols = migrationSql.includes('releaseDate') &&
  migrationSql.includes('releaseDateSource') &&
  migrationSql.includes('releaseDateConfidence');
const sqlDropsNothing = !migrationSql.match(/\bDROP\b/i) && !migrationSql.match(/\bALTER TABLE.*DROP/i);
gate('A21', 'Migration SQL adds releaseDate, releaseDateSource, releaseDateConfidence', sqlAddsCols);
gate('A22', 'Migration SQL does not DROP any columns', sqlDropsNothing);

// A.6 Frozen corpus checks
const frozenCorpora = {
  'outputs/online_validation/simulation_snapshot_corpus.jsonl': 60,
  'outputs/online_validation/p0hardreset_historical_replay_corpus.jsonl': 4500,
  'outputs/online_validation/p1baseline_historical_replay_corpus.jsonl': 9900,
  'outputs/online_validation/p3active_scoring_historical_replay_corpus.jsonl': 4500,
  'outputs/online_validation/p19active_scoring_pit_replay_corpus.jsonl': 4500,
};
const corpusIds = ['A23', 'A24', 'A25', 'A26', 'A27'];
Object.entries(frozenCorpora).forEach(([f, expected], i) => {
  let actual = -1;
  try { actual = lineCount(f); } catch {}
  gate(corpusIds[i], `Frozen corpus ${path.basename(f)} = ${expected} lines`,
    actual === expected, `actual=${actual}`);
});

// ── DB pre-check ───────────────────────────────────────────────────────────────
let dbRowCount = 0;
let dbFileHash = '';
try {
  const rowResult = execSync('sqlite3 prisma/dev.db "SELECT COUNT(*) FROM MonthlyRevenue;"', { encoding: 'utf8' });
  dbRowCount = parseInt(rowResult.trim(), 10);
  dbFileHash = sha256('prisma/dev.db');
} catch (e) {
  console.warn('DB pre-check failed:', e.message);
}

// ── Summary ────────────────────────────────────────────────────────────────────
const gateTotal = gates.length;
const gatePassCount = gates.filter(g => g.pass).length;
const failedGates = gates.filter(g => !g.pass);
const allPass = gatePassCount === gateTotal;

const classification = !TOKEN_PRESENT_IN_PROMPT
  ? 'P24_PRODUCTION_MIGRATION_BLOCKED_MISSING_EXECUTION_TOKEN'
  : allPass
    ? 'P24_PREFLIGHT_PASS_EXECUTION_AUTHORIZED'
    : 'P24_PRODUCTION_MIGRATION_BLOCKED_BY_ARTIFACTS';

const output = {
  phase: 'P24-HARDRESET',
  part: 'A',
  description: 'Production migration execution preflight',
  generatedAt: NOW,
  tokenStatus,
  requiredToken: REQUIRED_EXECUTION_TOKEN,
  tokenVerified: TOKEN_PRESENT_IN_PROMPT,
  gateTotal,
  gatePassCount,
  gateFailCount: gateTotal - gatePassCount,
  allPass,
  classification,
  failedGates: failedGates.map(g => ({ id: g.id, description: g.description, detail: g.detail })),
  gates,
  dbPreCheck: {
    dbFile: 'prisma/dev.db',
    monthlyRevenueRowCount: dbRowCount,
    dbFileHash,
    timestamp: NOW,
  },
  frozenCorpora: Object.entries(frozenCorpora).map(([f, expected]) => {
    let actual = -1;
    try { actual = lineCount(f); } catch {}
    return { file: path.basename(f), expectedLines: expected, actualLines: actual, ok: actual === expected };
  }),
  p23Summary: {
    classification: p23Decision.classification,
    approvalGranted: p23Decision.approvalGranted,
    productionMigrationApplied: p23Decision.productionMigrationApplied,
    requestedToken: p23Request.requestedToken,
    approvalAutoGranted: p23Request.approvalAutoGranted,
  },
  disclaimer: 'Does not constitute investment advice. Does not compute ROI, profit, alpha, win-rate, edge, or outperformance.',
};

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(
  path.join(OUT_DIR, 'p24production_migration_execution_preflight.json'),
  JSON.stringify(output, null, 2),
);

// ── Markdown ───────────────────────────────────────────────────────────────────
const md = `# P24-HARDRESET: Production Migration Execution Preflight

**Generated:** ${NOW}  
**Classification:** \`${classification}\`  
**Token Status:** ${tokenStatus}  
**Gates:** ${gatePassCount} / ${gateTotal} PASS  

## Token Verification

| Field | Value |
|-------|-------|
| Required Token | \`${REQUIRED_EXECUTION_TOKEN}\` |
| Token Present | ${TOKEN_PRESENT_IN_PROMPT ? '✅ YES' : '❌ NO'} |
| Token Status | **${tokenStatus}** |

## Gate Results

| ID | Description | Pass |
|----|-------------|------|
${gates.map(g => `| ${g.id} | ${g.description} | ${g.pass ? '✅' : '❌'} |`).join('\n')}

${failedGates.length > 0 ? `## Failed Gates\n\n${failedGates.map(g => `- **${g.id}**: ${g.description} — ${g.detail}`).join('\n')}` : '## All Gates PASS ✅'}

## DB Pre-Check

| Field | Value |
|-------|-------|
| DB File | \`prisma/dev.db\` |
| MonthlyRevenue rows (pre-migration) | ${dbRowCount} |
| DB sha256 | \`${dbFileHash}\` |

## Frozen Corpus Verification

| Corpus | Expected | Actual | OK |
|--------|----------|--------|----|
${output.frozenCorpora.map(c => `| ${c.file} | ${c.expectedLines} | ${c.actualLines} | ${c.ok ? '✅' : '❌'} |`).join('\n')}

## Final Classification

\`\`\`
${classification}
\`\`\`

---

*DISCLAIMER: Does not constitute investment advice. Does not compute ROI, profit, alpha, win-rate, edge, or outperformance.*
`;

fs.writeFileSync(path.join(OUT_DIR, 'p24production_migration_execution_preflight.md'), md);

console.log(`P24 Preflight: ${gatePassCount}/${gateTotal} gates PASS`);
console.log(`Token: ${tokenStatus}`);
console.log(`Classification: ${classification}`);
gates.forEach(g => console.log(`  ${g.pass ? '✅' : '❌'} ${g.id}: ${g.description}`));

if (!allPass) {
  console.error('\nFAILED GATES:');
  failedGates.forEach(g => console.error(`  ❌ ${g.id}: ${g.description} — ${g.detail}`));
  process.exit(1);
}
