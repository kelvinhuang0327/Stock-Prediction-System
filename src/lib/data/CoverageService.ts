/**
 * CoverageService — 股票資料覆蓋率分類服務
 *
 * 定義三個 Coverage Tier，讓分析引擎和 UI 可以清楚知道
 * 每檔股票能做什麼分析、受什麼限制：
 *
 * Tier A — 完整分析：quote ≥250天 + chip可用 → 回測 + MA200 + 法人分析全部可用
 * Tier B — 中度分析：quote ≥60天 + chip可用  → 技術指標 + 法人分析，回測受限
 * Tier C — 受限分析：quote <60天 或 無chip   → 僅部分分析可用，標示限制
 *
 * 此 service 為純查詢工具，不修改資料，可被以下使用：
 * - /api/strategy/screen (篩選 universe)
 * - /stocks/[symbol]/detail (顯示 coverage tier badge)
 * - /candidates (候選池 coverage 診斷)
 * - DataQualityChecker (整體 coverage 報告)
 */

import { prisma } from '@/lib/prisma';

// ─── Types ───────────────────────────────────────────────────────────────────

export type CoverageTier = 'A' | 'B' | 'C';

export interface StockCoverage {
  symbol: string;
  quoteDays: number;
  hasChip: boolean;
  chipLatestDate: string | null;
  chipDatesAvailable: number;
  tier: CoverageTier;
  tierLabel: string;
  capabilities: StockCapabilities;
  limitations: string[];
}

export interface StockCapabilities {
  /** ≥100 days quotes */
  canBacktest: boolean;
  /** ≥250 days quotes */
  canMA200: boolean;
  /** ≥60 days quotes */
  canMA60: boolean;
  /** ≥20 days quotes */
  canBasicSignals: boolean;
  /** InstitutionalChip available for this stock */
  hasChipData: boolean;
  /** Chip data is fresh (≤5 trading days old) */
  chipFresh: boolean;
}

