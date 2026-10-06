#!/usr/bin/env node
'use strict';
const fs = require('fs');
const BASE = require('path').resolve(__dirname, '..');
function r(f) { return JSON.parse(fs.readFileSync(require('path').join(BASE, f), 'utf8')); }
const b = r('outputs/online_validation/p22production_backup_restore_plan.json');
const rb = r('outputs/online_validation/p22production_migration_runbook.json');
const mon = r('outputs/online_validation/p22production_monitoring_checklist.json');

console.log('=== BACKUP.backupPlan.method ===');
console.log(JSON.stringify(b.backupPlan.method, null, 2));
console.log('=== BACKUP.backupPlan.restoreMethod ===');
console.log(JSON.stringify(b.backupPlan.restoreMethod, null, 2));
console.log('=== BACKUP.rollbackTrigger.triggers[0] ===');
console.log(JSON.stringify(b.rollbackTrigger.triggers[0], null, 2));

console.log('\n=== RUNBOOK top-level ===');
console.log('totalSteps:', rb.totalSteps);
console.log('placeholderSteps:', rb.placeholderSteps);
console.log('goNoGoCheckpoints:', rb.goNoGoCheckpoints);
const rnSteps = rb.runbookSteps || [];
const goNoGoSteps = rnSteps.filter(s => s.goNoGoCheckpoint === true);
console.log('goNoGo steps (goNoGoCheckpoint=true):', goNoGoSteps.length, goNoGoSteps.map(s => s.stepId));
const placeholderRunbookSteps = rnSteps.filter(s => s.isPlaceholder === true);
console.log('placeholder steps:', placeholderRunbookSteps.length, placeholderRunbookSteps.map(s => s.stepId));
const prismaStep = rnSteps.find(s => (s.label || '').toLowerCase().includes('prisma') || (s.description || '').toLowerCase().includes('prisma migrate deploy'));
console.log('prisma step:', prismaStep ? prismaStep.stepId + ' ' + prismaStep.label : 'none');

console.log('\n=== MONITORING items ===');
const items = mon.checklistItems || [];
const mandatory = items.filter(i => i.mandatory !== false);
console.log('total items:', items.length);
console.log('mandatory items:', mandatory.length);
console.log('mon.mandatoryItems:', mon.mandatoryItems);
console.log('includesReleaseDateSchemaCheck:', mon.includesReleaseDateSchemaCheck);
console.log('includesNoLeakageCheck:', mon.includesNoLeakageCheck);
console.log('includesRollbackReadinessCheck:', mon.includesRollbackReadinessCheck);
