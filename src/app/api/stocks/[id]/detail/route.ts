/**
 * GET /api/stocks/[id]/detail
 *
 * Aggregated single-stock research endpoint.
 * Powers the /stocks/[symbol] drill-down page.
 *
 * Sections: header | regime | fusion | signals | backtest | candidateCtx | watchlistCtx
 * Degraded: any section that fails returns null with a limitation note.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiCache } from '@/lib/cache';
import { runScreen } from '@/lib/screen/StrategyScreenEngine';
import { detectRegime } from '@/lib/market/MarketRegimeEngine';
import {
  calculateTechnicalSignals,
  type OHLCVBar,
} from '@/lib/analysis/TechnicalSignalCalculator';

// ─── Response Types ─────────────────────────────────────────────

export interface StockDetailResponse {
  symbol: string;
  name: string;
  industry: string;
  closePrice: number;
  priceChangePercent: number;
  isETF: boolean;
  dataPoints: number;
  dataCoverage: 'full' | 'limited' | 'insufficient';
  lastUpdated: string | null;
  regime: {
    regime: string;
    confidence: number;
    dataPoints: number;
    samplePeriod: string;
    limitations: string[];
  } | null;
  fusion: {
    alphaScore: number;
    recommendationBucket: string;
    confidence: number;
    technicalScore: number;
    chipScore: number;
    fundamentalScore: number;
    marketAdjustment: number;
    usedSources: string[];
    missingSources: string[];
    riskLevel: string;
    screenBucket: string;
    whyIncluded: string;
    topFactors: string[];
    keyRisks: string[];
    summary: string;
    limitations: string[];
  } | null;
  signals: {
    signal: string;
    strength: number;
    signalDate: string;
    dataPeriod: string;
    dataPoints: number;
    watchPrice: { price: number; methodology: string };
    buyPrice: { price: number; methodology: string };
    stopLoss: { price: number; methodology: string };
    targetPrice: { price: number; methodology: string };
    indicators: { name: string; value: number | string; signal: string; description: string }[];
  } | null;
  backtest: {
    available: boolean;
    dataPoints: number;
    requiredDays: number;
    buyAndHoldReturn: number | null;
    period: string | null;
    unavailableReason: string | null;
  };
  candidateCtx: {
    isCandidate: boolean;
    screenBucket: string | null;
    whyIncluded: string | null;
    topFactors: string[];
    keyRisks: string[];
    changeTags: string[];
    snapshotDate: string | null;
  };
  watchlistCtx: {
    inWatchlist: boolean;
    watchlistId: string | null;
    holdingShares: number | null;
    holdingCost: number | null;
    label: string | null;
  };
  limitations: string[];
  disclaimer: string;
  generatedAt: string;
}

// ─── Route ─────────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const symbol = params.id.toUpperCase();
  const cacheKey = `stock:detail:${symbol}`;
  const cached = apiCache.get<StockDetailResponse>(cacheKey);
  if (cached) return NextResponse.json(cached);

  const limitations: string[] = [];

  // ── 1. Base data ──────────────────────────────────────────────
  const [stockRow, quoteRows, watchlistRow] = await Promise.all([
    prisma.stock.findUnique({ where: { id: symbol } }).catch(() => null),
    (prisma as any).stockQuote.findMany({
      where: { stockId: symbol },
      orderBy: { date: 'desc' },
      take: 252,
    }).catch(() => [] as any[]),
    (prisma as any).watchlist.findFirst({ where: { stockId: symbol } }).catch(() => null),
  ]);

  const name: string = stockRow?.name ?? symbol;
  const industry: string = stockRow?.industry ?? '';
  const isETF = /^00\d/.test(symbol) || (stockRow?.name?.includes('ETF') ?? false);
  const sortedQuotes = [...(quoteRows as any[])].sort((a, b) => a.date.localeCompare(b.date));
  const dataPoints = sortedQuotes.length;
  const lastUpdated: string | null = dataPoints > 0 ? sortedQuotes[dataPoints - 1].date : null;
  const closePrice: number = dataPoints > 0 ? sortedQuotes[dataPoints - 1].close : 0;
  const prevClose: number = dataPoints > 1 ? sortedQuotes[dataPoints - 2].close : closePrice;
  const priceChangePercent =
    prevClose > 0 ? Math.round(((closePrice - prevClose) / prevClose) * 10000) / 100 : 0;
  const dataCoverage: 'full' | 'limited' | 'insufficient' =
    dataPoints >= 200 ? 'full' : dataPoints >= 60 ? 'limited' : 'insufficient';

  if (dataPoints === 0) {
    limitations.push('此股票目前無歷史行情資料，所有分析均不可用');
  } else if (dataCoverage === 'insufficient') {
    limitations.push(`歷史資料僅 ${dataPoints} 天（需 ≥60 天才可進行技術分析）`);
  } else if (dataCoverage === 'limited') {
    limitations.push(`歷史資料 ${dataPoints} 天，部分指標（MA60 等）可能不完整`);
  }

  // ── 2. Fusion + Regime (via runScreen, single-stock universe) ──
  let fusionSection: StockDetailResponse['fusion'] = null;
  let regimeSection: StockDetailResponse['regime'] = null;

  if (dataPoints >= 20) {
    try {
      // Fetch regime detail separately (ScreenResult.regime is just a string literal)
      const regimeResult = await detectRegime().catch(() => null);
      if (regimeResult) {
        regimeSection = {
          regime: regimeResult.regime,
          confidence: regimeResult.confidence,
          dataPoints: regimeResult.dataPoints,
          samplePeriod: regimeResult.samplePeriod,
          limitations: regimeResult.limitations,
        };
      }

      const screenResult = await runScreen({
        symbolUniverse: [symbol],
        maxResults: 10,
        respectMarketRegime: true,
        includeBuckets: ['Strong Candidate', 'Watch', 'Neutral', 'Excluded'],
      });
      const candidate = screenResult.candidates.find((c) => c.symbol === symbol);
      const excluded = screenResult.excluded.find((e) => e.symbol === symbol);
      if (candidate) {
        fusionSection = {
          alphaScore: candidate.alphaScore,
          recommendationBucket: candidate.recommendationBucket,
          confidence: candidate.confidence,
          technicalScore: candidate.technicalScore,
          chipScore: candidate.chipScore,
          fundamentalScore: candidate.fundamentalScore,
          marketAdjustment: candidate.marketAdjustment,
          usedSources: candidate.usedSources,
          missingSources: candidate.missingSources,
          riskLevel: candidate.riskLevel,
          screenBucket: candidate.screenBucket,
          whyIncluded: candidate.whyIncluded,
          topFactors: candidate.topFactors,
          keyRisks: candidate.keyRisks,
          summary: candidate.summary,
          limitations: candidate.limitations,
        };
      } else {
        if (excluded) limitations.push(`此股票未進入候選池：${excluded.reason}`);
        else limitations.push('此股票未進入分析候選池（可能資料不足）');
      }
    } catch {
      limitations.push('分析引擎暫時無法執行，評分資料不可用');
    }
  } else {
    limitations.push('歷史資料少於 20 天，無法執行綜合分析');
  }

  // ── 3. Technical Signals ───────────────────────────────────────
  let signalsSection: StockDetailResponse['signals'] = null;
  if (dataPoints >= 20) {
    try {
      const bars: OHLCVBar[] = sortedQuotes.map((q: any) => ({
        close: q.close,
        high: q.high,
        low: q.low,
        volume: q.volume,
      }));
      const dateRange = {
        first: sortedQuotes[0].date,
        last: sortedQuotes[dataPoints - 1].date,
        count: dataPoints,
      };
      const sig = calculateTechnicalSignals(symbol, name, industry, closePrice, bars, dateRange);
      if (sig) {
        signalsSection = {
          signal: sig.signal,
          strength: sig.strength,
          signalDate: sig.signalDate,
          dataPeriod: sig.dataPeriod,
          dataPoints: sig.dataPoints,
          watchPrice: sig.watchPrice,
          buyPrice: sig.buyPrice,
          stopLoss: sig.stopLoss,
          targetPrice: sig.targetPrice,
          indicators: sig.indicators,
        };
      }
    } catch {
      limitations.push('技術訊號計算失敗');
    }
  }

  // ── 4. Backtest Quick Summary ──────────────────────────────────
  let backtestSection: StockDetailResponse['backtest'];
  if (dataPoints >= 100) {
    const recent = sortedQuotes.slice(-252);
    const sPrice = recent[0].close;
    const ePrice = recent[recent.length - 1].close;
    backtestSection = {
      available: true,
      dataPoints,
      requiredDays: 100,
      buyAndHoldReturn:
        sPrice > 0 ? Math.round(((ePrice - sPrice) / sPrice) * 10000) / 100 : null,
      period: `${recent[0].date} ~ ${recent[recent.length - 1].date}`,
      unavailableReason: null,
    };
  } else {
    backtestSection = {
      available: false,
      dataPoints,
      requiredDays: 100,
      buyAndHoldReturn: null,
      period: null,
      unavailableReason: `僅有 ${dataPoints} 天資料，需 ≥100 天才可回測`,
    };
  }

  // ── 5. Candidate Snapshot Context ─────────────────────────────
  let candidateCtx: StockDetailResponse['candidateCtx'] = {
    isCandidate: false,
    screenBucket: null,
    whyIncluded: null,
    topFactors: [],
    keyRisks: [],
    changeTags: [],
    snapshotDate: null,
  };
  try {
    const snap = await (prisma as any).dailyCandidateSnapshot.findFirst({
      orderBy: { date: 'desc' },
    });
    if (snap) {
      const raw = snap.content;
      const parsed = raw ? (typeof raw === 'string' ? JSON.parse(raw) : raw) : null;
      const list: any[] = parsed?.candidates ?? parsed?.data ?? [];
      const found = list.find((c: any) => c.symbol === symbol);
      if (found) {
        candidateCtx = {
          isCandidate: true,
          screenBucket: found.screenBucket ?? null,
          whyIncluded: found.whyIncluded ?? null,
          topFactors: found.topFactors ?? [],
          keyRisks: found.keyRisks ?? [],
          changeTags: found.changeTags ?? [],
          snapshotDate: snap.date,
        };
      } else {
        candidateCtx.snapshotDate = snap.date;
      }
    }
  } catch {
    /* non-critical */
  }

  // ── 6. Watchlist Context ───────────────────────────────────────
  const watchlistCtx: StockDetailResponse['watchlistCtx'] = {
    inWatchlist: !!watchlistRow,
    watchlistId: watchlistRow?.id ?? null,
    holdingShares: watchlistRow?.holdingShares ?? null,
    holdingCost: watchlistRow?.holdingCost ?? null,
    label: watchlistRow?.label ?? null,
  };

  // ── Assemble ───────────────────────────────────────────────────
  const response: StockDetailResponse = {
    symbol,
    name,
    industry,
    closePrice,
    priceChangePercent,
    isETF,
    dataPoints,
    dataCoverage,
    lastUpdated,
    regime: regimeSection,
    fusion: fusionSection,
    signals: signalsSection,
    backtest: backtestSection,
    candidateCtx,
    watchlistCtx,
    limitations,
    disclaimer:
      '本頁所有評分、訊號與分析為模型推估結果，僅供研究參考，不構成投資建議。所有結果基於規則計算，不保證未來績效。',
    generatedAt: new Date().toISOString(),
  };

  apiCache.set(cacheKey, response, 300);
  return NextResponse.json(response);
}
