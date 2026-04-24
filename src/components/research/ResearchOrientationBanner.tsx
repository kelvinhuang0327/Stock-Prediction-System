"use client";

import React from 'react';
import { AlertTriangle, CircleHelp, Info, ShieldAlert, Sparkles } from 'lucide-react';
import { GlassCard } from '@/components/ui/glass-card';

type BannerTone = 'info' | 'warning' | 'degraded' | 'critical' | 'success';

interface ResearchOrientationBannerProps {
  title: string;
  summary: string;
  statusLabel: string;
  tone?: BannerTone;
  bullets: string[];
  note?: string;
  compact?: boolean;
}

const TONE_STYLE: Record<BannerTone, { shell: string; badge: string; icon: React.ReactNode }> = {
  info: {
    shell: 'border-sky-200/70 bg-sky-500/5 dark:border-sky-800/40 dark:bg-sky-950/10',
    badge: 'bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300',
    icon: <Info className="h-4 w-4" />,
  },
  warning: {
    shell: 'border-amber-200/70 bg-amber-500/5 dark:border-amber-800/40 dark:bg-amber-950/10',
    badge: 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
    icon: <AlertTriangle className="h-4 w-4" />,
  },
  degraded: {
    shell: 'border-orange-200/70 bg-orange-500/5 dark:border-orange-800/40 dark:bg-orange-950/10',
    badge: 'bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300',
    icon: <CircleHelp className="h-4 w-4" />,
  },
  critical: {
    shell: 'border-red-200/70 bg-red-500/5 dark:border-red-800/40 dark:bg-red-950/10',
    badge: 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300',
    icon: <ShieldAlert className="h-4 w-4" />,
  },
  success: {
    shell: 'border-emerald-200/70 bg-emerald-500/5 dark:border-emerald-800/40 dark:bg-emerald-950/10',
    badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
    icon: <Sparkles className="h-4 w-4" />,
  },
};

export function ResearchOrientationBanner({
  title,
  summary,
  statusLabel,
  tone = 'info',
  bullets,
  note,
  compact = false,
}: ResearchOrientationBannerProps) {
  const style = TONE_STYLE[tone];

  return (
    <GlassCard className={`p-4 border ${style.shell}`}>
      <div className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${style.badge}`}>
                {style.icon}
                {statusLabel}
              </span>
              <span className="text-sm font-semibold">{title}</span>
            </div>
            <p className="text-sm text-foreground/80 leading-relaxed">{summary}</p>
          </div>
        </div>

        <div className={`grid gap-2 ${compact ? 'grid-cols-1' : 'sm:grid-cols-3'}`}>
          {bullets.slice(0, compact ? 2 : 3).map((bullet) => (
            <div key={bullet} className="rounded-lg border border-border/20 bg-background/50 px-3 py-2">
              <p className="text-xs text-muted-foreground leading-relaxed">{bullet}</p>
            </div>
          ))}
        </div>

        {note && (
          <p className="text-[11px] text-muted-foreground leading-relaxed">{note}</p>
        )}
      </div>
    </GlassCard>
  );
}
