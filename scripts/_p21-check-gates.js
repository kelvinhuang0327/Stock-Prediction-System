'use strict';
const fs = require('fs');
const r = JSON.parse(fs.readFileSync('outputs/online_validation/p21production_migration_approval_review.json','utf8'));
r.hardGateResults.forEach(g => {
  if (!g.passed) console.log('FAIL', g.gateId, g.label, '|', g.evidence);
});
