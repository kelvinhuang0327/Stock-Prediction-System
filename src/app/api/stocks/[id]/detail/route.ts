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
import { getStockCoverage, type StockCoverage } from '@/lib/data/CoverageService';
import {
  safeCandidateSnapshotLatest,
  safeCandidateSnapshots,
} from '@/lib/prisma-safe';
import {
  buildStockFundamentalSnapshot,
  type StockFundamentalSnapshot,
} from '@/lib/fundamentals/StockFundamentalSnapshot';
import {
  type StockPeerComparison,
} from '@/lib/fundamentals/StockPeerComparison';
import {
  buildFinancialStructurePeerComparisonForSymbol,
  buildCashflowLeverageMetricsFromReports,
  buildCapitalEfficiencyMetricsFromResearchContext,
  buildPeerComparisonForSymbol,
} from '@/lib/fundamentals/FundamentalResearchService';
import { buildFundamentalRiskOverlay } from '@/lib/fundamental/FundamentalRiskOverlayEngine';
import {
  buildCashflowLeverageOverlay,
  type CashflowLeverageOverlay,
} from '@/lib/fundamental/CashflowLeverageOverlayEngine';
import {
  buildCapitalEfficiencyOverlay,
  type CapitalEfficiencyOverlay,
} from '@/lib/fundamental/CapitalEfficiencyOverlayEngine';
import type { FinancialStructurePeerComparison } from '@/lib/fundamental/FinancialStructurePeerComparisonEngine';
import {
  buildFullFundamentalComparisonMatrix,
  type FullFundamentalComparisonMatrix,
} from '@/lib/fundamental/FullFundamentalComparisonMatrixBuilder';
import {
  buildPeerPercentileDetailTable,
  type PeerPercentileDetailTable,
} from '@/lib/fundamental/PeerPercentileDetailTableBuilder';

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
  fundamentals: StockFundamentalSnapshot;
  peerComparison: StockPeerComparison | null;
  cashflowLeverageOverlay: CashflowLeverageOverlay;
  capitalEfficiencyOverlay: CapitalEfficiencyOverlay;
  financialStructurePeerComparison: FinancialStructurePeerComparison | null;
  fundamentalMatrix: FullFundamentalComparisonMatrix;
  peerPercentileDetailTable: PeerPercentileDetailTable;
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
  /** Lightweight strategy backtest summary (from /api/stocks/backtest) */
  backtestSummary: {
    available: boolean;
    strategy: string;
    totalReturn: number | null;
    buyAndHoldReturn: number | null;
    alphaToBuyAndHold: number | null;
    maxDrawdown: number | null;
    totalTrades: number | null;
    period: string | null;
    dataPoints: number;
    marketBenchmarkAvailable: boolean;
    marketReturn: number | null;
    regimeAwareAvailable: boolean;
    regimeAwareReturn: number | null;
    limitations: string[];
    unavailableReason: string | null;
  };
  /** Snapshot comparison vs previous day */
  comparison: {
    available: boolean;
    previousDate: string | null;
    currentDate: string | null;
    alphaDelta: number | null;
    previousAlpha: number | null;
    currentAlpha: number | null;
    bucketChanged: boolean;
    previousBucket: string | null;
    currentBucket: string | null;
    riskChanged: boolean;
    previousRisk: string | null;
    currentRisk: string | null;
    dataCoverageChanged: boolean;
    previousCoverage: string | null;
    newlyInsufficient: boolean;
    summaryNote: string;
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
  coverageTier: Pick<StockCoverage, 'tier' | 'tierLabel' | 'quoteDays' | 'hasChip' | 'capabilities' | 'limitations'>;
  limitations: string[];
  disclaimer: string;
  generatedAt: string;
}

