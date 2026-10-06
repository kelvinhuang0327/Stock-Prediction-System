"use client";

import React, { useMemo, useState } from 'react';
import { AlertTriangle, BarChart3, DollarSign, FileText, Shield, TrendingUp, Users } from 'lucide-react';
import type { StockFundamentalSnapshot } from '@/lib/fundamentals/StockFundamentalSnapshot';
import type { StockPeerComparison } from '@/lib/fundamentals/StockPeerComparison';
import type { FundamentalRiskOverlay } from '@/lib/fundamental/FundamentalRiskOverlayEngine';
import type { CashflowLeverageOverlay } from '@/lib/fundamental/CashflowLeverageOverlayEngine';
import type { CapitalEfficiencyOverlay } from '@/lib/fundamental/CapitalEfficiencyOverlayEngine';
import type { FinancialStructurePeerComparison } from '@/lib/fundamental/FinancialStructurePeerComparisonEngine';
import type { FullFundamentalComparisonMatrix } from '@/lib/fundamental/FullFundamentalComparisonMatrixBuilder';
import type { PeerPercentileDetailTable as PeerPercentileDetailTableType } from '@/lib/fundamental/types';
import {
  FundamentalComparisonMatrix,
  type FundamentalComparisonMatrixSectionKey,
} from '@/components/fundamental/FundamentalComparisonMatrix';
import { PeerPercentileDetailTable } from '@/components/fundamental/PeerPercentileDetailTable';

