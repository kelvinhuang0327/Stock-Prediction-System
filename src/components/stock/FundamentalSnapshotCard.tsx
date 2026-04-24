"use client";

import React, { useMemo, useState } from 'react';
import type { StockDetailResponse } from '@/app/api/stocks/[id]/detail/route';
import { AlertTriangle, BarChart3, CheckCircle2, DollarSign, FileText, TrendingUp } from 'lucide-react';
import { LimitationBlock } from '@/components/ui/limitation-block';
import { ResearchOrientationBanner } from '@/components/research/ResearchOrientationBanner';
import { FundamentalPeerComparisonCard } from '@/components/stock/FundamentalPeerComparisonCard';
import {
  FundamentalComparisonMatrix,
  type FundamentalComparisonMatrixSectionKey,
} from '@/components/fundamental/FundamentalComparisonMatrix';
import { PeerPercentileDetailTable } from '@/components/fundamental/PeerPercentileDetailTable';
import type { CashflowLeverageOverlay } from '@/lib/fundamental/CashflowLeverageOverlayEngine';
import type { CapitalEfficiencyOverlay } from '@/lib/fundamental/CapitalEfficiencyOverlayEngine';
import type {
  FinancialStructurePeerComparison,
  FinancialStructurePeerMetricComparison,
} from '@/lib/fundamental/FinancialStructurePeerComparisonEngine';
import type { FullFundamentalComparisonMatrix } from '@/lib/fundamental/FullFundamentalComparisonMatrixBuilder';
import type { PeerPercentileDetailTable as PeerPercentileDetailTableType } from '@/lib/fundamental/types';

interface Props {
  fundamentals: StockDetailResponse['fundamentals'] | null | undefined;
  peerComparison?: StockDetailResponse['peerComparison'] | null | undefined;
  cashflowLeverageOverlay?: CashflowLeverageOverlay | null | undefined;
  capitalEfficiencyOverlay?: CapitalEfficiencyOverlay | null | undefined;
  financialStructurePeerComparison?: FinancialStructurePeerComparison | null | undefined;
  fundamentalMatrix?: FullFundamentalComparisonMatrix | null | undefined;
  peerPercentileDetailTable?: PeerPercentileDetailTableType | null | undefined;
}