// ─── Route ─────────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const symbol = id.toUpperCase();
  const cacheKey = `stock:detail:${symbol}`;
  const cached = apiCache.get<StockDetailResponse>(cacheKey);
  if (cached) return NextResponse.json(cached);

  const limitations: string[] = [];

  // ── 1. Base data ──────────────────────────────────────────────
  const [
    stockRow,
    quoteRows,
    watchlistRow,
    stockCoverage,
    revenueRows,
    financialRows,
    metricsRows,
  ] = await Promise.all([
    prisma.stock.findUnique({ where: { id: symbol } }).catch(() => null),
    prisma.stockQuote.findMany({
      where: { stockId: symbol },
      orderBy: { date: 'desc' },
      take: 252,
    }).catch(() => []),
    prisma.watchlist.findFirst({ where: { stockId: symbol } }).catch(() => null),
    getStockCoverage(symbol).catch(() => null),
    prisma.monthlyRevenue.findMany({
      where: { stockId: symbol },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
      take: 18,
    }).catch(() => []),
    prisma.financialReport.findMany({
      where: { stockId: symbol },
      orderBy: [{ year: 'desc' }, { quarter: 'desc' }],
      take: 6,
    }).catch(() => []),
    prisma.stockMetrics.findMany({
      where: { stockId: symbol },
      orderBy: { date: 'desc' },
      take: 3,
    }).catch(() => []),
  ]);

  const name: string = stockRow?.name ?? symbol;
  const industry: string = stockRow?.industry ?? '';
  const isETF = /^00\d/.test(symbol) || (stockRow?.name?.includes('ETF') ?? false);
  const sortedQuotes = [...quoteRows].sort((a, b) => a.date.localeCompare(b.date));
  const dataPoints = sortedQuotes.length;
  const lastUpdated: string | null = dataPoints > 0 ? sortedQuotes[dataPoints - 1].date : null;
  const closePrice: number = dataPoints > 0 ? sortedQuotes[dataPoints - 1].close : 0;
  const prevClose: number = dataPoints > 1 ? sortedQuotes[dataPoints - 2].close : closePrice;
  const priceChangePercent =
    prevClose > 0 ? Math.round(((closePrice - prevClose) / prevClose) * 10000) / 100 : 0;
  const dataCoverage: 'full' | 'limited' | 'insufficient' =
    dataPoints >= 200 ? 'full' : dataPoints >= 60 ? 'limited' : 'insufficient';
  const fundamentalsSection = buildStockFundamentalSnapshot({
    isETF,
    monthlyRevenues: revenueRows,
    financialReports: financialRows,
    stockMetrics: metricsRows,
  });
  const peerComparison = await buildPeerComparisonForSymbol({
    symbol,
    name,
    industry,
  }).catch(() => null);
  const financialStructurePeerComparison = await buildFinancialStructurePeerComparisonForSymbol({
    symbol,
    name,
    industry,
  }).catch(() => null);
  const structureMetrics = buildCashflowLeverageMetricsFromReports(financialRows);
  const cashflowLeverageOverlay = buildCashflowLeverageOverlay({
    fundamentals: fundamentalsSection,
    peerComparison,
    metrics: structureMetrics,
  });
  const capitalEfficiencyOverlay = buildCapitalEfficiencyOverlay({
    fundamentals: fundamentalsSection,
    peerComparison,
    cashflowLeverageOverlay,
    metrics: buildCapitalEfficiencyMetricsFromResearchContext({
      monthlyRevenues: revenueRows,
      financialReports: financialRows,
      structureMetrics,
    }),
  });
  const overlay = buildFundamentalRiskOverlay({
    fundamentals: fundamentalsSection,
    peerComparison,
  });
  const fundamentalMatrix = buildFullFundamentalComparisonMatrix({
    fundamentals: fundamentalsSection,
    peerComparison,
    overlay,
    cashflowLeverageOverlay,
    capitalEfficiencyOverlay,
    financialStructurePeerComparison,
  });
  const peerPercentileDetailTable = buildPeerPercentileDetailTable({
    fundamentals: fundamentalsSection,
    peerComparison,
    financialStructurePeerComparison,
    fundamentalMatrix,
  });

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
      const bars: OHLCVBar[] = sortedQuotes.map((q) => ({
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
    // DailyCandidateSnapshot: one row per symbol per snapshotDate
    const snap = await safeCandidateSnapshotLatest(symbol);
    if (snap) {
      candidateCtx = {
        isCandidate: true,
        screenBucket: snap.screenBucket ?? null,
        whyIncluded: snap.whyIncluded ?? null,
        topFactors: snap.topFactors ? (typeof snap.topFactors === 'string' ? JSON.parse(snap.topFactors) : snap.topFactors) : [],
        keyRisks: snap.keyRisks ? (typeof snap.keyRisks === 'string' ? JSON.parse(snap.keyRisks) : snap.keyRisks) : [],
        changeTags: [],
        snapshotDate: snap.snapshotDate,
      };
    }
  } catch {
    /* non-critical */
  }

  // ── 6. Watchlist Context ───────────────────────────────────────
  const watchlistCtx: StockDetailResponse['watchlistCtx'] = {
    inWatchlist: !!watchlistRow,
    watchlistId: watchlistRow?.id != null ? String(watchlistRow.id) : null,
    holdingShares: watchlistRow?.quantity ?? null,
    holdingCost: watchlistRow?.entryPrice ?? null,
    label: null, // no label field in current schema
  };

  // ── 7. Snapshot Comparison ────────────────────────────────────
  let comparison: StockDetailResponse['comparison'] = {
    available: false,
    previousDate: null,
    currentDate: null,
    alphaDelta: null,
    previousAlpha: null,
    currentAlpha: null,
    bucketChanged: false,
    previousBucket: null,
    currentBucket: null,
    riskChanged: false,
    previousRisk: null,
    currentRisk: null,
    dataCoverageChanged: false,
    previousCoverage: null,
    newlyInsufficient: false,
    summaryNote: '尚無前日快照可供比較',
  };
  try {
    // DailyCandidateSnapshot: per-symbol per-date rows — get last 2 dates for this symbol
    const symSnapshots = await safeCandidateSnapshots(symbol, 2);
    if (symSnapshots.length >= 2) {
      const [todayEntry, prevEntry] = symSnapshots;

      const todayAlpha: number | null = todayEntry.alphaScore ?? null;
      const prevAlpha: number | null = prevEntry.alphaScore ?? null;
      const alphaDelta = todayAlpha !== null && prevAlpha !== null ? Math.round((todayAlpha - prevAlpha) * 10) / 10 : null;

      const todayBucket: string | null = todayEntry.screenBucket ?? null;
      const prevBucket: string | null = prevEntry.screenBucket ?? null;
      const bucketChanged = todayBucket !== prevBucket && todayBucket !== null && prevBucket !== null;

      const todayRisk: string | null = fusionSection?.riskLevel ?? null;
      const prevRisk: string | null = null; // riskLevel not stored in snapshot schema
      const riskChanged = false;

      const todayCoverage: string | null = todayEntry.dataCoverage ?? dataCoverage;
      const prevCoverage: string | null = prevEntry.dataCoverage ?? null;
      const dataCoverageChanged = todayCoverage !== prevCoverage && prevCoverage !== null;
      const newlyInsufficient = dataCoverageChanged && todayCoverage === 'insufficient';

      const notes: string[] = [];
      if (alphaDelta !== null) {
        if (alphaDelta > 0) notes.push(`Alpha 評分上升 ${alphaDelta} 分`);
        else if (alphaDelta < 0) notes.push(`Alpha 評分下降 ${Math.abs(alphaDelta)} 分`);
        else notes.push('Alpha 評分持平');
      }
      if (bucketChanged) notes.push(`建議級別由 ${prevBucket} 變為 ${todayBucket}`);
      if (newlyInsufficient) notes.push('資料覆蓋轉為不足，分析需保守解讀');
      if (notes.length === 0) notes.push('與前日快照相比無重大變化');

      comparison = {
        available: true,
        previousDate: prevEntry.snapshotDate,
        currentDate: todayEntry.snapshotDate,
        alphaDelta,
        previousAlpha: prevAlpha,
        currentAlpha: todayAlpha,
        bucketChanged,
        previousBucket: prevBucket,
        currentBucket: todayBucket,
        riskChanged,
        previousRisk: prevRisk,
        currentRisk: todayRisk,
        dataCoverageChanged,
        previousCoverage: prevCoverage,
        newlyInsufficient,
        summaryNote: notes.join('；'),
      };
    } else if (symSnapshots.length === 1) {
      comparison = {
        ...comparison,
        available: false,
        currentDate: symSnapshots[0].snapshotDate,
        summaryNote: '此股票僅有一日快照，尚無前日資料可供比較',
      };
    }
  } catch {
    /* non-critical — comparison stays unavailable */
  }

  // ── 8. Backtest Summary (lightweight call to backtestFromDB logic) ─
  let backtestSummary: StockDetailResponse['backtestSummary'] = {
    available: false,
    strategy: 'ma_cross',
    totalReturn: null,
    buyAndHoldReturn: null,
    alphaToBuyAndHold: null,
    maxDrawdown: null,
    totalTrades: null,
    period: null,
    dataPoints,
    marketBenchmarkAvailable: false,
    marketReturn: null,
    regimeAwareAvailable: false,
    regimeAwareReturn: null,
    limitations: [],
    unavailableReason: dataPoints < 100 ? `歷史資料僅 ${dataPoints} 天，需 ≥100 天` : null,
  };
  if (dataPoints >= 100) {
    try {
      // Re-use the existing /api/stocks/backtest endpoint via internal fetch isn't possible in SSR
      // Instead, call the backtestFromDB logic indirectly via a lightweight DB query
      // We only need summary stats: use buyAndHoldReturn from backtestSection + augment with metadata
      const backtestApiUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/api/stocks/backtest`;
      const btRes = await fetch(backtestApiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol,
          strategy: 'ma_cross',
          months: 12,
          regimeMode: 'filter',
          allowedRegimes: ['Bull', 'Sideways'],
        }),
        signal: AbortSignal.timeout(8000),
      }).catch(() => null);

      if (btRes && btRes.ok) {
        const btData = await btRes.json().catch(() => null);
        if (btData && btData.summary) {
          const s = btData.summary;
          const bm = btData.benchmark;
          backtestSummary = {
            available: true,
            strategy: 'ma_cross',
            totalReturn: s.totalReturn ?? null,
            buyAndHoldReturn: s.buyAndHoldReturn ?? backtestSection.buyAndHoldReturn,
            alphaToBuyAndHold:
              s.totalReturn !== null && s.buyAndHoldReturn !== null
                ? Math.round((s.totalReturn - s.buyAndHoldReturn) * 100) / 100
                : null,
            maxDrawdown: s.maxDrawdown ?? null,
            totalTrades: s.totalTrades ?? null,
            period: btData.period ?? null,
            dataPoints,
            marketBenchmarkAvailable: bm?.marketAvailable ?? false,
            marketReturn: bm?.marketReturn ?? null,
            regimeAwareAvailable: btData.regimeAware ?? false,
            regimeAwareReturn: btData.regimeAwareResult?.summary?.totalReturn ?? null,
            limitations: btData.dataLimitations ?? [],
            unavailableReason: null,
          };
        } else if (btData?.source === 'insufficient_data') {
          backtestSummary.unavailableReason = btData.coverage?.message ?? '回測資料不足';
        }
      }
    } catch {
      backtestSummary.unavailableReason = '回測摘要暫時不可用';
    }
  }

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
    fundamentals: fundamentalsSection,
    peerComparison,
    cashflowLeverageOverlay,
    capitalEfficiencyOverlay,
    financialStructurePeerComparison,
    fundamentalMatrix,
    peerPercentileDetailTable,
    signals: signalsSection,
    backtest: backtestSection,
    backtestSummary,
    comparison,
    candidateCtx,
    watchlistCtx,
    coverageTier: {
      tier: stockCoverage?.tier ?? 'C',
      tierLabel: stockCoverage?.tierLabel ?? '受限分析 (Tier C)',
      quoteDays: stockCoverage?.quoteDays ?? dataPoints,
      hasChip: stockCoverage?.hasChip ?? false,
      capabilities: stockCoverage?.capabilities ?? {
        canBacktest: dataPoints >= 100,
        canMA200: dataPoints >= 250,
        canMA60: dataPoints >= 60,
        canBasicSignals: dataPoints >= 20,
        hasChipData: false,
        chipFresh: false,
      },
      limitations: stockCoverage?.limitations ?? limitations,
    },
    limitations,
    disclaimer:
      '本頁所有評分、訊號與分析為模型推估結果，僅供研究參考，不構成投資建議。所有結果基於規則計算，不保證未來績效。',
    generatedAt: new Date().toISOString(),
  };

  apiCache.set(cacheKey, response, 300);
  return NextResponse.json(response);
}
