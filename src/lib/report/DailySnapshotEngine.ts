/**
 * DailySnapshotEngine
 * 
 * Creates and queries daily snapshots for market, candidates, and watchlist.
 * Snapshots are historical records—not predictions.
 * Supports upsert (forceRefresh) for same-day re-runs.
 */

import { prisma } from '@/lib/prisma';
import { generateDailyReport, type DailyReport, type CandidateDetail } from './DailyReportEngine';
import { runScreen, type ScreenCandidate } from '@/lib/screen/StrategyScreenEngine';
import { fuseBatch } from '@/lib/alpha/SignalFusionEngine';

// ─── Types ───────────────────────────────────────────────────────

export interface SnapshotResult {
  snapshotDate: string;
  success: boolean;
  marketCreated: boolean;
  candidatesCreated: number;
  candidatesUpdated: number;
  watchlistCreated: number;
  watchlistUpdated: number;
  limitations: string[];
}

export interface SnapshotStatus {
  latestDate: string | null;
  totalMarketSnapshots: number;
  totalCandidateSnapshots: number;
  totalWatchlistSnapshots: number;
  availableDates: string[];
}

export interface MarketComparison {
  available: boolean;
  previousDate: string | null;
  regimeChanged: boolean;
  previousRegime: string | null;
  currentRegime: string;
  confidenceDelta: number | null;
  note: string;
}

export interface CandidateChange {
  symbol: string;
  name: string;
  previousBucket: string;
  currentBucket: string;
  previousAlpha: number;
  currentAlpha: number;
  alphaDelta: number;
}

export interface CandidateComparison {
  available: boolean;
  previousDate: string | null;
  newStrongCandidates: Array<{ symbol: string; name: string; alphaScore: number }>;
  removedStrongCandidates: Array<{ symbol: string; name: string; previousAlpha: number }>;
  bucketUpgrades: CandidateChange[];
  bucketDowngrades: CandidateChange[];
  note: string;
}

export interface WatchlistChange {
  symbol: string;
  name: string;
  previousAlpha: number | null;
  currentAlpha: number | null;
  previousBucket: string | null;
  currentBucket: string | null;
  alphaDelta: number | null;
}

export interface WatchlistComparison {
  available: boolean;
  previousDate: string | null;
  scoreImproved: WatchlistChange[];
  scoreDropped: WatchlistChange[];
  newlyInsufficientData: string[];
  riskEscalated: Array<{ symbol: string; name: string; previousRisk: string; currentRisk: string }>;
  note: string;
}

export interface DailyComparison {
  comparisonAvailable: boolean;
  previousSnapshotDate: string | null;
  market: MarketComparison;
  candidates: CandidateComparison;
  watchlist: WatchlistComparison;
}

// ─── Comparison Thresholds ───────────────────────────────────────

const ALPHA_CHANGE_THRESHOLD = 5; // alphaScore change >= 5 to count as improved/dropped
const BUCKET_ORDER = ['Avoid', 'Insufficient Data', 'Neutral', 'Watch', 'Strong Candidate'];
const RISK_ORDER = ['low', 'moderate', 'elevated', 'high', 'unknown'];

function bucketRank(bucket: string): number {
  return BUCKET_ORDER.indexOf(bucket);
}

function riskRank(risk: string): number {
  const idx = RISK_ORDER.indexOf(risk);
  return idx >= 0 ? idx : 4; // unknown = highest
}

// ─── Create Snapshot ─────────────────────────────────────────────

