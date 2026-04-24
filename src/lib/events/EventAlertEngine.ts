import { prisma } from '@/lib/prisma';
import type { NewsEvent } from '@prisma/client';
import { generateTopicSurgeSummary } from '@/lib/events/TopicSurgeEngine';

export type EventAlertMode = 'market' | 'symbol' | 'watchlist' | 'candidates';
export type EventAlertSeverity = 'info' | 'caution' | 'warning';
export type EventAlertType =
  | 'symbol_new_event'
  | 'watchlist_new_event'
  | 'candidate_new_event'
  | 'market_event_increase'
  | 'low_trust_event_cluster'
  | 'catalyst_watch'
  | 'no_recent_event'
  | 'topic_surging'
  | 'theme_diffusing'
  | 'low_trust_theme_noise';

export interface EventAlert {
  type: EventAlertType;
  severity: EventAlertSeverity;
  title: string;
  message: string;
  relatedSymbols?: string[];
  relatedThemes?: string[];
  eventCount?: number;
  trustLevelSummary?: string;
  comparisonWindow?: string;
  limitations?: string[];
}

export interface EventAlertsResult {
  summary: string;
  alerts: EventAlert[];
  limitations: string[];
  generatedAt: string;
}

export interface GenerateEventAlertsParams {
  mode: EventAlertMode;
  symbol?: string;
  days?: number;
  minSeverity?: EventAlertSeverity;
  candidateSymbols?: string[];
  watchlistSymbols?: string[];
}

interface ParsedEvent {
  title: string;
  publishedAt: Date;
  trustLevel: 'official' | 'mainstream' | 'secondary' | 'unknown';
  relatedSymbols: string[];
  relatedThemes: string[];
}

interface TrustStats {
  official: number;
  mainstream: number;
  secondary: number;
  unknown: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const SEVERITY_RANK: Record<EventAlertSeverity, number> = { info: 0, caution: 1, warning: 2 };

function parseStringArray(value: string): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string').map((v) => v.toUpperCase()) : [];
  } catch {
    return [];
  }
}

function mapNewsEvent(row: NewsEvent): ParsedEvent {
  const relatedSymbols = parseStringArray(row.relatedSymbols);
  const relatedThemes = parseStringArray(row.relatedThemes).map((s) => s.toLowerCase());
  const trustLevel =
    row.trustLevel === 'official' || row.trustLevel === 'mainstream' || row.trustLevel === 'secondary'
      ? row.trustLevel
      : 'unknown';
  return {
    title: row.title,
    publishedAt: row.publishedAt,
    trustLevel,
    relatedSymbols,
    relatedThemes,
  };
}

function trustStats(events: ParsedEvent[]): TrustStats {
  return events.reduce<TrustStats>(
    (acc, event) => {
      acc[event.trustLevel] += 1;
      return acc;
    },
    { official: 0, mainstream: 0, secondary: 0, unknown: 0 },
  );
}

function trustSummaryText(stats: TrustStats): string {
  return `official ${stats.official} / mainstream ${stats.mainstream} / secondary ${stats.secondary} / unknown ${stats.unknown}`;
}

function lowTrustRatio(stats: TrustStats): number {
  const total = stats.official + stats.mainstream + stats.secondary + stats.unknown;
  if (total === 0) return 0;
  return (stats.secondary + stats.unknown) / total;
}

function getTopThemes(events: ParsedEvent[], limit = 5): string[] {
  const freq = new Map<string, number>();
  for (const ev of events) {
    for (const theme of ev.relatedThemes) {
      freq.set(theme, (freq.get(theme) ?? 0) + 1);
    }
  }
  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([theme]) => theme);
}

function summarize(alerts: EventAlert[], limitations: string[], mode: EventAlertMode): string {
  if (alerts.length === 0) {
    if (limitations.length > 0) return '事件提醒資料有限，僅提供降級摘要。';
    return mode === 'symbol' ? '近期未偵測到可用事件提醒。' : '近期未偵測到明確事件變化提醒。';
  }
  const warningCount = alerts.filter((a) => a.severity === 'warning').length;
  const cautionCount = alerts.filter((a) => a.severity === 'caution').length;
  if (warningCount > 0) return `偵測到 ${alerts.length} 則事件提醒（含 ${warningCount} 則 warning），請保守解讀。`;
  if (cautionCount > 0) return `偵測到 ${alerts.length} 則事件提醒（含 ${cautionCount} 則 caution），供研究追蹤。`;
  return `偵測到 ${alerts.length} 則事件提醒，屬研究層補充資訊。`;
}

