#!/usr/bin/env node
'use strict';
const fs = require('fs');

const lines = fs.readFileSync('outputs/online_validation/p3active_scoring_historical_replay_corpus.jsonl','utf8').trim().split('\n').map(l=>JSON.parse(l));
const syms = new Set(lines.map(l=>l.symbol));
const dates = new Set(lines.map(l=>l.originalAsOfDate));
const horizons = new Set(lines.map(l=>l.outcomeSnapshot && l.outcomeSnapshot.horizonDays));
const buckets = {};
lines.forEach(l => { buckets[l.researchBucket] = (buckets[l.researchBucket]||0) + 1; });
const completeness = {};
lines.forEach(l => { completeness[l.scoringCompletenessStatus] = (completeness[l.scoringCompletenessStatus]||0) + 1; });
const hasMonthlyRevenue = lines.filter(l => l.activeScoringSnapshot && l.activeScoringSnapshot.usedSources && l.activeScoringSnapshot.usedSources.includes('MonthlyRevenue')).length;
const missesMonthlyRevenue = lines.filter(l => l.activeScoringSnapshot && l.activeScoringSnapshot.missingSources && l.activeScoringSnapshot.missingSources.includes('MonthlyRevenue')).length;

console.log('total:', lines.length);
console.log('unique symbols:', syms.size);
console.log('unique dates:', dates.size);
console.log('horizons:', [...horizons].sort((a,b)=>a-b).join(','));
console.log('researchBuckets:', JSON.stringify(buckets));
console.log('completenessStatus:', JSON.stringify(completeness));
console.log('hasMonthlyRevenue:', hasMonthlyRevenue);
console.log('missesMonthlyRevenue:', missesMonthlyRevenue);
console.log('sample symbols:', [...syms].slice(0,10).join(','));
console.log('sample dates:', [...dates].slice(0,5).join(','));
console.log('priceSource:', lines[0].outcomeSnapshot && lines[0].outcomeSnapshot.priceSource);