export function CandidateFundamentalResearchCard({
  fundamentals,
  overlay,
  peerComparison,
  cashflowLeverageOverlay,
  capitalEfficiencyOverlay,
  financialStructurePeerComparison,
  fundamentalMatrix,
  peerPercentileDetailTable,
}: {
  fundamentals: StockFundamentalSnapshot;
  overlay: FundamentalRiskOverlay;
  peerComparison: StockPeerComparison | null;
  cashflowLeverageOverlay?: CashflowLeverageOverlay | null;
  capitalEfficiencyOverlay?: CapitalEfficiencyOverlay | null;
  financialStructurePeerComparison?: FinancialStructurePeerComparison | null;
  fundamentalMatrix?: FullFundamentalComparisonMatrix | null;
  peerPercentileDetailTable?: PeerPercentileDetailTableType | null;
}) {
  const [selectedMatrixSection, setSelectedMatrixSection] =
    useState<FundamentalComparisonMatrixSectionKey | null>(null);
  const activeDetailCategory = useMemo(() => {
    if (!selectedMatrixSection) return null;
    return selectedMatrixSection === 'peerPosition' ? 'financialStructure' : selectedMatrixSection;
  }, [selectedMatrixSection]);

  const basisLabel = peerComparison
    ? `${peerComparison.basis === 'industry' ? 'industry' : 'sector'} · ${peerComparison.groupLabel}`
    : fundamentals.kind === 'etf'
      ? 'ETF / 不適用'
      : '同組比較不可用';

  const sampleLabel = peerComparison ? `${peerComparison.peerCount} 檔` : '—';
  const comparisonCoverage = peerComparison?.dataCoverage ?? 'insufficient';

  return (
    <div className="p-3 rounded-lg bg-muted/20 border border-border/20 space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h4 className="text-xs font-medium flex items-center gap-1">
            <FileText className="h-3 w-3 text-primary" /> 基本面研究卡
          </h4>
          <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{overlay.summary}</p>
        </div>
        <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${overlayToneClass(overlay.riskLevel)}`}>
          {overlayLabel(overlay.riskLevel)}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <MetaCard
          icon={<Users className="h-3 w-3 text-primary" />}
          title="比較基準"
          value={basisLabel}
          note={comparisonCoverageLabel(comparisonCoverage)}
        />
        <MetaCard
          icon={<BarChart3 className="h-3 w-3 text-primary" />}
          title="同組樣本"
          value={sampleLabel}
          note={peerComparison ? peerComparison.summary : '目前缺少足夠的同組資料。'}
        />
        <MetaCard
          icon={<FileText className="h-3 w-3 text-primary" />}
          title="基本面覆蓋"
          value={fundamentals.dataCoverage === 'full' ? '完整' : fundamentals.dataCoverage === 'limited' ? '有限' : '不足'}
          note={fundamentals.kind === 'etf' ? 'ETF 僅做有限基本面解讀。' : fundamentals.summary}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <ContextBlock
          icon={<TrendingUp className="h-4 w-4 text-emerald-500" />}
          title="成長脈絡"
          text={overlay.growthContext}
        />
        <ContextBlock
          icon={<DollarSign className="h-4 w-4 text-amber-500" />}
          title="估值脈絡"
          text={overlay.valuationContext}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <MiniMetric
          icon={<TrendingUp className="h-3 w-3 text-primary" />}
          title="營收"
          values={[
            metricLine('月份', fundamentals.revenue.latestMonth ?? '—'),
            metricLine('YoY', formatSignedPercent(fundamentals.revenue.yoyGrowth)),
            metricLine('趨勢', fundamentals.revenue.trend),
          ]}
        />
        <MiniMetric
          icon={<FileText className="h-3 w-3 text-primary" />}
          title="獲利"
          values={[
            metricLine('期間', fundamentals.profitability.latestPeriod ?? '—'),
            metricLine('EPS', formatNumber(fundamentals.profitability.eps)),
            metricLine('毛利率', formatPercent(fundamentals.profitability.grossMargin)),
          ]}
        />
        <MiniMetric
          icon={<DollarSign className="h-3 w-3 text-primary" />}
          title="估值"
          values={[
            metricLine('P/E', formatNumber(fundamentals.valuation.pe)),
            metricLine('P/B', formatNumber(fundamentals.valuation.pb)),
            metricLine('殖利率', formatPercent(fundamentals.valuation.dividendYield)),
          ]}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <SummaryList
          title="相對優勢"
          icon={<Shield className="h-4 w-4 text-emerald-500" />}
          items={overlay.strengths}
          emptyText="目前沒有明確的同組相對優勢。"
          tone="positive"
        />
        <SummaryList
          title="壓力"
          icon={<AlertTriangle className="h-4 w-4 text-amber-500" />}
          items={overlay.pressures}
          emptyText="目前沒有明確的估值 / 基本面壓力。"
          tone="risk"
        />
      </div>

      {fundamentalMatrix && (
        <FundamentalComparisonMatrix
          matrix={fundamentalMatrix}
          title="完整基本面研究矩陣"
          compact
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
          compact
          maxRows={selectedMatrixSection ? undefined : 6}
          activeCategory={activeDetailCategory}
        />
      )}

      {cashflowLeverageOverlay && (
        <div className="rounded-lg border border-border/20 bg-background/50 p-3 space-y-3">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <div className="text-xs font-medium">現金流 / 財務槓桿觀察</div>
              <p className="mt-1 text-[11px] text-muted-foreground leading-relaxed">
                {cashflowLeverageOverlay.summary}
              </p>
            </div>
            <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${cashflowToneClass(cashflowLeverageOverlay.riskLevel)}`}>
              {cashflowOverlayLabel(cashflowLeverageOverlay.riskLevel)}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <ContextBlock
              icon={<TrendingUp className="h-4 w-4 text-cyan-500" />}
              title="現金流脈絡"
              text={cashflowLeverageOverlay.cashflowContext}
            />
            <ContextBlock
              icon={<Shield className="h-4 w-4 text-violet-500" />}
              title="槓桿 / 流動性脈絡"
              text={cashflowLeverageOverlay.leverageContext}
            />
          </div>
        </div>
      )}

      {capitalEfficiencyOverlay && (
        <div className="rounded-lg border border-border/20 bg-background/50 p-3 space-y-3">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <div className="text-xs font-medium">資本效率 / 獲利品質觀察</div>
              <p className="mt-1 text-[11px] text-muted-foreground leading-relaxed">
                {capitalEfficiencyOverlay.summary}
              </p>
            </div>
            <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${capitalToneClass(capitalEfficiencyOverlay.riskLevel)}`}>
              {capitalOverlayLabel(capitalEfficiencyOverlay.riskLevel)}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <ContextBlock
              icon={<BarChart3 className="h-4 w-4 text-sky-500" />}
              title="資本效率脈絡"
              text={capitalEfficiencyOverlay.efficiencyContext}
            />
            <ContextBlock
              icon={<FileText className="h-4 w-4 text-emerald-500" />}
              title="獲利效率脈絡"
              text={capitalEfficiencyOverlay.profitabilityContext}
            />
            <ContextBlock
              icon={<TrendingUp className="h-4 w-4 text-cyan-500" />}
              title="轉現品質脈絡"
              text={capitalEfficiencyOverlay.conversionContext}
            />
          </div>
        </div>
      )}

      {financialStructurePeerComparison && (
        <div className="rounded-lg border border-border/20 bg-background/50 p-3 space-y-3">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <div className="text-xs font-medium">財務結構 / 效率同組比較</div>
              <p className="mt-1 text-[11px] text-muted-foreground leading-relaxed">
                {financialStructurePeerComparison.summary}
              </p>
            </div>
            <span className="inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
              {peerComparisonBadgeLabel(financialStructurePeerComparison.dataCoverage)}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <MetaCard
              icon={<Users className="h-3 w-3 text-primary" />}
              title="結構比較基準"
              value={financialStructureBasisLabel(financialStructurePeerComparison)}
              note={financialStructurePeerComparison.basis === 'none'
                ? '目前未建立可靠 peer group。'
                : '以財務體質與效率指標做同組相對位置比較。'}
            />
            <MetaCard
              icon={<BarChart3 className="h-3 w-3 text-primary" />}
              title="結構同組樣本"
              value={`${financialStructurePeerComparison.peerSampleSize} 檔`}
              note={financialStructurePeerComparison.limitations[0] ?? '同組樣本可用。'}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <SummaryList
              title="同組支撐"
              icon={<Shield className="h-4 w-4 text-emerald-500" />}
              items={financialStructurePeerComparison.strengths.slice(0, 2)}
              emptyText="目前沒有明確的同組財務體質支撐。"
              tone="positive"
            />
            <SummaryList
              title="同組壓力"
              icon={<AlertTriangle className="h-4 w-4 text-amber-500" />}
              items={financialStructurePeerComparison.pressures.slice(0, 2)}
              emptyText="目前沒有明確的同組財務結構壓力。"
              tone="risk"
            />
          </div>
        </div>
      )}

      {overlay.limitations.length > 0 && (
        <div className="rounded-lg border border-border/20 bg-muted/10 p-3">
          <div className="text-xs font-medium text-muted-foreground">解讀限制</div>
          <ul className="mt-2 space-y-1">
            {overlay.limitations.slice(0, 4).map((item) => (
              <li key={item} className="text-[11px] text-muted-foreground">
                • {item}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function financialStructureBasisLabel(comparison: FinancialStructurePeerComparison): string {
  if (comparison.basis === 'none' || !comparison.groupLabel) return '同組比較不可用';
  return `${comparison.basis === 'industry' ? 'industry' : 'sector'} · ${comparison.groupLabel}`;
}

function peerComparisonBadgeLabel(coverage: FinancialStructurePeerComparison['dataCoverage']): string {
  switch (coverage) {
    case 'full':
      return '結構比較完整';
    case 'limited':
      return '結構比較有限';
    case 'insufficient':
    default:
      return '結構比較不足';
  }
}

function MetaCard({
  icon,
  title,
  value,
  note,
}: {
  icon: React.ReactNode;
  title: string;
  value: string;
  note: string;
}) {
  return (
    <div className="rounded-lg border border-border/20 bg-background/50 p-2.5">
      <div className="flex items-center gap-1.5 text-xs font-medium mb-2">
        {icon}
        {title}
      </div>
      <div className="text-sm font-medium">{value}</div>
      <div className="mt-1 text-[11px] text-muted-foreground leading-relaxed">{note}</div>
    </div>
  );
}

function ContextBlock({
  icon,
  title,
  text,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-lg border border-border/20 bg-background/50 p-3">
      <div className="flex items-center gap-2 text-xs font-medium">
        {icon}
        {title}
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground leading-relaxed">{text}</p>
    </div>
  );
}

function MiniMetric({
  icon,
  title,
  values,
}: {
  icon: React.ReactNode;
  title: string;
  values: Array<{ label: string; value: string }>;
}) {
  return (
    <div className="rounded-lg border border-border/20 bg-background/50 p-2.5">
      <div className="flex items-center gap-1.5 text-xs font-medium mb-2">
        {icon}
        {title}
      </div>
      <div className="space-y-1.5">
        {values.map((item) => (
          <div key={item.label} className="flex items-center justify-between gap-2 text-[11px]">
            <span className="text-muted-foreground">{item.label}</span>
            <span className="font-mono">{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SummaryList({
  title,
  icon,
  items,
  emptyText,
  tone,
}: {
  title: string;
  icon: React.ReactNode;
  items: string[];
  emptyText: string;
  tone: 'positive' | 'risk';
}) {
  const itemTone =
    tone === 'positive'
      ? 'text-emerald-700 dark:text-emerald-300'
      : 'text-amber-700 dark:text-amber-300';

  return (
    <div className="rounded-lg border border-border/20 bg-background/50 p-3">
      <div className="flex items-center gap-2 text-xs font-medium">
        {icon}
        {title}
      </div>
      {items.length > 0 ? (
        <ul className="mt-2 space-y-1">
          {items.map((item) => (
            <li key={item} className={`text-[11px] ${itemTone}`}>
              • {item}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-[11px] text-muted-foreground">{emptyText}</p>
      )}
    </div>
  );
}

function overlayLabel(riskLevel: FundamentalRiskOverlay['riskLevel']): string {
  switch (riskLevel) {
    case 'low':
      return '基本面低風險';
    case 'moderate':
      return '基本面中性';
    case 'elevated':
      return '基本面壓力';
    case 'high':
      return '基本面高風險';
    case 'unknown':
    default:
      return '基本面未知';
  }
}

function overlayToneClass(riskLevel: FundamentalRiskOverlay['riskLevel']): string {
  switch (riskLevel) {
    case 'low':
      return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300';
    case 'moderate':
      return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
    case 'elevated':
      return 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300';
    case 'high':
      return 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300';
    case 'unknown':
    default:
      return 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400';
  }
}

function cashflowOverlayLabel(riskLevel: CashflowLeverageOverlay['riskLevel']): string {
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

function cashflowToneClass(riskLevel: CashflowLeverageOverlay['riskLevel']): string {
  switch (riskLevel) {
    case 'low':
      return 'bg-cyan-100 text-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-300';
    case 'moderate':
      return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
    case 'elevated':
      return 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300';
    case 'high':
      return 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300';
    case 'unknown':
    default:
      return 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400';
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

function capitalToneClass(riskLevel: CapitalEfficiencyOverlay['riskLevel']): string {
  switch (riskLevel) {
    case 'low':
      return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300';
    case 'moderate':
      return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
    case 'elevated':
      return 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300';
    case 'high':
      return 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300';
    case 'unknown':
    default:
      return 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400';
  }
}

function comparisonCoverageLabel(coverage: StockPeerComparison['dataCoverage'] | 'insufficient'): string {
  switch (coverage) {
    case 'full':
      return '同組比較資料完整';
    case 'limited':
      return '同組比較資料有限';
    case 'insufficient':
    default:
      return '同組比較資料不足';
  }
}

function metricLine(label: string, value: string) {
  return { label, value };
}

function formatNumber(value: number | null): string {
  if (value === null || Number.isNaN(value)) return '—';
  return value.toFixed(2);
}

function formatPercent(value: number | null): string {
  if (value === null || Number.isNaN(value)) return '—';
  return `${value.toFixed(2)}%`;
}

function formatSignedPercent(value: number | null): string {
  if (value === null || Number.isNaN(value)) return '—';
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
}
