import { AlertTriangle, Shield } from 'lucide-react';
import { GlassCard } from '@/components/ui/glass-card';
import type { FundamentalObservationSummary } from '@/lib/report/DailyReportEngine';
import {
  fundamentalMatrixStatusLabel,
  type FundamentalMatrixSection,
} from '@/lib/fundamental/FullFundamentalComparisonMatrixBuilder';

export function DailyFundamentalObservationCard({
  summary,
}: {
  summary: FundamentalObservationSummary;
}) {
  const badgeClass =
    summary.dataCoverage === 'insufficient'
      ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300'
      : 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300';

  return (
    <GlassCard className="p-6 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">基本面觀察（研究）</h2>
          <p className="mt-1 text-sm text-muted-foreground">{summary.summary}</p>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${badgeClass}`}>
          {summary.dataCoverage === 'insufficient' ? '資料不足' : '研究觀察'}
        </span>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <ObservationList
          title="相對偏強"
          icon={<Shield className="h-4 w-4 text-emerald-500" />}
          items={summary.strongItems}
          emptyText="目前沒有明確相對偏強的 watchlist 基本面標的。"
          tone="positive"
        />
        <ObservationList
          title="估值 / 基本面壓力"
          icon={<AlertTriangle className="h-4 w-4 text-amber-500" />}
          items={summary.pressureItems}
          emptyText="目前沒有明確的 watchlist 基本面壓力標的。"
          tone="risk"
        />
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {Object.values(summary.matrixSections).map((section) => (
          <MatrixSectionCard key={section.title} section={section} />
        ))}
      </div>

      <ObservationList
        title="現金流 / 財務槓桿壓力"
        icon={<AlertTriangle className="h-4 w-4 text-rose-500" />}
        items={summary.cashflowPressureItems}
        emptyText="目前沒有明確的 watchlist 財務體質壓力標的。"
        tone="risk"
      />

      <ObservationList
        title="資本效率觀察（研究）"
        icon={<Shield className="h-4 w-4 text-sky-500" />}
        items={summary.capitalEfficiencyItems}
        emptyText="目前沒有明確需要優先檢視的 watchlist 資本效率標的。"
        tone="risk"
      />

      {summary.limitations.length > 0 && (
        <div className="rounded-lg border border-border/30 bg-muted/20 p-3">
          <h3 className="text-xs font-medium text-muted-foreground">解讀限制</h3>
          <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
            {summary.limitations.map((item) => (
              <li key={item}>• {item}</li>
            ))}
          </ul>
        </div>
      )}
    </GlassCard>
  );
}

function MatrixSectionCard({ section }: { section: FundamentalMatrixSection }) {
  return (
    <div className="rounded-lg border border-border/30 bg-muted/20 p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="text-sm font-medium">{section.title}</div>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${matrixTone(section.status)}`}>
          {fundamentalMatrixStatusLabel(section.status)}
        </span>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">{section.summary}</p>
      {section.highlights.length > 0 && (
        <ul className="space-y-1">
          {section.highlights.slice(0, 2).map((item) => (
            <li key={item} className="text-[11px] text-emerald-700 dark:text-emerald-300">• {item}</li>
          ))}
        </ul>
      )}
      {section.warnings.length > 0 && (
        <ul className="space-y-1">
          {section.warnings.slice(0, 2).map((item) => (
            <li key={item} className="text-[11px] text-amber-700 dark:text-amber-300">• {item}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function matrixTone(status: FundamentalMatrixSection['status']) {
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

function ObservationList({
  title,
  icon,
  items,
  emptyText,
  tone,
}: {
  title: string;
  icon: React.ReactNode;
  items: FundamentalObservationSummary['strongItems'];
  emptyText: string;
  tone: 'positive' | 'risk';
}) {
  const itemClass =
    tone === 'positive'
      ? 'text-emerald-700 dark:text-emerald-300'
      : 'text-amber-700 dark:text-amber-300';

  return (
    <div className="rounded-lg border border-border/30 bg-muted/20 p-3 space-y-2">
      <div className="flex items-center gap-2 text-sm font-medium">
        {icon}
        {title}
      </div>
      {items.length > 0 ? (
        <div className="space-y-2">
          {items.map((item) => (
            <div key={item.symbol} className="rounded-lg bg-background/60 p-2">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-semibold">{item.symbol}</span>
                <span className="text-xs text-muted-foreground">{item.name}</span>
              </div>
              <p className={`mt-1 text-xs ${itemClass}`}>{item.summary}</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">{emptyText}</p>
      )}
    </div>
  );
}
