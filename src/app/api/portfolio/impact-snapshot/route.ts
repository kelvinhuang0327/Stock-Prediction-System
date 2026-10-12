import { NextRequest, NextResponse } from 'next/server';
import { apiCache } from '@/lib/cache';
import {
  createPortfolioImpactSnapshot,
  getLatestPortfolioImpactSnapshot,
  type CompareWindow,
  type PortfolioSnapshotScope,
} from '@/lib/portfolio/PortfolioImpactSnapshotEngine';

function parseScope(value: string | null): PortfolioSnapshotScope {
  return value === 'candidates' ? 'candidates' : 'watchlist';
}

function parseSymbols(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((s) => String(s ?? '').trim().toUpperCase()).filter(Boolean))].slice(0, 40);
}

function parseCompareWindow(value: string | null): CompareWindow {
  if (value === '7d' || value === '30d') return value;
  return '1d';
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const scope = parseScope(searchParams.get('scope'));
    const comparison = searchParams.get('comparison') === 'true';
    const compareWindow = parseCompareWindow(searchParams.get('compareWindow'));
    const cacheKey = `portfolio:impact-snapshot:${scope}:cmp=${comparison ? 1 : 0}:w=${compareWindow}`;
    const cached = apiCache.get(cacheKey);
    if (cached) return NextResponse.json(cached);

    const result = await getLatestPortfolioImpactSnapshot({ scope, comparison, compareWindow });
    const limitations: string[] = [];
    if (comparison && !result.comparison.comparisonAvailable) {
      limitations.push(`compareWindow=${compareWindow} 基準快照不存在。`);
    }
    const response = {
      scope,
      compareWindow,
      snapshot: result.snapshot,
      comparison: result.comparison,
      limitations,
      generatedAt: new Date().toISOString(),
    };
    apiCache.set(cacheKey, response, 180);
    return NextResponse.json(response);
  } catch (error) {
    return NextResponse.json(
      {
        scope: 'watchlist',
        compareWindow: '1d',
        snapshot: {
          snapshotDate: new Date().toISOString().split('T')[0],
          scope: 'watchlist',
          symbols: [],
          summary: '組合快照不可用，已降級。',
          themeConcentration: { topThemes: [], concentrationLevel: 'unknown', explanation: '資料不足' },
          sectorConcentration: { sectors: [], concentrationLevel: 'unknown', chainBias: 'unknown', explanation: '資料不足' },
          riskClusters: { overallRiskLevel: 'unknown', clusters: [] },
          regimeExposure: {
            regime: 'Unknown',
            confidence: 0,
            offensiveExposure: 0,
            defensiveExposure: 0,
            neutralExposure: 0,
            sensitivity: 'unknown',
            note: '資料不足',
          },
          limitations: ['snapshot api failed'],
        },
        comparison: {
          comparisonAvailable: false,
          previousSnapshotDate: null,
          compareWindow: '1d',
          themeChanged: false,
          sectorChanged: false,
          riskChanged: false,
          regimeExposureChanged: false,
          summaryNote: 'comparison unavailable',
          details: {
            themeLevelChange: { from: 'unknown', to: 'unknown' },
            sectorLevelChange: { from: 'unknown', to: 'unknown' },
            riskLevelChange: { from: 'unknown', to: 'unknown' },
            regimeChange: { from: 'Unknown', to: 'Unknown', fromSensitivity: 'unknown', toSensitivity: 'unknown' },
            topThemeChange: { from: null, to: null },
            topSectorChange: { from: null, to: null },
          },
        },
        limitations: [error instanceof Error ? error.message : 'unknown error'],
        generatedAt: new Date().toISOString(),
      },
      { status: 200 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const scope = parseScope(typeof body.scope === 'string' ? body.scope : null);
    const date = typeof body.date === 'string' ? body.date : undefined;
    const forceRefresh = body.forceRefresh === true;
    const symbols = parseSymbols(body.symbols);

    const result = await createPortfolioImpactSnapshot({ scope, date, forceRefresh, symbols });
    apiCache.invalidate(`portfolio:impact-snapshot:${scope}`);
    return NextResponse.json({
      scope,
      ...result,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        scope: 'watchlist',
        success: false,
        created: false,
        updated: false,
        generatedAt: new Date().toISOString(),
        limitations: [error instanceof Error ? error.message : 'unknown error'],
      },
      { status: 500 },
    );
  }
}
