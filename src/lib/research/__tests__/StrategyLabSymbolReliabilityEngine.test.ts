import { buildStrategyLabSymbolReliability } from "@/lib/research/StrategyLabSymbolReliabilityEngine";
import type {
  StrategyLabOpenPrediction,
  StrategyLabResolvedPrediction,
} from "@/lib/research/strategyLabArtifacts";

function pair(
  index: number,
  overrides: Partial<StrategyLabResolvedPrediction>,
): StrategyLabResolvedPrediction {
  const forwardReturn = "forwardReturn" in overrides ? overrides.forwardReturn ?? null : 0.01;
  const actualDirection = "actualDirection" in overrides
    ? overrides.actualDirection ?? null
    : forwardReturn !== null && forwardReturn > 0
      ? "up"
      : "down";
  const predictedDirection = "predictedDirection" in overrides ? overrides.predictedDirection ?? null : "up";

  return {
    symbol: overrides.symbol ?? `T${index}`,
    featureDate: overrides.featureDate ?? `2026-06-${String(index + 1).padStart(2, "0")}`,
    targetDate: overrides.targetDate ?? `2026-06-${String(index + 8).padStart(2, "0")}`,
    probabilityUp: "probabilityUp" in overrides ? overrides.probabilityUp ?? null : 0.6,
    predictedDirection,
    actualDirection,
    forwardReturn,
    correct: overrides.correct ?? actualDirection === predictedDirection,
  };
}

function latest(overrides: Partial<StrategyLabOpenPrediction>): StrategyLabOpenPrediction {
  return {
    symbol: overrides.symbol ?? "A",
    featureDate: overrides.featureDate ?? "2026-06-20",
    close: overrides.close ?? 100,
    probabilityUp: "probabilityUp" in overrides ? overrides.probabilityUp ?? null : 0.7,
    predictedDirection: "predictedDirection" in overrides ? overrides.predictedDirection ?? null : "up",
    isLatest: overrides.isLatest ?? true,
  };
}

describe("buildStrategyLabSymbolReliability", () => {
  it("groups resolved pairs by symbol and computes hand-checked rates", () => {
    const reliability = buildStrategyLabSymbolReliability([
      pair(1, { symbol: "AAA", probabilityUp: 0.6, actualDirection: "up", forwardReturn: 0.03 }),
      pair(2, { symbol: "AAA", probabilityUp: 0.7, actualDirection: "down", forwardReturn: -0.02 }),
      pair(3, { symbol: "AAA", probabilityUp: 0.5, actualDirection: "up", forwardReturn: 0.01 }),
      pair(4, { symbol: "BBB", probabilityUp: 0.8, actualDirection: "down", forwardReturn: -0.04 }),
    ], [], [
      { symbol: "AAA", tradeCount: 2 },
      { symbol: "BBB", tradeCount: 1 },
    ]);

    expect(reliability.rows.map((row) => row.symbol)).toEqual(["AAA", "BBB"]);
    expect(reliability.rows[0]).toMatchObject({
      symbol: "AAA",
      resolvedPairCount: 3,
      correctRate: 0.66666667,
      actualUpRate: 0.66666667,
      meanProbabilityUp: 0.6,
      calibrationGap: 0.06666667,
      avgForwardReturn: 0.00666667,
      avgForwardReturnWhenPredictedUp: 0.00666667,
      predictedUpCount: 3,
      candidateSelectedCount: 2,
    });
  });

  it("maps latest predictions by symbol when available", () => {
    const reliability = buildStrategyLabSymbolReliability([
      pair(1, { symbol: "AAA" }),
    ], [
      latest({ symbol: "AAA", probabilityUp: 0.64, predictedDirection: "down" }),
    ]);

    expect(reliability.rows[0]).toMatchObject({
      symbol: "AAA",
      latestPredictedDirection: "down",
      latestProbabilityUp: 0.64,
    });
  });

  it("keeps resolved stats when a symbol has no latest prediction", () => {
    const reliability = buildStrategyLabSymbolReliability([
      pair(1, { symbol: "AAA", actualDirection: "up" }),
      pair(2, { symbol: "AAA", actualDirection: "down" }),
    ], []);

    expect(reliability.rows[0]).toMatchObject({
      symbol: "AAA",
      resolvedPairCount: 2,
      latestPredictedDirection: null,
      latestProbabilityUp: null,
      correctRate: 0.5,
    });
  });

  it("flags low sample, poor calibration, and negative average return", () => {
    const reliability = buildStrategyLabSymbolReliability([
      pair(1, {
        symbol: "AAA",
        probabilityUp: 0.9,
        actualDirection: "down",
        predictedDirection: "up",
        forwardReturn: -0.05,
        correct: false,
      }),
      pair(2, {
        symbol: "AAA",
        probabilityUp: 0.8,
        actualDirection: "down",
        predictedDirection: "up",
        forwardReturn: -0.03,
        correct: false,
      }),
    ], []);

    expect(reliability.rows[0].warnings).toEqual({
      lowSample: true,
      poorCalibration: true,
      negativeAvgReturn: true,
    });
    expect(reliability.status.enoughSymbols).toBe(false);
  });

  it("does not emit an investment or trading verdict", () => {
    const reliability = buildStrategyLabSymbolReliability([
      pair(1, { symbol: "AAA", actualDirection: "up" }),
      pair(2, { symbol: "BBB", actualDirection: "down" }),
    ], [
      latest({ symbol: "CCC" }),
    ]);

    const serialized = JSON.stringify(reliability);
    expect(serialized).not.toMatch(/profitability|buy|sell|recommendation|投資建議|交易訊號/i);
    expect(reliability.status.caveats.join(" ")).toMatch(/not investment advice/);
  });
});
