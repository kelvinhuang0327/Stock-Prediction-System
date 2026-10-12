/**
 * EventSourceQualityEngine
 *
 * Research-only guardrail for event source quality assessment.
 * Determines whether event research conclusions are backed by real RSS sources
 * or dominated by simulation (mock) data.
 *
 * HARD LIMITS:
 * - Does NOT modify alphaScore, recommendationBucket, or any core scoring.
 * - Does NOT treat mock events as real event support.
 * - Does NOT produce trading signals.
 * - Only provides confidence labels for the research / UI layer.
 */

import type { EventRecord } from '@/lib/events/EventIngestionService';

// ─── Types ────────────────────────────────────────────────────────────────────

export type EventSourceQualityLabel =
  | 'LIVE_CONFIDENT'
  | 'MIXED_SOURCE'
  | 'SIMULATION_DOMINATED'
  | 'INSUFFICIENT_EVENT_DATA';

export type EventConfidenceAdjustment = 'NONE' | 'LOWER' | 'STRONGLY_LOWER';

export interface EventTrustLevelBreakdown {
  official: number;
  mainstream: number;
  secondary: number;
  unknown: number;
}

export interface EventSourceQuality {
  totalEvents: number;
  rssCount: number;
  mockCount: number;
  rssRatio: number;
  mockRatio: number;
  trustLevelBreakdown: EventTrustLevelBreakdown;
  qualityLabel: EventSourceQualityLabel;
  confidenceAdjustment: EventConfidenceAdjustment;
  limitations: string[];
  explanation: string;
}

export interface EventSourceQualityInput {
  totalEvents: number;
  rssCount: number;
  mockCount: number;
  trustLevelBreakdown: EventTrustLevelBreakdown;
  /**
   * Set to false when events are loaded from the DB (sourceType is hardcoded 'rss'
   * and may not reflect the original source). In that case, fall back to
   * conservative trust-level-only assessment.
   */
  sourceTypeTracked: boolean;
}

// ─── Thresholds ───────────────────────────────────────────────────────────────

const MIN_EVENTS_FOR_CONCLUSION = 3;
const MOCK_DOMINATED_THRESHOLD = 0.5; // > 50% mock → SIMULATION_DOMINATED
const MOCK_MIXED_THRESHOLD = 0.2; // > 20% mock → MIXED_SOURCE
const HIGH_TRUST_RATIO_THRESHOLD = 0.6; // >= 60% official+mainstream → high trust

// ─── Helpers ──────────────────────────────────────────────────────────────────

function highTrustRatio(breakdown: EventTrustLevelBreakdown, total: number): number {
  if (total === 0) return 0;
  return (breakdown.official + breakdown.mainstream) / total;
}

function emptyBreakdown(): EventTrustLevelBreakdown {
  return { official: 0, mainstream: 0, secondary: 0, unknown: 0 };
}

function ratioStr(r: number): string {
  return `${(r * 100).toFixed(0)}%`;
}

// ─── Core Assessment ──────────────────────────────────────────────────────────

/**
 * Assess the source quality of an event bundle given explicit counts.
 *
 * Rules (in priority order):
 * 1. totalEvents === 0 → INSUFFICIENT_EVENT_DATA
 * 2. !sourceTypeTracked → conservative trust-based assessment (cap at MIXED_SOURCE)
 * 3. totalEvents < 2 → INSUFFICIENT_EVENT_DATA
 * 4. rssCount === 0 && mockCount > 0 → SIMULATION_DOMINATED
 * 5. mockRatio > 50% → SIMULATION_DOMINATED
 * 6. mockRatio > 20% → MIXED_SOURCE
 * 7. rssCount < MIN_EVENTS_FOR_CONCLUSION → INSUFFICIENT_EVENT_DATA
 * 8. highTrustRatio >= 60% → LIVE_CONFIDENT
 * 9. otherwise → MIXED_SOURCE
 */
