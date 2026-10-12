import type { StrategyLabResolvedPrediction } from "@/lib/research/strategyLabArtifacts";

export type StrategyLabCalibrationStatus = "missing" | "insufficient" | "ready";
export type StrategyLabCalibrationVerdict =
  | "needs_more_evidence"
  | "poorly_calibrated"
  | "mixed_evidence"
  | "calibrated_candidate";

export interface StrategyLabCalibrationBin {
  rangeLabel: string;
  lowerInclusive: number;
  upperExclusive: number | null;
  pairCount: number;
  meanProbabilityUp: number;
  actualUpRate: number;
  hitRate: number;
  avgForwardReturn: number;
  calibrationGap: number;
}

export interface StrategyLabCalibration {
  status: StrategyLabCalibrationStatus;
  verdict: StrategyLabCalibrationVerdict;
  verdictLabel: string;
  verdictReason: string;
  pairCount: number;
  validPairCount: number;
  binCount: number;
  brierScore: number | null;
  meanPredictedProbability: number | null;
  actualUpRate: number | null;
  expectedCalibrationErrorApprox: number | null;
  maxCalibrationGap: number | null;
  bins: StrategyLabCalibrationBin[];
  caveats: string[];
}

interface CalibrationPair extends StrategyLabResolvedPrediction {
  probabilityUp: number;
  forwardReturn: number;
  actualUp: boolean;
  correct: boolean;
}

interface CalibrationBinDefinition {
  lowerInclusive: number;
  upperExclusive: number | null;
  rangeLabel: string;
}

const MIN_CALIBRATION_PAIR_COUNT = 20;
const MIN_NON_SPARSE_BIN_COUNT = 2;
const MIN_BIN_PAIR_COUNT = 3;

const CALIBRATION_BINS: CalibrationBinDefinition[] = [
  { lowerInclusive: 0.5, upperExclusive: 0.55, rangeLabel: "0.50-0.55" },
  { lowerInclusive: 0.55, upperExclusive: 0.6, rangeLabel: "0.55-0.60" },
  { lowerInclusive: 0.6, upperExclusive: 0.65, rangeLabel: "0.60-0.65" },
  { lowerInclusive: 0.65, upperExclusive: 0.7, rangeLabel: "0.65-0.70" },
  { lowerInclusive: 0.7, upperExclusive: 0.75, rangeLabel: "0.70-0.75" },
  { lowerInclusive: 0.75, upperExclusive: null, rangeLabel: "0.75-1.00" },
];

function round(value: number, digits = 8): number {
  return Number(value.toFixed(digits));
}

function mean(values: number[]): number {
  return values.length === 0
    ? 0
    : values.reduce((total, value) => total + value, 0) / values.length;
}

function actualUpFromPair(pair: StrategyLabResolvedPrediction): boolean | null {
  if (pair.actualDirection === "up") return true;
  if (pair.actualDirection === "down") return false;
  if (pair.predictedDirection === "up") return pair.correct;
  if (pair.predictedDirection === "down") return !pair.correct;
  return null;
}

function isValidProbability(value: number | null): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0.5 && value <= 1;
}

function toCalibrationPair(pair: StrategyLabResolvedPrediction): CalibrationPair | null {
  const actualUp = actualUpFromPair(pair);
  if (
    !isValidProbability(pair.probabilityUp)
    || actualUp === null
    || typeof pair.forwardReturn !== "number"
    || !Number.isFinite(pair.forwardReturn)
  ) {
    return null;
  }

  return {
    ...pair,
    probabilityUp: pair.probabilityUp,
    forwardReturn: pair.forwardReturn,
    actualUp,
  };
}

function emptyCalibration(
  status: StrategyLabCalibrationStatus,
  pairCount: number,
  validPairCount: number,
  reason: string,
): StrategyLabCalibration {
  return {
    status,
    verdict: "needs_more_evidence",
    verdictLabel: "證據不足",
    verdictReason: reason,
    pairCount,
    validPairCount,
    binCount: 0,
    brierScore: null,
    meanPredictedProbability: null,
    actualUpRate: null,
    expectedCalibrationErrorApprox: null,
    maxCalibrationGap: null,
    bins: [],
    caveats: calibrationCaveats(validPairCount, true),
  };
}

function binForProbability(probabilityUp: number): CalibrationBinDefinition | null {
  return CALIBRATION_BINS.find((bin) =>
    probabilityUp >= bin.lowerInclusive
    && (bin.upperExclusive === null || probabilityUp < bin.upperExclusive),
  ) ?? null;
}

function calibrationCaveats(validPairCount: number, sparse: boolean): string[] {
  return [
    ...(validPairCount < MIN_CALIBRATION_PAIR_COUNT
      ? [`Small sample: N=${validPairCount}; at least ${MIN_CALIBRATION_PAIR_COUNT} valid resolved pairs are required.`]
      : []),
    ...(sparse
      ? ["Sparse bins: calibration bins need broader support before drawing conclusions."]
      : []),
    "Reliability uses only resolved prediction artifacts; it does not rerun, refit, or read the database.",
    "Research-only calibration check; not investment advice and not evidence of future predictive ability.",
  ];
}

