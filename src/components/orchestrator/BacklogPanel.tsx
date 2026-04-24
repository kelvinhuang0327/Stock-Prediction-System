"use client";

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { GlassButton } from '@/components/ui/glass-button';
import type { BacklogItemRecord, ExecutionPolicyMode } from '@/lib/agent-orchestrator/ctoTypes';

interface BacklogPanelProps {
  items: BacklogItemRecord[];
  executionMode: ExecutionPolicyMode;
  openCount: number;
}

const PRIORITY_TONE: Record<string, string> = {
  P0: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
  P1: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
  P2: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  P3: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
};

const CATEGORY_TONE: Record<string, string> = {
  signal:    'text-cyan-400',
  regime:    'text-purple-400',
  data:      'text-blue-400',
  execution: 'text-emerald-400',
};

const MODES: ExecutionPolicyMode[] = ['strict_priority', 'balanced', 'fairness'];

export function BacklogPanel({ items, executionMode, openCount }: BacklogPanelProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<string | null>(null);
  const [currentMode, setCurrentMode] = useState<ExecutionPolicyMode>(executionMode);

  async function handleAction(findingId: string, action: 'resolve' | 'dismiss') {
    const resp = await fetch('/api/orchestrator/cto/backlog', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ findingId, action }),
    });
    const data = (await resp.json().catch(() => ({}))) as { ok?: boolean; error?: string };
    if (data.ok) {
      startTransition(() => router.refresh());
    } else {
      setStatus(`Error: ${data.error ?? 'unknown'}`);
    }
  }

  async function handleSelectBatch() {
    setStatus('Selecting batch…');
    const resp = await fetch('/api/orchestrator/cto/backlog/prioritized', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'select', batchSize: 5 }),
    });
    const data = (await resp.json().catch(() => ({}))) as { ok?: boolean; count?: number; error?: string };
    if (data.ok) {
      setStatus(`Selected ${data.count} items`);
      startTransition(() => router.refresh());
    } else {
      setStatus(`Error: ${data.error ?? 'unknown'}`);
    }
  }

  async function handleSetMode(mode: ExecutionPolicyMode) {
    const resp = await fetch('/api/orchestrator/cto/backlog/prioritized', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'set_mode', mode }),
    });
    const data = (await resp.json().catch(() => ({}))) as { ok?: boolean };
    if (data.ok) {
      setCurrentMode(mode);
      setStatus(`Mode set to ${mode}`);
    }
  }

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-white/80 uppercase tracking-wide">
          Priority Backlog
          <span className="ml-2 text-xs font-normal text-slate-400">({openCount} open)</span>
        </h2>
        <div className="flex gap-2">
          <GlassButton onClick={handleSelectBatch} disabled={isPending} className="text-xs">
            Select Batch
          </GlassButton>
        </div>
      </div>

      {/* Mode Selector */}
      <div className="flex gap-2">
        {MODES.map((m) => (
          <button
            key={m}
            onClick={() => handleSetMode(m)}
            className={`text-xs px-3 py-1 rounded-full border transition-colors ${
              currentMode === m
                ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30'
                : 'bg-white/5 text-white/40 border-white/10 hover:bg-white/10'
            }`}
          >
            {m.replace('_', ' ')}
          </button>
        ))}
      </div>

      {status && <p className="text-xs text-slate-400">{status}</p>}

      {/* Backlog Items */}
      <div className="space-y-2">
        {items.length === 0 && (
          <p className="text-xs text-slate-500 py-4 text-center">No open backlog items</p>
        )}
        {items.map((item) => (
          <div
            key={item.id}
            className="flex items-start gap-3 rounded-lg bg-white/5 border border-white/10 px-3 py-2"
          >
            {/* Priority badge */}
            <span className={`text-xs font-bold px-2 py-0.5 rounded border mt-0.5 ${PRIORITY_TONE[item.priorityLevel] ?? ''}`}>
              {item.priorityLevel}
            </span>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 text-xs">
                <span className={`font-medium ${CATEGORY_TONE[item.category] ?? 'text-white/60'}`}>
                  {item.category}
                </span>
                <span className="text-white/30">·</span>
                <span className="text-white/50">{item.severity}</span>
                {item.rank && <span className="text-white/30">#{item.rank}</span>}
              </div>
              {item.suggestedAction && (
                <div className="text-xs text-white/50 mt-0.5 truncate">{item.suggestedAction}</div>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-1 shrink-0">
              <button
                onClick={() => handleAction(item.findingId, 'resolve')}
                className="text-xs text-emerald-400 hover:text-emerald-300 px-2 py-0.5 rounded hover:bg-emerald-500/10"
              >
                resolve
              </button>
              <button
                onClick={() => handleAction(item.findingId, 'dismiss')}
                className="text-xs text-slate-500 hover:text-slate-400 px-2 py-0.5 rounded hover:bg-slate-500/10"
              >
                dismiss
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
