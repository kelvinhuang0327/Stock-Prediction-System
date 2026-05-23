// p28c_9case_validation.js — Generate before/after for P28C PART E
// Run: node p28c_9case_validation.js
const path = require('path');
process.chdir(__dirname);

// We'll use ts-node to load the TypeScript files
const { execSync } = require('child_process');

const script = `
import { renderReasonFromCorpusSnapshot } from './src/lib/onlineValidation/P26ACorpusReasonRenderer';
import * as fs from 'fs';

const cases = [
  {
    symbol: '1710', family: 'scoreSnapshot_zero_label', caseIndex: 1,
    snapshot: {
      symbol: '1710', asOfDate: '2026-01-15', horizonDays: 20, researchBucket: 'Strong',
      alphaScore: 68, reasonSnapshot: '技術偏多',
      factorSnapshot: ['MA 趨勢: 多頭排列 (MA20(45.20) > MA60(42.80))', 'RSI(14): 62.5 (偏強)', 'MACD: 0.45 (MACD > 0，多方動能)', '近 20 日動能: 8.3%', '法人近 10 日買超: 外資淨買入 1200 張'],
      scoreSnapshot: { technicalScore: 68, chipScore: 65, researchScore: 68, confidenceScore: 0, fundamentalScore: 0, marketAdjustment: 0 },
      signalTags: [], usedSources: ['Technical', 'Chip'], missingSources: ['MonthlyRevenue'],
      completenessStatus: 'PARTIAL', stableHashKey: '1710-e'
    }
  },
  {
    symbol: '00738U', family: 'scoreSnapshot_zero_label', caseIndex: 2,
    snapshot: {
      symbol: '00738U', asOfDate: '2026-01-20', horizonDays: 20, researchBucket: 'Neutral',
      alphaScore: 55, reasonSnapshot: '技術偏空',
      factorSnapshot: ['MA 趨勢: 空頭排列 (MA20 < MA60)', 'RSI(14): 38 (偏弱)', 'MACD: -0.2 (空方動能)'],
      scoreSnapshot: { technicalScore: 35, chipScore: 40, researchScore: 45, confidenceScore: 0, fundamentalScore: 0, marketAdjustment: 0 },
      signalTags: [], usedSources: ['Technical'], missingSources: ['Chip', 'MonthlyRevenue'],
      completenessStatus: 'PARTIAL', stableHashKey: '00738U-e'
    }
  },
  {
    symbol: '00738U', family: 'scoreSnapshot_zero_label', caseIndex: 3,
    snapshot: {
      symbol: '00738U', asOfDate: '2026-01-25', horizonDays: 20, researchBucket: 'Neutral',
      alphaScore: 52, reasonSnapshot: '法人賣超',
      factorSnapshot: ['MA 趨勢: 空頭排列 (MA20 < MA60)', 'RSI(14): 35 (偏弱)', '法人近 10 日買超: 外資淨賣出 500 張'],
      scoreSnapshot: { technicalScore: 32, chipScore: 38, researchScore: 42, confidenceScore: 0, fundamentalScore: 0, marketAdjustment: 0 },
      signalTags: [], usedSources: ['Technical', 'Chip'], missingSources: ['MonthlyRevenue'],
      completenessStatus: 'PARTIAL', stableHashKey: '00738U-e2'
    }
  },
  {
    symbol: '1710', family: 'scoreSnapshot_zero_label', caseIndex: 4,
    snapshot: {
      symbol: '1710', asOfDate: '2026-02-01', horizonDays: 20, researchBucket: 'Strong',
      alphaScore: 70, reasonSnapshot: '動能轉強',
      factorSnapshot: ['MA 趨勢: 多頭排列 (MA20 > MA60)', 'RSI(14): 65 (偏強)', 'MACD: 0.52 (MACD > 0，多方動能)', '近 20 日動能: 10.1%'],
      scoreSnapshot: { technicalScore: 70, chipScore: 62, researchScore: 70, confidenceScore: 0, fundamentalScore: 0, marketAdjustment: 0 },
      signalTags: [], usedSources: ['Technical'], missingSources: ['Chip', 'MonthlyRevenue'],
      completenessStatus: 'PARTIAL', stableHashKey: '1710-e2'
    }
  },
  {
    symbol: '00738U', family: 'scoreSnapshot_zero_label', caseIndex: 5,
    snapshot: {
      symbol: '00738U', asOfDate: '2026-02-05', horizonDays: 20, researchBucket: 'Weak',
      alphaScore: 42, reasonSnapshot: '動能走弱',
      factorSnapshot: ['MA 趨勢: 空頭排列 (MA20 < MA60)', 'RSI(14): 28 (超賣)', 'MACD: -0.4 (空方動能)', '近 20 日動能: -8.2%'],
      scoreSnapshot: { technicalScore: 25, chipScore: 30, researchScore: 38, confidenceScore: 0, fundamentalScore: 0, marketAdjustment: 0 },
      signalTags: [], usedSources: ['Technical'], missingSources: ['Chip', 'MonthlyRevenue'],
      completenessStatus: 'PARTIAL', stableHashKey: '00738U-e3'
    }
  },
  // Family 2: mixed_signals_no_template (4 cases — 00891)
  {
    symbol: '00891', family: 'mixed_signals_no_template', caseIndex: 6,
    snapshot: {
      symbol: '00891', asOfDate: '2026-02-11', horizonDays: 20, researchBucket: 'Neutral',
      alphaScore: 63, reasonSnapshot: '技術偏多',
      factorSnapshot: ['MA 趨勢: 空頭排列 (MA20(16.05) < MA60(16.58))', 'RSI(14): 54.92 (中性健康區間)', 'MACD: 0.12 (MACD > 0，多方動能)', '近 20 日動能: 6.38%', '法人近 10 日買超: 外資淨賣出 800 張'],
      scoreSnapshot: { technicalScore: 75, chipScore: 50, researchScore: 63, confidenceScore: 0, fundamentalScore: 0, marketAdjustment: 0 },
      signalTags: [], usedSources: ['Technical', 'Chip'], missingSources: ['MonthlyRevenue'],
      completenessStatus: 'PARTIAL', stableHashKey: '00891-e'
    }
  },
  {
    symbol: '00891', family: 'mixed_signals_no_template', caseIndex: 7,
    snapshot: {
      symbol: '00891', asOfDate: '2026-02-18', horizonDays: 20, researchBucket: 'Neutral',
      alphaScore: 61, reasonSnapshot: '技術偏多',
      factorSnapshot: ['MA 趨勢: 空頭排列 (MA20(15.90) < MA60(16.40))', 'RSI(14): 52.1', 'MACD: 0.08 (MACD > 0，多方動能)', '近 20 日動能: 4.2%'],
      scoreSnapshot: { technicalScore: 72, chipScore: 48, researchScore: 61, confidenceScore: 0, fundamentalScore: 0, marketAdjustment: 0 },
      signalTags: [], usedSources: ['Technical'], missingSources: ['Chip', 'MonthlyRevenue'],
      completenessStatus: 'PARTIAL', stableHashKey: '00891-e2'
    }
  },
  {
    symbol: '00891', family: 'mixed_signals_no_template', caseIndex: 8,
    snapshot: {
      symbol: '00891', asOfDate: '2026-02-25', horizonDays: 20, researchBucket: 'Neutral',
      alphaScore: 60, reasonSnapshot: '技術偏多',
      factorSnapshot: ['MA 趨勢: 空頭排列 (MA20(15.80) < MA60(16.30))', 'MACD: 0.05 (MACD > 0，多方動能)', '量能變化: 0.65'],
      scoreSnapshot: { technicalScore: 68, chipScore: 47, researchScore: 60, confidenceScore: 0, fundamentalScore: 0, marketAdjustment: 0 },
      signalTags: [], usedSources: ['Technical'], missingSources: ['Chip', 'MonthlyRevenue'],
      completenessStatus: 'PARTIAL', stableHashKey: '00891-e3'
    }
  },
  {
    symbol: '00891', family: 'mixed_signals_no_template', caseIndex: 9,
    snapshot: {
      symbol: '00891', asOfDate: '2026-03-04', horizonDays: 20, researchBucket: 'Neutral',
      alphaScore: 62, reasonSnapshot: '技術偏多',
      factorSnapshot: ['MA 趨勢: 空頭排列 (MA20(15.70) < MA60(16.20))', 'MACD: 0.09 (MACD > 0，多方動能)', '近 5 日報酬: -1.2%'],
      scoreSnapshot: { technicalScore: 73, chipScore: 49, researchScore: 62, confidenceScore: 0, fundamentalScore: 0, marketAdjustment: 0 },
      signalTags: [], usedSources: ['Technical'], missingSources: ['Chip', 'MonthlyRevenue'],
      completenessStatus: 'PARTIAL', stableHashKey: '00891-e4'
    }
  },
] as any[];

const results = cases.map((c: any) => {
  const before = c.snapshot.reasonSnapshot;
  const after = renderReasonFromCorpusSnapshot(c.snapshot);
  return {
    caseIndex: c.caseIndex,
    symbol: c.symbol,
    repairFamily: c.family,
    before_reasonSnapshot: before,
    after_outcome: after.outcome,
    after_rendererVersion: after.rendererVersion,
    after_renderedText: after.renderedText,
    alphaScoreUnchanged: after.alphaScoreUnchanged,
    bucketUnchanged: after.bucketUnchanged,
    repairApplied: after.outcome === 'ENRICHED',
  };
});

const summary = {
  generatedAt: new Date().toISOString(),
  patchPhase: 'P28C',
  totalCases: 9,
  enrichedCount: results.filter((r: any) => r.repairApplied).length,
  allAlphaScoreUnchanged: results.every((r: any) => r.alphaScoreUnchanged),
  allBucketUnchanged: results.every((r: any) => r.bucketUnchanged),
  classification: results.every((r: any) => r.repairApplied)
    ? 'P28C_RENDERER_ONLY_REPAIR_COMPLETE'
    : 'P28C_RENDERER_ONLY_REPAIR_PARTIAL',
  cases: results,
};

fs.writeFileSync('outputs/online_validation/p28c_renderer_only_repair_9case_before_after.json', JSON.stringify(summary, null, 2));
console.log('Written: outputs/online_validation/p28c_renderer_only_repair_9case_before_after.json');
console.log('enrichedCount:', summary.enrichedCount, '/ 9');
console.log('classification:', summary.classification);
`;

require('fs').writeFileSync('/tmp/p28c_e_runner.ts', script);