function verdictFromCalibration(
  validPairCount: number,
  nonSparseBinCount: number,
  expectedCalibrationErrorApprox: number,
  maxCalibrationGap: number,
): Pick<StrategyLabCalibration, "status" | "verdict" | "verdictLabel" | "verdictReason"> {
  if (validPairCount < MIN_CALIBRATION_PAIR_COUNT || nonSparseBinCount < MIN_NON_SPARSE_BIN_COUNT) {
    return {
      status: "insufficient",
      verdict: "needs_more_evidence",
      verdictLabel: "證據不足",
      verdictReason:
        `有效校準樣本 ${validPairCount} 筆，非稀疏 bins ${nonSparseBinCount} 個；不足以判讀 probabilityUp 校準品質。`,
    };
  }

  if (expectedCalibrationErrorApprox >= 0.15 || maxCalibrationGap >= 0.25) {
    return {
      status: "ready",
      verdict: "poorly_calibrated",
      verdictLabel: "校準偏差偏大",
      verdictReason: "目前 resolved artifact 內，預測機率與實際上漲率的差距偏大，需先改善校準再判讀。",
    };
  }

  if (expectedCalibrationErrorApprox <= 0.08 && maxCalibrationGap <= 0.15) {
    return {
      status: "ready",
      verdict: "calibrated_candidate",
      verdictLabel: "校準候選",
      verdictReason: "目前 resolved artifact 內，分箱後實際上漲率大致貼近平均 probabilityUp；仍只代表此樣本。",
    };
  }

  return {
    status: "ready",
    verdict: "mixed_evidence",
    verdictLabel: "校準證據混合",
    verdictReason: "目前 resolved artifact 內部分 bins 貼近、部分 bins 偏離，需更多樣本確認。",
  };
}

export function buildStrategyLabCalibration(
  pairs: StrategyLabResolvedPrediction[] | null | undefined,
): StrategyLabCalibration {
  const pairCount = pairs?.length ?? 0;
  const validPairs = (pairs ?? [])
    .map(toCalibrationPair)
    .filter((pair): pair is CalibrationPair => pair !== null);
  const validPairCount = validPairs.length;

  if (pairCount === 0) {
    return emptyCalibration("missing", pairCount, validPairCount, "找不到可校準的 resolved prediction/outcome pairs。");
  }

  if (validPairCount === 0) {
    return emptyCalibration(
      "insufficient",
      pairCount,
      validPairCount,
      "resolved artifact 中沒有同時具備 probabilityUp、已知 outcome 與 forwardReturn 的有效樣本。",
    );
  }

  const byBin = new Map<string, CalibrationPair[]>();
  for (const pair of validPairs) {
    const bin = binForProbability(pair.probabilityUp);
    if (!bin) continue;
    byBin.set(bin.rangeLabel, [...(byBin.get(bin.rangeLabel) ?? []), pair]);
  }

  const bins = CALIBRATION_BINS.flatMap((bin) => {
    const binPairs = byBin.get(bin.rangeLabel) ?? [];
    if (binPairs.length === 0) return [];
    const actualUpRate = mean(binPairs.map((pair) => pair.actualUp ? 1 : 0));
    const meanProbabilityUp = mean(binPairs.map((pair) => pair.probabilityUp));
    return [{
      rangeLabel: bin.rangeLabel,
      lowerInclusive: bin.lowerInclusive,
      upperExclusive: bin.upperExclusive,
      pairCount: binPairs.length,
      meanProbabilityUp: round(meanProbabilityUp),
      actualUpRate: round(actualUpRate),
      hitRate: round(mean(binPairs.map((pair) => pair.correct ? 1 : 0))),
      avgForwardReturn: round(mean(binPairs.map((pair) => pair.forwardReturn))),
      calibrationGap: round(actualUpRate - meanProbabilityUp),
    }];
  });

  if (bins.length === 0) {
    return emptyCalibration(
      "insufficient",
      pairCount,
      validPairCount,
      "有效 probabilityUp 樣本未落入固定校準 bins，無法建立 reliability table。",
    );
  }

  const brierScore = mean(validPairs.map((pair) => (pair.probabilityUp - (pair.actualUp ? 1 : 0)) ** 2));
  const meanPredictedProbability = mean(validPairs.map((pair) => pair.probabilityUp));
  const actualUpRate = mean(validPairs.map((pair) => pair.actualUp ? 1 : 0));
  const expectedCalibrationErrorApprox = bins.reduce(
    (total, bin) => total + (bin.pairCount / validPairCount) * Math.abs(bin.calibrationGap),
    0,
  );
  const maxCalibrationGap = Math.max(...bins.map((bin) => Math.abs(bin.calibrationGap)));
  const nonSparseBinCount = bins.filter((bin) => bin.pairCount >= MIN_BIN_PAIR_COUNT).length;
  const sparse = validPairCount < MIN_CALIBRATION_PAIR_COUNT || nonSparseBinCount < MIN_NON_SPARSE_BIN_COUNT;
  const verdict = verdictFromCalibration(
    validPairCount,
    nonSparseBinCount,
    expectedCalibrationErrorApprox,
    maxCalibrationGap,
  );

  return {
    ...verdict,
    pairCount,
    validPairCount,
    binCount: bins.length,
    brierScore: round(brierScore),
    meanPredictedProbability: round(meanPredictedProbability),
    actualUpRate: round(actualUpRate),
    expectedCalibrationErrorApprox: round(expectedCalibrationErrorApprox),
    maxCalibrationGap: round(maxCalibrationGap),
    bins,
    caveats: calibrationCaveats(validPairCount, sparse),
  };
}