async function resolveModeSymbols(params: GenerateEventAlertsParams, limitations: string[]): Promise<string[] | null> {
  if (params.mode === 'market') return null;
  if (params.mode === 'symbol') {
    const symbol = params.symbol?.trim().toUpperCase();
    if (!symbol) {
      limitations.push('symbol mode 需要提供 symbol');
      return [];
    }
    return [symbol];
  }
  if (params.mode === 'watchlist') {
    if (params.watchlistSymbols && params.watchlistSymbols.length > 0) {
      return [...new Set(params.watchlistSymbols.map((s) => s.toUpperCase()))];
    }
    const rows = await prisma.watchlist.findMany({ select: { stockId: true } });
    return [...new Set(rows.map((r) => r.stockId.toUpperCase()))];
  }
  if (params.candidateSymbols && params.candidateSymbols.length > 0) {
    return [...new Set(params.candidateSymbols.map((s) => s.toUpperCase()))];
  }
  const latest = await prisma.dailyCandidateSnapshot.findFirst({
    orderBy: { snapshotDate: 'desc' },
    select: { snapshotDate: true },
  });
  if (!latest?.snapshotDate) return [];
  const rows = await prisma.dailyCandidateSnapshot.findMany({
    where: {
      snapshotDate: latest.snapshotDate,
      screenBucket: { in: ['Strong Candidate', 'Watch'] },
    },
    select: { symbol: true },
  });
  return [...new Set(rows.map((r) => r.symbol.toUpperCase()))];
}

function filterBySymbols(events: ParsedEvent[], symbols: string[] | null): ParsedEvent[] {
  if (!symbols || symbols.length === 0) return events;
  const set = new Set(symbols);
  return events.filter((ev) => ev.relatedSymbols.some((s) => set.has(s)));
}

function countBySymbol(events: ParsedEvent[], symbols: string[]): Map<string, number> {
  const symbolSet = new Set(symbols);
  const map = new Map<string, number>();
  for (const event of events) {
    const hits = event.relatedSymbols.filter((s) => symbolSet.has(s));
    for (const symbol of hits) {
      map.set(symbol, (map.get(symbol) ?? 0) + 1);
    }
  }
  return map;
}

function selectSeverityByTrust(eventCount: number, lowTrust: number): EventAlertSeverity {
  if (eventCount >= 4 && lowTrust < 0.5) return 'caution';
  if (eventCount >= 3 && lowTrust >= 0.8) return 'warning';
  if (eventCount >= 2 || lowTrust >= 0.6) return 'caution';
  return 'info';
}

