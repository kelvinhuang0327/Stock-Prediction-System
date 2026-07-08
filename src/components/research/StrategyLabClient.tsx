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
import type { StrategyLabCalibration } from "@/lib/research/StrategyLabCalibrationEngine";
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

interface ExecutiveSummaryItem {
  label: string;
  value: string;
  note: string;
  tone: "caution" | "neutral" | "info";
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

function productVerdictLabel(decision: StrategyDecision): string {
  if (decision === "do_not_promote") return "暫不推廣";
  if (decision === "research_candidate") return "研究候選，需再驗證";
  if (decision === "needs_more_evidence") return "研究觀察中";
  return "artifact 不完整";
}

function simulationSummary(simulation?: StrategyLabSimulation): Pick<ExecutiveSummaryItem, "value" | "note" | "tone"> {
  if (!simulation || simulation.status === "missing") {
    return {
      value: "尚無模擬",
      note: "目前沒有可回放的 resolved prediction/outcome pairs。",
      tone: "caution",
    };
  }
  if (simulation.status === "insufficient") {
    return {
      value: "證據不足",
      note: simulation.verdictReason,
      tone: "caution",
    };
  }
  return {
    value: simulation.verdict === "research_candidate" ? "跟隨模型高於 baseline" : "跟隨模型未勝過 baseline",
    note: `${simulation.verdictReason} N=${simulation.stats.validPairCount} resolved pairs。`,
    tone: simulation.verdict === "research_candidate" ? "info" : "caution",
  };
}

function thresholdCandidateSummary(
  simulation?: StrategyLabSimulation,
): Pick<ExecutiveSummaryItem, "value" | "note" | "tone"> {
  const candidate = simulation?.thresholdDrilldown.candidate;
  if (!candidate) {
    return {
      value: "無候選門檻",
      note: simulation?.thresholdDrilldown.reason ?? "目前 artifact 沒有可判讀的候選門檻。",
      tone: "caution",
    };
  }
  return {
    value: `${formatPct(candidate.threshold)} · ${candidate.tradeCount} 筆交易`,
    note: candidate.smallSample
      ? `小樣本；有效樣本 ${candidate.validPairCount} 筆，不能視為交易訊號。`
      : `有效樣本 ${candidate.validPairCount} 筆；仍只代表目前 artifact 樣本。`,
    tone: candidate.smallSample ? "caution" : "info",
  };
}

function symbolConcentrationSummary(
  simulation?: StrategyLabSimulation,
): Pick<ExecutiveSummaryItem, "value" | "note" | "tone"> {
  const breakdown = simulation?.thresholdDrilldown.symbolBreakdown;
  if (!breakdown || breakdown.status === "no_candidate") {
    return {
      value: "無候選樣本",
      note: breakdown?.reason ?? "尚無候選門檻可計算標的集中度。",
      tone: "neutral",
    };
  }
  if (breakdown.isConcentrated) {
    return {
      value: `集中於 ${breakdown.dominantSymbol ?? "單一標的"}`,
      note: `候選樣本交易占比 ${formatPct(breakdown.dominantTradeShare)}；共 ${breakdown.symbolCount} 檔標的。`,
      tone: "caution",
    };
  }
  return {
    value: "未由單一標的主導",
    note: `候選樣本分布於 ${breakdown.symbolCount} 檔標的。`,
    tone: "info",
  };
}

function cohortConcentrationSummary(
  simulation?: StrategyLabSimulation,
): Pick<ExecutiveSummaryItem, "value" | "note" | "tone"> {
  const breakdown = simulation?.thresholdDrilldown.cohortBreakdown;
  if (!breakdown || breakdown.status === "no_candidate") {
    return {
      value: "無候選樣本",
      note: breakdown?.reason ?? "尚無候選門檻可計算 cohort 集中度。",
      tone: "neutral",
    };
  }
  if (breakdown.isTimeConcentrated) {
    return {
      value: `集中於 ${breakdown.dominantCohortKey ?? "少數 cohort"}`,
      note: `候選樣本交易占比 ${formatPct(breakdown.dominantTradeShare)}；共 ${breakdown.cohortCount} 個 cohorts。`,
      tone: "caution",
    };
  }
  return {
    value: "未集中於單一 cohort",
    note: `候選樣本分布於 ${breakdown.cohortCount} 個 cohorts。`,
    tone: "info",
  };
}

function calibrationSummary(
  calibration?: StrategyLabCalibration,
): Pick<ExecutiveSummaryItem, "value" | "note" | "tone"> {
  if (!calibration || calibration.status === "missing") {
    return {
      value: "尚無校準檢查",
      note: "目前沒有可校準的 resolved prediction/outcome pairs。",
      tone: "caution",
    };
  }
  return {
    value: `${calibration.verdictLabel} / ${calibration.verdict}`,
    note: `ECE ${formatPct(calibration.expectedCalibrationErrorApprox)}，最大差距 ${formatPct(calibration.maxCalibrationGap)}，N=${calibration.validPairCount}。`,
    tone: calibration.verdict === "poorly_calibrated" || calibration.verdict === "needs_more_evidence"
      ? "caution"
      : "info",
  };
}

function buildExecutiveSummary(snapshot: StrategyLabSnapshot): ExecutiveSummaryItem[] {
  const simulation = simulationSummary(snapshot.simulation);
  const threshold = thresholdCandidateSummary(snapshot.simulation);
  const symbol = symbolConcentrationSummary(snapshot.simulation);
  const cohort = cohortConcentrationSummary(snapshot.simulation);
  const calibration = calibrationSummary(snapshot.calibration);
  const resolvedPairCount = snapshot.simulation?.stats.pairCount
    ?? snapshot.calibration?.pairCount
    ?? snapshot.predictions.recentResolved.length;
  const validPairCount = snapshot.simulation?.stats.validPairCount
    ?? snapshot.calibration?.validPairCount
    ?? snapshot.predictions.recentResolved.filter((pair) => pair.forwardReturn !== null).length;

  return [
    {
      label: "整體狀態",
      value: productVerdictLabel(snapshot.productStance.decision),
      note: snapshot.productStance.reason,
      tone: snapshot.productStance.decision === "research_candidate" ? "info" : "caution",
    },
    { label: "模擬", ...simulation },
    { label: "候選門檻", ...threshold },
    { label: "標的集中", ...symbol },
    { label: "時間集中", ...cohort },
    { label: "信心校準", ...calibration },
    {
      label: "樣本數",
      value: `${validPairCount} / ${resolvedPairCount} resolved pairs`,
      note: "僅計入目前 resolved artifact；不重新訓練、不重跑資料、不讀寫資料庫。",
      tone: "neutral",
    },
  ];
}

export function StrategyLabClient({ initialSnapshot }: StrategyLabClientProps) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [busyAction, setBusyAction] = useState<"refresh" | "rerun-refit" | null>(null);
  const [lastRun, setLastRun] = useState<{ ok: boolean; message: string } | null>(null);
  const style = decisionStyle(snapshot.productStance.decision);
  const executiveSummary = buildExecutiveSummary(snapshot);

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
  const calibration = snapshot.calibration;
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

