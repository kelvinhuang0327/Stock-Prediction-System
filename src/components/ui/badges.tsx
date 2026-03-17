/**
 * badges.tsx — Shared badge components
 *
 * StatusBadge:       success / failed / skipped / configured / not configured / ok / degraded / critical / A-D / fresh / stale
 * BucketBadge:       Strong Candidate / Watch / Neutral / Excluded / Insufficient Data / Avoid
 * AlertSeverityBadge: warning / caution / info
 *
 * Variants:
 *   'surface' (default) — light glass pattern, dark: support — for pages using GlassCard
 *   'glass'             — dark alpha + border — for dark-only pages (system health)
 */

import React from 'react';
import { cn } from '@/lib/utils';

// ─── StatusBadge ──────────────────────────────────────────────────

type StatusValue =
  | 'success' | 'failed' | 'error' | 'skipped' | 'completed'
  | 'configured' | 'not configured'
  | 'ok' | 'degraded' | 'critical'
  | 'A' | 'B' | 'C' | 'D'
  | 'fresh' | 'stale'
  | (string & {});

interface StatusBadgeProps {
  status: StatusValue;
  /** Color scheme. 'surface' uses light bg with dark: prefix; 'glass' uses alpha bg + border. */
  variant?: 'surface' | 'glass';
  /** Override display label. Default: Chinese label for known values, raw status otherwise. */
  label?: string;
  className?: string;
}

const STATUS_SURFACE: Record<string, string> = {
  success:           'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400',
  completed:         'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400',
  ok:                'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400',
  fresh:             'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400',
  A:                 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400',
  failed:            'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400',
  error:             'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400',
  critical:          'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400',
  D:                 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400',
  skipped:           'bg-gray-100 text-gray-600 dark:bg-gray-800/40 dark:text-gray-400',
  stale:             'bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400',
  degraded:          'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400',
  C:                 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400',
  configured:        'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400',
  B:                 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400',
  'not configured':  'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400',
};

const STATUS_GLASS: Record<string, string> = {
  success:           'bg-green-500/20 text-green-400 border-green-500/30',
  completed:         'bg-green-500/20 text-green-400 border-green-500/30',
  ok:                'bg-green-500/20 text-green-400 border-green-500/30',
  fresh:             'bg-green-500/20 text-green-400 border-green-500/30',
  A:                 'bg-green-500/20 text-green-400 border-green-500/30',
  failed:            'bg-red-500/20 text-red-400 border-red-500/30',
  error:             'bg-red-500/20 text-red-400 border-red-500/30',
  critical:          'bg-red-500/20 text-red-400 border-red-500/30',
  D:                 'bg-red-500/20 text-red-400 border-red-500/30',
  skipped:           'bg-gray-500/20 text-gray-400 border-gray-500/30',
  stale:             'bg-orange-500/20 text-orange-400 border-orange-500/30',
  degraded:          'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  C:                 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  configured:        'bg-blue-500/20 text-blue-400 border-blue-500/30',
  B:                 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  'not configured':  'bg-gray-500/20 text-gray-400 border-gray-500/30',
};

const STATUS_LABEL: Record<string, string> = {
  success: '✓ 成功',
  completed: '✓ 完成',
  ok: '正常',
  fresh: '新鮮',
  failed: '✗ 失敗',
  error: '✗ 錯誤',
  critical: '異常',
  skipped: '— 略過',
  stale: '過期',
  degraded: '降級',
  configured: '已設定',
  'not configured': '未設定',
};

export function StatusBadge({ status, variant = 'surface', label, className }: StatusBadgeProps) {
  const map = variant === 'glass' ? STATUS_GLASS : STATUS_SURFACE;
  const fallback = variant === 'glass'
    ? 'bg-gray-500/20 text-gray-400 border-gray-500/30'
    : 'bg-muted/50 text-muted-foreground';
  const colorCls = map[status] ?? fallback;
  const borderCls = variant === 'glass' ? 'border' : '';
  const displayLabel = label ?? STATUS_LABEL[status] ?? status;

  return (
    <span className={cn(
      'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium',
      borderCls, colorCls, className
    )}>
      {displayLabel}
    </span>
  );
}

