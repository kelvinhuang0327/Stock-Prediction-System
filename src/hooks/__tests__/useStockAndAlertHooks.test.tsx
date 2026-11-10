jest.mock('@/lib/api', () => ({ fetchStockData: jest.fn() }));

import { act, renderHook, waitFor } from '@testing-library/react';
import { fetchStockData } from '@/lib/api';
import { useStockData } from '../useStockData';
import { useWatchlistAlerts } from '../useWatchlistAlerts';
import type { PriceAlert } from '@/components/watchlist/PriceAlertDialog';

const mockFetchStockData = fetchStockData as jest.Mock;

function response(body: unknown, ok = true): Response {
  return { ok, json: async () => body } as Response;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('useStockData', () => {
  beforeEach(() => jest.clearAllMocks());

  test('loads stock data, converts non-Error failures, and ignores results for stale symbols', async () => {
    const first = deferred<unknown>();
    const second = deferred<unknown>();
    mockFetchStockData.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const { result, rerender } = renderHook(({ symbol }) => useStockData(symbol), {
      initialProps: { symbol: '2330' },
    });
    expect(result.current).toEqual({ data: null, loading: true, error: null });

    rerender({ symbol: '2454' });
    await act(async () => first.resolve({ name: 'stale result' }));
    expect(result.current).toEqual({ data: null, loading: true, error: null });
    await act(async () => second.resolve({ name: 'MediaTek' }));
    expect(result.current).toEqual({ data: { name: 'MediaTek' }, loading: false, error: null });
    expect(mockFetchStockData.mock.calls.map(([symbol]) => symbol)).toEqual(['2330', '2454']);

    mockFetchStockData.mockRejectedValueOnce('offline');
    rerender({ symbol: '2317' });
    await waitFor(() => expect(result.current.error).toEqual(new Error('offline')));
    expect(result.current).toMatchObject({ data: null, loading: false, error: new Error('offline') });
  });

  test('keeps the state untouched when a request settles after unmount', async () => {
    const request = deferred<unknown>();
    mockFetchStockData.mockReturnValue(request.promise);
    const { unmount } = renderHook(() => useStockData('2330'));
    unmount();
    await act(async () => request.resolve({ name: 'late response' }));
    expect(mockFetchStockData).toHaveBeenCalledWith('2330');
  });
});

describe('useWatchlistAlerts', () => {
  let originalFetch: typeof fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  test('loads alerts and leaves the list empty on an unsuccessful response', async () => {
    const saved: PriceAlert = { id: 3, symbol: '2330', type: 'above', value: 1000, enabled: true };
    global.fetch = jest.fn().mockResolvedValueOnce(response([saved]));
    const first = renderHook(() => useWatchlistAlerts());
    await waitFor(() => expect(first.result.current.alerts).toEqual([saved]));
    first.unmount();

    global.fetch = jest.fn().mockResolvedValueOnce(response({}, false));
    const second = renderHook(() => useWatchlistAlerts());
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));
    expect(second.result.current.alerts).toEqual([]);
  });

  test('saves an alert then refreshes from the API', async () => {
    const alert: PriceAlert = { symbol: '2454', type: 'below', value: 900, enabled: true };
    const refreshed = [{ ...alert, id: 8 }];
    const fetchMock = jest.fn()
      .mockResolvedValueOnce(response([]))
      .mockResolvedValueOnce(response({ success: true }))
      .mockResolvedValueOnce(response(refreshed));
    global.fetch = fetchMock;
    const { result } = renderHook(() => useWatchlistAlerts());
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    await act(async () => result.current.saveAlert(alert));
    await waitFor(() => expect(result.current.alerts).toEqual(refreshed));
    expect(fetchMock.mock.calls[1][0]).toBe('/api/alerts');
    expect(fetchMock.mock.calls[1][1]).toMatchObject({ method: 'POST', body: JSON.stringify(alert) });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  test('ignores missing ids, deletes an alert, and logs rejected requests', async () => {
    const fetchMock = jest.fn()
      .mockResolvedValueOnce(response([]))
      .mockResolvedValueOnce(response({ success: true }))
      .mockResolvedValueOnce(response([]));
    global.fetch = fetchMock;
    const { result } = renderHook(() => useWatchlistAlerts());
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    await act(async () => result.current.deleteAlert(0));
    await act(async () => result.current.deleteAlert());
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await act(async () => result.current.deleteAlert(12));
    expect(fetchMock.mock.calls[1]).toEqual(['/api/alerts?id=12', { method: 'DELETE' }]);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));

    fetchMock.mockRejectedValueOnce(new Error('network down'));
    await act(async () => result.current.saveAlert({ symbol: '2330', type: 'above', value: 1, enabled: true }));
    expect(console.error).toHaveBeenCalledWith('Failed to save alert', expect.any(Error));
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  test('ignores fetch failures without clearing existing alerts', async () => {
    const saved: PriceAlert = { id: 2, symbol: '2330', type: 'above', value: 100, enabled: true };
    const fetchMock = jest.fn().mockResolvedValueOnce(response([saved])).mockRejectedValueOnce(new Error('offline'));
    global.fetch = fetchMock;
    const { result } = renderHook(() => useWatchlistAlerts());
    await waitFor(() => expect(result.current.alerts).toEqual([saved]));

    await act(async () => result.current.deleteAlert(2));
    expect(result.current.alerts).toEqual([saved]);
    expect(console.error).toHaveBeenCalledWith('Failed to delete alert', expect.any(Error));
  });
});
