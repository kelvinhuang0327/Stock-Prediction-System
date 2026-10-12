"use client";

import React from 'react';
import { GlassCard } from '@/components/ui/glass-card';
import { LoadingSpinner } from '@/components/ui/loading';
import { SignalEffectivenessCard } from '@/components/signals/SignalEffectivenessCard';
import { WalkForwardSummaryCard } from '@/components/signals/WalkForwardSummaryCard';
import { RegimeStratifiedCard } from '@/components/signals/RegimeStratifiedCard';
import type {
  SignalEffectivenessApiResponse,
  SignalEffectivenessBatchApiResponse,
  SignalType,
  SignalWindow,
} from '@/lib/signals/types';
import type { WalkForwardResult } from '@/lib/signals/WalkForwardValidator';
import type { RegimeStratifiedResult } from '@/lib/signals/RegimeStratifiedEngine';

const STOCK_SIGNAL_TYPES: SignalType[] = [
  'topic_surging',
  'theme_diffusing',
  'strong_alpha_candidate',
  'chip_accumulation_signal',
  'risk_cluster_elevated',
];

interface WalkForwardApiResponse {
  window: SignalWindow;
  results: WalkForwardResult[];
  generatedAt: string;
  limitations: string[];
}

interface RegimeStratifiedApiResponse {
  window: SignalWindow;
  results: RegimeStratifiedResult[];
  generatedAt: string;
  limitations: string[];
}

