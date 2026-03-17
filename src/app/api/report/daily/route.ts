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
