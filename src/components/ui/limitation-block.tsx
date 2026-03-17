/**
 * limitation-block.tsx — Shared limitation list component
 *
 * Used for page-level "資料限制說明" sections.
 * Renders a list of limitation strings with consistent styling.
 *
 * Usage:
 *   <LimitationBlock items={data.limitations} />
 *   <LimitationBlock items={c.limitations} compact />
 */

import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LimitationBlockProps {
  items: string[];
  /** Title override. Default: "資料限制說明" */
  title?: string;
  /** compact: no outer card wrapper, smaller text — for inline/detail panel use */
  compact?: boolean;
  className?: string;
}

export function LimitationBlock({ items, title, compact = false, className }: LimitationBlockProps) {
  if (items.length === 0) return null;

  const heading = title ?? (items.length > 1 ? `${items.length} 項資料限制說明` : '資料限制說明');

  if (compact) {
    return (
      <div className={cn('text-xs text-muted-foreground space-y-0.5', className)}>
        <div className="font-medium text-yellow-600 dark:text-yellow-400 flex items-center gap-1 mb-0.5">
          <AlertTriangle className="h-3 w-3 shrink-0" />
          {heading}
        </div>
        <ul className="space-y-0.5 pl-4">
          {items.map((l, i) => <li key={i}>• {l}</li>)}
        </ul>
      </div>
    );
  }

  return (
    <div className={cn(
      'rounded-lg bg-muted/20 border border-border/30 p-4',
      className
    )}>
      <h3 className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
        <AlertTriangle className="h-3.5 w-3.5 text-yellow-500 shrink-0" />
        {heading}
      </h3>
      <ul className="text-xs text-muted-foreground space-y-0.5">
        {items.map((l, i) => <li key={i}>• {l}</li>)}
      </ul>
    </div>
  );
}