export function StockSignalEffectivenessSection({ symbol }: { symbol: string }) {
  const [window, setWindow] = React.useState<SignalWindow>(5);
  const [results, setResults] = React.useState<SignalEffectivenessApiResponse[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // Walk-forward state — loaded lazily on toggle
  const [showWalkForward, setShowWalkForward] = React.useState(false);
  const [wfResults, setWfResults] = React.useState<WalkForwardResult[]>([]);
  const [wfLoading, setWfLoading] = React.useState(false);
  const [wfError, setWfError] = React.useState<string | null>(null);
  const wfLoadedKey = React.useRef<string>('');

  // Regime-stratified state — loaded lazily on toggle
  const [showRegime, setShowRegime] = React.useState(false);
  const [regimeResults, setRegimeResults] = React.useState<RegimeStratifiedResult[]>([]);
  const [regimeLoading, setRegimeLoading] = React.useState(false);
  const [regimeError, setRegimeError] = React.useState<string | null>(null);
  const regimeLoadedKey = React.useRef<string>('');

  React.useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({
          symbol,
          window: String(window),
        });
        const res = await fetch(`/api/signals/effectiveness/batch?${params.toString()}`);
        const batch = (await res.json()) as SignalEffectivenessBatchApiResponse;
        if (!res.ok && (!batch || !Array.isArray(batch.results))) {
          throw new Error(`訊號有效性 API 失敗 (${res.status})`);
        }
        const resultMap = new Map(batch.results.map((result) => [result.signalType, result]));
        const responses: SignalEffectivenessApiResponse[] = STOCK_SIGNAL_TYPES.map((signalType) => {
          const result = resultMap.get(signalType);
          return result
            ? {
                signalType,
                window: batch.window,
                effectiveness: result.effectiveness,
                generatedAt: batch.generatedAt,
                limitations: result.limitations,
              }
            : {
                signalType,
                window: batch.window,
                effectiveness: {
                  signalType,
                  window: batch.window,
                  sampleSize: 0,
                  hitRate: 0,
                  avgReturn: 0,
                  excessReturn: 0,
                  volatility: 0,
                  regimeBreakdown: {},
                  persistence: { avgDuration: 0, continuationRate: 0 },
                  stabilityScore: 0,
                  classification: 'NOISE',
                  limitations: ['批次結果缺漏，已降級顯示'],
                },
                generatedAt: batch.generatedAt,
                limitations: ['批次結果缺漏，已降級顯示'],
              };
        });

        if (!cancelled) {
          setResults(responses);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : '無法載入訊號有效性');
          setResults([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [symbol, window]);

  // Load regime-stratified lazily when section is toggled open
  React.useEffect(() => {
    if (!showRegime) return;
    const key = `${symbol}:${window}`;
    if (regimeLoadedKey.current === key) return;

    let cancelled = false;
    setRegimeLoading(true);
    setRegimeError(null);

    const params = new URLSearchParams({ symbol, window: String(window) });
    fetch(`/api/signals/regime-stratified?${params.toString()}`)
      .then((res) => res.json() as Promise<RegimeStratifiedApiResponse>)
      .then((data) => {
        if (!cancelled) {
          setRegimeResults(data.results ?? []);
          regimeLoadedKey.current = key;
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setRegimeError(err instanceof Error ? err.message : '環境分層載入失敗');
        }
      })
      .finally(() => {
        if (!cancelled) setRegimeLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [showRegime, symbol, window]);

  // Load walk-forward lazily when section is toggled open
  React.useEffect(() => {
    if (!showWalkForward) return;
    const key = `${symbol}:${window}`;
    if (wfLoadedKey.current === key) return; // already loaded for this combination

    let cancelled = false;
    setWfLoading(true);
    setWfError(null);

    const params = new URLSearchParams({ symbol, window: String(window) });
    fetch(`/api/signals/walkforward?${params.toString()}`)
      .then((res) => res.json() as Promise<WalkForwardApiResponse>)
      .then((data) => {
        if (!cancelled) {
          setWfResults(data.results ?? []);
          wfLoadedKey.current = key;
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setWfError(err instanceof Error ? err.message : '走勢驗證載入失敗');
        }
      })
      .finally(() => {
        if (!cancelled) setWfLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [showWalkForward, symbol, window]);

  return (
    <div id="stock-signal-effectiveness" className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">訊號有效性（研究）</h2>
          <p className="text-xs text-muted-foreground mt-1">
            評估 signal 的歷史表現，不影響 alphaScore、screen bucket 或 backtest。
          </p>
        </div>
        <div className="inline-flex rounded-lg border border-border/40 p-1 bg-muted/10 self-start">
          {[3, 5, 10].map((value) => {
            const active = window === value;
            return (
              <button
                key={value}
                onClick={() => setWindow(value as SignalWindow)}
                className={`px-3 py-1 text-xs rounded-md transition-colors ${
                  active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {value} 日
              </button>
            );
          })}
        </div>
      </div>

      {loading ? (
        <GlassCard className="p-6 flex items-center gap-3 text-sm text-muted-foreground">
          <LoadingSpinner size="sm" />
          正在載入 {symbol} 的 signal effectiveness…
        </GlassCard>
      ) : null}

      {!loading && error ? (
        <GlassCard className="p-6 text-sm text-amber-600 dark:text-amber-400">
          {error}
        </GlassCard>
      ) : null}

      {!loading && !error ? (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {results.map((result) => (
            <SignalEffectivenessCard
              key={result.signalType}
              effectiveness={result.effectiveness}
            />
          ))}
        </div>
      ) : null}

      {/* ── Regime-stratified analysis (lazy) ── */}
      {!loading && !error ? (
        <div className="space-y-3">
          <button
            onClick={() => setShowRegime((prev) => !prev)}
            className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <span className="border border-border/40 rounded px-2 py-0.5 bg-muted/10">
              {showRegime ? '▾' : '▸'}
            </span>
            市場環境分層（哪種市況有效？）
          </button>

          {showRegime ? (
            <>
              {regimeLoading ? (
                <GlassCard className="p-5 flex items-center gap-3 text-sm text-muted-foreground">
                  <LoadingSpinner size="sm" />
                  正在計算市場環境分層…
                </GlassCard>
              ) : null}

              {!regimeLoading && regimeError ? (
                <GlassCard className="p-5 text-sm text-amber-600 dark:text-amber-400">
                  {regimeError}
                </GlassCard>
              ) : null}

              {!regimeLoading && !regimeError && regimeResults.length > 0 ? (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                  {regimeResults.map((result) => (
                    <RegimeStratifiedCard
                      key={result.signalType}
                      result={result}
                      signalType={result.signalType}
                    />
                  ))}
                </div>
              ) : null}
            </>
          ) : null}
        </div>
      ) : null}

      {/* ── Walk-forward validation (lazy) ── */}
      {!loading && !error ? (
        <div className="space-y-3">
          <button
            onClick={() => setShowWalkForward((prev) => !prev)}
            className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <span className="border border-border/40 rounded px-2 py-0.5 bg-muted/10">
              {showWalkForward ? '▾' : '▸'}
            </span>
            走勢驗證（前後期一致性）
          </button>

          {showWalkForward ? (
            <>
              {wfLoading ? (
                <GlassCard className="p-5 flex items-center gap-3 text-sm text-muted-foreground">
                  <LoadingSpinner size="sm" />
                  正在計算走勢驗證…
                </GlassCard>
              ) : null}

              {!wfLoading && wfError ? (
                <GlassCard className="p-5 text-sm text-amber-600 dark:text-amber-400">
                  {wfError}
                </GlassCard>
              ) : null}

              {!wfLoading && !wfError && wfResults.length > 0 ? (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                  {wfResults.map((result) => (
                    <WalkForwardSummaryCard
                      key={result.signalType}
                      result={result}
                      signalType={result.signalType}
                    />
                  ))}
                </div>
              ) : null}
            </>
          ) : null}
        </div>
      ) : null}

      <p className="text-[11px] text-muted-foreground">
        `regime_shift_signal` 為市場級訊號，統整於每日報告；此處僅呈現與個股可對應的研究訊號。
      </p>
    </div>
  );
}
