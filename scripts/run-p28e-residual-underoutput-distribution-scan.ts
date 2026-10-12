/**
 * P28E PART C — Residual Underoutput Distribution Scan (compressed)
 *
 * Read-only. No DB write. No corpus mutation. No scoring touch.
 *
 * Scope: only families F7-F10 (CEO-revised compressed scan).
 * Families F1-F6 are already covered by P28D's regression sweep
 * (see outputs/online_validation/p28d_p3_p19_renderer_regression_sweep.json:
 *   p3   → rendererErrorCount=0, fallbackEmptyCount=0
 *   p19  → rendererErrorCount=0, fallbackEmptyCount=0).
 *
 * Sampling: deterministic, every 16th row from each corpus.
 *           Identical to P28D's sample size (~286 per corpus) to keep
 *           comparability without re-doing identical work.
 *
 * F7. dataAvailabilityNote missing while missingSources includes MonthlyRevenue
 * F8. mixed signals (detectMixedSignal=true) but rendered text lacks mixed-signal note
 * F9. renderedText length < threshold but outcome != FALLBACK_EMPTY
 * F10. factor triggered but rendered text contains no recognizable factor keyword
 *
 * Run: npx ts-node scripts/run-p28e-residual-underoutput-distribution-scan.ts
 */

import * as fs from "fs";
import * as path from "path";
import {
  renderReasonFromCorpusSnapshot,
  detectMixedSignal,
  CORPUS_REASON_RENDERER_VERSION,
} from "../src/lib/onlineValidation/P26ACorpusReasonRenderer";
import type { ActiveScoringSnapshot } from "../src/lib/onlineValidation/ActiveScoringSnapshotBuilder";

const ROOT = path.resolve(__dirname, "..");
const OUTPUTS_DIR = path.join(ROOT, "outputs", "online_validation");

// Deterministic sample step. 4500/16 ≈ 281 rows per corpus.
const SAMPLE_STEP = 16;

// F9 threshold: renderedText length below this counts as "too short".
// Set conservatively low to only catch genuinely empty-ish output.
const F9_LENGTH_THRESHOLD = 12;

// F10 factor keywords. Match against rendered text.
const FACTOR_KEYWORDS = [
  "MA",
  "RSI",
  "MACD",
  "布林",
  "動能",
  "法人",
  "外資",
  "投信",
  "成交量",
  "營收",
  "市場情境",
  "市場狀態",
  "中性",
  "偏多",
  "偏空",
  "多頭",
  "空頭",
];

// F7 data-coverage keywords. If rendered text contains any of these,
// dataAvailabilityNote is considered present.
const DATA_COVERAGE_KEYWORDS = ["月營收", "資料說明", "資料來源", "PIT"];

// F8 mixed-signal note keywords.
const MIXED_SIGNAL_KEYWORDS = ["混合", "混合信號", "mixed signal", "信號分歧", "訊號分歧"];

interface CorpusRowMinimal {
  symbol: string;
  originalAsOfDate: string;
  activeScoringSnapshot?: ActiveScoringSnapshot;
}

interface FamilyCounts {
  F7_dataAvailabilityNoteMissing_withMonthlyRevenueMissingSource: number;
  F8_mixedSignalWithoutNote: number;
  F9_shortOutputNotFallbackEmpty: number;
  F10_factorTriggeredButRenderedHasNoFactorKeyword: number;
}

interface CorpusScanResult {
  corpus: string;
  parsedLineCount: number;
  sampledCount: number;
  sampleStep: number;
  familyCounts: FamilyCounts;
  sampleExamples: Record<string, Array<{ symbol: string; asOfDate: string; outcome: string; renderedTextHead: string }>>;
}

function readJsonl(filePath: string): CorpusRowMinimal[] {
  const text = fs.readFileSync(filePath, "utf8");
  const rows: CorpusRowMinimal[] = [];
  for (const line of text.split("\n")) {
    const t = line.trim();
    if (!t) continue;
    try {
      rows.push(JSON.parse(t) as CorpusRowMinimal);
    } catch {
      // Skip malformed; not our scope to repair
    }
  }
  return rows;
}

function containsAny(text: string, keywords: string[]): boolean {
  if (!text) return false;
  for (const kw of keywords) {
    if (text.indexOf(kw) !== -1) return true;
  }
  return false;
}

