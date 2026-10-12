'use strict';
/**
 * build-p15-monthly-revenue-migration-risk-register.js
 *
 * PART D — P15 Migration Risk Register
 *
 * DISCLAIMER: Does not constitute investment advice. Governance / review only.
 * No production DB writes. No automatic approval granted.
 */

require('ts-node').register({
  transpileOnly: true,
  compilerOptions: { module: 'commonjs', moduleResolution: 'node', esModuleInterop: true },
});
require('tsconfig-paths').register({
  baseUrl: require('path').resolve(__dirname, '..'),
  paths: { '@/*': ['src/*'] },
});

const fs = require('fs');
const path = require('path');
const {
  buildApprovalRiskRegister,
} = require('../src/lib/onlineValidation/P15MigrationApprovalReviewUtils');

const OUT = 'outputs/online_validation';

const register = buildApprovalRiskRegister();

const output = {
  ...register,
  phase: 'P15',
  disclaimer: 'Does not constitute investment advice. Does not compute ROI, profit, alpha, win-rate, edge, or outperformance. Governance / risk register only. No production DB writes.',
  productionDbWritten: false,
};

fs.writeFileSync(path.join(OUT, 'p15migration_risk_register.json'), JSON.stringify(output, null, 2), 'utf8');
console.log('Written: p15migration_risk_register.json');

// Markdown
const md = `# P15 Migration Risk Register

> **Disclaimer:** Does not constitute investment advice. Governance / review only.

**Phase:** P15  
**Register ID:** ${register.registerId}  
**Generated:** ${register.generatedAt}  
**HIGH severity risks:** ${register.highSeverityCount}  
**Mitigated HIGH risks:** ${register.mitigatedHighCount}  
**Hard blockers:** ${register.blockerCount}

---

## Risk Items

${register.risks.map(r => `### ${r.riskId}: ${r.title}

| Field | Value |
|-------|-------|
| Severity | **${r.severity}** |
| Likelihood | **${r.likelihood}** |
| Owner | ${r.owner} |
| Approval Impact | ${r.approvalImpact} |

**Evidence:** ${r.evidence}

**Mitigation:** ${r.mitigation}

**Next Phase Action:** ${r.nextPhaseAction}

---`).join('\n\n')}

## Summary

| Risk ID | Title | Severity | Likelihood | Approval Impact |
|---------|-------|----------|------------|-----------------|
${register.risks.map(r => `| ${r.riskId} | ${r.title} | ${r.severity} | ${r.likelihood} | ${r.approvalImpact} |`).join('\n')}

**productionDbWritten:** false  
**approvalGranted:** false (hardcoded)
`;

fs.writeFileSync(path.join(OUT, 'p15migration_risk_register.md'), md, 'utf8');
console.log('Written: p15migration_risk_register.md');

console.log('\nRisk register:');
for (const r of register.risks) {
  console.log(`  ${r.riskId} [${r.severity}/${r.likelihood}] ${r.title}`);
}
console.log('HIGH severity:', register.highSeverityCount);
console.log('Mitigated HIGH:', register.mitigatedHighCount);
console.log('Blockers:', register.blockerCount);