export async function createDailySnapshot(options?: {
  date?: string;
  forceRefresh?: boolean;
  includeWatchlist?: boolean;
}): Promise<SnapshotResult> {
  const snapshotDate = options?.date ?? new Date().toISOString().split('T')[0];
  const forceRefresh = options?.forceRefresh ?? false;
  const includeWatchlist = options?.includeWatchlist !== false;

  const limitations: string[] = [];
  let marketCreated = false;
  let candidatesCreated = 0;
  let candidatesUpdated = 0;
  let watchlistCreated = 0;
  let watchlistUpdated = 0;

  try {
    // Generate fresh report data
    const report = await generateDailyReport({ includeWatchlist, candidateLimit: 50 });

    // 1. Market snapshot
    const existingMarket = await prisma.dailyMarketSnapshot.findUnique({
      where: { snapshotDate },
    });

    if (!existingMarket || forceRefresh) {
      await prisma.dailyMarketSnapshot.upsert({
        where: { snapshotDate },
        create: {
          snapshotDate,
          regime: report.marketSummary.regime,
          regimeConfidence: report.marketSummary.regimeConfidence,
          marketSummary: JSON.stringify(report.marketSummary),
          limitations: JSON.stringify(report.marketSummary.limitations),
        },
        update: {
          regime: report.marketSummary.regime,
          regimeConfidence: report.marketSummary.regimeConfidence,
          marketSummary: JSON.stringify(report.marketSummary),
          limitations: JSON.stringify(report.marketSummary.limitations),
        },
      });
      marketCreated = true;
    }

    // 2. Candidate snapshots — get full screen data
    const screenResult = await runScreen().catch(() => null);
    if (screenResult && screenResult.candidates.length > 0) {
      for (const c of screenResult.candidates) {
        const existing = await prisma.dailyCandidateSnapshot.findUnique({
          where: { snapshotDate_symbol: { snapshotDate, symbol: c.symbol } },
        });

        if (!existing) {
          await prisma.dailyCandidateSnapshot.create({
            data: {
              snapshotDate,
              symbol: c.symbol,
              name: c.name,
              alphaScore: c.alphaScore,
              recommendationBucket: c.recommendationBucket,
              confidence: c.confidence,
              screenBucket: c.screenBucket,
              whyIncluded: c.whyIncluded,
              topFactors: JSON.stringify(c.topFactors),
              keyRisks: JSON.stringify(c.keyRisks),
              dataCoverage: c.dataCoverage,
            },
          });
          candidatesCreated++;
        } else if (forceRefresh) {
          await prisma.dailyCandidateSnapshot.update({
            where: { id: existing.id },
            data: {
              name: c.name,
              alphaScore: c.alphaScore,
              recommendationBucket: c.recommendationBucket,
              confidence: c.confidence,
              screenBucket: c.screenBucket,
              whyIncluded: c.whyIncluded,
              topFactors: JSON.stringify(c.topFactors),
              keyRisks: JSON.stringify(c.keyRisks),
              dataCoverage: c.dataCoverage,
            },
          });
          candidatesUpdated++;
        }
      }
    } else {
      limitations.push('候選股掃描無結果或失敗');
    }

    // 3. Watchlist snapshots
    if (includeWatchlist) {
      const watchlistItems = await prisma.watchlist.findMany({ include: { stock: true } });
      if (watchlistItems.length > 0) {
        // Get alpha scores for watchlist items
        const symbols = watchlistItems.map(w => w.stockId);
        const fusionResults = await fuseBatch(symbols).catch(() => []);
        const fusionMap = new Map(fusionResults.map(f => [f.symbol, f]));

        // Get latest prices
        const latestQuotes = await prisma.stockQuote.findMany({
          where: { stockId: { in: symbols } },
          orderBy: { date: 'desc' },
          distinct: ['stockId'],
        });
        const priceMap = new Map(latestQuotes.map(q => [q.stockId, q]));

        for (const item of watchlistItems) {
          const fusion = fusionMap.get(item.stockId);
          const quote = priceMap.get(item.stockId);

          const existing = await prisma.dailyWatchlistSnapshot.findUnique({
            where: { snapshotDate_symbol: { snapshotDate, symbol: item.stockId } },
          });

          const data = {
            snapshotDate,
            symbol: item.stockId,
            name: item.stock?.name ?? item.stockId,
            alphaScore: fusion?.alphaScore ?? null,
            recommendationBucket: fusion?.recommendationBucket ?? null,
            price: quote?.close ?? null,
            priceChangePercent: null as number | null,
            riskLevel: fusion ? (fusion.alphaScore < 35 ? 'high' : fusion.alphaScore < 55 ? 'moderate' : 'low') : null,
            dataCoverage: fusion?.dataCoverage ?? null,
          };

          if (!existing) {
            await prisma.dailyWatchlistSnapshot.create({ data });
            watchlistCreated++;
          } else if (forceRefresh) {
            await prisma.dailyWatchlistSnapshot.update({
              where: { id: existing.id },
              data: {
                name: data.name,
                alphaScore: data.alphaScore,
                recommendationBucket: data.recommendationBucket,
                price: data.price,
                priceChangePercent: data.priceChangePercent,
                riskLevel: data.riskLevel,
                dataCoverage: data.dataCoverage,
              },
            });
            watchlistUpdated++;
          }
        }
      } else {
        limitations.push('自選清單為空');
      }
    }

    return {
      snapshotDate,
      success: true,
      marketCreated,
      candidatesCreated,
      candidatesUpdated,
      watchlistCreated,
      watchlistUpdated,
      limitations,
    };
  } catch (error) {
    return {
      snapshotDate,
      success: false,
      marketCreated,
      candidatesCreated,
      candidatesUpdated,
      watchlistCreated,
      watchlistUpdated,
      limitations: [...limitations, `Snapshot 產生失敗: ${error instanceof Error ? error.message : String(error)}`],
    };
  }
}

