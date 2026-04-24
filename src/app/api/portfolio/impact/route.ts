import { NextResponse } from 'next/server';
import { apiCache } from '@/lib/cache';
import { prisma } from '@/lib/prisma';
import { runScreen } from '@/lib/screen/StrategyScreenEngine';
import { generatePortfolioDecisionSupport, generatePortfolioImpacts } from '@/lib/portfolio/PortfolioImpactEngine';

function parseSymbolList(value: string | null): string[] {
  if (!value) return [];
  return [...new Set(value.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean))].slice(0, 40);
}

async function resolveSymbols(mode: 'watchlist' | 'candidates', explicit: string[]): Promise<string[]> {
  if (explicit.length > 0) return explicit;
  if (mode === 'candidates') {
    const screen = await runScreen().catch(() => null);
    return (screen?.candidates ?? []).map((c) => c.symbol.toUpperCase()).slice(0, 30);
  }
  const items = await prisma.watchlist.findMany({ select: { stockId: true } }).catch(() => []);
  return items.map((i) => i.stockId.toUpperCase()).slice(0, 40);
}

async function resolveWeights(mode: 'watchlist' | 'candidates', symbols: string[]): Promise<Record<string, number>> {
  if (mode === 'candidates') return {};
  const items = await prisma.watchlist.findMany({ where: { stockId: { in: symbols } }, select: { stockId: true, quantity: true } }).catch(() => []);
  const weightMap: Record<string, number> = {};
  for (const item of items) {
    const q = Number(item.quantity ?? 0);
    weightMap[item.stockId.toUpperCase()] = q > 0 ? q : 1;
  }
  return weightMap;
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const symbols = Array.isArray(body?.symbols) ? body.symbols : [];
    if (!Array.isArray(symbols) || symbols.length === 0) {
      return NextResponse.json(
        { results: [], generatedAt: new Date().toISOString(), limitations: ['symbols is required'] },
        { status: 400 },
      );
    }

    const cleaned = [...new Set(symbols.map((s: unknown) => String(s || '').trim().toUpperCase()).filter(Boolean))].slice(0, 40);
    const cacheKey = `portfolio:impact:v1:${cleaned.join(',')}`;
    const cached = apiCache.get(cacheKey);
    if (cached) return NextResponse.json(cached);

    const results = await generatePortfolioImpacts(cleaned);
    const response = {
      results,
      generatedAt: new Date().toISOString(),
    };
    apiCache.set(cacheKey, response, 120);
    return NextResponse.json(response);
  } catch (error) {
    return NextResponse.json(
      {
        results: [],
        generatedAt: new Date().toISOString(),
        limitations: ['portfolio impact generation failed', error instanceof Error ? error.message : 'unknown error'],
      },
      { status: 500 },
    );
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get('mode') === 'candidates' ? 'candidates' : 'watchlist';
    const explicitSymbols = parseSymbolList(searchParams.get('symbols'));
    const symbols = await resolveSymbols(mode, explicitSymbols);

    const cacheKey = `portfolio:impact:l3p:${mode}:${symbols.join(',') || 'empty'}`;
    const cached = apiCache.get(cacheKey);
    if (cached) return NextResponse.json(cached);

    const weights = await resolveWeights(mode, symbols);
    const analysis = await generatePortfolioDecisionSupport(symbols, { weights });
    const response = {
      ...analysis,
      mode,
      symbols,
      generatedAt: new Date().toISOString(),
    };
    apiCache.set(cacheKey, response, 180);
    return NextResponse.json(response);
  } catch (error) {
    return NextResponse.json(
      {
        summary: '組合研究資料暫時不可用，已降級。',
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
        limitations: ['portfolio impact aggregation failed', error instanceof Error ? error.message : 'unknown error'],
        generatedAt: new Date().toISOString(),
      },
      { status: 200 },
    );
  }
}