// ─── BucketBadge ──────────────────────────────────────────────────

type BucketValue =
  | 'Strong Candidate' | 'Watch' | 'Neutral'
  | 'Excluded' | 'Insufficient Data' | 'Avoid'
  | (string & {});

interface BucketBadgeProps {
  bucket: BucketValue;
  /** 'short': condensed English label; 'full': full English; 'chinese': Chinese labels */
  labelMode?: 'short' | 'full' | 'chinese';
  size?: 'sm' | 'md';
  className?: string;
}

const BUCKET_COLOR: Record<string, string> = {
  'Strong Candidate': 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400',
  'Watch':            'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
  'Neutral':          'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  'Excluded':         'bg-gray-50 text-gray-400 dark:bg-gray-900 dark:text-gray-500',
  'Insufficient Data':'bg-gray-50 text-gray-400 dark:bg-gray-900 dark:text-gray-500',
  'Avoid':            'bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400',
};

const BUCKET_LABEL_SHORT: Record<string, string> = {
  'Strong Candidate': 'Strong',
  'Watch': 'Watch',
  'Neutral': 'Neutral',
  'Excluded': 'Excluded',
  'Insufficient Data': 'Insuf.',
  'Avoid': 'Avoid',
};

const BUCKET_LABEL_CHINESE: Record<string, string> = {
  'Strong Candidate': '強勢候選',
  'Watch': '值得觀察',
  'Neutral': '中性',
  'Excluded': '排除',
  'Insufficient Data': '資料不足',
  'Avoid': '迴避',
};

export function BucketBadge({ bucket, labelMode = 'short', size = 'sm', className }: BucketBadgeProps) {
  const colorCls = BUCKET_COLOR[bucket] ?? 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400';
  const label =
    labelMode === 'chinese' ? (BUCKET_LABEL_CHINESE[bucket] ?? bucket)
    : labelMode === 'short'  ? (BUCKET_LABEL_SHORT[bucket] ?? bucket)
    : bucket;
  const sizeCls = size === 'md' ? 'px-2.5 py-1 text-[11px]' : 'px-2 py-0.5 text-xs';

  return (
    <span className={cn(
      'inline-flex items-center rounded-full font-medium',
      sizeCls, colorCls, className
    )}>
      {label}
    </span>
  );
}

// ─── AlertSeverityBadge ───────────────────────────────────────────

type AlertSeverity = 'warning' | 'caution' | 'info';

interface AlertSeverityBadgeProps {
  severity: AlertSeverity;
  /** 'pill' (default): rounded-full, suitable for summaries; 'tag': rectangular */
  shape?: 'pill' | 'tag';
  size?: 'sm' | 'md';
  className?: string;
}

const SEVERITY_COLOR: Record<AlertSeverity, string> = {
  warning: 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400',
  caution: 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
  info:    'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400',
};

const SEVERITY_LABEL_MAP: Record<AlertSeverity, string> = {
  warning: '⚠️ 注意',
  caution: '🔶 提醒',
  info:    'ℹ️ 一般',
};

export function AlertSeverityBadge({ severity, shape = 'pill', size = 'md', className }: AlertSeverityBadgeProps) {
  const colorCls = SEVERITY_COLOR[severity] ?? 'bg-gray-100 text-gray-600';
  const shapeCls = shape === 'pill' ? 'rounded-full' : 'rounded';
  const sizeCls = size === 'md' ? 'px-3 py-1.5 text-sm' : 'px-2 py-0.5 text-xs';

  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 font-medium shrink-0',
      shapeCls, sizeCls, colorCls, className
    )}>
      {SEVERITY_LABEL_MAP[severity] ?? severity}
    </span>
  );
}