// ─── Query Snapshot Status ───────────────────────────────────────

export async function getSnapshotStatus(): Promise<SnapshotStatus> {
  const [marketCount, candidateCount, watchlistCount, latestMarket, dates] = await Promise.all([
    prisma.dailyMarketSnapshot.count(),
    prisma.dailyCandidateSnapshot.count(),
    prisma.dailyWatchlistSnapshot.count(),
    prisma.dailyMarketSnapshot.findFirst({ orderBy: { snapshotDate: 'desc' } }),
    prisma.dailyMarketSnapshot.findMany({
      select: { snapshotDate: true },
      orderBy: { snapshotDate: 'desc' },
      take: 30,
    }),
  ]);

  return {
    latestDate: latestMarket?.snapshotDate ?? null,
    totalMarketSnapshots: marketCount,
    totalCandidateSnapshots: candidateCount,
    totalWatchlistSnapshots: watchlistCount,
    availableDates: dates.map(d => d.snapshotDate),
  };
}

// ─── Build Comparison ────────────────────────────────────────────

export async function buildComparison(
  currentReport: DailyReport,
  currentCandidates: CandidateDetail[],
): Promise<DailyComparison> {
  const today = currentReport.reportDate;

  // Find previous snapshot
  const prevMarket = await prisma.dailyMarketSnapshot.findFirst({
    where: { snapshotDate: { lt: today } },
    orderBy: { snapshotDate: 'desc' },
  });

  if (!prevMarket) {
    return {
      comparisonAvailable: false,
      previousSnapshotDate: null,
      market: {
        available: false, previousDate: null, regimeChanged: false,
        previousRegime: null, currentRegime: currentReport.marketSummary.regime,
        confidenceDelta: null, note: '尚未建立前日快照，無法進行比較。首次建立快照後，下次報告將可提供歷史比較。',
      },
      candidates: {
        available: false, previousDate: null, newStrongCandidates: [],
        removedStrongCandidates: [], bucketUpgrades: [], bucketDowngrades: [],
        note: '尚未建立前日候選快照。',
      },
      watchlist: {
        available: false, previousDate: null, scoreImproved: [],
        scoreDropped: [], newlyInsufficientData: [], riskEscalated: [],
        note: '尚未建立前日自選快照。',
      },
    };
  }

  const prevDate = prevMarket.snapshotDate;

  // Get previous candidate/watchlist snapshots
  const [prevCandidates, prevWatchlist] = await Promise.all([
    prisma.dailyCandidateSnapshot.findMany({ where: { snapshotDate: prevDate } }),
    prisma.dailyWatchlistSnapshot.findMany({ where: { snapshotDate: prevDate } }),
  ]);

  const market = buildMarketComparison(prevMarket, currentReport, prevDate);
  const candidates = buildCandidateComparison(prevCandidates, currentCandidates, prevDate);
  const watchlist = await buildWatchlistComparison(prevWatchlist, prevDate);

  return {
    comparisonAvailable: true,
    previousSnapshotDate: prevDate,
    market,
    candidates,
    watchlist,
  };
}

// ─── Market Comparison ───────────────────────────────────────────