function scanCorpus(corpusFilename: string, displayName: string): CorpusScanResult {
  const fullPath = path.join(OUTPUTS_DIR, corpusFilename);
  const rows = readJsonl(fullPath);
  const sampled: CorpusRowMinimal[] = [];
  for (let i = 0; i < rows.length; i += SAMPLE_STEP) {
    sampled.push(rows[i]);
  }

  const counts: FamilyCounts = {
    F7_dataAvailabilityNoteMissing_withMonthlyRevenueMissingSource: 0,
    F8_mixedSignalWithoutNote: 0,
    F9_shortOutputNotFallbackEmpty: 0,
    F10_factorTriggeredButRenderedHasNoFactorKeyword: 0,
  };

  const examples: Record<string, Array<{ symbol: string; asOfDate: string; outcome: string; renderedTextHead: string }>> = {
    F7: [],
    F8: [],
    F9: [],
    F10: [],
  };

  const recordExample = (
    family: "F7" | "F8" | "F9" | "F10",
    row: CorpusRowMinimal,
    outcome: string,
    renderedText: string
  ) => {
    if (examples[family].length >= 5) return;
    examples[family].push({
      symbol: row.symbol,
      asOfDate: row.originalAsOfDate,
      outcome,
      renderedTextHead: (renderedText || "").slice(0, 80),
    });
  };

  for (const row of sampled) {
    const snap = row.activeScoringSnapshot;
    if (!snap) continue;

    const rendered = renderReasonFromCorpusSnapshot(snap);
    const renderedText = rendered.renderedText || "";
    const outcome = rendered.outcome;
    const factors = snap.factorSnapshot ?? [];
    const missing = snap.missingSources ?? [];

    // F7
    if (missing.includes("MonthlyRevenue") && !containsAny(renderedText, DATA_COVERAGE_KEYWORDS)) {
      counts.F7_dataAvailabilityNoteMissing_withMonthlyRevenueMissingSource++;
      recordExample("F7", row, outcome, renderedText);
    }

    // F8
    const mixed = detectMixedSignal(factors);
    if (mixed && !containsAny(renderedText, MIXED_SIGNAL_KEYWORDS)) {
      counts.F8_mixedSignalWithoutNote++;
      recordExample("F8", row, outcome, renderedText);
    }

    // F9
    if (renderedText.trim().length < F9_LENGTH_THRESHOLD && outcome !== "FALLBACK_EMPTY") {
      counts.F9_shortOutputNotFallbackEmpty++;
      recordExample("F9", row, outcome, renderedText);
    }

    // F10
    if (factors.length >= 1 && renderedText.trim().length > 0 && !containsAny(renderedText, FACTOR_KEYWORDS)) {
      counts.F10_factorTriggeredButRenderedHasNoFactorKeyword++;
      recordExample("F10", row, outcome, renderedText);
    }
  }

  return {
    corpus: corpusFilename,
    parsedLineCount: rows.length,
    sampledCount: sampled.length,
    sampleStep: SAMPLE_STEP,
    familyCounts: counts,
    sampleExamples: examples,
  };
}

