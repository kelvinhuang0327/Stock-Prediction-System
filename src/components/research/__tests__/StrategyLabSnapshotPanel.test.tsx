import { render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom";

import { StrategyLabSnapshotPanel } from "@/components/research/StrategyLabSnapshotPanel";
import { readStrategyLabSnapshot } from "@/lib/research/strategyLabArtifacts";
import type { StrategyLabSnapshot } from "@/lib/research/strategyLabArtifacts";

describe("StrategyLabSnapshotPanel", () => {
  it("renders prediction, retraining, validation, replay, provenance, and caveats", async () => {
    const snapshot = await readStrategyLabSnapshot();

    render(<StrategyLabSnapshotPanel snapshot={snapshot} />);

    const panel = screen.getByLabelText("Prediction & Retraining Snapshot");
    expect(within(panel).getByText("Prediction & Retraining Snapshot")).toBeInTheDocument();
    expect(within(panel).getByText("Prediction")).toBeInTheDocument();
    expect(within(panel).getByText("Retraining")).toBeInTheDocument();
    expect(within(panel).getByText("Resolved Validation")).toBeInTheDocument();
    expect(within(panel).getByText("Research Replay")).toBeInTheDocument();
    expect(within(panel).getByText("Provenance + Caveats")).toBeInTheDocument();
    expect(within(panel).getAllByText("diagnostic-only").length).toBeGreaterThan(0);
    expect(within(panel).getByText("no investment advice")).toBeInTheDocument();
    expect(within(panel).getByText("no trading signal")).toBeInTheDocument();
  });

  it("renders NOT_AVAILABLE for missing snapshot inputs", async () => {
    const snapshot = await readStrategyLabSnapshot();
    const missingSnapshot: StrategyLabSnapshot = {
      ...snapshot,
      artifactSetStatus: "blocked",
      refit: {
        ...snapshot.refit,
        status: "missing",
        runId: null,
        mtime: null,
      },
      predictions: {
        ...snapshot.predictions,
        status: "missing",
        runId: null,
        mtime: null,
        dataEndDate: null,
        latestBySymbol: [],
        openPredictions: [],
        recentResolved: [],
      },
    };

    render(<StrategyLabSnapshotPanel snapshot={missingSnapshot} />);

    const panel = screen.getByLabelText("Prediction & Retraining Snapshot");
    expect(within(panel).getAllByText("NOT_AVAILABLE").length).toBeGreaterThan(0);
  });
});
