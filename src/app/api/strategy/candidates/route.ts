/**
 * GET /api/strategy/candidates
 *
 * Enriches /api/strategy/screen output with per-candidate snapshot comparison.
 * Does NOT re-implement screening logic—delegates entirely to StrategyScreenEngine.
 *
 * Extra vs /api/strategy/screen:
 * - Per-candidate change tags: new / upgraded / downgraded / improved / dropped
 * - Comparison availability metadata
 * - All ScreenCandidate fields passed through unchanged
 */

import { NextRequest, NextResponse } from 'next/server';
import { runScreen, type ScreenParams, type ScreenCandidate } from '@/lib/screen/StrategyScreenEngine';
import { prisma } from '@/lib/prisma';
import { apiCache } from '@/lib/cache';

const ALPHA_CHANGE_THRESHOLD = 5;
const BUCKET_ORDER = ['Avoid', 'Insufficient Data', 'Neutral', 'Watch', 'Strong Candidate'];

function bucketRank(b: string) { return BUCKET_ORDER.indexOf(b); }

export type CandidateChangeTag =
  | 'new_today'
  | 'bucket_upgraded'
  | 'bucket_downgraded'
  | 'alpha_improved'
  | 'alpha_dropped'
  | 'newly_insufficient';

export interface EnrichedCandidate extends ScreenCandidate {
  changeTags: CandidateChangeTag[];
  previousAlpha: number | null;
  previousBucket: string | null;
  alphaDelta: number | null;
}

export interface CandidatesResponse {
  regime: string;
  regimeConfidence: number;
  candidates: EnrichedCandidate[];
  excludedCount: number;
  totalScanned: number;
  dataCoverageSummary: { full: number; limited: number; insufficient: number };
  screenParams: object;
  comparisonAvailable: boolean;
  previousSnapshotDate: string | null;
  strongCount: number;
  watchCount: number;
  neutralCount: number;
  limitations: string[];
  disclaimer: string;
  last_updated: string | null;
}

// ─── GET handler ─────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const params: ScreenParams = {
    minAlphaScore: searchParams.has('minAlphaScore') ? Number(searchParams.get('minAlphaScore')) : undefined,
    minConfidence: searchParams.has('minConfidence') ? Number(searchParams.get('minConfidence')) : undefined,
    maxResults: searchParams.has('maxResults') ? Number(searchParams.get('maxResults')) : 200,
    respectMarketRegime: searchParams.get('respectMarketRegime') !== 'false',
  };

  const cacheKey = `candidates:${JSON.stringify(params)}`;
  const cached = apiCache.get<CandidatesResponse>(cacheKey);
  if (cached) return NextResponse.json(cached);

  try {
    const [screenResult, prevSnapshot] = await Promise.all([
      runScreen(params),
      prisma.dailyCandidateSnapshot.findFirst({
        where: { snapshotDate: { lt: new Date().toISOString().split('T')[0] } },
        select: { snapshotDate: true },
        orderBy: { snapshotDate: 'desc' },
      }),
    ]);

    // Load all previous-day candidates if snapshot exists
    let prevCandidateMap = new Map<string, { alphaScore: number; screenBucket: string }>();
    let comparisonAvailable = false;
    let previousSnapshotDate: string | null = null;

    if (prevSnapshot) {
      comparisonAvailable = true;
      previousSnapshotDate = prevSnapshot.snapshotDate;
      const prevRows = await prisma.dailyCandidateSnapshot.findMany({
        where: { snapshotDate: prevSnapshot.snapshotDate },
        select: { symbol: true, alphaScore: true, screenBucket: true },
      });
      prevCandidateMap = new Map(prevRows.map(r => [r.symbol, r]));
    }

    // Enrich candidates with comparison tags
    const allCandidates = screenResult.candidates;
    const currentSymbols = new Set(allCandidates.map(c => c.symbol));

    const enriched: EnrichedCandidate[] = allCandidates.map(c => {
      const prev = prevCandidateMap.get(c.symbol);
      const changeTags: CandidateChangeTag[] = [];

      if (!comparisonAvailable) {
        return { ...c, changeTags, previousAlpha: null, previousBucket: null, alphaDelta: null };
      }

      if (!prev) {
        changeTags.push('new_today');
        return { ...c, changeTags, previousAlpha: null, previousBucket: null, alphaDelta: null };
      }

      const alphaDelta = c.alphaScore - prev.alphaScore;
      const prevRank = bucketRank(prev.screenBucket);
      const currRank = bucketRank(c.screenBucket);

      if (currRank > prevRank) changeTags.push('bucket_upgraded');
      if (currRank < prevRank) changeTags.push('bucket_downgraded');
      if (alphaDelta >= ALPHA_CHANGE_THRESHOLD) changeTags.push('alpha_improved');
      if (alphaDelta <= -ALPHA_CHANGE_THRESHOLD) changeTags.push('alpha_dropped');
      if (c.dataCoverage === 'insufficient' && prev.screenBucket !== 'Excluded') {
        changeTags.push('newly_insufficient');
      }

      return {
        ...c,
        changeTags,
        previousAlpha: prev.alphaScore,
        previousBucket: prev.screenBucket,
        alphaDelta: Math.round(alphaDelta * 10) / 10,
      };
    });

    const response: CandidatesResponse = {
      regime: screenResult.regime,
      regimeConfidence: screenResult.regimeConfidence,
      candidates: enriched,
      excludedCount: screenResult.excludedCount,
      totalScanned: screenResult.totalScanned,
      dataCoverageSummary: screenResult.dataCoverageSummary,
      screenParams: screenResult.screenParams,
      comparisonAvailable,
      previousSnapshotDate,
      strongCount: enriched.filter(c => c.screenBucket === 'Strong Candidate').length,
      watchCount: enriched.filter(c => c.screenBucket === 'Watch').length,
      neutralCount: enriched.filter(c => c.screenBucket === 'Neutral').length,
      limitations: screenResult.limitations,
      disclaimer: screenResult.disclaimer,
      last_updated: screenResult.last_updated,
    };

    apiCache.set(cacheKey, response, 180);
    return NextResponse.json(response);
  } catch (error) {
    console.error('[Candidates API] error:', error);
    return NextResponse.json(
      { error: '候選股資料取得失敗', candidates: [], comparisonAvailable: false },
      { status: 500 }
    );
  }
}