export async function generateEventAlerts(params: GenerateEventAlertsParams): Promise<EventAlertsResult> {
  const mode = params.mode;
  const days = Math.min(Math.max(params.days ?? 1, 1), 7);
  const minSeverity = params.minSeverity ?? 'info';
  const minRank = SEVERITY_RANK[minSeverity];
  const limitations: string[] = [];
  const comparisonWindow = `recent ${days}d vs previous ${days}d`;

  try {
    const symbols = await resolveModeSymbols(params, limitations);
    if (symbols && symbols.length === 0 && mode !== 'symbol') {
      limitations.push('目標股票清單為空，無法產生事件提醒。');
      return {
        summary: '無可用目標清單，事件提醒暫無資料。',
        alerts: [],
        limitations,
        generatedAt: new Date().toISOString(),
      };
    }

    const now = new Date();
    const recentStart = new Date(now.getTime() - days * DAY_MS);
    const prevStart = new Date(recentStart.getTime() - days * DAY_MS);

    const [recentRows, previousRows, earlierRows] = await Promise.all([
      prisma.newsEvent.findMany({
        where: { publishedAt: { gte: recentStart, lt: now } },
        orderBy: { publishedAt: 'desc' },
        take: 400,
      }),
      prisma.newsEvent.findMany({
        where: { publishedAt: { gte: prevStart, lt: recentStart } },
        orderBy: { publishedAt: 'desc' },
        take: 400,
      }),
      prisma.newsEvent.findMany({
        where: { publishedAt: { lt: prevStart } },
        orderBy: { publishedAt: 'desc' },
        take: 80,
      }),
    ]);

    const recentEvents = filterBySymbols(recentRows.map(mapNewsEvent), symbols);
    const previousEvents = filterBySymbols(previousRows.map(mapNewsEvent), symbols);
    const earlierEvents = filterBySymbols(earlierRows.map(mapNewsEvent), symbols);
    const comparisonAvailable = previousEvents.length > 0 || earlierEvents.length > 0;
    if (!comparisonAvailable) {
      limitations.push('無前期可比較事件資料，變化提醒已降級為存在性提醒。');
    }

    const recentStats = trustStats(recentEvents);
    const recentLowTrust = lowTrustRatio(recentStats);
    const recentCount = recentEvents.length;
    const previousCount = previousEvents.length;
    const alerts: EventAlert[] = [];

    if (mode === 'symbol' && symbols && symbols.length === 1) {
      const symbol = symbols[0];
      if (recentCount > 0 && (!comparisonAvailable || recentCount > previousCount)) {
        alerts.push({
          type: 'symbol_new_event',
          severity: selectSeverityByTrust(recentCount, recentLowTrust),
          title: `${symbol} 近期出現新事件`,
          message: `比較窗口內事件數為 ${recentCount}，主要作為研究追蹤，非交易指令。`,
          relatedSymbols: [symbol],
          relatedThemes: getTopThemes(recentEvents),
          eventCount: recentCount,
          trustLevelSummary: trustSummaryText(recentStats),
          comparisonWindow,
          limitations: recentLowTrust >= 0.7 ? ['來源偏低可信度，需保守解讀'] : [],
        });
      } else if (recentCount === 0) {
        alerts.push({
          type: 'no_recent_event',
          severity: 'info',
          title: `${symbol} 近期無事件資料`,
          message: '目前未偵測到近期事件，可視為研究資料補充不足。',
          relatedSymbols: [symbol],
          eventCount: 0,
          comparisonWindow,
        });
      }
    }

    if (mode === 'watchlist' || mode === 'candidates') {
      const activeSymbols = symbols ?? [];
      const recentMap = countBySymbol(recentEvents, activeSymbols);
      const prevMap = countBySymbol(previousEvents, activeSymbols);
      const changedSymbols = activeSymbols.filter((s) => (recentMap.get(s) ?? 0) > (prevMap.get(s) ?? 0));
      const totalChangedCount = changedSymbols.reduce((acc, s) => acc + (recentMap.get(s) ?? 0), 0);

      if (changedSymbols.length > 0) {
        alerts.push({
          type: mode === 'watchlist' ? 'watchlist_new_event' : 'candidate_new_event',
          severity: selectSeverityByTrust(totalChangedCount, recentLowTrust),
          title: mode === 'watchlist' ? 'Watchlist 股票出現新事件' : 'Candidate 股票出現新事件',
          message: `${changedSymbols.length} 檔股票出現事件增量，請以研究角度追蹤，不代表交易信號。`,
          relatedSymbols: changedSymbols.slice(0, 10),
          relatedThemes: getTopThemes(recentEvents),
          eventCount: totalChangedCount,
          trustLevelSummary: trustSummaryText(recentStats),
          comparisonWindow,
          limitations: recentLowTrust >= 0.7 ? ['事件來源以 secondary/unknown 為主，可信度有限'] : [],
        });
      }

      const catalystSymbols = activeSymbols.filter((s) => {
        const nowCount = recentMap.get(s) ?? 0;
        const prevCount = prevMap.get(s) ?? 0;
        return nowCount >= 3 && nowCount > prevCount;
      });
      if (catalystSymbols.length > 0) {
        alerts.push({
          type: 'catalyst_watch',
          severity: recentLowTrust >= 0.7 ? 'info' : 'caution',
          title: '催化劑觀察事件增加',
          message: `${catalystSymbols.length} 檔股票事件數達催化劑觀察門檻，僅供研究追蹤。`,
          relatedSymbols: catalystSymbols.slice(0, 8),
          relatedThemes: getTopThemes(recentEvents),
          comparisonWindow,
          trustLevelSummary: trustSummaryText(recentStats),
          limitations: ['催化劑觀察不等同於買進或賣出建議'],
        });
      }
    }

    if (mode === 'market') {
      if (!comparisonAvailable && recentCount === 0) {
        alerts.push({
          type: 'no_recent_event',
          severity: 'info',
          title: '市場近期事件不足',
          message: '目前事件資料不足，無法形成有效事件變化提醒。',
          eventCount: 0,
          comparisonWindow,
        });
      }

      if (comparisonAvailable && recentCount >= previousCount + Math.max(2, Math.ceil(previousCount * 0.5))) {
        alerts.push({
          type: 'market_event_increase',
          severity: recentLowTrust >= 0.7 ? 'caution' : recentCount >= previousCount + 6 ? 'warning' : 'caution',
          title: '市場事件量增加',
          message: `事件數由 ${previousCount} 增至 ${recentCount}，顯示事件討論熱度上升，請保守追蹤。`,
          relatedThemes: getTopThemes(recentEvents),
          eventCount: recentCount,
          trustLevelSummary: trustSummaryText(recentStats),
          comparisonWindow,
          limitations: ['事件增加僅代表資訊活躍度變化，不代表價格方向'],
        });
      }

      if (comparisonAvailable && recentCount > previousCount && recentCount >= 3 && recentLowTrust >= 0.7) {
        alerts.push({
          type: 'low_trust_event_cluster',
          severity: recentCount >= previousCount + 5 ? 'warning' : 'caution',
          title: '低可信度事件群聚',
          message: '事件量增加但來源多為 secondary/unknown，需更保守解讀。',
          relatedThemes: getTopThemes(recentEvents),
          eventCount: recentCount,
          trustLevelSummary: trustSummaryText(recentStats),
          comparisonWindow,
          limitations: ['低可信度來源不得視為強訊號'],
        });
      }

      try {
        const topicSummary = await generateTopicSurgeSummary({
          days: Math.max(3, days),
          minSurgeLevel: 'watch',
          includeSymbols: true,
          maxTopics: 3,
        });
        for (const topic of topicSummary.topics) {
          if (topic.surgeLevel !== 'none') {
            alerts.push({
              type: 'topic_surging',
              severity: topic.surgeLevel === 'surging' ? 'caution' : 'info',
              title: `主題升溫：${topic.topic}`,
              message: `主題提及 ${topic.previousCount} → ${topic.recentCount}，目前為 ${topic.diffusionLevel}。`,
              relatedSymbols: topic.relatedSymbols,
              eventCount: topic.recentCount,
              trustLevelSummary: topic.trustLevelSummary,
              comparisonWindow,
              limitations: topic.limitations,
            });
          }
          if (topic.diffusionLevel !== 'single-stock theme' && topic.surgeLevel !== 'none') {
            alerts.push({
              type: 'theme_diffusing',
              severity: topic.diffusionLevel === 'broadening theme' ? 'caution' : 'info',
              title: `題材擴散：${topic.topic}`,
              message: `已呈現 ${topic.diffusionLevel}，涉及 ${topic.relatedSymbols.length} 檔股票。`,
              relatedSymbols: topic.relatedSymbols,
              eventCount: topic.recentCount,
              trustLevelSummary: topic.trustLevelSummary,
              comparisonWindow,
              limitations: ['題材擴散僅供研究追蹤，非交易指令'],
            });
          }
          if (/次級或未知|low-trust|secondary\/unknown/i.test(topic.trustLevelSummary) && topic.surgeLevel !== 'none') {
            alerts.push({
              type: 'low_trust_theme_noise',
              severity: 'caution',
              title: `低信源主題雜訊：${topic.topic}`,
              message: '主題升溫主要來自低可信來源，請保守解讀。',
              relatedSymbols: topic.relatedSymbols,
              eventCount: topic.recentCount,
              trustLevelSummary: topic.trustLevelSummary,
              comparisonWindow,
              limitations: ['低信源主題不得視為高可信市場訊號'],
            });
          }
        }
        limitations.push(...topicSummary.limitations.map((l) => `[topic] ${l}`));
      } catch {
        limitations.push('topic surge 提醒暫時不可用（已降級）');
      }
    }

    const finalAlerts = alerts
      .filter((a) => SEVERITY_RANK[a.severity] >= minRank)
      .sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity]);

    if (recentCount > 0 && recentLowTrust >= 0.9) {
      limitations.push('當期事件幾乎全為低可信度來源，已強制保守提醒。');
    }

    return {
      summary: summarize(finalAlerts, limitations, mode),
      alerts: finalAlerts,
      limitations,
      generatedAt: new Date().toISOString(),
    };
  } catch (error) {
    return {
      summary: '事件提醒暫時不可用（已降級）。',
      alerts: [],
      limitations: [
        '事件資料查詢失敗，已回傳降級結構',
        error instanceof Error ? error.message : 'unknown error',
      ],
      generatedAt: new Date().toISOString(),
    };
  }
}

export const EventAlertEngine = {
  generateEventAlerts,
};
