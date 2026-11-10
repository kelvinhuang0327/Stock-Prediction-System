import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { StockSignalEffectivenessSection } from '../StockSignalEffectivenessSection';

jest.mock('@/components/ui/glass-card', () => ({
  GlassCard: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

jest.mock('@/components/ui/loading', () => ({
  LoadingSpinner: () => <span>spinner</span>,
}));

jest.mock('@/components/signals/SignalEffectivenessCard', () => ({
  SignalEffectivenessCard: ({ effectiveness }: { effectiveness: { signalType: string; sampleSize: number } }) => (
    <div data-testid="effectiveness-card">{effectiveness.signalType}:{effectiveness.sampleSize}</div>
  ),
}));

jest.mock('@/components/signals/WalkForwardSummaryCard', () => ({
  WalkForwardSummaryCard: ({ signalType }: { signalType: string }) => <div>walk:{signalType}</div>,
}));

jest.mock('@/components/signals/RegimeStratifiedCard', () => ({
  RegimeStratifiedCard: ({ signalType }: { signalType: string }) => <div>regime:{signalType}</div>,
}));

function response(data: unknown, ok = true, status = 200) {
  return { ok, status, json: async () => data } as Response;
}

function batch(results: Array<Record<string, unknown>> = [{
  signalType: 'topic_surging',
  effectiveness: { signalType: 'topic_surging', window: 5, sampleSize: 12, classification: 'RELIABLE' },
  limitations: [],
}]) {
  return { window: 5, results, generatedAt: '2026-11-10T00:00:00Z', limitations: [] };
}

describe('StockSignalEffectivenessSection', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith('/api/signals/effectiveness/batch')) return response(batch());
      if (url.startsWith('/api/signals/regime-stratified')) return response({ results: [{ signalType: 'topic_surging' }] });
      if (url.startsWith('/api/signals/walkforward')) return response({ results: [{ signalType: 'topic_surging' }] });
      throw new Error(`Unexpected request: ${url}`);
    }) as jest.Mock;
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  it('loads signal cards, fills missing batch results, and reloads on the selected window', async () => {
    render(<StockSignalEffectivenessSection symbol="2330" />);

    expect(await screen.findAllByTestId('effectiveness-card')).toHaveLength(5);
    expect(screen.getByText('topic_surging:12')).toBeInTheDocument();
    expect(screen.getAllByText(/:0$/)).toHaveLength(4);
    expect(global.fetch).toHaveBeenCalledWith('/api/signals/effectiveness/batch?symbol=2330&window=5');

    fireEvent.click(screen.getByRole('button', { name: '3 日' }));
    await waitFor(() => expect(global.fetch).toHaveBeenLastCalledWith('/api/signals/effectiveness/batch?symbol=2330&window=3'));
    expect(await screen.findAllByTestId('effectiveness-card')).toHaveLength(5);
  });

  it('handles malformed non-success responses and non-Error base request failures', async () => {
    const fetchMock = global.fetch as jest.Mock;
    fetchMock.mockResolvedValueOnce(response({ status: 'unavailable' }, false, 503));
    const first = render(<StockSignalEffectivenessSection symbol="2330" />);
    expect(await screen.findByText('訊號有效性 API 失敗 (503)')).toBeInTheDocument();
    expect(screen.queryAllByTestId('effectiveness-card')).toHaveLength(0);
    first.unmount();

    fetchMock.mockRejectedValueOnce('network unavailable');
    render(<StockSignalEffectivenessSection symbol="2317" />);
    expect(await screen.findByText('無法載入訊號有效性')).toBeInTheDocument();
  });

  it('loads lazy regime and walk-forward panels and reuses cached results for the same window', async () => {
    render(<StockSignalEffectivenessSection symbol="2330" />);
    await screen.findAllByTestId('effectiveness-card');

    fireEvent.click(screen.getByRole('button', { name: /市場環境分層/ }));
    expect(await screen.findByText('regime:topic_surging')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /市場環境分層/ }));
    fireEvent.click(screen.getByRole('button', { name: /市場環境分層/ }));
    expect(screen.getByText('regime:topic_surging')).toBeInTheDocument();
    expect((global.fetch as jest.Mock).mock.calls.filter(([url]) => String(url).startsWith('/api/signals/regime-stratified'))).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: /走勢驗證/ }));
    expect(await screen.findByText('walk:topic_surging')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /走勢驗證/ }));
    fireEvent.click(screen.getByRole('button', { name: /走勢驗證/ }));
    expect(screen.getByText('walk:topic_surging')).toBeInTheDocument();
    expect((global.fetch as jest.Mock).mock.calls.filter(([url]) => String(url).startsWith('/api/signals/walkforward'))).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: '10 日' }));
    await waitFor(() => expect((global.fetch as jest.Mock).mock.calls.filter(([url]) => String(url).startsWith('/api/signals/regime-stratified'))).toHaveLength(2));
    await waitFor(() => expect((global.fetch as jest.Mock).mock.calls.filter(([url]) => String(url).startsWith('/api/signals/walkforward'))).toHaveLength(2));
  });

  it('shows lazy loading failures, handles unknown rejection values, and accepts empty results', async () => {
    const fetchMock = global.fetch as jest.Mock;
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith('/api/signals/effectiveness/batch')) return response(batch());
      if (url.startsWith('/api/signals/regime-stratified')) return response({ results: null });
      if (url.startsWith('/api/signals/walkforward')) throw new Error('walk service down');
      throw new Error('Unexpected request');
    });
    render(<StockSignalEffectivenessSection symbol="2330" />);
    await screen.findAllByTestId('effectiveness-card');

    fireEvent.click(screen.getByRole('button', { name: /市場環境分層/ }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/signals/regime-stratified?symbol=2330&window=5'));
    expect(screen.queryByText(/regime:/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /走勢驗證/ }));
    expect(await screen.findByText('walk service down')).toBeInTheDocument();
  });

  it('shows regime request errors for Error and non-Error rejection values', async () => {
    const fetchMock = global.fetch as jest.Mock;
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith('/api/signals/effectiveness/batch')) return response(batch());
      if (url.startsWith('/api/signals/regime-stratified')) throw new Error('regime service down');
      if (url.startsWith('/api/signals/walkforward')) return response({ results: [] });
      throw new Error(`Unexpected request: ${url}`);
    });
    const first = render(<StockSignalEffectivenessSection symbol="2330" />);
    await screen.findAllByTestId('effectiveness-card');
    fireEvent.click(screen.getByRole('button', { name: /市場環境分層/ }));
    expect(await screen.findByText('regime service down')).toBeInTheDocument();
    first.unmount();

    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      if (String(input).startsWith('/api/signals/effectiveness/batch')) return response(batch());
      if (String(input).startsWith('/api/signals/regime-stratified')) throw 'unknown regime failure';
      return response({ results: [] });
    });
    render(<StockSignalEffectivenessSection symbol="2317" />);
    await screen.findAllByTestId('effectiveness-card');
    fireEvent.click(screen.getByRole('button', { name: /市場環境分層/ }));
    expect(await screen.findByText('環境分層載入失敗')).toBeInTheDocument();
  });

  it('renders loading state while the initial request is pending', async () => {
    let resolveRequest!: (value: Response) => void;
    global.fetch = jest.fn(() => new Promise<Response>((resolve) => { resolveRequest = resolve; })) as jest.Mock;
    render(<StockSignalEffectivenessSection symbol="2454" />);

    expect(screen.getByText('正在載入 2454 的 signal effectiveness…')).toBeInTheDocument();
    await act(async () => resolveRequest(response(batch())));
    expect(await screen.findAllByTestId('effectiveness-card')).toHaveLength(5);
  });

  it('ignores initial and lazy responses that arrive after their effects are cancelled', async () => {
    let resolveInitial!: (value: Response) => void;
    global.fetch = jest.fn(() => new Promise<Response>((resolve) => { resolveInitial = resolve; })) as jest.Mock;
    const initial = render(<StockSignalEffectivenessSection symbol="2454" />);
    initial.unmount();
    await act(async () => resolveInitial(response(batch())));

    let rejectRegime!: (reason: unknown) => void;
    let rejectWalkForward!: (reason: unknown) => void;
    global.fetch = jest.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith('/api/signals/effectiveness/batch')) return Promise.resolve(response(batch()));
      if (url.startsWith('/api/signals/regime-stratified')) return new Promise<Response>((_resolve, reject) => { rejectRegime = reject; });
      if (url.startsWith('/api/signals/walkforward')) return new Promise<Response>((_resolve, reject) => { rejectWalkForward = reject; });
      return Promise.reject(new Error(`Unexpected request: ${url}`));
    }) as jest.Mock;
    const lazy = render(<StockSignalEffectivenessSection symbol="2330" />);
    await screen.findAllByTestId('effectiveness-card');
    fireEvent.click(screen.getByRole('button', { name: /市場環境分層/ }));
    fireEvent.click(screen.getByRole('button', { name: /走勢驗證/ }));
    lazy.unmount();
    await act(async () => {
      rejectRegime(new Error('late regime failure'));
      rejectWalkForward(new Error('late walk-forward failure'));
      await Promise.resolve();
    });
  });
});
