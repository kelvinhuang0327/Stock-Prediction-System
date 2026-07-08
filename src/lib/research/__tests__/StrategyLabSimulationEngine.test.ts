import {
  STRATEGY_LAB_CONFIDENCE_THRESHOLDS,
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
    probabilityUp: "probabilityUp" in overrides ? overrides.probabilityUp ?? null : 0.55,
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
    expect(simulation.thresholdSweep.map((row) => row.threshold)).toEqual([...STRATEGY_LAB_CONFIDENCE_THRESHOLDS]);
  });

  it("returns missing for empty input", () => {
    const simulation = buildStrategySimulation([]);

    expect(simulation.status).toBe("missing");
    expect(simulation.verdict).toBe("needs_more_evidence");
    expect(simulation.stats.pairCount).toBe(0);
    expect(simulation.equityCurve).toEqual([]);
    expect(simulation.thresholdSweep).toEqual([]);
    expect(simulation.thresholdDrilldown.status).toBe("no_candidate");
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
    expect(simulation.thresholdSweep).toEqual([]);
    expect(simulation.thresholdDrilldown.status).toBe("no_candidate");
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

  it("filters threshold trades by probabilityUp while preserving the default strategy", () => {
    const pairs = [
      pair(0, { probabilityUp: 0.51, predictedDirection: "up", forwardReturn: 0.02 }),
      pair(1, { probabilityUp: 0.59, predictedDirection: "up", forwardReturn: 0.03 }),
      pair(2, { probabilityUp: 0.6, predictedDirection: "up", forwardReturn: 0.04 }),
      pair(3, { probabilityUp: 0.7, predictedDirection: "up", forwardReturn: -0.01 }),
      pair(4, { probabilityUp: null, predictedDirection: "up", forwardReturn: 0.05 }),
      pair(5, { probabilityUp: 0.9, predictedDirection: "down", forwardReturn: 0.1 }),
      pair(6, { probabilityUp: 0.5, predictedDirection: "down", forwardReturn: 0.1 }),
      pair(7, { probabilityUp: 0.49, predictedDirection: "up", forwardReturn: 0.2 }),
      pair(8, { probabilityUp: null, predictedDirection: "down", forwardReturn: -0.02 }),
      pair(9, { probabilityUp: 0.8, predictedDirection: "up", forwardReturn: 0.06 }),
    ];

    const simulation = buildStrategySimulation(pairs);

    expect(simulation.stats.tradeCount).toBe(7);
    expect(simulation.thresholdSweep.map((row) => [row.threshold, row.tradeCount])).toEqual([
      [0.5, 5],
      [0.55, 4],
      [0.6, 3],
      [0.65, 2],
      [0.7, 2],
      [0.75, 1],
    ]);
  });

  it("keeps baseline unchanged across thresholds", () => {
    const pairs = Array.from({ length: 10 }, (_, index) =>
      pair(index, {
        probabilityUp: 0.5 + index * 0.03,
        predictedDirection: index % 2 === 0 ? "up" : "down",
        forwardReturn: index % 2 === 0 ? 0.02 : -0.01,
      }),
    );

    const simulation = buildStrategySimulation(pairs);
    const baselineReturns = new Set(
      simulation.thresholdSweep.map((row) => row.baselineNetCumulativeReturn),
    );

    expect(baselineReturns.size).toBe(1);
    expect([...baselineReturns][0]).toBe(simulation.stats.cumulativeBaselineNet);
  });

  it("keeps a threshold strategy flat when the threshold selects zero trades", () => {
    const pairs = Array.from({ length: 10 }, (_, index) =>
      pair(index, {
        probabilityUp: 0.55,
        predictedDirection: index % 2 === 0 ? "up" : "down",
        forwardReturn: index % 2 === 0 ? 0.02 : -0.01,
      }),
    );

    const simulation = buildStrategySimulation(pairs);
    const threshold075 = simulation.thresholdSweep.find((row) => row.threshold === 0.75);

    expect(threshold075).toBeDefined();
    expect(threshold075?.tradeCount).toBe(0);
    expect(threshold075?.hitRate).toBeNull();
    expect(threshold075?.avgTradeReturnGross).toBeNull();
    expect(threshold075?.strategyNetCumulativeReturn).toBe(0);
    expect(threshold075?.maxDrawdownStrategyNet).toBe(0);
    expect(threshold075?.verdict).toBe("needs_more_evidence");
    expect(threshold075?.equityCurve.every((point) => point.strategyNetReturn === 0)).toBe(true);
    expect(threshold075?.baselineNetCumulativeReturn).toBe(simulation.stats.cumulativeBaselineNet);
  });

  it("applies threshold strategy cost only to selected long trades", () => {
    const pairs = [
      pair(0, { probabilityUp: 0.6, predictedDirection: "up", forwardReturn: 0.04 }),
      pair(1, { probabilityUp: 0.7, predictedDirection: "up", forwardReturn: -0.01 }),
      pair(2, { probabilityUp: 0.8, predictedDirection: "up", forwardReturn: 0.06 }),
      ...Array.from({ length: 7 }, (_, index) =>
        pair(index + 3, {
          probabilityUp: 0.9,
          predictedDirection: "down",
          forwardReturn: 0.02,
        }),
      ),
    ];

    const simulation = buildStrategySimulation(pairs);
    const threshold06 = simulation.thresholdSweep.find((row) => row.threshold === 0.6);

    expect(threshold06?.tradeCount).toBe(3);
    expect(threshold06?.avgTradeReturnGross).toBe(0.03);
    expect(threshold06?.strategyNetCumulativeReturn).toBe(
      round((0.04 - TAIWAN_ROUND_TRIP_COST - 0.01 - TAIWAN_ROUND_TRIP_COST + 0.06 - TAIWAN_ROUND_TRIP_COST) / 10),
    );
  });

  it("selects the nonzero research candidate threshold with the highest positive delta", () => {
    const pairs = [
      ...Array.from({ length: 2 }, (_, index) =>
        pair(index, {
          probabilityUp: 0.55,
          predictedDirection: "up",
          forwardReturn: -0.04,
        }),
      ),
      ...Array.from({ length: 4 }, (_, index) =>
        pair(index + 2, {
          probabilityUp: 0.6,
          predictedDirection: "up",
          forwardReturn: 0.05,
        }),
      ),
      ...Array.from({ length: 4 }, (_, index) =>
        pair(index + 6, {
          probabilityUp: 0.9,
          predictedDirection: "down",
          forwardReturn: -0.04,
        }),
      ),
    ];

    const simulation = buildStrategySimulation(pairs);

    expect(simulation.thresholdDrilldown.status).toBe("candidate");
    expect(simulation.thresholdDrilldown.candidate?.threshold).toBe(0.6);
    expect(simulation.thresholdDrilldown.candidate?.tradeCount).toBe(4);
    expect(simulation.thresholdDrilldown.candidate?.deltaVsBaselineNet).toBeGreaterThan(0);
    expect(simulation.thresholdDrilldown.candidate?.smallSample).toBe(true);
  });

  it("marks a one-symbol candidate sample as concentrated", () => {
    const pairs = [
      ...Array.from({ length: 4 }, (_, index) =>
        pair(index, {
          symbol: "SINGLE",
          probabilityUp: 0.6,
          predictedDirection: "up",
          forwardReturn: 0.05,
        }),
      ),
      ...Array.from({ length: 6 }, (_, index) =>
        pair(index + 4, {
          symbol: `FILL${index}`,
          probabilityUp: 0.9,
          predictedDirection: "down",
          forwardReturn: -0.04,
        }),
      ),
    ];

    const simulation = buildStrategySimulation(pairs);
    const breakdown = simulation.thresholdDrilldown.symbolBreakdown;

    expect(simulation.thresholdDrilldown.status).toBe("candidate");
    expect(breakdown.status).toBe("candidate");
    expect(breakdown.dominantSymbol).toBe("SINGLE");
    expect(breakdown.dominantTradeShare).toBe(1);
    expect(breakdown.symbolCount).toBe(1);
    expect(breakdown.isConcentrated).toBe(true);
    expect(breakdown.rows).toHaveLength(1);
    expect(breakdown.rows[0]).toMatchObject({
      symbol: "SINGLE",
      tradeCount: 4,
      tradeShare: 1,
      winCount: 4,
      hitRate: 1,
      averageNetReturnAfterCost: round(0.05 - TAIWAN_ROUND_TRIP_COST),
      cumulativeNetContributionApprox: round(0.05 - TAIWAN_ROUND_TRIP_COST),
    });
    expect(breakdown.caveats.some((caveat) => caveat.includes("Concentration warning"))).toBe(true);
  });

  it("groups candidate selected trades by symbol with hand-computed shares and hit rates", () => {
    const pairs = [
      pair(0, { symbol: "ALPHA", probabilityUp: 0.6, predictedDirection: "up", forwardReturn: 0.04 }),
      pair(1, { symbol: "ALPHA", probabilityUp: 0.7, predictedDirection: "up", forwardReturn: -0.01 }),
      pair(2, { symbol: "ALPHA", probabilityUp: 0.8, predictedDirection: "up", forwardReturn: 0.06 }),
      pair(3, { symbol: "BETA", probabilityUp: 0.65, predictedDirection: "up", forwardReturn: 0.02 }),
      pair(4, { symbol: "BETA", probabilityUp: 0.75, predictedDirection: "up", forwardReturn: 0.03 }),
      ...Array.from({ length: 5 }, (_, index) =>
        pair(index + 5, {
          symbol: `SHORT${index}`,
          probabilityUp: 0.9,
          predictedDirection: "down",
          forwardReturn: -0.04,
        }),
      ),
    ];

    const simulation = buildStrategySimulation(pairs);
    const rows = simulation.thresholdDrilldown.symbolBreakdown.rows;
    const alpha = rows.find((row) => row.symbol === "ALPHA");
    const beta = rows.find((row) => row.symbol === "BETA");

    expect(simulation.thresholdDrilldown.status).toBe("candidate");
    expect(simulation.thresholdDrilldown.symbolBreakdown.symbolCount).toBe(2);
    expect(simulation.thresholdDrilldown.symbolBreakdown.dominantSymbol).toBe("ALPHA");
    expect(simulation.thresholdDrilldown.symbolBreakdown.dominantTradeShare).toBe(0.6);
    expect(simulation.thresholdDrilldown.symbolBreakdown.isConcentrated).toBe(true);
    expect(alpha).toMatchObject({
      symbol: "ALPHA",
      tradeCount: 3,
      tradeShare: 0.6,
      winCount: 2,
      hitRate: round(2 / 3),
      averageProbabilityUp: 0.7,
      averageForwardReturnGross: 0.03,
      averageNetReturnAfterCost: round(0.03 - TAIWAN_ROUND_TRIP_COST),
      cumulativeNetContributionApprox: round((0.04 - TAIWAN_ROUND_TRIP_COST - 0.01 - TAIWAN_ROUND_TRIP_COST + 0.06 - TAIWAN_ROUND_TRIP_COST) / 5),
      bestTradeForwardReturn: 0.06,
      worstTradeForwardReturn: -0.01,
    });
    expect(beta).toMatchObject({
      symbol: "BETA",
      tradeCount: 2,
      tradeShare: 0.4,
      winCount: 2,
      hitRate: 1,
      averageProbabilityUp: 0.7,
      averageForwardReturnGross: 0.025,
      averageNetReturnAfterCost: round(0.025 - TAIWAN_ROUND_TRIP_COST),
      cumulativeNetContributionApprox: round((0.02 - TAIWAN_ROUND_TRIP_COST + 0.03 - TAIWAN_ROUND_TRIP_COST) / 5),
      bestTradeForwardReturn: 0.03,
      worstTradeForwardReturn: 0.02,
    });
  });

  it("never selects zero-trade threshold rows even when flat strategy return beats a negative baseline", () => {
    const pairs = Array.from({ length: 10 }, (_, index) =>
      pair(index, {
        probabilityUp: 0.9,
        predictedDirection: "down",
        forwardReturn: -0.03,
      }),
    );

    const simulation = buildStrategySimulation(pairs);

    expect(simulation.thresholdSweep.every((row) => row.tradeCount === 0)).toBe(true);
    expect(simulation.thresholdSweep.every((row) => row.strategyNetCumulativeReturn === 0)).toBe(true);
    expect(simulation.thresholdSweep.every((row) => row.baselineNetCumulativeReturn < 0)).toBe(true);
    expect(simulation.thresholdDrilldown.status).toBe("no_candidate");
    expect(simulation.thresholdDrilldown.candidate).toBeNull();
    expect(simulation.thresholdDrilldown.symbolBreakdown).toMatchObject({
      status: "no_candidate",
      dominantSymbol: null,
      dominantTradeShare: null,
      symbolCount: 0,
      isConcentrated: false,
      rows: [],
    });
  });

  it("includes only selected up trades at or above the candidate threshold in the preview", () => {
    const pairs = [
      pair(0, { symbol: "LOWUP", probabilityUp: 0.55, predictedDirection: "up", forwardReturn: -0.04 }),
      pair(1, { symbol: "UP60A", probabilityUp: 0.6, predictedDirection: "up", forwardReturn: 0.05 }),
      pair(2, { symbol: "UP60B", probabilityUp: 0.62, predictedDirection: "up", forwardReturn: 0.04 }),
      pair(3, { symbol: "DOWN90", probabilityUp: 0.9, predictedDirection: "down", forwardReturn: -0.03 }),
      ...Array.from({ length: 6 }, (_, index) =>
        pair(index + 4, {
          symbol: `FILL${index}`,
          probabilityUp: 0.9,
          predictedDirection: "down",
          forwardReturn: -0.03,
        }),
      ),
    ];

    const simulation = buildStrategySimulation(pairs);
    const preview = simulation.thresholdDrilldown.candidate?.selectedTradesPreview ?? [];

    expect(simulation.thresholdDrilldown.candidate?.threshold).toBe(0.6);
    expect(preview.map((trade) => trade.symbol)).toEqual(["UP60A", "UP60B"]);
    expect(preview.every((trade) => trade.predictedDirection === "up")).toBe(true);
    expect(preview.every((trade) => (trade.probabilityUp ?? 0) >= 0.6)).toBe(true);
  });

  it("caps the selected trade preview at ten rows", () => {
    const pairs = [
      ...Array.from({ length: 12 }, (_, index) =>
        pair(index, {
          symbol: `UP${index}`,
          probabilityUp: 0.6,
          predictedDirection: "up",
          forwardReturn: 0.03,
        }),
      ),
      ...Array.from({ length: 8 }, (_, index) =>
        pair(index + 12, {
          symbol: `DOWN${index}`,
          probabilityUp: 0.9,
          predictedDirection: "down",
          forwardReturn: -0.05,
        }),
      ),
    ];

    const simulation = buildStrategySimulation(pairs);

    expect(simulation.thresholdDrilldown.status).toBe("candidate");
    expect(simulation.thresholdDrilldown.candidate?.tradeCount).toBe(12);
    expect(simulation.thresholdDrilldown.candidate?.selectedTradesPreview).toHaveLength(10);
    expect(simulation.thresholdDrilldown.candidate?.smallSample).toBe(false);
  });

  it("returns a no-candidate drilldown when all threshold rows are do_not_promote or zero-trade", () => {
    const pairs = [
      ...Array.from({ length: 6 }, (_, index) =>
        pair(index, {
          probabilityUp: 0.6,
          predictedDirection: "up",
          forwardReturn: -0.03,
        }),
      ),
      ...Array.from({ length: 4 }, (_, index) =>
        pair(index + 6, {
          probabilityUp: 0.9,
          predictedDirection: "down",
          forwardReturn: 0.02,
        }),
      ),
    ];

    const simulation = buildStrategySimulation(pairs);

    expect(simulation.thresholdSweep.some((row) => row.verdict === "do_not_promote")).toBe(true);
    expect(simulation.thresholdSweep.some((row) => row.tradeCount === 0)).toBe(true);
    expect(simulation.thresholdDrilldown).toMatchObject({
      status: "no_candidate",
      candidate: null,
    });
    expect(simulation.thresholdDrilldown.symbolBreakdown.rows).toEqual([]);
  });

  it("uses the active-long cost for selected trade netReturnAfterCost", () => {
    const pairs = [
      pair(0, { symbol: "COST", probabilityUp: 0.6, predictedDirection: "up", forwardReturn: 0.04 }),
      ...Array.from({ length: 4 }, (_, index) =>
        pair(index + 1, {
          probabilityUp: 0.6,
          predictedDirection: "up",
          forwardReturn: 0.05,
        }),
      ),
      ...Array.from({ length: 5 }, (_, index) =>
        pair(index + 5, {
          probabilityUp: 0.9,
          predictedDirection: "down",
          forwardReturn: -0.05,
        }),
      ),
    ];

    const simulation = buildStrategySimulation(pairs);
    const costPreview = simulation.thresholdDrilldown.candidate?.selectedTradesPreview.find((trade) =>
      trade.symbol === "COST",
    );

    expect(costPreview?.netReturnAfterCost).toBe(round(0.04 - TAIWAN_ROUND_TRIP_COST));
  });
});
