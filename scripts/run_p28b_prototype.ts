/**
 * P28B Prototype Runner — generates p28b_readonly_prototype_result.json
 * Run: npx ts-node scripts/run_p28b_prototype.ts
 */
import * as fs from "fs";
import * as path from "path";
import {
  buildRendererRepairPlanBatch,
  P28BInputSnapshot,
} from "../src/lib/onlineValidation/P28BReasonTemplateCoveragePlanner";

const ROOT = path.resolve(__dirname, "..");

const snapshots: P28BInputSnapshot[] = [
  // FX-02: 1710 — scoreSnapshot_zero_label family
  {
    symbol: "1710",
    reasonSnapshot: "技術偏多",
    factorSnapshot: [
      "MA 趨勢：多頭排列（5MA > 10MA > 20MA）",
      "RSI(14)：52.3（中性區間）",
      "MACD：多方動能（MACD > Signal）",
      "近 20 日動能：+3.2%",
      "布林通道：中軌上方",
      "法人買超：外資淨買入 1200 張",
      "投信動向：淨買入 300 張",
      "成交量：近 5 日均量 112%",
      "市場情境：大盤多頭",
      "月營收：資料暫缺",
    ],
    scoreSnapshot: { technicalScore: 0, chipScore: 0, momentumScore: 0, revenueScore: 0 },
    usedSources: ["Technical", "Chip"],
    missingSources: ["MonthlyRevenue"],
    alphaScore: 68,
    researchBucket: "NEUTRAL",
    asOfDate: "2025-12-15",
  },
  // FX-MS: 00891 — mixed_signals_no_template family
  {
    symbol: "00891",
    reasonSnapshot: "技術偏多",
    factorSnapshot: [
      "MA 趨勢：空頭排列（5MA < 10MA < 20MA）",
      "MACD：多方動能（MACD > Signal）",
      "RSI(14)：48.5（中性區間）",
      "法人買超：外資淨賣出 800 張",
      "近 20 日動能：-1.2%",
    ],
    scoreSnapshot: { technicalScore: 0, chipScore: 0, momentumScore: 0, revenueScore: 0 },
    usedSources: ["Technical", "Chip"],
    missingSources: ["MonthlyRevenue"],
    alphaScore: 63,
    researchBucket: "NEUTRAL",
    asOfDate: "2025-11-12",
  },
  // FX-01: empty factorSnapshot — fallback
  {
    symbol: "00738U",
    reasonSnapshot: "技術偏多",
    factorSnapshot: [],
    scoreSnapshot: { technicalScore: 0, chipScore: 0, momentumScore: 0, revenueScore: 0 },
    usedSources: ["Technical"],
    missingSources: ["MonthlyRevenue"],
    alphaScore: 63,
    researchBucket: "NEUTRAL",
    asOfDate: "2025-12-19",
  },
];

const plans = buildRendererRepairPlanBatch(snapshots);

const result = {
  runId: "p28b-readonly-prototype-run",
  generatedAt: new Date().toISOString(),
  phase: "P28B-REASON-TEMPLATE-COVERAGE-HARDRESET",
  snapshotCount: snapshots.length,
  invarianceCheck: {
    alphaScoreUnchanged: plans.every((p) => p.alphaScoreUnchanged),
    bucketUnchanged: plans.every((p) => p.bucketUnchanged),
    noScoringChange: plans.every((p) =>
      p.entries.every((e) => e.requiresScoringChange === false)
    ),
  },
  plans,
  disclaimer: "Observability only. No investment recommendations.",
};

const outPath = path.join(
  ROOT,
  "outputs/online_validation/p28b_readonly_prototype_result.json"
);
fs.writeFileSync(outPath, JSON.stringify(result, null, 2), "utf-8");
console.log("Written:", outPath);
console.log("Invariance:", JSON.stringify(result.invarianceCheck));
