'use strict';
const fs = require('fs');

const ma = JSON.parse(fs.readFileSync('outputs/online_validation/p13monthly_revenue_migration_plan.json', 'utf8'));
const sa = JSON.parse(fs.readFileSync('outputs/online_validation/p13monthly_revenue_source_audit.json', 'utf8'));
const pv = JSON.parse(fs.readFileSync('outputs/online_validation/p13monthly_revenue_pit_gate_validation.json', 'utf8'));
const fr = fs.readFileSync('outputs/online_validation/p13monthly_revenue_final_report.md', 'utf8');

console.log('planId:', ma.planId);
console.log('writesProductionDb:', ma.productionSafety && ma.productionSafety.writesProductionDb);
console.log('sourceAudit mode:', sa.mode);
console.log('releaseDateMissing:', sa.findings && sa.findings.releaseDateMissing);
console.log('pitGate validationStatus:', pv.validationStatus);
console.log('pitGate passed/total:', pv.summary && (pv.summary.passed + '/' + pv.summary.total));
console.log('finalReport classification:', fr.includes('P13_MONTHLY_REVENUE_REQUIRES_SCHEMA_MIGRATION_APPROVAL'));