      <ExecutiveSummarySection items={executiveSummary} />

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

      <StrategyCalibrationSection calibration={calibration} />

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

function ExecutiveSummarySection({ items }: { items: ExecutiveSummaryItem[] }) {
  const toneClass: Record<ExecutiveSummaryItem["tone"], string> = {
    caution: "border-amber-300/35 bg-amber-500/10",
    info: "border-sky-300/35 bg-sky-500/10",
    neutral: "border-border/30 bg-background/40",
  };

  return (
    <section className="min-w-0 rounded-lg border border-border/50 bg-card/70 p-5">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-300" />
            <h2 className="text-lg font-semibold">目前研究結論</h2>
          </div>
          <p className="max-w-4xl text-sm leading-6 text-muted-foreground">
            依目前 Strategy Lab resolved artifact 彙整；先看結論，再往下檢查模擬、門檻、集中度與校準明細。
          </p>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-amber-300/45 bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-100">
          <PauseCircle className="h-3.5 w-3.5" />
          研究觀察中
        </span>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {items.map((item) => (
          <div key={item.label} className={`rounded-md border p-3 ${toneClass[item.tone]}`}>
            <p className="text-xs font-medium text-muted-foreground">{item.label}</p>
            <p className="mt-1 break-words text-base font-semibold leading-6 text-white">{item.value}</p>
            <p className="mt-2 break-words text-xs leading-5 text-muted-foreground">{item.note}</p>
          </div>
        ))}
      </div>

      <ul className="mt-4 grid gap-2 text-xs leading-5 text-muted-foreground sm:grid-cols-2 xl:grid-cols-4">
        <li>僅反映目前 resolved artifact。</li>
        <li>非投資建議。</li>
        <li>不代表未來預測能力。</li>
        <li>不可作為交易訊號。</li>
      </ul>
    </section>
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
        <>
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
          <ThresholdSweepTable simulation={simulation} />
          <ThresholdDrilldownBlock simulation={simulation} />
        </>
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

function calibrationVerdictStyle(verdict: StrategyLabCalibration["verdict"]): { shell: string; icon: React.ReactNode } {
  if (verdict === "calibrated_candidate") {
    return {
      shell: "border-emerald-300/60 bg-emerald-500/10 text-emerald-100",
      icon: <CheckCircle2 className="h-5 w-5 text-emerald-300" />,
    };
  }
  if (verdict === "poorly_calibrated") {
    return {
      shell: "border-amber-300/60 bg-amber-500/10 text-amber-100",
      icon: <AlertTriangle className="h-5 w-5 text-amber-300" />,
    };
  }
  if (verdict === "mixed_evidence") {
    return {
      shell: "border-sky-300/60 bg-sky-500/10 text-sky-100",
      icon: <Activity className="h-5 w-5 text-sky-300" />,
    };
  }
  return {
    shell: "border-zinc-500/60 bg-zinc-500/10 text-zinc-200",
    icon: <PauseCircle className="h-5 w-5 text-zinc-300" />,
  };
}

function CalibrationStatusPill({ calibration }: { calibration: StrategyLabCalibration }) {
  const style = calibrationVerdictStyle(calibration.verdict);
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium ${style.shell}`}>
      {style.icon}
      {calibration.verdictLabel}
    </span>
  );
}

function StrategyCalibrationSection({ calibration }: { calibration?: StrategyLabCalibration }) {
  const status = calibration?.status ?? "missing";
  const failSafeMessage = !calibration || status === "missing" || calibration.bins.length === 0
    ? "目前沒有可校準的 resolved prediction/outcome pairs。"
    : null;
  const sparseMessage = calibration && status === "insufficient" && calibration.bins.length > 0
    ? `有效校準樣本不足，目前 N=${calibration.validPairCount}，先顯示計算結果但不判讀 probabilityUp 校準品質。`
    : null;

  return (
    <section className="min-w-0 rounded-lg border border-border/50 bg-card/70 p-5">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <Activity className="h-5 w-5 text-violet-300" />
            <h2 className="text-lg font-semibold">信心校準檢查</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            使用現有 resolved artifact 將 probabilityUp 分箱，對照每個機率區間的實際上漲率與校準差距。
          </p>
        </div>
        {calibration && <CalibrationStatusPill calibration={calibration} />}
      </div>

      {failSafeMessage ? (
        <div className="rounded-md border border-amber-300/35 bg-amber-500/10 px-3 py-5 text-sm leading-6 text-amber-100">
          {failSafeMessage}
        </div>
      ) : calibration ? (
        <>
          {sparseMessage && (
            <div className="mb-4 flex items-start gap-2 rounded-md border border-amber-300/35 bg-amber-500/10 px-3 py-2 text-sm leading-6 text-amber-100">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              {sparseMessage}
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <SmallMetric label="Brier score" value={calibration.brierScore?.toFixed(4) ?? "N/A"} />
            <SmallMetric label="平均 probabilityUp" value={formatPct(calibration.meanPredictedProbability)} />
            <SmallMetric label="實際上漲率" value={formatPct(calibration.actualUpRate)} />
            <SmallMetric label="近似 ECE" value={formatPct(calibration.expectedCalibrationErrorApprox)} />
            <SmallMetric label="最大校準差距" value={formatPct(calibration.maxCalibrationGap)} />
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="border-b border-border/60 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="py-2 pr-3 font-medium">probabilityUp 區間</th>
                  <th className="py-2 pr-3 font-medium">樣本數</th>
                  <th className="py-2 pr-3 font-medium">平均機率</th>
                  <th className="py-2 pr-3 font-medium">實際上漲率</th>
                  <th className="py-2 pr-3 font-medium">命中率</th>
                  <th className="py-2 pr-3 font-medium">平均 5 日報酬</th>
                  <th className="py-2 pr-3 font-medium">校準差距</th>
                </tr>
              </thead>
              <tbody>
                {calibration.bins.map((bin) => (
                  <CalibrationBinRow key={bin.rangeLabel} bin={bin} />
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 rounded-md border border-border/30 bg-background/35 p-3">
            <p className="mb-2 text-xs font-medium text-muted-foreground">限制與警語</p>
            <ul className="space-y-1 text-sm leading-6 text-muted-foreground">
              {calibration.caveats.map((caveat) => (
                <li key={caveat}>{calibrationCaveatText(caveat)}</li>
              ))}
              <li>{calibration.verdictReason}</li>
              <li>樣本數有限，校準結果只代表目前 resolved artifact，不代表未來預測能力或投資建議。</li>
            </ul>
          </div>
        </>
      ) : null}
    </section>
  );
}

function CalibrationBinRow({ bin }: { bin: StrategyLabCalibration["bins"][number] }) {
  const gapAbs = Math.abs(bin.calibrationGap);
  const gapClass = gapAbs <= 0.08
    ? "text-emerald-300"
    : gapAbs <= 0.15
      ? "text-sky-300"
      : "text-amber-300";

  return (
    <tr className="border-b border-border/30 last:border-0">
      <td className="py-2.5 pr-3 font-mono text-sm">{bin.rangeLabel}</td>
      <td className="py-2.5 pr-3 font-mono text-sm">{bin.pairCount}</td>
      <td className="py-2.5 pr-3 font-mono text-sm">{formatPct(bin.meanProbabilityUp)}</td>
      <td className="py-2.5 pr-3 font-mono text-sm">{formatPct(bin.actualUpRate)}</td>
      <td className="py-2.5 pr-3 font-mono text-sm">{formatPct(bin.hitRate)}</td>
      <td className={`py-2.5 pr-3 font-mono text-sm ${bin.avgForwardReturn > 0 ? "text-red-400" : "text-emerald-400"}`}>
        {formatSignedPct(bin.avgForwardReturn)}
      </td>
      <td className={`py-2.5 pr-3 font-mono text-sm ${gapClass}`}>
        {formatSignedPct(bin.calibrationGap)}
      </td>
    </tr>
  );
}

function calibrationCaveatText(caveat: string): string {
  if (caveat.includes("Small sample")) {
    return caveat.replace("Small sample:", "小樣本警語：").replace("valid resolved pairs are required", "有效 resolved pairs 後才判讀");
  }
  if (caveat.includes("Sparse bins")) {
    return "分箱樣本偏稀疏，需更多 resolved pairs 才能降低偶然波動。";
  }
  if (caveat.includes("resolved prediction artifacts")) {
    return "校準檢查只讀取 resolved artifact，不重新訓練、不重跑資料、不讀寫資料庫。";
  }
  if (caveat.includes("Research-only")) {
    return "僅供研究驗證；不是投資建議，也不代表未來預測能力。";
  }
  return caveat;
}

function ThresholdSweepTable({ simulation }: { simulation: StrategyLabSimulation }) {
  const rows = simulation.thresholdSweep;
  const candidateThreshold = simulation.thresholdDrilldown.candidate?.threshold;

  if (rows.length === 0) return null;

  return (
    <div className="mt-5 rounded-md border border-border/30 bg-background/35 p-3">
      <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h3 className="text-base font-semibold">信心門檻掃描</h3>
          <p className="text-sm text-muted-foreground">
            只在預測看漲且上漲機率達門檻時做多；其他樣本維持空手，baseline 仍是同一批樣本全部做多。
          </p>
        </div>
        <span className="text-xs text-muted-foreground">
          active long cost {formatPct(simulation.costPerRoundTrip)}
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[680px] text-sm">
          <thead className="border-b border-border/60 text-left text-xs text-muted-foreground">
            <tr>
              <th className="py-2 pr-3 font-medium">門檻</th>
              <th className="py-2 pr-3 font-medium">交易數</th>
              <th className="py-2 pr-3 font-medium">淨報酬</th>
              <th className="py-2 pr-3 font-medium">vs baseline</th>
              <th className="py-2 pr-3 font-medium">最大回撤</th>
              <th className="py-2 pr-3 font-medium">verdict</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <ThresholdSweepRow
                key={row.threshold}
                row={row}
                sampleBest={candidateThreshold === row.threshold}
              />
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs leading-5 text-muted-foreground">
        candidate 只標示此 artifact 樣本內符合研究候選且交易數大於 0 的最高 delta 門檻，不能視為推薦。小樣本、重疊 5 日窗口、研究用途限定；不是投資建議，不可用於交易。
      </p>
    </div>
  );
}

function ThresholdSweepRow({
  row,
  sampleBest,
}: {
  row: StrategyLabSimulation["thresholdSweep"][number];
  sampleBest: boolean;
}) {
  const positiveDelta = row.deltaVsBaselineNet > 0;
  const verdictLabel = row.verdict === "research_candidate"
    ? "研究候選"
    : row.verdict === "needs_more_evidence"
      ? "證據不足"
      : "暫不啟用";
  return (
    <tr className="border-b border-border/30 last:border-0">
      <td className="py-2.5 pr-3 font-mono text-sm">
        {formatPct(row.threshold)}
        {sampleBest && (
          <span className="ml-2 rounded-sm border border-sky-300/45 bg-sky-500/10 px-1.5 py-0.5 text-[11px] font-medium text-sky-100">
            candidate
          </span>
        )}
      </td>
      <td className="py-2.5 pr-3 font-mono text-sm">{row.tradeCount} / {row.validPairCount}</td>
      <td className="py-2.5 pr-3 font-mono text-sm">{formatSignedPct(row.strategyNetCumulativeReturn)}</td>
      <td className={`py-2.5 pr-3 font-mono text-sm ${positiveDelta ? "text-emerald-300" : "text-amber-300"}`}>
        {formatSignedPct(row.deltaVsBaselineNet)}
      </td>
      <td className="py-2.5 pr-3 font-mono text-sm">{formatPct(row.maxDrawdownStrategyNet)}</td>
      <td className="py-2.5 pr-3 text-xs text-muted-foreground">{verdictLabel}</td>
    </tr>
  );
}

function ThresholdDrilldownBlock({ simulation }: { simulation: StrategyLabSimulation }) {
  const drilldown = simulation.thresholdDrilldown;
  const candidate = drilldown.candidate;

  return (
    <div className="mt-4 rounded-md border border-border/30 bg-background/35 p-3">
      <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-base font-semibold">候選門檻明細</h3>
          <p className="text-sm text-muted-foreground">
            從信心門檻掃描中挑選非零交易數的研究候選列，展示 artifact 內實際被選入的交易樣本。
          </p>
        </div>
        <span className="text-xs text-muted-foreground">
          preview 最多 10 筆
        </span>
      </div>

      {!candidate ? (
        <div className="rounded-md border border-amber-300/35 bg-amber-500/10 px-3 py-4 text-sm leading-6 text-amber-100">
          目前沒有符合條件的候選門檻。{drilldown.reason}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <SmallMetric label="候選門檻" value={formatPct(candidate.threshold)} />
            <SmallMetric label="交易數 / 有效樣本" value={`${candidate.tradeCount} / ${candidate.validPairCount}`} />
            <SmallMetric label="Strategy net vs baseline" value={`${formatSignedPct(candidate.strategyNetCumulativeReturn)} / ${formatSignedPct(candidate.baselineNetCumulativeReturn)}`} compact />
            <SmallMetric label="Delta / 最大回撤" value={`${formatSignedPct(candidate.deltaVsBaselineNet)} / ${formatPct(candidate.maxDrawdownStrategyNet)}`} compact />
          </div>

          {candidate.smallSample && (
            <div className="flex items-start gap-2 rounded-md border border-amber-300/35 bg-amber-500/10 px-3 py-2 text-sm leading-6 text-amber-100">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              樣本交易數偏少，僅供研究檢視，不能視為投資建議。
            </div>
          )}

          <ThresholdSymbolBreakdownBlock breakdown={drilldown.symbolBreakdown} />
          <ThresholdCohortBreakdownBlock breakdown={drilldown.cohortBreakdown} />

          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="border-b border-border/60 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="py-2 pr-3 font-medium">預測日</th>
                  <th className="py-2 pr-3 font-medium">股票</th>
                  <th className="py-2 pr-3 font-medium">機率</th>
                  <th className="py-2 pr-3 font-medium">預測 / 實際</th>
                  <th className="py-2 pr-3 font-medium">5 日報酬</th>
                  <th className="py-2 pr-3 font-medium">成本後單筆</th>
                  <th className="py-2 pr-3 font-medium">命中</th>
                </tr>
              </thead>
              <tbody>
                {candidate.selectedTradesPreview.map((trade) => (
                  <ThresholdDrilldownTradeRow
                    key={`${trade.symbol}-${trade.featureDate}-${trade.targetDate}`}
                    trade={trade}
                  />
                ))}
                {candidate.selectedTradesPreview.length === 0 && (
                  <tr>
                    <td className="py-6 text-muted-foreground" colSpan={7}>
                      候選門檻存在，但 preview 沒有可顯示的 selected trades。
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <ul className="space-y-1 text-xs leading-5 text-muted-foreground">
            {candidate.caveats.map((caveat) => (
              <li key={caveat}>{thresholdDrilldownCaveatText(caveat)}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function ThresholdSymbolBreakdownBlock({
  breakdown,
}: {
  breakdown: StrategyLabSimulation["thresholdDrilldown"]["symbolBreakdown"];
}) {
  return (
    <div className="rounded-md border border-border/30 bg-card/45 p-3">
      <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h4 className="text-sm font-semibold">標的集中度與貢獻</h4>
          <p className="text-xs leading-5 text-muted-foreground">
            依候選門檻實際選入的 artifact trades 分組，貢獻值是樣本歸因近似，不代表未來表現。
          </p>
        </div>
        <span className="text-xs text-muted-foreground">
          {breakdown.symbolCount} symbols
        </span>
      </div>

      {breakdown.status === "no_candidate" ? (
        <div className="rounded-md border border-amber-300/35 bg-amber-500/10 px-3 py-3 text-sm leading-6 text-amber-100">
          尚無候選門檻可計算標的貢獻。{breakdown.reason}
        </div>
      ) : (
        <div className="space-y-3">
          {breakdown.isConcentrated && (
            <div className="flex items-start gap-2 rounded-md border border-amber-300/35 bg-amber-500/10 px-3 py-2 text-sm leading-6 text-amber-100">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              候選樣本由 {breakdown.dominantSymbol ?? "單一標的"} 主導，交易占比 {formatPct(breakdown.dominantTradeShare)}。
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead className="border-b border-border/60 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="py-2 pr-3 font-medium">股票</th>
                  <th className="py-2 pr-3 font-medium">交易數 / 占比</th>
                  <th className="py-2 pr-3 font-medium">命中率</th>
                  <th className="py-2 pr-3 font-medium">平均機率</th>
                  <th className="py-2 pr-3 font-medium">平均 gross</th>
                  <th className="py-2 pr-3 font-medium">平均成本後</th>
                  <th className="py-2 pr-3 font-medium">近似貢獻</th>
                  <th className="py-2 pr-3 font-medium">最佳 / 最差</th>
                </tr>
              </thead>
              <tbody>
                {breakdown.rows.map((row) => (
                  <ThresholdSymbolBreakdownRow key={row.symbol} row={row} />
                ))}
              </tbody>
            </table>
          </div>

          <p className="text-xs leading-5 text-muted-foreground">
            樣本集中於少數標的，僅供研究檢視，不能視為投資建議。
          </p>
          <ul className="space-y-1 text-xs leading-5 text-muted-foreground">
            {breakdown.caveats.map((caveat) => (
              <li key={caveat}>{thresholdSymbolBreakdownCaveatText(caveat)}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function ThresholdSymbolBreakdownRow({
  row,
}: {
  row: StrategyLabSimulation["thresholdDrilldown"]["symbolBreakdown"]["rows"][number];
}) {
  const avgGrossPositive = row.averageForwardReturnGross > 0;
  const avgNetPositive = row.averageNetReturnAfterCost > 0;
  const contributionPositive = row.cumulativeNetContributionApprox > 0;

  return (
    <tr className="border-b border-border/30 last:border-0">
      <td className="py-2.5 pr-3 font-medium">{row.symbol}</td>
      <td className="py-2.5 pr-3 font-mono text-sm">{row.tradeCount} / {formatPct(row.tradeShare)}</td>
      <td className="py-2.5 pr-3 font-mono text-sm">{row.winCount} / {formatPct(row.hitRate)}</td>
      <td className="py-2.5 pr-3 font-mono text-sm">{formatPct(row.averageProbabilityUp)}</td>
      <td className={`py-2.5 pr-3 font-mono text-sm ${avgGrossPositive ? "text-red-400" : "text-emerald-400"}`}>
        {formatSignedPct(row.averageForwardReturnGross)}
      </td>
      <td className={`py-2.5 pr-3 font-mono text-sm ${avgNetPositive ? "text-red-400" : "text-emerald-400"}`}>
        {formatSignedPct(row.averageNetReturnAfterCost)}
      </td>
      <td className={`py-2.5 pr-3 font-mono text-sm ${contributionPositive ? "text-red-400" : "text-emerald-400"}`}>
        {formatSignedPct(row.cumulativeNetContributionApprox)}
      </td>
      <td className="py-2.5 pr-3 font-mono text-sm">
        {formatSignedPct(row.bestTradeForwardReturn)} / {formatSignedPct(row.worstTradeForwardReturn)}
      </td>
    </tr>
  );
}

function ThresholdCohortBreakdownBlock({
  breakdown,
}: {
  breakdown: StrategyLabSimulation["thresholdDrilldown"]["cohortBreakdown"];
}) {
  return (
    <div className="rounded-md border border-border/30 bg-card/45 p-3">
      <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h4 className="text-sm font-semibold">時間區間與 cohort 貢獻</h4>
          <p className="text-xs leading-5 text-muted-foreground">
            依候選門檻實際選入的 artifact trades 以 featureDate 分組，貢獻值是樣本歸因近似，不代表未來表現。
          </p>
        </div>
        <span className="text-xs text-muted-foreground">
          {breakdown.cohortCount} cohorts
        </span>
      </div>

      {breakdown.status === "no_candidate" ? (
        <div className="rounded-md border border-amber-300/35 bg-amber-500/10 px-3 py-3 text-sm leading-6 text-amber-100">
          尚無候選門檻可計算時間 cohort 貢獻。{breakdown.reason}
        </div>
      ) : (
        <div className="space-y-3">
          {breakdown.isTimeConcentrated && (
            <div className="flex items-start gap-2 rounded-md border border-amber-300/35 bg-amber-500/10 px-3 py-2 text-sm leading-6 text-amber-100">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              候選樣本集中於 {breakdown.dominantCohortKey ?? "少數日期區間"}，
              交易占比 {formatPct(breakdown.dominantTradeShare)}。
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead className="border-b border-border/60 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="py-2 pr-3 font-medium">featureDate / target</th>
                  <th className="py-2 pr-3 font-medium">交易數 / 占比</th>
                  <th className="py-2 pr-3 font-medium">命中率</th>
                  <th className="py-2 pr-3 font-medium">平均機率</th>
                  <th className="py-2 pr-3 font-medium">平均 gross</th>
                  <th className="py-2 pr-3 font-medium">平均成本後</th>
                  <th className="py-2 pr-3 font-medium">近似貢獻</th>
                  <th className="py-2 pr-3 font-medium">最佳 / 最差</th>
                  <th className="py-2 pr-3 font-medium">標的</th>
                </tr>
              </thead>
              <tbody>
                {breakdown.rows.map((row) => (
                  <ThresholdCohortBreakdownRow key={row.cohortKey} row={row} />
                ))}
              </tbody>
            </table>
          </div>

          <p className="text-xs leading-5 text-muted-foreground">
            樣本集中於少數日期區間，僅供研究檢視，不能視為投資建議。
          </p>
          <ul className="space-y-1 text-xs leading-5 text-muted-foreground">
            {breakdown.caveats.map((caveat) => (
              <li key={caveat}>{thresholdCohortBreakdownCaveatText(caveat)}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function ThresholdCohortBreakdownRow({
  row,
}: {
  row: StrategyLabSimulation["thresholdDrilldown"]["cohortBreakdown"]["rows"][number];
}) {
  const avgGrossPositive = row.averageForwardReturnGross > 0;
  const avgNetPositive = row.averageNetReturnAfterCost > 0;
  const contributionPositive = row.cumulativeNetContributionApprox > 0;
  const displayedSymbols = row.symbols.slice(0, 4).join(", ");
  const hiddenSymbolCount = Math.max(0, row.symbols.length - 4);

  return (
    <tr className="border-b border-border/30 last:border-0">
      <td className="py-2.5 pr-3 font-mono text-xs">
        <div>{row.featureDate}</div>
        <div className="text-muted-foreground">target {row.targetDateRange}</div>
      </td>
      <td className="py-2.5 pr-3 font-mono text-sm">{row.tradeCount} / {formatPct(row.tradeShare)}</td>
      <td className="py-2.5 pr-3 font-mono text-sm">{row.winCount} / {formatPct(row.hitRate)}</td>
      <td className="py-2.5 pr-3 font-mono text-sm">{formatPct(row.averageProbabilityUp)}</td>
      <td className={`py-2.5 pr-3 font-mono text-sm ${avgGrossPositive ? "text-red-400" : "text-emerald-400"}`}>
        {formatSignedPct(row.averageForwardReturnGross)}
      </td>
      <td className={`py-2.5 pr-3 font-mono text-sm ${avgNetPositive ? "text-red-400" : "text-emerald-400"}`}>
        {formatSignedPct(row.averageNetReturnAfterCost)}
      </td>
      <td className={`py-2.5 pr-3 font-mono text-sm ${contributionPositive ? "text-red-400" : "text-emerald-400"}`}>
        {formatSignedPct(row.cumulativeNetContributionApprox)}
      </td>
      <td className="py-2.5 pr-3 font-mono text-sm">
        {formatSignedPct(row.bestTradeForwardReturn)} / {formatSignedPct(row.worstTradeForwardReturn)}
      </td>
      <td className="py-2.5 pr-3 text-xs text-muted-foreground">
        {displayedSymbols}{hiddenSymbolCount > 0 ? ` +${hiddenSymbolCount}` : ""}
      </td>
    </tr>
  );
}

function ThresholdDrilldownTradeRow({
  trade,
}: {
  trade: NonNullable<StrategyLabSimulation["thresholdDrilldown"]["candidate"]>["selectedTradesPreview"][number];
}) {
  const predicted = directionMeta(trade.predictedDirection);
  const actual = directionMeta(trade.actualDirection);
  const returnPositive = trade.forwardReturn > 0;
  const netPositive = trade.netReturnAfterCost > 0;

  return (
    <tr className="border-b border-border/30 last:border-0">
      <td className="py-2.5 pr-3 font-mono text-xs">
        <div>{trade.featureDate}</div>
        <div className="text-muted-foreground">→ {trade.targetDate}</div>
      </td>
      <td className="py-2.5 pr-3 font-medium">{trade.symbol}</td>
      <td className="py-2.5 pr-3 font-mono text-sm">{formatPct(trade.probabilityUp)}</td>
      <td className="py-2.5 pr-3">
        <span className={`inline-flex items-center gap-1 ${predicted.textClass}`}>{predicted.icon}{predicted.label}</span>
        <span className="mx-1 text-muted-foreground">/</span>
        <span className={`inline-flex items-center gap-1 ${actual.textClass}`}>{actual.icon}{actual.label}</span>
      </td>
      <td className={`py-2.5 pr-3 font-mono text-sm ${returnPositive ? "text-red-400" : "text-emerald-400"}`}>
        {formatSignedPct(trade.forwardReturn)}
      </td>
      <td className={`py-2.5 pr-3 font-mono text-sm ${netPositive ? "text-red-400" : "text-emerald-400"}`}>
        {formatSignedPct(trade.netReturnAfterCost)}
      </td>
      <td className="py-2.5 pr-3">
        {trade.correct
          ? <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          : <XCircle className="h-4 w-4 text-amber-400" />}
      </td>
    </tr>
  );
}

function thresholdDrilldownCaveatText(caveat: string): string {
  if (caveat.includes("Small sample")) {
    return "樣本交易數偏少，僅供研究檢視，不能視為投資建議。";
  }
  if (caveat.includes("Research-only")) {
    return "僅供研究驗證；不是投資建議，不可用於交易。";
  }
  if (caveat.includes("artifact replay")) {
    return "表格列出的是 artifact 回放樣本，不是交易指示。";
  }
  return caveat;
}

function thresholdSymbolBreakdownCaveatText(caveat: string): string {
  if (caveat.includes("sample attribution")) {
    return "標的貢獻是候選樣本內的歸因近似，不能直接對應策略總報酬。";
  }
  if (caveat.includes("Small sample")) {
    return "樣本交易數偏少，集中度容易主導結果，僅供研究檢視。";
  }
  if (caveat.includes("Concentration warning")) {
    return "候選樣本由單一或少數標的主導，需先擴大樣本再判讀。";
  }
  if (caveat.includes("Research-only")) {
    return "僅供研究驗證；不是投資建議，不可用於交易。";
  }
  return caveat;
}

function thresholdCohortBreakdownCaveatText(caveat: string): string {
  if (caveat.includes("sample attribution")) {
    return "cohort 貢獻是候選樣本內的時間歸因近似，不能直接對應策略總報酬。";
  }
  if (caveat.includes("Small sample")) {
    return "樣本交易數偏少，日期集中度容易主導結果，僅供研究檢視。";
  }
  if (caveat.includes("Date concentration warning")) {
    return "候選樣本落在兩個以下 featureDate cohorts，需先擴大樣本再判讀。";
  }
  if (caveat.includes("Concentration warning")) {
    return "候選樣本由單一或少數日期區間主導，需避免把樣本歸因視為可交易結論。";
  }
  if (caveat.includes("Research-only")) {
    return "僅供研究驗證；不是投資建議，不可用於交易。";
  }
  return caveat;
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