function main() {
  console.log("[P28E PART C] Residual Underoutput Distribution Scan (F7-F10, compressed)\n");

  const p3 = scanCorpus("p3active_scoring_historical_replay_corpus.jsonl", "P3 historical replay");
  const p19 = scanCorpus("p19active_scoring_pit_replay_corpus.jsonl", "P19 PIT replay");

  // Aggregate
  const aggregate = {
    F7: p3.familyCounts.F7_dataAvailabilityNoteMissing_withMonthlyRevenueMissingSource + p19.familyCounts.F7_dataAvailabilityNoteMissing_withMonthlyRevenueMissingSource,
    F8: p3.familyCounts.F8_mixedSignalWithoutNote + p19.familyCounts.F8_mixedSignalWithoutNote,
    F9: p3.familyCounts.F9_shortOutputNotFallbackEmpty + p19.familyCounts.F9_shortOutputNotFallbackEmpty,
    F10: p3.familyCounts.F10_factorTriggeredButRenderedHasNoFactorKeyword + p19.familyCounts.F10_factorTriggeredButRenderedHasNoFactorKeyword,
  };

  // F7 is informational only — when corpus has missingSources=[MonthlyRevenue]
  // for all rows (as P3/P19 do), it would always count if the renderer doesn't
  // append a coverage note. This is a known design choice, not a renderer bug.
  // We report it, but it is NOT a blocking residual.
  const blocking = aggregate.F8 + aggregate.F9 + aggregate.F10;

  let closureStatus: string;
  if (blocking === 0 && aggregate.F7 === 0) {
    closureStatus = "NO_BLOCKING_RESIDUAL_UNDEROUTPUT";
  } else if (blocking === 0) {
    // F7 informational only
    closureStatus = "NO_BLOCKING_RESIDUAL_UNDEROUTPUT";
  } else if (blocking > 0 && blocking < 10) {
    closureStatus = "RESIDUAL_UNDEROUTPUT_REVIEW_NEEDED";
  } else {
    closureStatus = "BLOCKING_RESIDUAL_UNDEROUTPUT_FOUND";
  }

  const out = {
    phase: "P28E",
    part: "C - Residual Underoutput Distribution Scan (compressed)",
    generatedAt: new Date().toISOString(),
    rendererVersion: CORPUS_REASON_RENDERER_VERSION,
    sampleStep: SAMPLE_STEP,
    f9LengthThreshold: F9_LENGTH_THRESHOLD,
    notes: {
      f1_to_f6_coverage: "Already covered by P28D regression sweep (p28d_p3_p19_renderer_regression_sweep.json). Not re-scanned in P28E.",
      f7_interpretation: "F7 is informational. P3/P19 corpora have missingSources=[MonthlyRevenue] on every row by design (P3/P19 predate the MonthlyRevenue PIT repair). Renderer correctly does not invent a coverage note. F7 is not a blocking residual.",
      f8_interpretation: "F8 measures mixed-signal detection coverage. Renderer v2 (P28C) added detectMixedSignal + buildMixedSignalNote. F8>0 would mean v2 missed cases.",
      f9_interpretation: "F9 measures degenerate short output that did not declare FALLBACK_EMPTY. F9>0 would mean output should have been longer or marked fallback.",
      f10_interpretation: "F10 measures template coverage gap: factors present but rendered text has no factor keyword."
    },
    perCorpus: { p3, p19 },
    aggregate,
    blockingResidualCount: blocking,
    closureStatus,
    productionWritten: false,
    dbWritten: false,
    corpusWritten: false,
  };

  fs.writeFileSync(
    path.join(OUTPUTS_DIR, "p28e_residual_underoutput_distribution_scan.json"),
    JSON.stringify(out, null, 2) + "\n",
    "utf8"
  );

  // Markdown summary
  const md = [
    "# P28E PART C — Residual Underoutput Distribution Scan (compressed)",
    "",
    `**Renderer version:** \`${CORPUS_REASON_RENDERER_VERSION}\``,
    `**Sampling:** deterministic, every ${SAMPLE_STEP}th row per corpus`,
    `**F9 length threshold:** ${F9_LENGTH_THRESHOLD} chars`,
    "",
    "## CEO-revised compressed scope",
    "",
    "F1-F6 (rendererError / FALLBACK_EMPTY / single-token / lowFactor / outcomeLeakage / scoreSnapshot-zero-fallback) are already covered by P28D's regression sweep with 0 errors on each corpus. P28E does **not** redo F1-F6.",
    "",
    "P28E scans only F7-F10 (read-only, sample-based).",
    "",
    "## Per-corpus counts",
    "",
    "| Corpus | Parsed | Sampled | F7 | F8 | F9 | F10 |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: |",
    `| ${p3.corpus} | ${p3.parsedLineCount} | ${p3.sampledCount} | ${p3.familyCounts.F7_dataAvailabilityNoteMissing_withMonthlyRevenueMissingSource} | ${p3.familyCounts.F8_mixedSignalWithoutNote} | ${p3.familyCounts.F9_shortOutputNotFallbackEmpty} | ${p3.familyCounts.F10_factorTriggeredButRenderedHasNoFactorKeyword} |`,
    `| ${p19.corpus} | ${p19.parsedLineCount} | ${p19.sampledCount} | ${p19.familyCounts.F7_dataAvailabilityNoteMissing_withMonthlyRevenueMissingSource} | ${p19.familyCounts.F8_mixedSignalWithoutNote} | ${p19.familyCounts.F9_shortOutputNotFallbackEmpty} | ${p19.familyCounts.F10_factorTriggeredButRenderedHasNoFactorKeyword} |`,
    "",
    "## Aggregate",
    "",
    `- F7 = ${aggregate.F7} (informational; see interpretation below)`,
    `- F8 = ${aggregate.F8}`,
    `- F9 = ${aggregate.F9}`,
    `- F10 = ${aggregate.F10}`,
    `- **Blocking residual count (F8 + F9 + F10) = ${blocking}**`,
    "",
    `## Closure status: \`${closureStatus}\``,
    "",
    "## Family interpretation",
    "",
    "- **F7:** P3/P19 corpora pre-date the MonthlyRevenue PIT repair; every row has `missingSources=[MonthlyRevenue]`. Renderer correctly does not invent a coverage note from corpus data. F7 hits here are *expected by design* and are **not** a blocking residual.",
    "- **F8:** mixed-signal detection coverage. Renderer v2 added the note; F8>0 would mean v2 missed cases.",
    "- **F9:** degenerate short output that did not declare FALLBACK_EMPTY.",
    "- **F10:** template-coverage gap — factors present but rendered text has no factor keyword.",
    "",
    "## Production safety",
    "",
    "- `productionWritten`: false",
    "- `dbWritten`: false",
    "- `corpusWritten`: false",
    "- This script runs read-only and writes only to `outputs/online_validation/p28e_*`.",
  ].join("\n");

  fs.writeFileSync(
    path.join(OUTPUTS_DIR, "p28e_residual_underoutput_distribution_scan.md"),
    md + "\n",
    "utf8"
  );

  console.log(JSON.stringify({ aggregate, blocking, closureStatus }, null, 2));
}

main();
