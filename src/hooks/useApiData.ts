"use client";

import { useState, useEffect, useCallback, useRef } from 'react';

interface UseApiDataOptions {
  /** Auto-fetch on mount. Default true */
  immediate?: boolean;
  /** Refetch interval in ms. 0 = no auto-refetch */
  refetchInterval?: number;
}

interface UseApiDataReturn<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useApiData<T>(
  url: string | null,
  options: UseApiDataOptions = {}
): UseApiDataReturn<T> {
  const { immediate = true, refetchInterval = 0 } = options;
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const fetchData = useCallback(async () => {
    if (!url) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(body || `HTTP ${res.status}`);
      }
      const json = await res.json();
      setData(json);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return;
      setError(err instanceof Error ? err.message : '未知錯誤');
    } finally {
      setLoading(false);
    }
  }, [url]);

  useEffect(() => {
    if (immediate && url) {
      fetchData();
    }
    return () => { abortRef.current?.abort(); };
  }, [fetchData, immediate, url]);

  useEffect(() => {
    if (refetchInterval > 0 && url) {
      const timer = setInterval(fetchData, refetchInterval);
      return () => clearInterval(timer);
    }
  }, [refetchInterval, fetchData, url]);

  return { data, loading, error, refetch: fetchData };
}

/** POST variant */
export function useApiPost<TReq, TRes>() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const post = useCallback(async (url: string, body: TReq): Promise<TRes | null> => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(text || `HTTP ${res.status}`);
      }
      return await res.json();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '未知錯誤';
      setError(msg);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { post, loading, error };
}