export function assessEventSourceQuality(input: EventSourceQualityInput): EventSourceQuality {
  const { totalEvents, rssCount, mockCount, trustLevelBreakdown, sourceTypeTracked } = input;
  const limitations: string[] = [];

  const rssRatio = totalEvents > 0 ? rssCount / totalEvents : 0;
  const mockRatio = totalEvents > 0 ? mockCount / totalEvents : 0;

  const base: Omit<EventSourceQuality, 'qualityLabel' | 'confidenceAdjustment' | 'limitations' | 'explanation'> = {
    totalEvents,
    rssCount,
    mockCount,
    rssRatio,
    mockRatio,
    trustLevelBreakdown,
  };

  // ── Rule 1: No events ──────────────────────────────────────────────────────
  if (totalEvents === 0) {
    return {
      ...base,
      qualityLabel: 'INSUFFICIENT_EVENT_DATA',
      confidenceAdjustment: 'STRONGLY_LOWER',
      limitations: ['無可用事件資料，無法形成研究結論'],
      explanation: '事件資料為空，無法評估來源品質',
    };
  }

  // ── Rule 2: Source type not tracked (DB mode) ──────────────────────────────
  if (!sourceTypeTracked) {
    limitations.push('事件資料來自資料庫快取，來源類型（RSS / 模擬）無法確認');
    if (totalEvents < MIN_EVENTS_FOR_CONCLUSION) {
      limitations.push('事件數量偏少，研究結論需保守解讀');
      return {
        ...base,
        qualityLabel: 'INSUFFICIENT_EVENT_DATA',
        confidenceAdjustment: 'LOWER',
        limitations,
        explanation: '事件數量過少且來源類型不確定，已保守降級',
      };
    }
    const htr = highTrustRatio(trustLevelBreakdown, totalEvents);
    if (htr >= HIGH_TRUST_RATIO_THRESHOLD) {
      // Good trust structure but can't confirm no mock → cap at MIXED_SOURCE
      return {
        ...base,
        qualityLabel: 'MIXED_SOURCE',
        confidenceAdjustment: 'LOWER',
        limitations,
        explanation: '事件可信度結構尚可，但來源類型（RSS/模擬）無法確認，已保守標示為 MIXED_SOURCE',
      };
    }
    limitations.push('來源可信度以次級或未分類為主');
    return {
      ...base,
      qualityLabel: 'MIXED_SOURCE',
      confidenceAdjustment: 'LOWER',
      limitations,
      explanation: '事件可信度較低且來源類型不確定，建議保守解讀',
    };
  }

  // ── Source type is reliably tracked ───────────────────────────────────────

  // Rule 3: Too few events
  if (totalEvents < 2) {
    limitations.push('事件數量過少，無法形成可信研究結論');
    return {
      ...base,
      qualityLabel: 'INSUFFICIENT_EVENT_DATA',
      confidenceAdjustment: 'STRONGLY_LOWER',
      limitations,
      explanation: '事件數量不足',
    };
  }

  // Rule 4: No RSS at all
  if (rssCount === 0 && mockCount > 0) {
    limitations.push('全部事件均為模擬來源（mock），無真實 RSS 事件');
    return {
      ...base,
      qualityLabel: 'SIMULATION_DOMINATED',
      confidenceAdjustment: 'STRONGLY_LOWER',
      limitations,
      explanation: '事件全部來自模擬來源，研究結論不應被視為真實事件支持',
    };
  }

  // Rule 5: Mock > 50%
  if (mockRatio > MOCK_DOMINATED_THRESHOLD) {
    limitations.push(`模擬事件佔 ${ratioStr(mockRatio)}，超過門檻（>50%）`);
    return {
      ...base,
      qualityLabel: 'SIMULATION_DOMINATED',
      confidenceAdjustment: 'STRONGLY_LOWER',
      limitations,
      explanation: '模擬事件佔多數，研究結論需大幅降級',
    };
  }

  // Rule 6: Mock > 20% (non-trivial mix)
  if (mockCount > 0 && mockRatio > MOCK_MIXED_THRESHOLD) {
    limitations.push(`含模擬事件 ${mockCount} 則（${ratioStr(mockRatio)}）`);
    const htr = highTrustRatio(trustLevelBreakdown, totalEvents);
    if (htr < HIGH_TRUST_RATIO_THRESHOLD) {
      limitations.push('RSS 來源缺少 official / mainstream 級別，可信度有限');
    }
    return {
      ...base,
      qualityLabel: 'MIXED_SOURCE',
      confidenceAdjustment: 'LOWER',
      limitations,
      explanation: '事件混合 RSS 與模擬資料，可顯示但需保守解讀',
    };
  }

  // ── Mostly/pure RSS from here ─────────────────────────────────────────────

  if (mockCount > 0) {
    limitations.push(`含少量模擬事件 ${mockCount} 則（${ratioStr(mockRatio)}）`);
  }

  // Rule 7: Too few RSS events
  if (rssCount < MIN_EVENTS_FOR_CONCLUSION) {
    limitations.push('RSS 事件數量偏少，尚不足以形成可信結論');
    return {
      ...base,
      qualityLabel: 'INSUFFICIENT_EVENT_DATA',
      confidenceAdjustment: 'LOWER',
      limitations,
      explanation: 'RSS 事件數量不足，無法形成可信研究結論',
    };
  }

  // Rule 8: Good RSS + good trust
  const htr = highTrustRatio(trustLevelBreakdown, totalEvents);
  if (htr >= HIGH_TRUST_RATIO_THRESHOLD) {
    return {
      ...base,
      qualityLabel: 'LIVE_CONFIDENT',
      confidenceAdjustment: 'NONE',
      limitations,
      explanation:
        mockCount === 0
          ? '事件主要來自真實 RSS 且包含較高可信度來源，可作為較可信的研究輸出'
          : 'RSS 為主且可信度結構良好，含少量模擬事件',
    };
  }

  // Rule 9: RSS but low trust structure
  limitations.push('RSS 來源以次級或未分類為主，建議保守解讀');
  return {
    ...base,
    qualityLabel: 'MIXED_SOURCE',
    confidenceAdjustment: 'LOWER',
    limitations,
    explanation: 'RSS 來源可信度較差，建議保守解讀',
  };
}

