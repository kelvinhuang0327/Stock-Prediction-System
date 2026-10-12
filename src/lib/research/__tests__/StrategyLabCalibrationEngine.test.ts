import { buildStrategyLabCalibration } from "@/lib/research/StrategyLabCalibrationEngine";
import type { StrategyLabResolvedPrediction } from "@/lib/research/strategyLabArtifacts";

function pair(
  index: number,
  overrides: Partial<StrategyLabResolvedPrediction>,
): StrategyLabResolvedPrediction {
  const actualDirection = "actualDirection" in overrides ? overrides.actualDirection ?? null : "up";
  const predictedDirection = "predictedDirection" in overrides ? overrides.predictedDirection ?? null : "up";
  return {
    symbol: overrides.symbol ?? `T${index}`,
    featureDate: overrides.featureDate ?? "2026-06-01",
    targetDate: overrides.targetDate ?? "2026-06-08",
    probabilityUp: "probabilityUp" in overrides ? overrides.probabilityUp ?? null : 0.6,
    predictedDirection,
    actualDirection,
    forwardReturn: "forwardReturn" in overrides
      ? overrides.forwardReturn ?? null
      : actualDirection === "up"
        ? 0.02
        : -0.02,
    correct: overrides.correct ?? actualDirection === predictedDirection,
  };
}

function outcomePairs(probabilityUp: number, outcomes: Array<"up" | "down">, startIndex: number) {
  return outcomes.map((actualDirection, index) =>
    pair(startIndex + index, {
      probabilityUp,
      actualDirection,
      predictedDirection: "up",
      correct: actualDirection === "up",
    }),
  );
}

describe("buildStrategyLabCalibration", () => {
  it("returns missing for empty input and insufficient for unusable resolved rows", () => {
    const empty = buildStrategyLabCalibration([]);
    expect(empty.status).toBe("missing");
    expect(empty.verdict).toBe("needs_more_evidence");
    expect(empty.brierScore).toBeNull();
    expect(empty.bins).toEqual([]);

    const unusable = buildStrategyLabCalibration([
      pair(1, { probabilityUp: null }),
      pair(2, { actualDirection: null, predictedDirection: null }),
      pair(3, { forwardReturn: null }),
    ]);
    expect(unusable.status).toBe("insufficient");
    expect(unusable.validPairCount).toBe(0);
    expect(unusable.bins).toEqual([]);
  });

  it("assigns bin boundaries with lower-inclusive ranges and omits empty bins", () => {
    const calibration = buildStrategyLabCalibration([
      pair(1, { probabilityUp: 0.5 }),
      pair(2, { probabilityUp: 0.549999 }),
      pair(3, { probabilityUp: 0.55 }),
      pair(4, { probabilityUp: 0.6 }),
      pair(5, { probabilityUp: 0.75 }),
      pair(6, { probabilityUp: 1 }),
    ]);

    expect(calibration.bins.map((bin) => [bin.rangeLabel, bin.pairCount])).toEqual([
      ["0.50-0.55", 2],
      ["0.55-0.60", 1],
      ["0.60-0.65", 1],
      ["0.75-1.00", 2],
    ]);
  });

  it("computes Brier score, ECE, max calibration gap, and per-bin rates from hand-computed values", () => {
    const calibration = buildStrategyLabCalibration([
      ...outcomePairs(0.5, ["up", "down", "up", "down", "down"], 0),
      ...outcomePairs(0.6, ["up", "up", "up", "down", "down"], 5),
      ...outcomePairs(0.7, ["up", "up", "down", "down", "down"], 10),
      ...outcomePairs(0.8, ["up", "up", "up", "up", "down"], 15),
    ]);

    expect(calibration.status).toBe("ready");
    expect(calibration.verdict).toBe("poorly_calibrated");
    expect(calibration.validPairCount).toBe(20);
    expect(calibration.binCount).toBe(4);
    expect(calibration.brierScore).toBe(0.245);
    expect(calibration.meanPredictedProbability).toBe(0.65);
    expect(calibration.actualUpRate).toBe(0.55);
    expect(calibration.expectedCalibrationErrorApprox).toBe(0.1);
    expect(calibration.maxCalibrationGap).toBe(0.3);
    expect(calibration.bins).toEqual([
      expect.objectContaining({
        rangeLabel: "0.50-0.55",
        pairCount: 5,
        meanProbabilityUp: 0.5,
        actualUpRate: 0.4,
        calibrationGap: -0.1,
      }),
      expect.objectContaining({
        rangeLabel: "0.60-0.65",
        pairCount: 5,
        meanProbabilityUp: 0.6,
        actualUpRate: 0.6,
        calibrationGap: 0,
      }),
      expect.objectContaining({
        rangeLabel: "0.70-0.75",
        pairCount: 5,
        meanProbabilityUp: 0.7,
        actualUpRate: 0.4,
        calibrationGap: -0.3,
      }),
      expect.objectContaining({
        rangeLabel: "0.75-1.00",
        pairCount: 5,
        meanProbabilityUp: 0.8,
        actualUpRate: 0.8,
        calibrationGap: 0,
      }),
    ]);
  });

  it("uses actualDirection before correct and derives outcome from correct when actualDirection is missing", () => {
    const calibration = buildStrategyLabCalibration([
      pair(1, {
        probabilityUp: 0.8,
        predictedDirection: "down",
        actualDirection: "up",
        correct: true,
        forwardReturn: 0.03,
      }),
      pair(2, {
        probabilityUp: 0.8,
        predictedDirection: "down",
        actualDirection: null,
        correct: true,
        forwardReturn: -0.03,
      }),
    ]);

    expect(calibration.validPairCount).toBe(2);
    expect(calibration.actualUpRate).toBe(0.5);
    expect(calibration.brierScore).toBe(0.34);
    expect(calibration.bins[0]).toMatchObject({
      rangeLabel: "0.75-1.00",
      pairCount: 2,
      actualUpRate: 0.5,
      hitRate: 1,
      calibrationGap: -0.3,
    });
  });

  it("keeps sparse samples in needs-more-evidence and avoids trading or investment verdicts", () => {
    const calibration = buildStrategyLabCalibration([
      pair(1, { probabilityUp: 0.6, actualDirection: "up" }),
      pair(2, { probabilityUp: 0.65, actualDirection: "down" }),
    ]);

    expect(calibration.status).toBe("insufficient");
    expect(calibration.verdict).toBe("needs_more_evidence");
    expect(calibration.verdictLabel).toBe("證據不足");
    expect(calibration.verdictReason).not.toMatch(/投資|交易|profit|return/i);
    expect(calibration.caveats.some((caveat) => caveat.includes("Small sample: N=2"))).toBe(true);
    expect(calibration.caveats.some((caveat) => caveat.includes("Sparse bins"))).toBe(true);
    expect(calibration.caveats.some((caveat) => caveat.includes("not investment advice"))).toBe(true);
  });
});