function fmtNumber(value: number | null, digits = 2): string {
  if (value === null || Number.isNaN(value)) return '—';
  return value.toLocaleString('zh-TW', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function fmtPercent(value: number | null): string {
  if (value === null || Number.isNaN(value)) return '—';
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
}

function fmtDelta(value: number | null, suffix = ''): string {
  if (value === null || Number.isNaN(value)) return '—';
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}${suffix}`;
}

function coverageTone(coverage: string): string {
  if (coverage === 'full') return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400';
  if (coverage === 'limited') return 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400';
  return 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400';
}

function coverageLabel(coverage: string): string {
  if (coverage === 'full') return '資料完整';
  if (coverage === 'limited') return '資料部分';
  return '資料不足';
}

function MetricCard({
  icon,
  title,
  subtitle,
  rows,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  rows: Array<{ label: string; value: string; hint?: string }>;
}) {
  return (
    <div className="rounded-lg border border-border/30 bg-muted/10 p-3 space-y-3">
      <div className="flex items-center gap-2">
        <div className="text-primary">{icon}</div>
        <div>
          <div className="text-sm font-medium">{title}</div>
          {subtitle && <div className="text-[11px] text-muted-foreground">{subtitle}</div>}
        </div>
      </div>
      <div className="space-y-2">
        {rows.map((row) => (
          <div key={row.label} className="flex items-start justify-between gap-3 text-xs">
            <div className="text-muted-foreground">{row.label}</div>
            <div className="text-right">
              <div className="font-mono font-medium">{row.value}</div>
              {row.hint && <div className="text-[10px] text-muted-foreground">{row.hint}</div>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function FundamentalSnapshotCard({
  fundamentals,
  peerComparison,
  cashflowLeverageOverlay,
  capitalEfficiencyOverlay,
  financialStructurePeerComparison,
  fundamentalMatrix,
  peerPercentileDetailTable,
}: Props) {
  const [selectedMatrixSection, setSelectedMatrixSection] =
    useState<FundamentalComparisonMatrixSectionKey | null>(null);
  const activeDetailCategory = useMemo(() => {
    if (!selectedMatrixSection) return null;
    return selectedMatrixSection === 'peerPosition' ? 'financialStructure' : selectedMatrixSection;
  }, [selectedMatrixSection]);

  if (!fundamentals) {
    return (
      <div className="text-sm text-muted-foreground py-4 px-2">
        基本面資料暫時不可用。
      </div>
    );
  }

  const tone = coverageTone(fundamentals.dataCoverage);
  const signalTitle = fundamentals.keySignals.length > 0 ? '基本面支撐' : '目前無明確正向支撐';
  const riskTitle = fundamentals.keyRisks.length > 0 ? '基本面風險' : '目前無明確負向風險';

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold">基本面研究摘要</span>
            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${tone}`}>
              {coverageLabel(fundamentals.dataCoverage)}
            </span>
            {fundamentals.kind === 'etf' && (
              <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400">
                ETF 規則
              </span>
            )}
          </div>
          <p className="text-sm text-foreground/80 leading-relaxed">{fundamentals.summary}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <MetricCard
          icon={<TrendingUp className="h-4 w-4" />}
          title="營收趨勢"
          subtitle={fundamentals.revenue.latestMonth ? `最新月份 ${fundamentals.revenue.latestMonth}` : '月營收資料不足'}
          rows={[
            { label: '月營收', value: fundamentals.revenue.revenue !== null ? fmtNumber(fundamentals.revenue.revenue, 0) : '—' },
            { label: 'YoY', value: fmtPercent(fundamentals.revenue.yoyGrowth) },
            { label: 'MoM', value: fmtPercent(fundamentals.revenue.momGrowth) },
            {
              label: '趨勢',
              value: fundamentals.revenue.trend,
              hint: fundamentals.revenue.consecutivePositiveYoYMonths > 0
                ? `連續 ${fundamentals.revenue.consecutivePositiveYoYMonths} 個月年增為正`
                : undefined,
            },
          ]}
        />

        <MetricCard
          icon={<FileText className="h-4 w-4" />}
          title="獲利能力"
          subtitle={fundamentals.profitability.latestPeriod ?? '財報資料不足'}
          rows={[
            {
              label: '單季 EPS',
              value: fundamentals.profitability.eps !== null ? fmtNumber(fundamentals.profitability.eps) : '—',
              hint: fundamentals.profitability.epsQoQDelta !== null ? `QoQ ${fmtDelta(fundamentals.profitability.epsQoQDelta, ' 元')}` : undefined,
            },
            {
              label: '毛利率',
              value: fundamentals.profitability.grossMargin !== null ? `${fmtNumber(fundamentals.profitability.grossMargin)}%` : '—',
              hint: fundamentals.profitability.grossMarginDelta !== null ? `QoQ ${fmtDelta(fundamentals.profitability.grossMarginDelta, ppSuffix())}` : undefined,
            },
            {
              label: '營益率',
              value: fundamentals.profitability.operatingMargin !== null ? `${fmtNumber(fundamentals.profitability.operatingMargin)}%` : '—',
              hint: fundamentals.profitability.operatingMarginDelta !== null ? `QoQ ${fmtDelta(fundamentals.profitability.operatingMarginDelta, ppSuffix())}` : undefined,
            },
          ]}
        />

        <MetricCard
          icon={<DollarSign className="h-4 w-4" />}
          title="估值 / 收益"
          subtitle={fundamentals.valuation.asOfDate ? `as of ${fundamentals.valuation.asOfDate}` : '估值資料不足'}
          rows={[
            { label: 'P/E', value: fundamentals.valuation.pe !== null ? fmtNumber(fundamentals.valuation.pe) : '—' },
            { label: 'P/B', value: fundamentals.valuation.pb !== null ? fmtNumber(fundamentals.valuation.pb) : '—' },
            { label: '殖利率', value: fundamentals.valuation.dividendYield !== null ? `${fmtNumber(fundamentals.valuation.dividendYield)}%` : '—' },
          ]}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="rounded-lg border border-border/30 bg-emerald-50/50 dark:bg-emerald-950/10 p-3 space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            {signalTitle}
          </div>
          {fundamentals.keySignals.length > 0 ? (
            <ul className="space-y-1">
              {fundamentals.keySignals.map((item) => (
                <li key={item} className="text-xs text-foreground/80">
                  {item}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-muted-foreground">尚未形成足夠明確的基本面正向訊號。</p>
          )}
        </div>

        <div className="rounded-lg border border-border/30 bg-amber-50/50 dark:bg-amber-950/10 p-3 space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            {riskTitle}
          </div>
          {fundamentals.keyRisks.length > 0 ? (
            <ul className="space-y-1">
              {fundamentals.keyRisks.map((item) => (
                <li key={item} className="text-xs text-foreground/80">
                  {item}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-muted-foreground">目前未偵測到明顯的基本面惡化訊號。</p>
          )}
        </div>
      </div>

      <div className="rounded-lg border border-border/30 bg-muted/10 p-3">
        <FundamentalPeerComparisonCard comparison={peerComparison} />
      </div>

      <ResearchOrientationBanner
        title="這一段怎麼讀"
        statusLabel={
          fundamentals.kind === 'etf'
            ? 'ETF 降級'
            : fundamentals.dataCoverage === 'full'
            ? '可完整解讀'
            : fundamentals.dataCoverage === 'limited'
            ? '部分可解讀'
            : '保守解讀'
        }
        tone={
          fundamentals.kind === 'etf'
            ? 'degraded'
            : fundamentals.dataCoverage === 'full'
            ? 'success'
            : fundamentals.dataCoverage === 'limited'
            ? 'warning'
            : 'critical'
        }
        summary={
          fundamentals.kind === 'etf'
            ? 'ETF 的這一區塊只做有限的公司營運式比較，重點會放在估值、收益與組合脈絡。'
            : fundamentals.dataCoverage === 'full'
            ? '矩陣先給你「面向結論」，百分位細表再給你「每個指標的位置」，兩者一起看才完整。'
            : '這個區塊有降級資料，先看限制與 basis，再看矩陣與百分位，不要把 null 當成壞表現。'
        }
        bullets={
          fundamentals.kind === 'etf'
            ? [
                'ETF 不適合拿公司營運式成長 / 效率 / 槓桿指標做直接比較。',
                '如果看到 PR — 或 unknown，表示此欄位本來就不應強行解讀。',
              ]
            : [
                '先看完整基本面研究矩陣，抓出哪個面向偏強、偏弱、未知。',
                '再看同組百分位明細，確認本股相對同組是偏強還是偏弱。',
                '若 sample 很少或 percentile = null，請把它視為「資料不足」，不是負面訊號。',
              ]
        }
        compact
      />

      {fundamentalMatrix && (
        <FundamentalComparisonMatrix
          matrix={fundamentalMatrix}
          title="完整基本面研究矩陣"
          selectedSectionKey={selectedMatrixSection}
          onSectionSelect={(key) => {
            setSelectedMatrixSection((current) => (current === key ? null : key));
          }}
        />
      )}

      {peerPercentileDetailTable && (
        <PeerPercentileDetailTable
          table={peerPercentileDetailTable}
          title="同組百分位明細"
          activeCategory={activeDetailCategory}
        />
      )}

      {cashflowLeverageOverlay && (
        <div className="rounded-lg border border-border/30 bg-muted/10 p-3 space-y-3">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <div className="text-sm font-medium">現金流 / 財務槓桿觀察</div>
              <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                {cashflowLeverageOverlay.summary}
              </p>
            </div>
            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${overlayTone(cashflowLeverageOverlay.riskLevel)}`}>
              {overlayLabel(cashflowLeverageOverlay.riskLevel)}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="rounded-lg border border-border/20 bg-background/50 p-3">
              <div className="text-xs font-medium">現金流脈絡</div>
              <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                {cashflowLeverageOverlay.cashflowContext}
              </p>
            </div>
            <div className="rounded-lg border border-border/20 bg-background/50 p-3">
              <div className="text-xs font-medium">槓桿 / 流動性脈絡</div>
              <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                {cashflowLeverageOverlay.leverageContext}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <OverlayList
              title="體質支撐"
              items={cashflowLeverageOverlay.strengths}
              emptyText="目前沒有明確的現金流 / 槓桿正向支撐。"
              tone="positive"
            />
            <OverlayList
              title="財務壓力"
              items={cashflowLeverageOverlay.pressures}
              emptyText="目前沒有明確的現金流 / 槓桿壓力。"
              tone="risk"
            />
          </div>

          {cashflowLeverageOverlay.limitations.length > 0 && (
            <div className="rounded-lg border border-border/20 bg-muted/10 p-3">
              <div className="text-xs font-medium text-muted-foreground mb-2">財務結構限制</div>
              <LimitationBlock items={cashflowLeverageOverlay.limitations} compact />
            </div>
          )}
        </div>
      )}

      {capitalEfficiencyOverlay && (
        <div className="rounded-lg border border-border/30 bg-muted/10 p-3 space-y-3">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <div className="text-sm font-medium">資本效率 / 獲利品質觀察</div>
              <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                {capitalEfficiencyOverlay.summary}
              </p>
            </div>
            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${overlayTone(capitalEfficiencyOverlay.riskLevel)}`}>
              {capitalOverlayLabel(capitalEfficiencyOverlay.riskLevel)}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="rounded-lg border border-border/20 bg-background/50 p-3">
              <div className="text-xs font-medium">資本效率脈絡</div>
              <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                {capitalEfficiencyOverlay.efficiencyContext}
              </p>
            </div>
            <div className="rounded-lg border border-border/20 bg-background/50 p-3">
              <div className="text-xs font-medium">獲利效率脈絡</div>
              <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                {capitalEfficiencyOverlay.profitabilityContext}
              </p>
            </div>
            <div className="rounded-lg border border-border/20 bg-background/50 p-3">
              <div className="text-xs font-medium">轉現品質脈絡</div>
              <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                {capitalEfficiencyOverlay.conversionContext}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <OverlayList
              title="效率支撐"
              items={capitalEfficiencyOverlay.strengths}
              emptyText="目前沒有明確的資本效率正向支撐。"
              tone="positive"
            />
            <OverlayList
              title="效率壓力"
              items={capitalEfficiencyOverlay.pressures}
              emptyText="目前沒有明確的資本效率壓力。"
              tone="risk"
            />
          </div>

          {capitalEfficiencyOverlay.limitations.length > 0 && (
            <div className="rounded-lg border border-border/20 bg-muted/10 p-3">
              <div className="text-xs font-medium text-muted-foreground mb-2">效率研究限制</div>
              <LimitationBlock items={capitalEfficiencyOverlay.limitations} compact />
            </div>
          )}
        </div>
      )}

      {financialStructurePeerComparison && (
        <div className="rounded-lg border border-border/30 bg-muted/10 p-3 space-y-3">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <div className="text-sm font-medium">財務結構 / 效率同組比較</div>
              <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                {financialStructurePeerComparison.summary}
              </p>
            </div>
            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${coverageTone(financialStructurePeerComparison.dataCoverage)}`}>
              {financialCoverageLabel(financialStructurePeerComparison.dataCoverage)}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="rounded-lg border border-border/20 bg-background/50 p-3">
              <div className="text-xs font-medium">比較基準</div>
              <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                {financialStructureBasisLabel(financialStructurePeerComparison)}
              </p>
            </div>
            <div className="rounded-lg border border-border/20 bg-background/50 p-3">
              <div className="text-xs font-medium">同組樣本</div>
              <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                {financialStructurePeerComparison.peerSampleSize} 檔
                {financialStructurePeerComparison.basis !== 'none' && financialStructurePeerComparison.groupLabel
                  ? ` · ${financialStructurePeerComparison.groupLabel}`
                  : ''}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {pickHighlightedMetrics(financialStructurePeerComparison).map(({ key, metric }) => (
              <div key={key} className="rounded-lg border border-border/20 bg-background/50 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs font-medium">{metricLabel(key)}</div>
                  <div className="text-[11px] font-mono text-muted-foreground">
                    {metric.percentile !== null ? `PR ${metric.percentile}` : 'PR —'}
                  </div>
                </div>
                <div className="mt-2 flex items-center justify-between gap-3 text-xs">
                  <span className="text-muted-foreground">本股</span>
                  <span className="font-mono">{fmtPeerMetricValue(key, metric.value)}</span>
                </div>
                <div className="mt-1 flex items-center justify-between gap-3 text-xs">
                  <span className="text-muted-foreground">同組中位</span>
                  <span className="font-mono">{fmtPeerMetricValue(key, metric.median)}</span>
                </div>
                <p className="mt-2 text-[11px] text-muted-foreground leading-relaxed">
                  {metric.interpretation}
                </p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <OverlayList
              title="結構支撐"
              items={financialStructurePeerComparison.strengths}
              emptyText="目前沒有明確的同組財務結構支撐。"
              tone="positive"
            />
            <OverlayList
              title="結構壓力"
              items={financialStructurePeerComparison.pressures}
              emptyText="目前沒有明確的同組財務結構壓力。"
              tone="risk"
            />
          </div>

          {financialStructurePeerComparison.limitations.length > 0 && (
            <div className="rounded-lg border border-border/20 bg-muted/10 p-3">
              <div className="text-xs font-medium text-muted-foreground mb-2">同組比較限制</div>
              <LimitationBlock items={financialStructurePeerComparison.limitations} compact />
            </div>
          )}
        </div>
      )}

      {fundamentals.limitations.length > 0 && (
        <div className="rounded-lg border border-border/20 bg-muted/10 p-3">
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground mb-2">
            <BarChart3 className="h-3.5 w-3.5" />
            研究限制
          </div>
          <LimitationBlock items={fundamentals.limitations} compact />
        </div>
      )}
    </div>
  );
}

function ppSuffix(): string {
  return ' 個百分點';
}

function overlayLabel(riskLevel: CashflowLeverageOverlay['riskLevel']): string {
  switch (riskLevel) {
    case 'low':
      return '財務體質較穩';
    case 'moderate':
      return '財務體質中性';
    case 'elevated':
      return '財務體質承壓';
    case 'high':
      return '財務結構高壓';
    case 'unknown':
    default:
      return '財務體質未知';
  }
}

function capitalOverlayLabel(riskLevel: CapitalEfficiencyOverlay['riskLevel']): string {
  switch (riskLevel) {
    case 'low':
      return '效率結構較佳';
    case 'moderate':
      return '效率結構中性';
    case 'elevated':
      return '效率品質承壓';
    case 'high':
      return '效率風險偏高';
    case 'unknown':
    default:
      return '效率資料未知';
  }
}

function overlayTone(riskLevel: CashflowLeverageOverlay['riskLevel']): string {
  switch (riskLevel) {
    case 'low':
      return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400';
    case 'moderate':
      return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
    case 'elevated':
      return 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400';
    case 'high':
      return 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300';
    case 'unknown':
    default:
      return 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400';
  }
}

function OverlayList({
  title,
  items,
  emptyText,
  tone,
}: {
  title: string;
  items: string[];
  emptyText: string;
  tone: 'positive' | 'risk';
}) {
  const toneClass =
    tone === 'positive'
      ? 'text-emerald-700 dark:text-emerald-300'
      : 'text-amber-700 dark:text-amber-300';

  return (
    <div className="rounded-lg border border-border/20 bg-background/50 p-3">
      <div className="text-xs font-medium">{title}</div>
      {items.length > 0 ? (
        <ul className="mt-2 space-y-1">
          {items.map((item) => (
            <li key={item} className={`text-xs ${toneClass}`}>
              • {item}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-xs text-muted-foreground">{emptyText}</p>
      )}
    </div>
  );
}

function financialCoverageLabel(coverage: FinancialStructurePeerComparison['dataCoverage']): string {
  if (coverage === 'full') return '結構比較完整';
  if (coverage === 'limited') return '結構比較有限';
  return '結構比較不足';
}

function financialStructureBasisLabel(comparison: FinancialStructurePeerComparison): string {
  if (comparison.basis === 'none' || !comparison.groupLabel) return '同組比較不可用';
  return `${comparison.basis === 'industry' ? 'industry' : 'sector'} · ${comparison.groupLabel}`;
}

function pickHighlightedMetrics(
  comparison: FinancialStructurePeerComparison,
): Array<{ key: string; metric: FinancialStructurePeerMetricComparison }> {
  const preferredOrder = [
    'debtRatio',
    'currentRatio',
    'roe',
    'cashflowConversion',
    'roa',
    'assetTurnover',
    'liabilitiesRatio',
    'quickRatio',
  ] as const;
  const highlighted: Array<{ key: string; metric: FinancialStructurePeerMetricComparison }> = [];

  for (const key of preferredOrder) {
    const metric = comparison.metrics[key];
    if (!metric) continue;
    highlighted.push({ key, metric });
    if (highlighted.length >= 4) break;
  }

  return highlighted;
}

function metricLabel(key: string): string {
  switch (key) {
    case 'debtRatio':
      return '負債比';
    case 'liabilitiesRatio':
      return '負債佔資產比';
    case 'currentRatio':
      return '流動比率';
    case 'quickRatio':
      return '速動比率';
    case 'roe':
      return 'ROE';
    case 'roa':
      return 'ROA';
    case 'assetTurnover':
      return '資產周轉率';
    case 'cashflowConversion':
      return '現金流轉換率';
    default:
      return key;
  }
}

function fmtPeerMetricValue(key: string, value: number | null): string {
  if (value === null || Number.isNaN(value)) return '—';
  if (key === 'currentRatio' || key === 'quickRatio' || key === 'assetTurnover' || key === 'cashflowConversion') {
    return fmtNumber(value);
  }
  return `${fmtNumber(value)}%`;
}
