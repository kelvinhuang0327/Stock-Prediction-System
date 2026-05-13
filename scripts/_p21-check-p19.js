'use strict';
const fs = require('fs');
const d = JSON.parse(fs.readFileSync('outputs/online_validation/p19monthly_revenue_pit_guard_validation.json','utf8'));
console.log(JSON.stringify(d, null, 2).slice(0, 1000));
