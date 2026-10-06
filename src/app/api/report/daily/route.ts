import { NextRequest, NextResponse } from 'next/server';
import { generateDailyReport, type ReportParams } from '@/lib/report/DailyReportEngine';
import { apiCache } from '@/lib/cache';

const CACHE_KEY = 'daily-report';
const CACHE_TTL = 300; // 5 minutes

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const includeWatchlist = searchParams.get('includeWatchlist') !== 'false';
    const candidateLimit = parseInt(searchParams.get('candidateLimit') ?? '5', 10);
    const includeExcludedSummary = searchParams.get('includeExcludedSummary') === 'true';

    const cacheKey = `${CACHE_KEY}:wl=${includeWatchlist}:cl=${candidateLimit}:ex=${includeExcludedSummary}`;
    const cached = apiCache.get<ReturnType<typeof generateDailyReport>>(cacheKey);
    if (cached) {
      return NextResponse.json(cached);
    }

    const params: ReportParams = {
      includeWatchlist,
      candidateLimit: Math.min(Math.max(candidateLimit, 1), 20),
      includeExcludedSummary,
    };

    const report = await generateDailyReport(params);
    apiCache.set(cacheKey, report, CACHE_TTL);

    return NextResponse.json(report);
  } catch (error) {
    console.error('[DailyReport API] Error:', error);
    return NextResponse.json(
      {
        error: '無法產生每日報告',
        reportDate: new Date().toISOString().split('T')[0],
        marketSummary: { regime: 'Unknown', regimeConfidence: 0, summary: '報告產生失敗', keyFactors: [], limitations: ['系統錯誤'] },
        eventSummary: {
          eventCount: 0,
          rawCount: 0,
          dedupedCount: 0,
          recentThemes: [],
          catalystSummary: '事件摘要暫時不可用',
          sourceBreakdown: {},
          trustLevelSummary: { official: 0, mainstream: 0, secondary: 0, unknown: 0, dominant: 'mixed', note: '事件來源不可用' },
          limitations: ['系統錯誤'],
          dataCoverage: 'insufficient',
          recentEventTitles: [],
        },
        topicSummary: {
          summary: '主題升溫資料暫時不可用',
          topics: [],
          trendItems: [],
          limitations: ['系統錯誤'],
          generatedAt: new Date().toISOString(),
        },
        themeLinkageSummary: {
          summary: '主題連動資料暫時不可用',
          items: [],
          limitations: ['系統錯誤'],
          generatedAt: new Date().toISOString(),
        },
        crossMarketSummary: {
          summary: '主題跨板塊傳導資料暫時不可用',
          items: [],
          limitations: ['系統錯誤'],
          generatedAt: new Date().toISOString(),
        },
        signalReliabilitySummary: {
          window: 5,
          signals: [],
          generatedAt: new Date().toISOString(),
          dataNote: '訊號有效性研究資料暫時不可用',
          limitations: ['系統錯誤'],
        },
        fundamentalSummary: {
          items: [],
          highlights: [],
          risks: [],
          summary: '基本面摘要暫時不可用',
          dataCoverage: 'insufficient',
          limitations: ['系統錯誤'],
        },
        fundamentalObservationSummary: {
          summary: '基本面觀察暫時不可用',
          dataCoverage: 'insufficient',
          strongItems: [],
          pressureItems: [],
          cashflowPressureItems: [],
          capitalEfficiencyItems: [],
          limitations: ['系統錯誤'],
        },
        candidateSummary: { strongCandidates: [], watchCandidates: [], strongCount: 0, watchCount: 0, neutralCount: 0, excludedCount: 0, totalScanned: 0, keyReasons: [], limitations: ['系統錯誤'] },
        watchlistSummary: { totalItems: 0, withQuoteData: 0, topGainers: [], topLosers: [], insufficientDataItems: [], historyTrackingAvailable: false, historyNote: '報告產生失敗', limitations: ['系統錯誤'] },
        riskSummary: { overallRiskLevel: 'unknown', marketRiskContext: '無法取得', cautionNotes: ['報告產生過程發生錯誤'], dataInsufficiencyWarning: '系統錯誤' },
        dataStatusSummary: { sources: [], overallCoverage: '不足', keyLimitations: ['系統錯誤'], last_updated: new Date().toISOString() },
        disclaimer: '本報告僅供研究參考，不構成投資建議。',
        last_updated: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