function buildMarketComparison(
  prev: { regime: string; regimeConfidence: number },
  current: DailyReport,
  prevDate: string,
): MarketComparison {
  const regimeChanged = prev.regime !== current.marketSummary.regime;
  const confDelta = Math.round((current.marketSummary.regimeConfidence - prev.regimeConfidence) * 10) / 10;

  let note = '';
  if (regimeChanged) {
    note = `市場環境由 ${prev.regime} 轉為 ${current.marketSummary.regime}，請注意策略調整。`;
  } else if (Math.abs(confDelta) >= 10) {
    note = `市場環境維持 ${current.marketSummary.regime}，但信心度${confDelta > 0 ? '上升' : '下降'} ${Math.abs(confDelta).toFixed(0)}%。`;
  } else {
    note = `市場環境維持 ${current.marketSummary.regime}，無重大變化。`;
  }

  return {
    available: true,
    previousDate: prevDate,
    regimeChanged,
    previousRegime: prev.regime,
    currentRegime: current.marketSummary.regime,
    confidenceDelta: confDelta,
    note,
  };
}

// ─── Candidate Comparison ────────────────────────────────────────

function buildCandidateComparison(
  prevSnapshots: Array<{ symbol: string; name: string | null; alphaScore: number; screenBucket: string }>,
  currentCandidates: CandidateDetail[],
  prevDate: string,
): CandidateComparison {
  const prevMap = new Map(prevSnapshots.map(p => [p.symbol, p]));
  const currMap = new Map(currentCandidates.map(c => [c.symbol, c]));

  const prevStrong = new Set(prevSnapshots.filter(p => p.screenBucket === 'Strong Candidate').map(p => p.symbol));
  const currStrong = new Set(currentCandidates.filter(c => c.marketContext === 'Strong Candidate').map(c => c.symbol));

  // New strong candidates
  const newStrong = [...currStrong]
    .filter(s => !prevStrong.has(s))
    .map(s => {
      const c = currMap.get(s)!;
      return { symbol: s, name: c.name, alphaScore: c.alphaScore };
    });

  // Removed strong candidates
  const removedStrong = [...prevStrong]
    .filter(s => !currStrong.has(s))
    .map(s => {
      const p = prevMap.get(s)!;
      return { symbol: s, name: p.name ?? s, previousAlpha: p.alphaScore };
    });

  // Bucket upgrades & downgrades
  const upgrades: CandidateChange[] = [];
  const downgrades: CandidateChange[] = [];

  for (const [symbol, curr] of currMap) {
    const prev = prevMap.get(symbol);
    if (!prev) continue;

    const prevRank = bucketRank(prev.screenBucket);
    const currRank = bucketRank(curr.marketContext);

    if (currRank > prevRank && prevRank >= 0 && currRank >= 0) {
      upgrades.push({
        symbol, name: curr.name,
        previousBucket: prev.screenBucket, currentBucket: curr.marketContext,
        previousAlpha: prev.alphaScore, currentAlpha: curr.alphaScore,
        alphaDelta: Math.round((curr.alphaScore - prev.alphaScore) * 10) / 10,
      });
    } else if (currRank < prevRank && prevRank >= 0 && currRank >= 0) {
      downgrades.push({
        symbol, name: curr.name,
        previousBucket: prev.screenBucket, currentBucket: curr.marketContext,
        previousAlpha: prev.alphaScore, currentAlpha: curr.alphaScore,
        alphaDelta: Math.round((curr.alphaScore - prev.alphaScore) * 10) / 10,
      });
    }
  }

  const notes: string[] = [];
  if (newStrong.length > 0) notes.push(`${newStrong.length} 檔新進入 Strong Candidate`);
  if (removedStrong.length > 0) notes.push(`${removedStrong.length} 檔離開 Strong Candidate`);
  if (upgrades.length > 0) notes.push(`${upgrades.length} 檔 bucket 升級`);
  if (downgrades.length > 0) notes.push(`${downgrades.length} 檔 bucket 降級`);
  if (notes.length === 0) notes.push('候選池無重大變動');

  return {
    available: true,
    previousDate: prevDate,
    newStrongCandidates: newStrong,
    removedStrongCandidates: removedStrong,
    bucketUpgrades: upgrades.slice(0, 10),
    bucketDowngrades: downgrades.slice(0, 10),
    note: notes.join('；'),
  };
}