// ─── Convenience ──────────────────────────────────────────────────────────────

/**
 * Assess quality directly from an EventRecord array.
 * @param sourceTypeTracked - set false when records come from DB (sourceType hardcoded 'rss')
 */
export function assessEventSourceQualityFromRecords(
  events: EventRecord[],
  sourceTypeTracked = true,
): EventSourceQuality {
  const breakdown = emptyBreakdown();
  let rssCount = 0;
  let mockCount = 0;

  for (const ev of events) {
    if (ev.sourceType === 'rss') rssCount++;
    else if (ev.sourceType === 'mock') mockCount++;
    const level = ev.trustLevel as keyof EventTrustLevelBreakdown;
    if (level in breakdown) breakdown[level]++;
  }

  return assessEventSourceQuality({
    totalEvents: events.length,
    rssCount,
    mockCount,
    trustLevelBreakdown: breakdown,
    sourceTypeTracked,
  });
}

// ─── Degraded fallback ────────────────────────────────────────────────────────

/** Returns a conservative INSUFFICIENT quality when no input data is available. */
export function buildDegradedEventSourceQuality(reason: string): EventSourceQuality {
  return {
    totalEvents: 0,
    rssCount: 0,
    mockCount: 0,
    rssRatio: 0,
    mockRatio: 0,
    trustLevelBreakdown: emptyBreakdown(),
    qualityLabel: 'INSUFFICIENT_EVENT_DATA',
    confidenceAdjustment: 'STRONGLY_LOWER',
    limitations: [reason],
    explanation: reason,
  };
}

// ─── UI helpers ───────────────────────────────────────────────────────────────

export function getEventQualityBadgeText(label: EventSourceQualityLabel): string {
  switch (label) {
    case 'LIVE_CONFIDENT':
      return '真實事件為主';
    case 'MIXED_SOURCE':
      return '來源混合（含模擬）';
    case 'SIMULATION_DOMINATED':
      return '以模擬事件為主';
    case 'INSUFFICIENT_EVENT_DATA':
      return '事件資料不足';
  }
}

export function getEventQualityBadgeColor(label: EventSourceQualityLabel): string {
  switch (label) {
    case 'LIVE_CONFIDENT':
      return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400';
    case 'MIXED_SOURCE':
      return 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400';
    case 'SIMULATION_DOMINATED':
      return 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400';
    case 'INSUFFICIENT_EVENT_DATA':
      return 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400';
  }
}

export const EventSourceQualityEngine = {
  assessEventSourceQuality,
  assessEventSourceQualityFromRecords,
  buildDegradedEventSourceQuality,
  getEventQualityBadgeText,
  getEventQualityBadgeColor,
};
