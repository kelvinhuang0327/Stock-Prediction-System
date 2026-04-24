"use client";

import { AlertTriangle, BarChart3, CheckCircle2, CircleHelp, MinusCircle } from 'lucide-react';
import type { PeerPercentileDetailCategory } from '@/lib/fundamental/types';
import {
  fundamentalMatrixStatusLabel,
  type FullFundamentalComparisonMatrix,
  type FundamentalMatrixSection,
  type FundamentalMatrixStatus,
} from '@/lib/fundamental/FullFundamentalComparisonMatrixBuilder';

export type FundamentalComparisonMatrixSectionKey =
  | PeerPercentileDetailCategory
  | 'peerPosition';

export function FundamentalComparisonMatrix({
  matrix,
  title = '完整基本面研究矩陣',
  compact = false,
  onSectionSelect,
  selectedSectionKey,
}: {
  matrix: FullFundamentalComparisonMatrix;
  title?: string;
  compact?: boolean;
  onSectionSelect?: (key: FundamentalComparisonMatrixSectionKey) => void;
  selectedSectionKey?: FundamentalComparisonMatrixSectionKey | null;
}) {
  const sections = [
    { key: 'growth' as const, section: matrix.sections.growth },
    { key: 'valuation' as const, section: matrix.sections.valuation },
    { key: 'financialStructure' as const, section: matrix.sections.financialStructure },
    { key: 'efficiency' as const, section: matrix.sections.efficiency },
    { key: 'peerPosition' as const, section: matrix.sections.peerPosition },
  ];

  return (
    <div className="rounded-lg border border-border/30 bg-muted/10 p-3 space-y-3">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="text-sm font-medium flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" />
            {title}
          </div>
          <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
            {matrix.overallSummary}
          </p>
        </div>
      </div>

      <div className={`grid gap-3 ${compact ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3'}`}>
        {sections.map(({ key, section }) => (
          <MatrixSectionCard
            key={key}
            sectionKey={key}
            section={section}
            compact={compact}
            selected={selectedSectionKey === key}
            onSelect={onSectionSelect}
          />
        ))}
      </div>

      {matrix.limitations.length > 0 && (
        <div className="rounded-lg border border-border/20 bg-background/50 p-3">
          <div className="text-xs font-medium text-muted-foreground">矩陣限制</div>
          <ul className="mt-2 space-y-1">
            {matrix.limitations.slice(0, compact ? 3 : 5).map((item) => (
              <li key={item} className="text-[11px] text-muted-foreground">• {item}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function MatrixSectionCard({
  sectionKey,
  section,
  compact,
  selected,
  onSelect,
}: {
  sectionKey: FundamentalComparisonMatrixSectionKey;
  section: FundamentalMatrixSection;
  compact: boolean;
  selected: boolean;
  onSelect?: (key: FundamentalComparisonMatrixSectionKey) => void;
}) {
  const actionable = Boolean(onSelect);
  const className = [
    'w-full rounded-lg border p-3 space-y-2.5 text-left transition-colors',
    selected
      ? 'border-primary/60 bg-primary/5 ring-1 ring-primary/20'
      : 'border-border/20 bg-background/50',
    actionable ? 'cursor-pointer hover:border-primary/40 hover:bg-primary/5' : 'cursor-default',
  ].join(' ');

  if (!actionable) {
    return (
      <div className={className}>
        <MatrixSectionBody section={section} compact={compact} actionable={false} />
      </div>
    );
  }

  return (
    <button
      type="button"
      className={className}
      onClick={() => onSelect?.(sectionKey)}
      aria-pressed={selected}
    >
      <MatrixSectionBody section={section} compact={compact} actionable />
    </button>
  );
}

function MatrixSectionBody({
  section,
  compact,
  actionable,
}: {
  section: FundamentalMatrixSection;
  compact: boolean;
  actionable: boolean;
}) {
  return (
    <>
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-xs font-medium">{section.title}</div>
          {section.basis && (
            <div className="mt-1 text-[10px] text-muted-foreground">
              {section.basis}
              {section.peerSampleSize !== null && section.peerSampleSize !== undefined
                ? ` · ${section.peerSampleSize} 檔`
                : ''}
            </div>
          )}
        </div>
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${statusTone(section.status)}`}>
          {statusIcon(section.status)}
          {fundamentalMatrixStatusLabel(section.status)}
        </span>
      </div>

      <p className="text-[11px] text-muted-foreground leading-relaxed">{section.summary}</p>

      {!compact && section.highlights.length > 0 && (
        <MiniList title="支撐" items={section.highlights.slice(0, 2)} tone="positive" />
      )}
      {section.warnings.length > 0 && (
        <MiniList title="留意" items={section.warnings.slice(0, compact ? 1 : 2)} tone="risk" />
      )}
      {!compact && section.highlights.length === 0 && section.warnings.length === 0 && (
        <p className="text-[11px] text-muted-foreground">目前沒有額外需要前置標示的亮點或壓力。</p>
      )}
      {actionable && (
        <div className="pt-1 text-[10px] text-muted-foreground">
          點擊可對應到下方細表
        </div>
      )}
    </>
  );
}

function MiniList({
  title,
  items,
  tone,
}: {
  title: string;
  items: string[];
  tone: 'positive' | 'risk';
}) {
  const className =
    tone === 'positive'
      ? 'text-emerald-700 dark:text-emerald-300'
      : 'text-amber-700 dark:text-amber-300';

  return (
    <div>
      <div className="text-[11px] font-medium text-muted-foreground">{title}</div>
      <ul className="mt-1 space-y-1">
        {items.map((item) => (
          <li key={item} className={`text-[11px] ${className}`}>• {item}</li>
        ))}
      </ul>
    </div>
  );
}

function statusTone(status: FundamentalMatrixStatus): string {
  switch (status) {
    case 'strong':
      return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300';
    case 'neutral':
      return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
    case 'pressure':
      return 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300';
    case 'unknown':
    default:
      return 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400';
  }
}

function statusIcon(status: FundamentalMatrixStatus) {
  switch (status) {
    case 'strong':
      return <CheckCircle2 className="h-3 w-3" />;
    case 'neutral':
      return <MinusCircle className="h-3 w-3" />;
    case 'pressure':
      return <AlertTriangle className="h-3 w-3" />;
    case 'unknown':
    default:
      return <CircleHelp className="h-3 w-3" />;
  }
}
