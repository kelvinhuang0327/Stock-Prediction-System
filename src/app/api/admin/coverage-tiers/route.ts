/**
 * GET /api/admin/coverage-tiers
 *
 * Returns stock universe split by coverage tier:
 *   Tier A: quote ≥250 days + chip data → full analysis + backtest
 *   Tier B: quote ≥60 days + chip data  → signals + chip, limited backtest
 *   Tier C: insufficient data           → partial analysis only
 *
 * Query params:
 *   ?tier=A|B|C     → filter by specific tier
 *   ?symbol=2330    → get coverage for specific symbol
 *   ?summary=1      → return only aggregate summary (no stock list)
 */

import { NextRequest, NextResponse } from 'next/server';
import { CoverageService, type CoverageTier } from '@/lib/data/CoverageService';
import { getCoverageSummary } from '@/lib/data/CoverageService';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const tierFilter = searchParams.get('tier') as CoverageTier | null;
  const symbolParam = searchParams.get('symbol');
  const summaryOnly = searchParams.get('summary') === '1';

  try {
    // Single symbol lookup
    if (symbolParam) {
      const cov = await CoverageService.getStockCoverage(symbolParam.toUpperCase());
      return NextResponse.json({ coverage: cov });
    }

    // Aggregate summary only
    if (summaryOnly) {
      const summary = await getCoverageSummary();
      return NextResponse.json({ summary });
    }

    // Full tier list (optionally filtered)
    const summary = await getCoverageSummary();

    // Get detailed list for Tier A and B only (Tier C can be huge)
    const tierASymbols = await CoverageService.getTierSymbols('A');
    const allCovMap = await CoverageService.getBatchCoverage(tierASymbols);
    const tierBOnly = await CoverageService.getTierSymbols('B');
    const tierBMap = await CoverageService.getBatchCoverage(
      tierBOnly.filter(s => !tierASymbols.includes(s))
    );

    type CovItem = { symbol: string; tier: CoverageTier; quoteDays: number; hasChip: boolean; chipDatesAvailable: number; tierLabel: string; capabilities: Record<string, boolean>; limitations: string[] };
    const tierAList: CovItem[] = Array.from(allCovMap.values())
      .filter(c => c.tier === 'A')
      .sort((a, b) => b.quoteDays - a.quoteDays)
      .map(c => ({
        symbol: c.symbol,
        tier: c.tier,
        quoteDays: c.quoteDays,
        hasChip: c.hasChip,
        chipDatesAvailable: c.chipDatesAvailable,
        tierLabel: c.tierLabel,
        capabilities: c.capabilities as unknown as Record<string, boolean>,
        limitations: c.limitations,
      }));

    const tierBList: CovItem[] = Array.from(tierBMap.values())
      .filter(c => c.tier === 'B')
      .sort((a, b) => b.quoteDays - a.quoteDays)
      .map(c => ({
        symbol: c.symbol,
        tier: c.tier,
        quoteDays: c.quoteDays,
        hasChip: c.hasChip,
        chipDatesAvailable: c.chipDatesAvailable,
        tierLabel: c.tierLabel,
        capabilities: c.capabilities as unknown as Record<string, boolean>,
        limitations: c.limitations,
      }));

    const result = {
      summary,
      tiers: {
        A: tierFilter === null || tierFilter === 'A' ? tierAList : undefined,
        B: tierFilter === null || tierFilter === 'B' ? tierBList : undefined,
        C: tierFilter === 'C' ? `(${summary.tierC} stocks — list omitted for size)` : undefined,
      },
      interpretation: {
        tierA: 'Full analysis: backtest + MA200 + signals + chip data available',
        tierB: 'Moderate analysis: signals + chip data, backtest limited',
        tierC: 'Limited analysis: missing quotes or chip data',
        chipAgentActive: summary.tierA + summary.tierB > 0,
        backtestEligible: summary.tierA,
      },
      generatedAt: new Date().toISOString(),
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error('[coverage-tiers] error:', error);
    return NextResponse.json(
      { error: 'Coverage tiers lookup failed', detail: String(error) },
      { status: 500 }
    );
  }
}
