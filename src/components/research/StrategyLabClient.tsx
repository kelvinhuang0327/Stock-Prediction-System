"use client";

import { useState } from "react";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Clock3,
  Database,
  FileText,
  FlaskConical,
  History,
  PauseCircle,
  Play,
  RefreshCw,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  XCircle,
} from "lucide-react";

import type {
  PredictedDirection,
  StrategyDecision,
  StrategyLabOpenPrediction,
  StrategyLabProtocolVariant,
  StrategyLabResolvedPrediction,
  StrategyLabRunHistoryEntry,
  StrategyLabSnapshot,
  StrategyLabSymbolHoldout,
} from "@/lib/research/strategyLabArtifacts";
import type { StrategyLabSimulation } from "@/lib/research/StrategyLabSimulationEngine";

interface StrategyLabClientProps {
  initialSnapshot: StrategyLabSnapshot;
}

interface RunResponse {
  ok: boolean;
  error?: string;
  stdout?: string;
  stderr?: string;
  snapshot?: StrategyLabSnapshot;
}

function formatPct(value: number | null): string {
  return value === null ? "N/A" : `${(value * 100).toFixed(2)}%`;
}

function formatNumber(value: number | null): string {
  return value === null ? "N/A" : value.toLocaleString("en-US");
}

function formatSignedPct(value: number | null): string {
  if (value === null) return "N/A";
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${(value * 100).toFixed(2)}%`;
}

function formatTime(value: string | null): string {
  if (!value) return "N/A";
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return value;
  return new Intl.DateTimeFormat("zh-TW", {
    timeZone: "Asia/Taipei",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(parsed));
}

function decisionStyle(decision: StrategyDecision): { shell: string; icon: React.ReactNode } {
  if (decision === "research_candidate") {
    return {
      shell: "border-emerald-300/60 bg-emerald-500/10 text-emerald-100",
      icon: <CheckCircle2 className="h-5 w-5 text-emerald-300" />,
    };
  }
  if (decision === "do_not_promote") {
    return {
      shell: "border-amber-300/60 bg-amber-500/10 text-amber-100",
      icon: <PauseCircle className="h-5 w-5 text-amber-300" />,
    };
  }
  if (decision === "needs_more_evidence") {
    return {
      shell: "border-sky-300/60 bg-sky-500/10 text-sky-100",
      icon: <Activity className="h-5 w-5 text-sky-300" />,
    };
  }
  return {
    shell: "border-zinc-500/60 bg-zinc-500/10 text-zinc-200",
    icon: <AlertTriangle className="h-5 w-5 text-zinc-300" />,
  };
}

function extractRunSummary(stdout?: string): string | null {
  if (!stdout) return null;
  try {
    const parsed = JSON.parse(stdout) as Record<string, unknown>;
    const status = typeof parsed.status === "string" ? parsed.status : "complete";
    const accuracy = typeof parsed.holdoutAccuracy === "number" ? formatPct(parsed.holdoutAccuracy) : "N/A";
    const baseline = typeof parsed.holdoutMajorityBaselineAccuracy === "number"
      ? formatPct(parsed.holdoutMajorityBaselineAccuracy)
      : "N/A";
    return `${status} · holdout ${accuracy} · baseline ${baseline}`;
  } catch {
    return stdout.trim().slice(0, 220);
  }
}

export function StrategyLabClient({ initialSnapshot }: StrategyLabClientProps) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [busyAction, setBusyAction] = useState<"refresh" | "rerun-refit" | null>(null);
  const [lastRun, setLastRun] = useState<{ ok: boolean; message: string } | null>(null);
  const style = decisionStyle(snapshot.productStance.decision);

  async function refreshSnapshot() {
    setBusyAction("refresh");
    setLastRun(null);
    try {
      const response = await fetch("/api/research/strategy-lab", { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      setSnapshot(await response.json() as StrategyLabSnapshot);
    } catch (error) {
      setLastRun({ ok: false, message: error instanceof Error ? error.message : String(error) });
    } finally {
      setBusyAction(null);
    }
  }

  async function rerunRefit() {
    setBusyAction("rerun-refit");
    setLastRun(null);
    try {
      const response = await fetch("/api/research/strategy-lab", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "rerun-refit" }),
      });
      const payload = await response.json() as RunResponse;
      if (payload.snapshot) setSnapshot(payload.snapshot);
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error ?? `HTTP ${response.status}`);
      }
      setLastRun({
        ok: true,
        message: extractRunSummary(payload.stdout) ?? "refit complete",
      });
    } catch (error) {
      setLastRun({ ok: false, message: error instanceof Error ? error.message : String(error) });
    } finally {
      setBusyAction(null);
    }
  }

  const refit = snapshot.refit;
  const data = snapshot.dataExport;
  const comparison = snapshot.protocolComparison;
  const predictions = snapshot.predictions;
  const simulation = snapshot.simulation;
  const runHistory = snapshot.runHistory;

  return (
    <div className="min-w-0 space-y-6">
      <section className={`rounded-lg border p-5 ${style.shell}`}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              {style.icon}
              策略研究決策
            </div>
            <h1 className="text-2xl font-bold tracking-normal text-white md:text-3xl">
              {snapshot.productStance.label}
            </h1>
            <p className="max-w-3xl text-sm leading-6 text-white/78">
              {snapshot.productStance.reason}
            </p>
            <p className="text-xs leading-5 text-white/60">
              僅供研究驗證；不是投資建議，不送出交易，不讀寫 canonical DB。
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={refreshSnapshot}
              disabled={busyAction !== null}
              className="inline-flex h-10 items-center gap-2 rounded-md border border-white/15 bg-white/8 px-3 text-sm font-medium text-white transition-colors hover:bg-white/14 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${busyAction === "refresh" ? "animate-spin" : ""}`} />
              更新結果
            </button>
            <button
              type="button"
              onClick={rerunRefit}
              disabled={busyAction !== null || !snapshot.availableActions.rerunRefit}
              className="inline-flex h-10 items-center gap-2 rounded-md bg-sky-500 px-3 text-sm font-semibold text-white transition-colors hover:bg-sky-400 disabled:cursor-not-allowed disabled:bg-zinc-600 disabled:text-zinc-300"
            >
              {busyAction === "rerun-refit" ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              重新跑 refit
            </button>
          </div>
        </div>
        {lastRun && (
          <div className={`mt-4 flex items-center gap-2 rounded-md border px-3 py-2 text-sm ${
            lastRun.ok
              ? "border-emerald-400/35 bg-emerald-500/10 text-emerald-100"
              : "border-red-400/35 bg-red-500/10 text-red-100"
          }`}>
            {lastRun.ok ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
            {lastRun.message}
          </div>
        )}
      </section>

      <section className="min-w-0 rounded-lg border border-border/50 bg-card/70 p-5">
        <div className="mb-1 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-red-400" />
            <h2 className="text-lg font-semibold">最新預測（未來 {predictions.horizonTradingDays ?? 5} 個交易日）</h2>
          </div>
          <span className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium ${
            predictions.modelBeatsBaseline
              ? "border-emerald-300/60 bg-emerald-500/10 text-emerald-100"
              : "border-amber-300/60 bg-amber-500/10 text-amber-100"
          }`}>
            <AlertTriangle className="h-3.5 w-3.5" />
            {predictions.modelBeatsBaseline ? "研究輸出" : "研究輸出・模型未勝過基準"}
          </span>
        </div>
        <p className="mb-4 text-sm text-muted-foreground">
          資料截止 {predictions.dataEndDate ?? "N/A"}。機率是模型對「{predictions.horizonTradingDays ?? 5} 個交易日後收盤是否高於當日」的估計；
          僅示範研究管線輸出，不是投資建議，不可用於交易。
        </p>
        {predictions.latestBySymbol.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {predictions.latestBySymbol.map((prediction) => (
              <LatestPredictionCard key={prediction.symbol} prediction={prediction} />
            ))}
          </div>
        ) : (
          <p className="rounded-md border border-border/30 bg-background/40 px-3 py-6 text-center text-sm text-muted-foreground">
            尚未產生預測 artifact，請先按「重新跑 refit」。
          </p>
        )}
      </section>

      <StrategySimulationSection simulation={simulation} />

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricTile
          icon={<Database className="h-5 w-5 text-sky-300" />}
          label="資料範圍"
          value={data.dateRange ? `${data.dateRange.start} → ${data.dateRange.end}` : "N/A"}
          note={`${formatNumber(data.rowCount)} rows · ${data.symbols.join(", ") || "no symbols"}`}
        />
        <MetricTile
          icon={<BarChart3 className="h-5 w-5 text-violet-300" />}
          label="Holdout accuracy"
          value={formatPct(refit.metrics.accuracy)}
          note={`baseline ${formatPct(refit.metrics.majorityBaselineAccuracy)} · delta ${formatSignedPct(refit.metrics.deltaVsMajorityBaseline)}`}
        />
        <MetricTile
          icon={<FlaskConical className="h-5 w-5 text-emerald-300" />}
          label="訓練 / 測試樣本"
          value={`${formatNumber(refit.trainSampleCount)} / ${formatNumber(refit.holdoutSampleCount)}`}
          note={`${formatNumber(refit.featureCount)} features · ${formatNumber(refit.purgedSampleCount)} purged`}
        />
        <MetricTile
          icon={<Clock3 className="h-5 w-5 text-amber-300" />}
          label="最近 refit"
          value={formatTime(refit.mtime)}
          note={refit.runId ?? "no run id"}
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="min-w-0 rounded-lg border border-border/50 bg-card/70 p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">P193 真實 OHLCV Refit</h2>
              <p className="text-sm text-muted-foreground">{refit.interpretation ?? refit.decisionReason}</p>
            </div>
            <StatusPill decision={refit.decision} label={refit.decisionLabel} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <SmallMetric label="Accuracy" value={formatPct(refit.metrics.accuracy)} />
            <SmallMetric label="Precision" value={formatPct(refit.metrics.precision)} />
            <SmallMetric label="Recall" value={formatPct(refit.metrics.recall)} />
            <SmallMetric label="Brier score" value={refit.metrics.brierScore?.toFixed(4) ?? "N/A"} />
            <SmallMetric label="Log loss" value={refit.metrics.logLoss?.toFixed(4) ?? "N/A"} />
            <SmallMetric label="Classification" value={refit.finalClassification ?? "N/A"} compact />
          </div>
        </div>

        <div className="min-w-0 rounded-lg border border-border/50 bg-card/70 p-5">
          <div className="mb-4 flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-emerald-300" />
            <h2 className="text-lg font-semibold">驗證邊界</h2>
          </div>
          <div className="space-y-3 text-sm">
            <InfoLine label="目標" value={refit.targetDefinition ?? "N/A"} />
            <InfoLine label="切分方式" value={String(refit.validationBoundary?.method ?? "N/A")} />
            <InfoLine label="Train end" value={String(refit.validationBoundary?.trainEndDate ?? "N/A")} />
            <InfoLine label="Test target" value={rangeText(refit.validationBoundary?.testTargetPeriod)} />
            <InfoLine label="PIT 狀態" value={data.pitSafety} />
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="min-w-0 rounded-lg border border-border/50 bg-card/70 p-5">
          <div className="mb-1 flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-sky-300" />
            <h2 className="text-lg font-semibold">近期已驗證預測</h2>
          </div>
          <p className="mb-4 text-sm text-muted-foreground">
            holdout 期間最近的預測與實際結果逐筆對帳，命中與未命中都完整揭露。
          </p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="border-b border-border/60 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="py-2 pr-3 font-medium">預測日</th>
                  <th className="py-2 pr-3 font-medium">股票</th>
                  <th className="py-2 pr-3 font-medium">預測</th>
                  <th className="py-2 pr-3 font-medium">機率</th>
                  <th className="py-2 pr-3 font-medium">實際 5 日報酬</th>
                  <th className="py-2 pr-3 font-medium">命中</th>
                </tr>
              </thead>
              <tbody>
                {predictions.recentResolved.slice(0, 12).map((resolved) => (
                  <ResolvedPredictionRow
                    key={`${resolved.symbol}-${resolved.featureDate}`}
                    resolved={resolved}
                  />
                ))}
                {predictions.recentResolved.length === 0 && (
                  <tr>
                    <td className="py-6 text-muted-foreground" colSpan={6}>
                      尚未產生已驗證預測，請先按「重新跑 refit」。
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="min-w-0 rounded-lg border border-border/50 bg-card/70 p-5">
          <div className="mb-1 flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-violet-300" />
            <h2 className="text-lg font-semibold">各股 holdout 命中率</h2>
          </div>
          <p className="mb-4 text-sm text-muted-foreground">
            每檔在 chronological holdout 的方向命中率，對照各自的 majority baseline。
          </p>
          <div className="space-y-2">
            {refit.perSymbolHoldout.map((item) => (
              <SymbolHoldoutRow key={item.symbol} item={item} />
            ))}
            {refit.perSymbolHoldout.length === 0 && (
              <p className="rounded-md border border-border/30 bg-background/40 px-3 py-6 text-center text-sm text-muted-foreground">
                尚無各股 holdout 指標。
              </p>
            )}
          </div>
        </div>
      </section>

      <section className="min-w-0 rounded-lg border border-border/50 bg-card/70 p-5">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold">P195 策略 Protocol 比較</h2>
            <p className="text-sm text-muted-foreground">
              {comparison.decisionReason}
            </p>
          </div>
          <StatusPill decision={comparison.decision} label={comparison.decisionLabel} />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="border-b border-border/60 text-left text-xs text-muted-foreground">
              <tr>
                <th className="py-2 pr-3 font-medium">Variant</th>
                <th className="py-2 pr-3 font-medium">Accuracy</th>
                <th className="py-2 pr-3 font-medium">Baseline</th>
                <th className="py-2 pr-3 font-medium">Delta</th>
                <th className="py-2 pr-3 font-medium">Precision</th>
                <th className="py-2 pr-3 font-medium">Recall</th>
                <th className="py-2 pr-3 font-medium">Result</th>
              </tr>
            </thead>
            <tbody>
              {comparison.variants.map((variant) => (
                <VariantRow key={variant.variantId} variant={variant} />
              ))}
              {comparison.variants.length === 0 && (
                <tr>
                  <td className="py-6 text-muted-foreground" colSpan={7}>
                    尚未產生 protocol comparison artifact。
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="min-w-0 rounded-lg border border-border/50 bg-card/70 p-5">
        <div className="mb-1 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <History className="h-5 w-5 text-amber-300" />
            <h2 className="text-lg font-semibold">重訓歷史</h2>
          </div>
          <span className="text-xs text-muted-foreground">
            共 {runHistory.totalRuns} 次紀錄{runHistory.totalRuns > runHistory.entries.length ? `，顯示最近 ${runHistory.entries.length} 次` : ""}
          </span>
        </div>
        <p className="mb-4 text-sm text-muted-foreground">
          每次按「重新跑 refit」都會留下一筆紀錄；資料相同時 run ID 相同，accuracy 也會一致（refit 是 deterministic）。
        </p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-sm">
            <thead className="border-b border-border/60 text-left text-xs text-muted-foreground">
              <tr>
                <th className="py-2 pr-3 font-medium">執行時間</th>
                <th className="py-2 pr-3 font-medium">Holdout accuracy</th>
                <th className="py-2 pr-3 font-medium">Baseline</th>
                <th className="py-2 pr-3 font-medium">Delta</th>
                <th className="py-2 pr-3 font-medium">資料截止</th>
                <th className="py-2 pr-3 font-medium">Run ID</th>
              </tr>
            </thead>
            <tbody>
              {runHistory.entries.map((entry, index) => (
                <RunHistoryRow key={`${entry.runId}-${entry.executedAt}-${index}`} entry={entry} />
              ))}
              {runHistory.entries.length === 0 && (
                <tr>
                  <td className="py-6 text-muted-foreground" colSpan={6}>
                    尚無重訓紀錄，按「重新跑 refit」後會在這裡看到每一次的結果。
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="min-w-0 rounded-lg border border-border/50 bg-card/70 p-5">
          <div className="mb-4 flex items-center gap-2">
            <Database className="h-5 w-5 text-sky-300" />
            <h2 className="text-lg font-semibold">資料來源</h2>
          </div>
          <div className="space-y-3 text-sm">
            <InfoLine label="CSV" value={data.path} />
            <InfoLine label="SHA256" value={data.sha256 ?? "N/A"} mono />
            <InfoLine label="Fetched at" value={data.fetchedAtUtc ?? "N/A"} />
            <InfoLine label="Source" value={data.source ?? "N/A"} />
            <InfoLine label="Manifest" value={data.manifestAvailable ? "present" : "missing"} />
          </div>
        </div>

        <div className="min-w-0 rounded-lg border border-border/50 bg-card/70 p-5">
          <div className="mb-4 flex items-center gap-2">
            <FileText className="h-5 w-5 text-violet-300" />
            <h2 className="text-lg font-semibold">Artifact 完整性</h2>
          </div>
          <div className="space-y-2">
            {snapshot.artifactCompleteness.map((artifact) => (
              <div key={artifact.path} className="flex items-center justify-between gap-3 rounded-md border border-border/30 bg-background/40 px-3 py-2 text-sm">
                <div className="min-w-0">
                  <p className="font-medium">{artifact.label}</p>
                  <p className="truncate text-xs text-muted-foreground">{artifact.path}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2 text-xs">
                  <span className="text-muted-foreground">{formatTime(artifact.mtime)}</span>
                  {artifact.present
                    ? <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    : <XCircle className="h-4 w-4 text-amber-400" />}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

function StrategySimulationSection({ simulation }: { simulation?: StrategyLabSimulation }) {
  const status: StrategyLabSimulation["status"] = simulation?.status ?? "missing";
  const decision = simulation?.verdict ?? "needs_more_evidence";
  const stats = simulation?.stats;
  const failSafeMessage = status === "missing"
    ? "目前沒有可回放的 resolved prediction/outcome pairs，暫不產生模擬曲線。"
    : status === "insufficient"
      ? `有效樣本數低於門檻，目前 N=${stats?.validPairCount ?? 0}，暫不產生模擬曲線。`
      : null;

  return (
    <section className="min-w-0 rounded-lg border border-border/50 bg-card/70 p-5">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-sky-300" />
            <h2 className="text-lg font-semibold">策略模擬對照</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            從現有 artifact 回放已驗證的預測與實際 5 日報酬，對照「跟隨模型」與「全部做多 baseline」的成本後曲線。
          </p>
        </div>
        <StatusPill decision={decision} label={simulation?.verdictLabel ?? "證據不足"} />
      </div>

      {failSafeMessage ? (
        <div className="rounded-md border border-amber-300/35 bg-amber-500/10 px-3 py-5 text-sm leading-6 text-amber-100">
          {failSafeMessage}
        </div>
      ) : simulation ? (
        <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="min-w-0">
            <SimulationEquityChart simulation={simulation} />
            <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-full bg-sky-300" />
                跟隨模型
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-full bg-amber-300" />
                全部做多 baseline
              </span>
              <span>每筆 active long round-trip cost {formatPct(simulation.costPerRoundTrip)}</span>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <SmallMetric
              label="跟隨模型累積報酬"
              value={`${formatSignedPct(simulation.stats.cumulativeStrategyGross)} gross / ${formatSignedPct(simulation.stats.cumulativeStrategyNet)} net`}
              compact
            />
            <SmallMetric
              label="Baseline 累積報酬"
              value={`${formatSignedPct(simulation.stats.cumulativeBaselineGross)} gross / ${formatSignedPct(simulation.stats.cumulativeBaselineNet)} net`}
              compact
            />
            <SmallMetric label="命中率" value={formatPct(simulation.stats.hitRate)} />
            <SmallMetric label="平均單筆報酬" value={formatSignedPct(simulation.stats.avgTradeReturnGross)} />
            <SmallMetric label="跟隨模型最大回撤" value={formatPct(simulation.stats.maxDrawdownStrategyNet)} />
            <SmallMetric label="Baseline 最大回撤" value={formatPct(simulation.stats.maxDrawdownBaselineNet)} />
            <SmallMetric label="樣本數 N" value={`${simulation.stats.validPairCount} / ${simulation.stats.pairCount}`} />
            <SmallMetric label="Cohort count" value={formatNumber(simulation.stats.cohortCount)} />
          </div>
        </div>
      ) : null}

      {simulation && (
        <div className="mt-4 rounded-md border border-border/30 bg-background/35 p-3">
          <p className="mb-2 text-xs font-medium text-muted-foreground">限制與警語</p>
          <ul className="space-y-1 text-sm leading-6 text-muted-foreground">
            {simulation.limitations.map((limitation) => (
              <li key={limitation}>{simulationLimitationText(limitation)}</li>
            ))}
            <li>{simulation.verdictReason}</li>
          </ul>
        </div>
      )}
    </section>
  );
}

function SimulationEquityChart({ simulation }: { simulation: StrategyLabSimulation }) {
  const width = 720;
  const height = 260;
  const padX = 36;
  const padY = 24;
  const values = simulation.equityCurve.flatMap((point) => [
    point.strategyNetReturn,
    point.baselineNetReturn,
  ]);
  const minValue = Math.min(0, ...values);
  const maxValue = Math.max(0, ...values);
  const span = maxValue - minValue || 1;
  const plotWidth = width - padX * 2;
  const plotHeight = height - padY * 2;
  const xFor = (index: number) =>
    simulation.equityCurve.length <= 1
      ? width / 2
      : padX + (index / (simulation.equityCurve.length - 1)) * plotWidth;
  const yFor = (value: number) => padY + ((maxValue - value) / span) * plotHeight;
  const lineFor = (key: "strategyNetReturn" | "baselineNetReturn") =>
    simulation.equityCurve
      .map((point, index) => `${xFor(index).toFixed(2)},${yFor(point[key]).toFixed(2)}`)
      .join(" ");
  const zeroY = yFor(0);
  const first = simulation.equityCurve[0];
  const last = simulation.equityCurve.at(-1);

  return (
    <div className="overflow-hidden rounded-md border border-border/30 bg-background/35">
      <svg
        role="img"
        aria-label="跟隨模型與全部做多 baseline 的成本後累積報酬曲線"
        viewBox={`0 0 ${width} ${height}`}
        className="block h-[260px] w-full"
      >
        <rect width={width} height={height} fill="transparent" />
        <line x1={padX} x2={width - padX} y1={zeroY} y2={zeroY} stroke="rgba(255,255,255,0.22)" strokeDasharray="5 5" />
        <text x={padX} y={18} fill="rgba(255,255,255,0.58)" fontSize="12">
          {formatSignedPct(maxValue)}
        </text>
        <text x={padX} y={height - 8} fill="rgba(255,255,255,0.58)" fontSize="12">
          {formatSignedPct(minValue)}
        </text>
        <polyline
          fill="none"
          stroke="#7dd3fc"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="3"
          points={lineFor("strategyNetReturn")}
        />
        <polyline
          fill="none"
          stroke="#fcd34d"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="3"
          points={lineFor("baselineNetReturn")}
        />
        {simulation.equityCurve.map((point, index) => (
          <g key={`${point.featureDate}-${point.targetDate}`}>
            <circle cx={xFor(index)} cy={yFor(point.strategyNetReturn)} r="3" fill="#7dd3fc" />
            <circle cx={xFor(index)} cy={yFor(point.baselineNetReturn)} r="3" fill="#fcd34d" />
          </g>
        ))}
        {first && (
          <text x={padX} y={height - 30} fill="rgba(255,255,255,0.62)" fontSize="12">
            {first.targetDate}
          </text>
        )}
        {last && (
          <text x={width - padX - 70} y={height - 30} fill="rgba(255,255,255,0.62)" fontSize="12">
            {last.targetDate}
          </text>
        )}
      </svg>
    </div>
  );
}

function simulationLimitationText(limitation: string): string {
  if (limitation.includes("Overlapping 5-trading-day")) {
    return "重疊的 5 個交易日前瞻報酬窗口只是近似回放，不能視為獨立交易樣本。";
  }
  if (limitation.includes("Small sample warning")) {
    return limitation.replace("Small sample warning:", "小樣本警語：");
  }
  if (limitation.includes("Research-only")) {
    return "僅供研究驗證；不是投資建議，不可用於交易。";
  }
  return limitation;
}

function MetricTile({
  icon,
  label,
  value,
  note,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  note: string;
}) {
  return (
    <div className="rounded-lg border border-border/50 bg-card/70 p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{label}</span>
        {icon}
      </div>
      <p className="break-words text-xl font-semibold leading-tight tracking-normal">{value}</p>
      <p className="mt-2 break-words text-xs leading-5 text-muted-foreground">{note}</p>
    </div>
  );
}

function SmallMetric({
  label,
  value,
  compact = false,
}: {
  label: string;
  value: string;
  compact?: boolean;
}) {
  return (
    <div className="rounded-md border border-border/30 bg-background/40 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-1 font-semibold ${compact ? "break-all text-xs leading-5" : "break-words text-lg"}`}>
        {value}
      </p>
    </div>
  );
}