// ─── Watchlist Comparison ────────────────────────────────────────

async function buildWatchlistComparison(
  prevSnapshots: Array<{ symbol: string; name: string | null; alphaScore: number | null; recommendationBucket: string | null; riskLevel: string | null }>,
  prevDate: string,
): Promise<WatchlistComparison> {
  if (prevSnapshots.length === 0) {
    return {
      available: false,
      previousDate: prevDate,
      scoreImproved: [],
      scoreDropped: [],
      newlyInsufficientData: [],
      riskEscalated: [],
      note: '前日自選清單快照為空。',
    };
  }

  // Get current watchlist + fusion
  const currentWatchlist = await prisma.watchlist.findMany({ include: { stock: true } });
  if (currentWatchlist.length === 0) {
    return {
      available: true,
      previousDate: prevDate,
      scoreImproved: [],
      scoreDropped: [],
      newlyInsufficientData: [],
      riskEscalated: [],
      note: '自選清單目前為空。',
    };
  }

  const symbols = currentWatchlist.map(w => w.stockId);
  const fusionResults = await fuseBatch(symbols).catch(() => []);
  const fusionMap = new Map(fusionResults.map(f => [f.symbol, f]));
  const prevMap = new Map(prevSnapshots.map(p => [p.symbol, p]));

  const improved: WatchlistChange[] = [];
  const dropped: WatchlistChange[] = [];
  const newInsufficient: string[] = [];
  const riskEscalated: Array<{ symbol: string; name: string; previousRisk: string; currentRisk: string }> = [];

  for (const item of currentWatchlist) {
    const prev = prevMap.get(item.stockId);
    const curr = fusionMap.get(item.stockId);
    if (!prev) continue;

    const prevAlpha = prev.alphaScore;
    const currAlpha = curr?.alphaScore ?? null;

    // Score change
    if (prevAlpha !== null && currAlpha !== null) {
      const delta = currAlpha - prevAlpha;
      if (delta >= ALPHA_CHANGE_THRESHOLD) {
        improved.push({
          symbol: item.stockId,
          name: item.stock?.name ?? item.stockId,
          previousAlpha: prevAlpha,
          currentAlpha: currAlpha,
          previousBucket: prev.recommendationBucket,
          currentBucket: curr?.recommendationBucket ?? null,
          alphaDelta: Math.round(delta * 10) / 10,
        });
      } else if (delta <= -ALPHA_CHANGE_THRESHOLD) {
        dropped.push({
          symbol: item.stockId,
          name: item.stock?.name ?? item.stockId,
          previousAlpha: prevAlpha,
          currentAlpha: currAlpha,
          previousBucket: prev.recommendationBucket,
          currentBucket: curr?.recommendationBucket ?? null,
          alphaDelta: Math.round(delta * 10) / 10,
        });
      }
    }

    // Newly insufficient
    if (prev.recommendationBucket !== 'Insufficient Data' && curr?.recommendationBucket === 'Insufficient Data') {
      newInsufficient.push(item.stockId);
    }

    // Risk escalation
    const prevRisk = prev.riskLevel ?? 'unknown';
    const currRisk = curr ? (curr.alphaScore < 35 ? 'high' : curr.alphaScore < 55 ? 'moderate' : 'low') : 'unknown';
    if (riskRank(currRisk) > riskRank(prevRisk) && prevRisk !== 'unknown') {
      riskEscalated.push({
        symbol: item.stockId,
        name: item.stock?.name ?? item.stockId,
        previousRisk: prevRisk,
        currentRisk: currRisk,
      });
    }
  }

  const notes: string[] = [];
  if (improved.length > 0) notes.push(`${improved.length} 檔分數改善`);
  if (dropped.length > 0) notes.push(`${dropped.length} 檔分數下滑`);
  if (riskEscalated.length > 0) notes.push(`${riskEscalated.length} 檔風險升高`);
  if (notes.length === 0) notes.push('自選清單無重大變動');

  return {
    available: true,
    previousDate: prevDate,
    scoreImproved: improved.slice(0, 10),
    scoreDropped: dropped.slice(0, 10),
    newlyInsufficientData: newInsufficient,
    riskEscalated: riskEscalated.slice(0, 10),
    note: notes.join('；'),
  };
}
