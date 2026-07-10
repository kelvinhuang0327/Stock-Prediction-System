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
    expect(within(panel).getByText("Research Replay (historical validation)")).toBeInTheDocument();
    expect(within(panel).getByText("Provenance + Caveats")).toBeInTheDocument();
    expect(within(panel).getAllByText("diagnostic-only").length).toBeGreaterThan(0);
    expect(within(panel).getByText("no investment advice")).toBeInTheDocument();
    expect(within(panel).getByText("no trading signal")).toBeInTheDocument();
    expect(within(panel).getByText("Research diagnostic only — not a buy/sell recommendation, not a profitability claim, and not a production trading signal.")).toBeInTheDocument();
    expect(within(panel).getByText(/Snapshot payload generated time:/)).toBeInTheDocument();
    expect(within(panel).getAllByText(/artifact file mtime:/).length).toBeGreaterThan(0);
    expect(within(panel).getAllByText(/run recorded time:/).length).toBeGreaterThan(0);
    expect(within(panel).getAllByText("directional hit rate (historical validation evidence)").length).toBeGreaterThan(0);
    expect(within(panel).queryByText(/buy now|sell now|strong buy|strong sell/i)).not.toBeInTheDocument();
    expect(within(panel).queryByText(/guaranteed profit|profitable strategy|profit opportunity/i)).not.toBeInTheDocument();
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
