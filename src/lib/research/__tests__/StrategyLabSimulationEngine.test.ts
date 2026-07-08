import {
  TAIWAN_ROUND_TRIP_COST,
  buildStrategySimulation,
} from "@/lib/research/StrategyLabSimulationEngine";
import type { StrategyLabResolvedPrediction } from "@/lib/research/strategyLabArtifacts";

function pair(
  index: number,
  overrides: Partial<StrategyLabResolvedPrediction>,
): StrategyLabResolvedPrediction {
  const forwardReturn = "forwardReturn" in overrides ? overrides.forwardReturn ?? null : 0.01;
  return {
    symbol: overrides.symbol ?? `T${index}`,
    featureDate: overrides.featureDate ?? "2026-06-01",
    targetDate: overrides.targetDate ?? "2026-06-08",
    probabilityUp: overrides.probabilityUp ?? 0.55,
    predictedDirection: overrides.predictedDirection ?? "up",
    actualDirection: overrides.actualDirection ?? ((forwardReturn ?? 0) > 0 ? "up" : "down"),
    forwardReturn,
    correct: overrides.correct ?? true,
  };
}

function round(value: number): number {
  return Number(value.toFixed(8));
}

describe("buildStrategySimulation", () => {
  it("builds a normal mixed up/down strategy simulation", () => {
    const simulation = buildStrategySimulation([
      pair(1, { predictedDirection: "up", forwardReturn: 0.03 }),
      pair(2, { predictedDirection: "down", forwardReturn: -0.02 }),
      pair(3, { predictedDirection: "up", forwardReturn: -0.01 }),
      pair(4, { predictedDirection: "down", forwardReturn: 0.02 }),
      pair(5, { predictedDirection: "up", forwardReturn: 0.04 }),
      pair(6, { featureDate: "2026-06-02", targetDate: "2026-06-09", predictedDirection: "down", forwardReturn: 0.01 }),
      pair(7, { featureDate: "2026-06-02", targetDate: "2026-06-09", predictedDirection: "up", forwardReturn: 0.05 }),
      pair(8, { featureDate: "2026-06-02", targetDate: "2026-06-09", predictedDirection: "down", forwardReturn: -0.02 }),
      pair(9, { featureDate: "2026-06-02", targetDate: "2026-06-09", predictedDirection: "up", forwardReturn: 0.01 }),
      pair(10, { featureDate: "2026-06-02", targetDate: "2026-06-09", predictedDirection: "up", forwardReturn: -0.03 }),
    ]);

    expect(simulation.status).toBe("ready");
    expect(simulation.stats.pairCount).toBe(10);
    expect(simulation.stats.validPairCount).toBe(10);
    expect(simulation.stats.cohortCount).toBe(2);
    expect(simulation.stats.tradeCount).toBe(6);
    expect(simulation.equityCurve).toHaveLength(2);
  });

  it("returns missing for empty input", () => {
    const simulation = buildStrategySimulation([]);

    expect(simulation.status).toBe("missing");
    expect(simulation.verdict).toBe("needs_more_evidence");
    expect(simulation.stats.pairCount).toBe(0);
    expect(simulation.equityCurve).toEqual([]);
  });

  it("returns insufficient when fewer than 10 valid pairs are available", () => {
    const simulation = buildStrategySimulation([
      pair(1, {}),
      pair(2, {}),
      pair(3, {}),
      pair(4, {}),
      pair(5, {}),
      pair(6, {}),
      pair(7, {}),
      pair(8, {}),
      pair(9, {}),
    ]);

    expect(simulation.status).toBe("insufficient");
    expect(simulation.verdict).toBe("needs_more_evidence");
    expect(simulation.stats.validPairCount).toBe(9);
    expect(simulation.equityCurve).toEqual([]);
  });

  it("keeps the strategy flat when every prediction is down while baseline compounds", () => {
    const pairs = Array.from({ length: 10 }, (_, index) =>
      pair(index, {
        predictedDirection: "down",
        forwardReturn: index % 2 === 0 ? 0.02 : -0.01,
      }),
    );
    const simulation = buildStrategySimulation(pairs);

    expect(simulation.status).toBe("ready");
    expect(simulation.stats.tradeCount).toBe(0);
    expect(simulation.stats.cumulativeStrategyGross).toBe(0);
    expect(simulation.stats.cumulativeStrategyNet).toBe(0);
    expect(simulation.equityCurve.at(-1)?.strategyNetReturn).toBe(0);
    expect(simulation.stats.cumulativeBaselineGross).not.toBe(0);
  });

  it("compounds the baseline curve from hand-computed cohort means", () => {
    const returnsA = [0.1, 0, -0.05, 0.02, 0.03];
    const returnsB = [-0.02, 0.04, 0.01, -0.01, 0.05];
    const pairs = [
      ...returnsA.map((forwardReturn, index) => pair(index, {
        featureDate: "2026-06-01",
        targetDate: "2026-06-08",
        forwardReturn,
      })),
      ...returnsB.map((forwardReturn, index) => pair(index + 5, {
        featureDate: "2026-06-02",
        targetDate: "2026-06-09",
        forwardReturn,
      })),
    ];

    const simulation = buildStrategySimulation(pairs);
    const meanA = returnsA.reduce((total, value) => total + value, 0) / returnsA.length;
    const meanB = returnsB.reduce((total, value) => total + value, 0) / returnsB.length;

    expect(simulation.stats.cumulativeBaselineGross).toBe(round((1 + meanA) * (1 + meanB) - 1));
    expect(simulation.equityCurve.at(-1)?.baselineNetReturn).toBe(
      round((1 + meanA - TAIWAN_ROUND_TRIP_COST) * (1 + meanB - TAIWAN_ROUND_TRIP_COST) - 1),
    );
  });

  it("applies Taiwan costs only to active strategy longs and to every baseline pair", () => {
    const pairs = Array.from({ length: 10 }, (_, index) =>
      pair(index, {
        predictedDirection: index < 5 ? "up" : "down",
        forwardReturn: index < 5 ? 0.02 : 0.01,
      }),
    );

    const simulation = buildStrategySimulation(pairs);

    expect(simulation.stats.cumulativeStrategyGross).toBe(0.01);
    expect(simulation.stats.cumulativeStrategyNet).toBe(round((5 * (0.02 - TAIWAN_ROUND_TRIP_COST)) / 10));
    expect(simulation.stats.cumulativeBaselineGross).toBe(0.015);
    expect(simulation.stats.cumulativeBaselineNet).toBe(round(0.015 - TAIWAN_ROUND_TRIP_COST));
  });

  it("computes max drawdown from net strategy equity", () => {
    const cohortReturns = [
      { featureDate: "2026-06-01", targetDate: "2026-06-08", forwardReturn: 0.1 },
      { featureDate: "2026-06-02", targetDate: "2026-06-09", forwardReturn: -0.2 },
      { featureDate: "2026-06-03", targetDate: "2026-06-10", forwardReturn: 0.05 },
    ];
    const pairs = cohortReturns.flatMap((cohort, cohortIndex) =>
      Array.from({ length: 4 }, (_, index) =>
        pair(cohortIndex * 4 + index, {
          ...cohort,
          predictedDirection: "up",
        }),
      ),
    );

    const simulation = buildStrategySimulation(pairs);

    expect(simulation.stats.maxDrawdownStrategyNet).toBe(round(0.2 + TAIWAN_ROUND_TRIP_COST));
  });

  it("excludes null forwardReturn pairs from valid simulation counts", () => {
    const pairs = [
      pair(0, { forwardReturn: null }),
      ...Array.from({ length: 10 }, (_, index) => pair(index + 1, { forwardReturn: 0.01 })),
    ];

    const simulation = buildStrategySimulation(pairs);

    expect(simulation.status).toBe("ready");
    expect(simulation.stats.pairCount).toBe(11);
    expect(simulation.stats.validPairCount).toBe(10);
  });
});
