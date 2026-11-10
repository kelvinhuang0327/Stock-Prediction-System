import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

import { StrategyLabClient } from '../StrategyLabClient';
import { readStrategyLabSnapshot } from '@/lib/research/strategyLabArtifacts';
import type { StrategyLabSnapshot } from '@/lib/research/strategyLabArtifacts';

const originalFetch = globalThis.fetch;

function withRefitEnabled(snapshot: StrategyLabSnapshot): StrategyLabSnapshot {
  return {
    ...snapshot,
    availableActions: { ...snapshot.availableActions, rerunRefit: true },
  };
}

function setFetch(fetchMock: jest.Mock): void {
  Object.defineProperty(globalThis, 'fetch', { configurable: true, writable: true, value: fetchMock });
}

describe('StrategyLabClient', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    if (originalFetch) Object.defineProperty(globalThis, 'fetch', { configurable: true, writable: true, value: originalFetch });
    else delete (globalThis as unknown as { fetch?: unknown }).fetch;
    delete (navigator as unknown as { clipboard?: unknown }).clipboard;
  });

  it('renders the research decision, executive summary, and read-only brief', async () => {
    const snapshot = withRefitEnabled(await readStrategyLabSnapshot());

    render(<StrategyLabClient initialSnapshot={snapshot} />);

    expect(screen.getByText('策略研究決策')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: snapshot.productStance.label })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '目前研究結論' })).toBeInTheDocument();
    expect(screen.getByLabelText('Strategy Lab Research Brief')).toHaveAttribute('readonly');
    expect(screen.getByRole('button', { name: '更新結果' })).toBeEnabled();
    expect(screen.getByRole('button', { name: '重新跑 refit' })).toBeEnabled();
  });

  it('renders the fail-safe state when research artifacts are missing', async () => {
    const snapshot = await readStrategyLabSnapshot();
    const missingSnapshot: StrategyLabSnapshot = {
      ...snapshot,
      artifactSetStatus: 'blocked',
      dataExport: {
        ...snapshot.dataExport,
        status: 'missing',
        manifestAvailable: false,
        sha256: null,
        rowCount: null,
        symbols: [],
        dateRange: null,
        fetchedAtUtc: null,
        source: null,
        mtime: null,
      },
      refit: {
        ...snapshot.refit,
        status: 'missing',
        mtime: null,
        runId: null,
        finalClassification: null,
        decision: 'missing',
        trainSampleCount: null,
        holdoutSampleCount: null,
        purgedSampleCount: null,
        featureCount: null,
        targetDefinition: null,
        validationBoundary: null,
        metrics: {
          accuracy: null,
          majorityBaselineAccuracy: null,
          deltaVsMajorityBaseline: null,
          precision: null,
          recall: null,
          brierScore: null,
          logLoss: null,
        },
        perSymbolHoldout: [],
        interpretation: null,
      },
      predictions: {
        ...snapshot.predictions,
        status: 'missing',
        mtime: null,
        runId: null,
        dataEndDate: null,
        horizonTradingDays: null,
        modelBeatsBaseline: null,
        latestBySymbol: [],
        openPredictions: [],
        recentResolved: [],
        resolvedSampleProvenance: {
          ...snapshot.predictions.resolvedSampleProvenance,
          validationStatus: 'fallback',
          fallbackActive: true,
          featureDateRange: null,
          targetDateRange: null,
        },
      },
      simulation: undefined,
      calibration: undefined,
      symbolReliability: undefined,
      runHistory: { ...snapshot.runHistory, status: 'missing', mtime: null, totalRuns: 0, entries: [] },
      protocolComparison: {
        ...snapshot.protocolComparison,
        status: 'missing',
        mtime: null,
        finalClassification: null,
        decision: 'missing',
        variants: [],
        bestVariant: null,
      },
      productStance: { decision: 'missing', label: 'artifact 不完整', reason: '尚無可用研究 artifact。' },
      artifactCompleteness: [{ label: 'refit', path: 'missing.json', present: false, mtime: null }],
      availableActions: { rerunRefit: false, rerunProtocolComparison: false },
    };

    render(<StrategyLabClient initialSnapshot={missingSnapshot} />);

    expect(screen.getByRole('heading', { level: 1, name: 'artifact 不完整' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '重新跑 refit' })).toBeDisabled();
    expect(screen.getByText('尚未產生預測 artifact，請先按「重新跑 refit」。')).toBeInTheDocument();
    expect(screen.getByText('尚未產生已驗證預測，請先按「重新跑 refit」。')).toBeInTheDocument();
    expect(screen.getByText('目前沒有可回放的 resolved prediction/outcome pairs，暫不產生模擬曲線。')).toBeInTheDocument();
    expect(screen.getAllByText('目前沒有可校準的 resolved prediction/outcome pairs。')).toHaveLength(2);
    expect(screen.getByText('尚無可彙整的各股 resolved artifact。')).toBeInTheDocument();
  });

  it('refreshes the snapshot and reports HTTP and network errors', async () => {
    const snapshot = withRefitEnabled(await readStrategyLabSnapshot());
    const refreshed = { ...snapshot, productStance: { ...snapshot.productStance, label: 'refresh completed' } };
    const fetchMock = jest.fn().mockResolvedValue({ ok: true, json: async () => refreshed });
    setFetch(fetchMock);
    render(<StrategyLabClient initialSnapshot={snapshot} />);

    fireEvent.click(screen.getByRole('button', { name: '更新結果' }));
    await screen.findByText('refresh completed');
    expect(fetchMock).toHaveBeenCalledWith('/api/research/strategy-lab', { cache: 'no-store' });

    fetchMock.mockResolvedValueOnce({ ok: false, status: 503, json: async () => ({}) });
    fireEvent.click(screen.getByRole('button', { name: '更新結果' }));
    await screen.findByText('HTTP 503');

    fetchMock.mockRejectedValueOnce(new Error('network offline'));
    fireEvent.click(screen.getByRole('button', { name: '更新結果' }));
    await screen.findByText('network offline');
  });

  it('runs refit, updates its snapshot, and summarizes valid and plain-text output', async () => {
    const snapshot = withRefitEnabled(await readStrategyLabSnapshot());
    const rerunSnapshot = { ...snapshot, productStance: { ...snapshot.productStance, label: 'refit updated' } };
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        ok: true,
        stdout: JSON.stringify({ status: 'complete', holdoutAccuracy: 0.7, holdoutMajorityBaselineAccuracy: 0.6 }),
        snapshot: rerunSnapshot,
      }),
    });
    setFetch(fetchMock);
    render(<StrategyLabClient initialSnapshot={snapshot} />);

    fireEvent.click(screen.getByRole('button', { name: '重新跑 refit' }));
    await screen.findByText('refit updated');
    await screen.findByText('complete · holdout 70.00% · baseline 60.00%');
    expect(fetchMock).toHaveBeenCalledWith('/api/research/strategy-lab', expect.objectContaining({ method: 'POST' }));

    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ ok: true, stdout: 'plain output\n' }) });
    fireEvent.click(screen.getByRole('button', { name: '重新跑 refit' }));
    await screen.findByText('plain output');
  });

  it('shows rerun errors and chooses copy feedback for clipboard success, failure, or absence', async () => {
    const snapshot = withRefitEnabled(await readStrategyLabSnapshot());
    const fetchMock = jest.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({ ok: false, error: 'refit failed' }) });
    setFetch(fetchMock);
    const writeText = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    render(<StrategyLabClient initialSnapshot={snapshot} />);

    fireEvent.click(screen.getByRole('button', { name: '重新跑 refit' }));
    await screen.findByText('refit failed');

    fireEvent.click(screen.getByRole('button', { name: '複製摘要' }));
    await screen.findByText('已複製到剪貼簿。');
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('# Strategy Lab'));

    writeText.mockRejectedValueOnce(new Error('clipboard denied'));
    fireEvent.click(screen.getByRole('button', { name: '複製摘要' }));
    await screen.findByText('剪貼簿不可用，請直接選取下方文字手動複製。');
  });

  it('prompts for manual copy when the browser has no clipboard API', async () => {
    const snapshot = withRefitEnabled(await readStrategyLabSnapshot());
    render(<StrategyLabClient initialSnapshot={snapshot} />);

    fireEvent.click(screen.getByRole('button', { name: '複製摘要' }));
    await waitFor(() => expect(screen.getByText('剪貼簿不可用，請直接選取下方文字手動複製。')).toBeInTheDocument());
  });
});