export interface CoverageSummaryByTier {
  tierA: number;
  tierB: number;
  tierC: number;
  total: number;
  /** Stocks with quotes but no chip data */
  quoteOnlyStocks: number;
  /** Stocks with chip but no quote data */
  chipOnlyStocks: number;
  lastComputedAt: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function classifyTier(quoteDays: number, hasChip: boolean): CoverageTier {
  if (quoteDays >= 250 && hasChip) return 'A';
  if (quoteDays >= 60 && hasChip)  return 'B';
  return 'C';
}

function tierLabel(tier: CoverageTier): string {
  switch (tier) {
    case 'A': return '完整分析 (Tier A)';
    case 'B': return '中度分析 (Tier B)';
    case 'C': return '受限分析 (Tier C)';
  }
}

function buildCapabilities(quoteDays: number, hasChip: boolean, chipFresh: boolean): StockCapabilities {
  return {
    canBacktest:     quoteDays >= 100,
    canMA200:        quoteDays >= 250,
    canMA60:         quoteDays >= 60,
    canBasicSignals: quoteDays >= 20,
    hasChipData:     hasChip,
    chipFresh,
  };
}

function buildLimitations(quoteDays: number, hasChip: boolean, chipFresh: boolean): string[] {
  const lims: string[] = [];
  if (quoteDays < 20)  lims.push('歷史資料極度不足 (<20天)，分析極度受限');
  else if (quoteDays < 60)  lims.push(`歷史資料偏少 (${quoteDays}天)，技術指標受限`);
  else if (quoteDays < 100) lims.push(`歷史資料不足回測 (${quoteDays}天，需≥100天)`);
  else if (quoteDays < 250) lims.push(`歷史資料不足長期技術分析 (${quoteDays}天，需≥250天for MA200)`);

  if (!hasChip) lims.push('無法人籌碼資料，ChipAgent 輸出 Insufficient');
  else if (!chipFresh) lims.push('法人資料可能過時，ChipScore 準確性降低');

  return lims;
}

// ─── Cache ───────────────────────────────────────────────────────────────────

let coverageCache: Map<string, StockCoverage> | null = null;
let cacheTtl = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function clearCache() {
  coverageCache = null;
  cacheTtl = 0;
}

// ─── Core Functions ───────────────────────────────────────────────────────────

/**
 * Load all stock coverage data into memory (cached for 5 min).
 * Used internally for batch lookups.
 */
async function loadCoverageMap(): Promise<Map<string, StockCoverage>> {
  const now = Date.now();
  if (coverageCache && cacheTtl > now) {
    return coverageCache;
  }

  // Quote days per stock
  const quoteGroups = await prisma.stockQuote.groupBy({
    by: ['stockId'],
    _count: { _all: true },
  });
  const quoteDaysMap = new Map(quoteGroups.map(g => [g.stockId, g._count._all]));

  // Chip coverage (distinct stockIds + latest date + date count)
  const chipGroups = await (prisma as any).institutionalChip.groupBy({
    by: ['stockId'],
    _count: { _all: true },
    _max: { date: true },
  }) as { stockId: string; _count: { _all: number }; _max: { date: string | null } }[];

  const chipMap = new Map(chipGroups.map(g => ({
    stockId: g.stockId,
    dates: g._count._all,
    latestDate: g._max.date,
  })).map(g => [g.stockId, g]));

  // All symbols that appear in either table
  const allSymbols = new Set([
    ...quoteDaysMap.keys(),
    ...chipMap.keys(),
  ]);

  const today = new Date().toISOString().slice(0, 10);
  const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const map = new Map<string, StockCoverage>();
  for (const symbol of allSymbols) {
    const quoteDays = quoteDaysMap.get(symbol) ?? 0;
    const chipInfo = chipMap.get(symbol);
    const hasChip = !!chipInfo && chipInfo.dates > 0;
    const chipLatestDate = chipInfo?.latestDate ?? null;
    const chipFresh = chipLatestDate !== null && chipLatestDate >= fiveDaysAgo;
    const tier = classifyTier(quoteDays, hasChip);

    map.set(symbol, {
      symbol,
      quoteDays,
      hasChip,
      chipLatestDate,
      chipDatesAvailable: chipInfo?.dates ?? 0,
      tier,
      tierLabel: tierLabel(tier),
      capabilities: buildCapabilities(quoteDays, hasChip, chipFresh),
      limitations: buildLimitations(quoteDays, hasChip, chipFresh),
    });
  }

  coverageCache = map;
  cacheTtl = now + CACHE_TTL_MS;
  return map;
}

/**
 * Get coverage info for a single stock symbol.
 * Returns a Tier C record with 0 quote days if symbol has no data.
 */
export async function getStockCoverage(symbol: string): Promise<StockCoverage> {
  const map = await loadCoverageMap();
  return map.get(symbol) ?? {
    symbol,
    quoteDays: 0,
    hasChip: false,
    chipLatestDate: null,
    chipDatesAvailable: 0,
    tier: 'C',
    tierLabel: tierLabel('C'),
    capabilities: buildCapabilities(0, false, false),
    limitations: ['此股票無任何歷史資料'],
  };
}

/**
 * Get coverage info for multiple symbols at once (efficient batch).
 */
export async function getBatchCoverage(symbols: string[]): Promise<Map<string, StockCoverage>> {
  const map = await loadCoverageMap();
  const result = new Map<string, StockCoverage>();
  for (const sym of symbols) {
    result.set(sym, map.get(sym) ?? {
      symbol: sym,
      quoteDays: 0,
      hasChip: false,
      chipLatestDate: null,
      chipDatesAvailable: 0,
      tier: 'C',
      tierLabel: tierLabel('C'),
      capabilities: buildCapabilities(0, false, false),
      limitations: ['此股票無任何歷史資料'],
    });
  }
  return result;
}

/**
 * Get all symbols at a given tier or above.
 * E.g., getTierSymbols('A') → only Tier A stocks
 *       getTierSymbols('B') → Tier A + B
 */
export async function getTierSymbols(minTier: CoverageTier): Promise<string[]> {
  const map = await loadCoverageMap();
  const tierOrder: Record<CoverageTier, number> = { A: 3, B: 2, C: 1 };
  const minOrder = tierOrder[minTier];
  return Array.from(map.values())
    .filter(s => tierOrder[s.tier] >= minOrder)
    .map(s => s.symbol);
}

/**
 * Get aggregate summary by tier.
 */
export async function getCoverageSummary(): Promise<CoverageSummaryByTier> {
  const map = await loadCoverageMap();
  let tierA = 0, tierB = 0, tierC = 0;
  let quoteOnly = 0, chipOnly = 0;

  for (const cov of map.values()) {
    if (cov.tier === 'A') tierA++;
    else if (cov.tier === 'B') tierB++;
    else tierC++;

    if (cov.quoteDays > 0 && !cov.hasChip) quoteOnly++;
    if (cov.quoteDays === 0 && cov.hasChip) chipOnly++;
  }

  return {
    tierA,
    tierB,
    tierC,
    total: map.size,
    quoteOnlyStocks: quoteOnly,
    chipOnlyStocks: chipOnly,
    lastComputedAt: new Date().toISOString(),
  };
}

/**
 * Invalidate the coverage cache (call after syncing new data).
 */
export function invalidateCoverageCache() {
  clearCache();
}

export const CoverageService = {
  getStockCoverage,
  getBatchCoverage,
  getTierSymbols,
  getCoverageSummary,
  invalidateCoverageCache,
};
