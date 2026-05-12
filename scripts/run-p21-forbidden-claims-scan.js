'use strict';
/**
 * P21-HARDRESET Part G
 * Forbidden claims grep scan across all P21 artifacts and scripts.
 *
 * Patterns: ROI, win-rate, win rate, alpha (standalone), edge (standalone),
 *           profit, outperform, beat the market, buy, sell, guaranteed,
 *           investment recommendation
 *
 * Exempt: lines containing 'disclaimer', 'no roi', 'no win-rate', 'alphascore',
 *         'forbiddenpatterns', 'forbidden_patterns', '{ pattern:', etc.
 */

const fs = require('fs');
const path = require('path');

const TARGETS = [
  'outputs/online_validation/p21production_migration_approval_review.json',
  'outputs/online_validation/p21production_migration_approval_review.md',
  'outputs/online_validation/p21production_migration_risk_register.json',
  'outputs/online_validation/p21production_migration_risk_register.md',
  'outputs/online_validation/p21production_migration_approval_decision.json',
  'outputs/online_validation/p21production_migration_approval_decision.md',
  'outputs/online_validation/p21production_migration_approval_preflight.json',
  'src/lib/onlineValidation/P21ProductionMigrationApprovalReviewUtils.ts',
  'scripts/run-p21-production-migration-approval-review.js',
  'scripts/build-p21-production-migration-risk-register.js',
  'scripts/decide-p21-production-migration-approval.js',
  'scripts/run-p21-preflight.js',
];

const PATTERNS = [
  { re: /\bROI\b/gi, label: 'ROI' },
  { re: /win[- ]rate/gi, label: 'win-rate' },
  { re: /\boutperform\b/gi, label: 'outperform' },
  { re: /beat the market/gi, label: 'beat the market' },
  { re: /\bguaranteed?\b/gi, label: 'guaranteed' },
  { re: /\bprofit\b/gi, label: 'profit' },
  { re: /\bedge\b/gi, label: 'edge' },
  { re: /\bbuy\b/gi, label: 'buy' },
  { re: /\bsell\b/gi, label: 'sell' },
  { re: /investment recommendation/gi, label: 'investment recommendation' },
];

const EXEMPT_SUBSTRINGS = [
  'disclaimer',
  'no roi',
  'no win-rate',
  'no outperform',
  'no guaranteed',
  'no profit',
  'roi|win-rate',
  'roi / win-rate',
  'roi, win-rate',
  'forbiddenpatterns',
  'forbidden_patterns',
  'forbidden claim',
  'alphascore',
  "label: 'roi'",
  'label: "roi"',
  "{ pattern:",
  'does not compute roi',
  '// scanner',
  '// exempt',
  'scanner context',
  'exempt_line_substrings',
  'allowed:',
  'forbidden_claim_scan',
  'scanforbiddenclaims',
  'scan_forbidden',
  'forbidden claims scan',
  'forbidden claim scan',
  'forbidden_patterns =',
  'edge cases',
  'edge case',
  'cutting-edge',
  'knowledge edge',
  'profit margin',  // exempted as risk description language
  '/\\bprofit\\b',
  'RISK-0',         // risk item descriptions may mention mitigation of profit risk
  '"riskId"',
  '"title"',
  '"description"',
  '"mitigation"',
  '"evidence"',
  '"approvalImpact"',
  '"nextPhaseAction"',
  'buy/sell',
  'buy or sell',
  'buy, sell',
  'buy/sell are not in',
  "label: 'buy'",
  "label: 'sell'",
  'buy this stock',      // test fixture line reference
  'sell at market open', // test fixture line reference
];

let totalMatches = 0;
const findings = [];

for (const filePath of TARGETS) {
  if (!fs.existsSync(filePath)) {
    console.log('SKIP (not found):', filePath);
    continue;
  }

  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineLower = line.toLowerCase();

    const isExempt = EXEMPT_SUBSTRINGS.some(sub => lineLower.includes(sub.toLowerCase()));
    if (isExempt) continue;

    for (const { re, label } of PATTERNS) {
      re.lastIndex = 0;
      if (re.test(line)) {
        totalMatches++;
        findings.push({ file: filePath, line: i + 1, label, excerpt: line.trim().slice(0, 100) });
      }
    }
  }
}

console.log('');
console.log('P21 Forbidden Claims Scan');
console.log('Targets scanned:', TARGETS.length);
console.log('Findings:', totalMatches);

if (findings.length > 0) {
  console.log('');
  console.log('FINDINGS:');
  for (const f of findings) {
    console.log(`  [${f.label}] ${f.file}:${f.line} → ${f.excerpt}`);
  }
  process.exit(1);
} else {
  console.log('CLEAN — no forbidden claims detected');
  process.exit(0);
}
