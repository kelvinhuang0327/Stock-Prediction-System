import { AlertTriangle, BarChart3, Shield } from 'lucide-react';
import { GlassCard } from '@/components/ui/glass-card';
import type { DailyFundamentalSummary } from '@/lib/report/DailyFundamentalSummary';

const COVERAGE_STYLE: Record<
  DailyFundamentalSummary['dataCoverage'],
  { label: string; className: string }
> = {
  full: {
    label: '資料完整',
    className: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  },
  limited: {
    label: '資料有限',
    className: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
  },
  insufficient: {
    label: '資料不足',
    className: 'bg-rose-500/10 text-rose-700 dark:text-rose-300',
  },
};

export function DailyFundamentalSummaryCard({ summary }: { summary: DailyFundamentalSummary }) {
  const coverage = COVERAGE_STYLE[summary.dataCoverage];

  return (
    <GlassCard className="p-6 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            候選股基本面摘要
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {summary.summary}
          </p>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${coverage.className}`}>
          {coverage.label}
        </span>
      </div>

      {summary.items.length > 0 ? (
        <div className="space-y-3">
          {summary.items.map((item) => (
            <div key={item.symbol} className="rounded-xl border border-border/30 bg-muted/20 p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-semibold">{item.symbol}</span>
                    <span className="text-xs text-muted-foreground">{item.name}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{item.summary}</p>
                </div>
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] text-primary">
                  {item.dataCoverage}
                </span>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                <Metric label="營收 YoY" value={formatPct(item.revenueYoY)} />
                <Metric label="EPS" value={formatNumber(item.eps)} />
                <Metric label="PE" value={formatNumber(item.pe)} />
                <Metric label="PB" value={formatNumber(item.pb)} />
              </div>

              {item.keySignals.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {item.keySignals.map((signal) => (
                    <span
                      key={signal}
                      className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] text-emerald-700 dark:text-emerald-300"
                    >
                      + {signal}
                    </span>
                  ))}
                </div>
              )}

              {item.keyRisks.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {item.keyRisks.map((risk) => (
                    <span
                      key={risk}
                      className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-700 dark:text-amber-300"
                    >
                      ! {risk}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-border/40 px-4 py-5 text-sm text-muted-foreground">
          目前沒有可整理的候選股基本面內容。
        </div>
      )}

      {(summary.highlights.length > 0 || summary.risks.length > 0) && (
        <div className="grid gap-3 md:grid-cols-2">
          <SummaryList
            title="今日基本面亮點"
            icon={<Shield className="h-4 w-4 text-emerald-500" />}
            items={summary.highlights}
            emptyText="目前沒有明確的基本面亮點。"
            tone="positive"
          />
          <SummaryList
            title="今日基本面風險"
            icon={<AlertTriangle className="h-4 w-4 text-amber-500" />}
            items={summary.risks}
            emptyText="目前沒有明確的基本面風險。"
            tone="risk"
          />
        </div>
      )}

      {summary.limitations.length > 0 && (
        <div className="rounded-xl border border-border/30 bg-muted/20 p-3">
          <h3 className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <AlertTriangle className="h-3.5 w-3.5" />
            解讀限制
          </h3>
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
  const textClass =
    tone === 'positive'
      ? 'text-emerald-700 dark:text-emerald-300'
      : 'text-amber-700 dark:text-amber-300';

  return (
    <div className="rounded-xl border border-border/30 bg-muted/20 p-3">
      <h3 className="flex items-center gap-2 text-sm font-medium">
        {icon}
        {title}
      </h3>
      <div className="mt-2 space-y-1.5 text-xs">
        {items.length > 0 ? (
          items.map((item) => (
            <p key={item} className={textClass}>
              • {item}
            </p>
          ))
        ) : (
          <p className="text-muted-foreground">{emptyText}</p>
        )}
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-background/50 p-2">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-sm font-medium">{value}</div>
    </div>
  );
}

function formatPct(value: number | null): string {
  if (value === null) return '—';
  return `${value > 0 ? '+' : ''}${value.toFixed(1)}%`;
}

function formatNumber(value: number | null): string {
  if (value === null) return '—';
  return value.toFixed(2);
}
