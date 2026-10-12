#!/usr/bin/env node
'use strict';
const fs = require('fs');
const BASE = require('path').resolve(__dirname, '..');
function r(f) { return JSON.parse(fs.readFileSync(require('path').join(BASE, f), 'utf8')); }
const b = r('outputs/online_validation/p22production_backup_restore_plan.json');
const rb = r('outputs/online_validation/p22production_migration_runbook.json');
const mon = r('outputs/online_validation/p22production_monitoring_checklist.json');
console.log('=== BACKUP ===');
console.log('backupPlan keys:', Object.keys(b.backupPlan || {}));
console.log('restorePlan keys:', Object.keys(b.restorePlan || {}));
console.log('rollbackTrigger keys:', Object.keys(b.rollbackTrigger || {}));
console.log('targetFields:', b.targetFields);
const restoreSteps = b.restorePlan && (b.restorePlan.steps || []);
console.log('restoreSteps count:', restoreSteps ? restoreSteps.length : 0);
const rollbackTriggers = b.rollbackTrigger && (b.rollbackTrigger.triggers || []);
console.log('rollbackTriggers count:', rollbackTriggers ? rollbackTriggers.length : 0);
console.log('rollback autoTrigger:', b.rollbackTrigger && b.rollbackTrigger.autoTrigger);
const backupScope = b.backupPlan && (b.backupPlan.scope || b.backupPlan.tables || []);
console.log('backupScope:', backupScope);
const rollbackSteps = b.rollbackTrigger && (b.rollbackTrigger.rollbackSteps || b.rollbackTrigger.steps || []);
console.log('rollbackSteps count:', rollbackSteps ? rollbackSteps.length : 0);
console.log('requiresManualApproval:', b.rollbackTrigger && b.rollbackTrigger.requiresManualApproval);
console.log('checksumAlgorithm:', b.backupPlan && (b.backupPlan.checksumAlgorithm || b.backupPlan.hashAlgorithm));

console.log('\n=== RUNBOOK ===');
console.log('runbook keys:', Object.keys(rb));
const steps = rb.steps || rb.runbookSteps || [];
console.log('steps count:', steps.length);
const firstStep = steps[0] || {};
console.log('first step keys:', Object.keys(firstStep));
console.log('first step:', JSON.stringify(firstStep, null, 2).substring(0, 400));
const goNoGoSteps = steps.filter(s => s.isGoNoGo === true || (s.type || '').toLowerCase().includes('go-no-go') || (s.type||'').toLowerCase().includes('gonogo') || (s.stepType||'').toLowerCase().includes('go'));
console.log('goNoGo steps count:', goNoGoSteps.length, goNoGoSteps.map(s => s.stepId || s.id));

console.log('\n=== MONITORING ===');
console.log('monitoring keys:', Object.keys(mon));
const items = mon.checklistItems || mon.items || [];
console.log('items count:', items.length);
if(items[0]) console.log('item[0]:', JSON.stringify(items[0]).substring(0, 200));
console.log('includesQueryGateSmokeCheck:', mon.includesQueryGateSmokeCheck);
console.log('includesReleaseDateNullRateCheck:', mon.includesReleaseDateNullRateCheck);