function InfoLine({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="grid gap-1 rounded-md border border-border/25 bg-background/35 px-3 py-2 sm:grid-cols-[110px_1fr]">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={`text-sm ${mono ? "break-all font-mono text-xs" : "break-words"}`}>{value}</span>
    </div>
  );
}

function StatusPill({ decision, label }: { decision: StrategyDecision; label: string }) {
  const style = decisionStyle(decision);
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium ${style.shell}`}>
      {style.icon}
      {label}
    </span>
  );
}

function VariantRow({ variant }: { variant: StrategyLabProtocolVariant }) {
  const positive = (variant.deltaVsMajorityBaseline ?? 0) > 0;
  const neutral = variant.deltaVsMajorityBaseline === 0;
  return (
    <tr className="border-b border-border/30 last:border-0">
      <td className="py-3 pr-3">
        <div className="font-medium">{variant.variantId} · {variant.name}</div>
        <div className="text-xs text-muted-foreground">{variant.holdoutSampleCount ?? "N/A"} holdout samples</div>
      </td>
      <td className="py-3 pr-3 font-mono text-sm">{formatPct(variant.accuracy)}</td>
      <td className="py-3 pr-3 font-mono text-sm">{formatPct(variant.majorityBaselineAccuracy)}</td>
      <td className={`py-3 pr-3 font-mono text-sm ${positive ? "text-emerald-300" : neutral ? "text-sky-300" : "text-amber-300"}`}>
        {formatSignedPct(variant.deltaVsMajorityBaseline)}
      </td>
      <td className="py-3 pr-3 font-mono text-sm">{formatPct(variant.precision)}</td>
      <td className="py-3 pr-3 font-mono text-sm">{formatPct(variant.recall)}</td>
      <td className="py-3 pr-3 text-xs text-muted-foreground">{variant.interpretation ?? "N/A"}</td>
    </tr>
  );
}

function rangeText(value: unknown): string {
  if (typeof value !== "object" || value === null) return "N/A";
  const range = value as Record<string, unknown>;
  const start = typeof range.start === "string" ? range.start : "N/A";
  const end = typeof range.end === "string" ? range.end : "N/A";
  return `${start} → ${end}`;
}

// 台股慣例:紅漲綠跌
function directionMeta(direction: PredictedDirection | null): {
  label: string;
  textClass: string;
  icon: React.ReactNode;
} {
  if (direction === "up") {
    return { label: "看漲", textClass: "text-red-400", icon: <TrendingUp className="h-4 w-4" /> };
  }
  if (direction === "down") {
    return { label: "看跌", textClass: "text-emerald-400", icon: <TrendingDown className="h-4 w-4" /> };
  }
  return { label: "N/A", textClass: "text-zinc-400", icon: <Activity className="h-4 w-4" /> };
}

function LatestPredictionCard({ prediction }: { prediction: StrategyLabOpenPrediction }) {
  const meta = directionMeta(prediction.predictedDirection);
  const probabilityPct = prediction.probabilityUp !== null
    ? Math.round(prediction.probabilityUp * 1000) / 10
    : null;
  return (
    <div className="rounded-lg border border-border/40 bg-background/40 p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-lg font-bold">{prediction.symbol}</span>
        <span className={`inline-flex items-center gap-1 text-sm font-semibold ${meta.textClass}`}>
          {meta.icon}
          {meta.label}
        </span>
      </div>
      <p className="text-2xl font-semibold tracking-tight">
        {probabilityPct !== null ? `${probabilityPct.toFixed(1)}%` : "N/A"}
        <span className="ml-1 text-xs font-normal text-muted-foreground">上漲機率</span>
      </p>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
        <div
          className={`h-full rounded-full ${prediction.predictedDirection === "up" ? "bg-red-400/80" : "bg-emerald-400/80"}`}
          style={{ width: `${Math.min(100, Math.max(0, (prediction.probabilityUp ?? 0) * 100))}%` }}
        />
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        {prediction.featureDate} 收盤 {prediction.close !== null ? prediction.close.toLocaleString("en-US") : "N/A"}
      </p>
    </div>
  );
}

function ResolvedPredictionRow({ resolved }: { resolved: StrategyLabResolvedPrediction }) {
  const predicted = directionMeta(resolved.predictedDirection);
  const returnPositive = (resolved.forwardReturn ?? 0) > 0;
  return (
    <tr className="border-b border-border/30 last:border-0">
      <td className="py-2.5 pr-3 font-mono text-xs">{resolved.featureDate}</td>
      <td className="py-2.5 pr-3 font-medium">{resolved.symbol}</td>
      <td className={`py-2.5 pr-3 ${predicted.textClass}`}>
        <span className="inline-flex items-center gap-1">{predicted.icon}{predicted.label}</span>
      </td>
      <td className="py-2.5 pr-3 font-mono text-sm">{formatPct(resolved.probabilityUp)}</td>
      <td className={`py-2.5 pr-3 font-mono text-sm ${returnPositive ? "text-red-400" : "text-emerald-400"}`}>
        {formatSignedPct(resolved.forwardReturn)}
      </td>
      <td className="py-2.5 pr-3">
        {resolved.correct
          ? <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          : <XCircle className="h-4 w-4 text-amber-400" />}
      </td>
    </tr>
  );
}

function SymbolHoldoutRow({ item }: { item: StrategyLabSymbolHoldout }) {
  const positive = (item.deltaVsMajorityBaseline ?? 0) > 0;
  const neutral = item.deltaVsMajorityBaseline === 0;
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-border/30 bg-background/40 px-3 py-2.5">
      <div>
        <p className="font-semibold">{item.symbol}</p>
        <p className="text-xs text-muted-foreground">{formatNumber(item.sampleCount)} 筆 holdout</p>
      </div>
      <div className="text-right">
        <p className="font-mono text-sm font-semibold">{formatPct(item.accuracy)}</p>
        <p className="text-xs text-muted-foreground">
          baseline {formatPct(item.majorityBaselineAccuracy)}
          <span className={`ml-1 font-mono ${positive ? "text-emerald-300" : neutral ? "text-sky-300" : "text-amber-300"}`}>
            {formatSignedPct(item.deltaVsMajorityBaseline)}
          </span>
        </p>
      </div>
    </div>
  );
}

function RunHistoryRow({ entry }: { entry: StrategyLabRunHistoryEntry }) {
  const positive = (entry.deltaVsBaseline ?? 0) > 0;
  const neutral = entry.deltaVsBaseline === 0;
  return (
    <tr className="border-b border-border/30 last:border-0">
      <td className="py-2.5 pr-3 text-sm">{formatTime(entry.executedAt)}</td>
      <td className="py-2.5 pr-3 font-mono text-sm">{formatPct(entry.holdoutAccuracy)}</td>
      <td className="py-2.5 pr-3 font-mono text-sm">{formatPct(entry.majorityBaselineAccuracy)}</td>
      <td className={`py-2.5 pr-3 font-mono text-sm ${positive ? "text-emerald-300" : neutral ? "text-sky-300" : "text-amber-300"}`}>
        {formatSignedPct(entry.deltaVsBaseline)}
      </td>
      <td className="py-2.5 pr-3 font-mono text-xs">{entry.dataEndDate ?? "N/A"}</td>
      <td className="py-2.5 pr-3 font-mono text-xs text-muted-foreground">{entry.runId ?? "N/A"}</td>
    </tr>
  );
}
