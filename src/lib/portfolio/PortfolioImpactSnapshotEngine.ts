import { prisma } from '@/lib/prisma';
import { runScreen } from '@/lib/screen/StrategyScreenEngine';
import { generatePortfolioDecisionSupport } from '@/lib/portfolio/PortfolioImpactEngine';
import type { PortfolioDecisionSupport, PortfolioImpactSnapshotComparison, PortfolioImpactSnapshotRecord } from '@/types/portfolio';

export type PortfolioSnapshotScope = 'watchlist' | 'candidates';
export type CompareWindow = '1d' | '7d' | '30d';

interface SnapshotRow {
  snapshotDate: string;
  scope: string;
  symbols: string | null;
  themeConcentration: string | null;
  sectorConcentration: string | null;
  riskClusters: string | null;
  regimeExposure: string | null;
  summary: string | null;
  limitations: string | null;
}

export interface CreatePortfolioSnapshotResult {
  success: boolean;
  created: boolean;
  updated: boolean;
  snapshot: PortfolioImpactSnapshotRecord;
  limitations: string[];
}

const WINDOW_DAYS: Record<CompareWindow, number> = {
  '1d': 1,
  '7d': 7,
  '30d': 30,
};

function safeJsonParse<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function emptyDecisionSupport(message = '尚無組合快照資料'): PortfolioDecisionSupport {
  return {
    summary: message,
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
    limitations: ['尚未建立 portfolio snapshot'],
  };
}

function toSnapshotRecord(row: SnapshotRow): PortfolioImpactSnapshotRecord {
  const fallback = emptyDecisionSupport('快照資料欄位不完整，已降級');
  return {
    snapshotDate: row.snapshotDate,
    scope: row.scope === 'candidates' ? 'candidates' : 'watchlist',
    symbols: safeJsonParse<string[]>(row.symbols, []),
    themeConcentration: safeJsonParse(row.themeConcentration, fallback.themeConcentration),
    sectorConcentration: safeJsonParse(row.sectorConcentration, fallback.sectorConcentration),
    riskClusters: safeJsonParse(row.riskClusters, fallback.riskClusters),
    regimeExposure: safeJsonParse(row.regimeExposure, fallback.regimeExposure),
    summary: row.summary ?? fallback.summary,
    limitations: safeJsonParse<string[]>(row.limitations, fallback.limitations),
  };
}

async function resolveSymbols(scope: PortfolioSnapshotScope, explicit?: string[]): Promise<string[]> {
  const cleanedExplicit = [...new Set((explicit ?? []).map((s) => s.trim().toUpperCase()).filter(Boolean))].slice(0, 40);
  if (cleanedExplicit.length > 0) return cleanedExplicit;
  if (scope === 'candidates') {
    const screen = await runScreen().catch(() => null);
    return (screen?.candidates ?? []).map((c) => c.symbol.toUpperCase()).slice(0, 30);
  }
  const items = await prisma.watchlist.findMany({ select: { stockId: true } }).catch(() => []);
  return items.map((i) => i.stockId.toUpperCase()).slice(0, 40);
}

async function resolveWeights(scope: PortfolioSnapshotScope, symbols: string[]): Promise<Record<string, number>> {
  if (scope === 'candidates') return {};
  const items = await prisma.watchlist
    .findMany({ where: { stockId: { in: symbols } }, select: { stockId: true, quantity: true } })
    .catch(() => []);
  const out: Record<string, number> = {};
  for (const item of items) {
    const q = Number(item.quantity ?? 0);
    out[item.stockId.toUpperCase()] = q > 0 ? q : 1;
  }
  return out;
}

function levelRank(level: string): number {
  const order = ['low', 'moderate', 'elevated', 'high', 'unknown'];
  const idx = order.indexOf(level);
  return idx >= 0 ? idx : order.length - 1;
}

export function comparePortfolioSnapshots(
  current: PortfolioImpactSnapshotRecord,
  previous: PortfolioImpactSnapshotRecord | null,
  compareWindow: CompareWindow = '1d',
): PortfolioImpactSnapshotComparison {
  if (!previous) {
    return {
      comparisonAvailable: false,
      previousSnapshotDate: null,
      compareWindow,
      themeChanged: false,
      sectorChanged: false,
      riskChanged: false,
      regimeExposureChanged: false,
      summaryNote: `查無 ${compareWindow} 對應基準 snapshot，暫無法比較組合演變。`,
      details: {
        themeLevelChange: { from: 'unknown', to: current.themeConcentration.concentrationLevel ?? 'unknown' },
        sectorLevelChange: { from: 'unknown', to: current.sectorConcentration.concentrationLevel ?? 'unknown' },
        riskLevelChange: { from: 'unknown', to: current.riskClusters.overallRiskLevel ?? 'unknown' },
        regimeChange: { from: 'Unknown', to: current.regimeExposure.regime, fromSensitivity: 'unknown', toSensitivity: current.regimeExposure.sensitivity },
        topThemeChange: { from: null, to: current.themeConcentration.topThemes[0]?.theme ?? null },
        topSectorChange: { from: null, to: current.sectorConcentration.sectors[0]?.sector ?? null },
      },
    };
  }

  const themeChanged =
    previous.themeConcentration.concentrationLevel !== current.themeConcentration.concentrationLevel ||
    (previous.themeConcentration.topThemes[0]?.theme ?? null) !== (current.themeConcentration.topThemes[0]?.theme ?? null);
  const sectorChanged =
    previous.sectorConcentration.concentrationLevel !== current.sectorConcentration.concentrationLevel ||
    (previous.sectorConcentration.sectors[0]?.sector ?? null) !== (current.sectorConcentration.sectors[0]?.sector ?? null);
  const riskChanged = previous.riskClusters.overallRiskLevel !== current.riskClusters.overallRiskLevel;
  const regimeExposureChanged =
    previous.regimeExposure.regime !== current.regimeExposure.regime ||
    previous.regimeExposure.sensitivity !== current.regimeExposure.sensitivity ||
    Math.abs(previous.regimeExposure.offensiveExposure - current.regimeExposure.offensiveExposure) >= 10;

  const notes: string[] = [];
  if (!themeChanged) notes.push('主題集中度相對穩定');
  else notes.push(`主題集中度由 ${previous.themeConcentration.concentrationLevel} 變為 ${current.themeConcentration.concentrationLevel}`);
  if (!sectorChanged) notes.push('產業分布無明顯變化');
  else notes.push(`產業集中度由 ${previous.sectorConcentration.concentrationLevel} 變為 ${current.sectorConcentration.concentrationLevel}`);
  if (riskChanged) {
    const up = levelRank(current.riskClusters.overallRiskLevel) > levelRank(previous.riskClusters.overallRiskLevel);
    notes.push(`風險群聚由 ${previous.riskClusters.overallRiskLevel} ${up ? '升至' : '降至'} ${current.riskClusters.overallRiskLevel}`);
  } else {
    notes.push('風險群聚等級未見顯著變化');
  }
  if (regimeExposureChanged) notes.push('市場曝險結構出現變化');
  else notes.push('市場曝險結構大致穩定');

  return {
    comparisonAvailable: true,
    previousSnapshotDate: previous.snapshotDate,
    compareWindow,
    themeChanged,
    sectorChanged,
    riskChanged,
    regimeExposureChanged,
    summaryNote: `${notes.join('；')}。僅供研究觀察，非交易訊號。`,
    details: {
      themeLevelChange: { from: previous.themeConcentration.concentrationLevel, to: current.themeConcentration.concentrationLevel },
      sectorLevelChange: { from: previous.sectorConcentration.concentrationLevel, to: current.sectorConcentration.concentrationLevel },
      riskLevelChange: { from: previous.riskClusters.overallRiskLevel, to: current.riskClusters.overallRiskLevel },
      regimeChange: {
        from: previous.regimeExposure.regime,
        to: current.regimeExposure.regime,
        fromSensitivity: previous.regimeExposure.sensitivity,
        toSensitivity: current.regimeExposure.sensitivity,
      },
      topThemeChange: { from: previous.themeConcentration.topThemes[0]?.theme ?? null, to: current.themeConcentration.topThemes[0]?.theme ?? null },
      topSectorChange: { from: previous.sectorConcentration.sectors[0]?.sector ?? null, to: current.sectorConcentration.sectors[0]?.sector ?? null },
    },
  };
}

export async function createPortfolioImpactSnapshot(options?: {
  scope?: PortfolioSnapshotScope;
  date?: string;
  forceRefresh?: boolean;
  symbols?: string[];
}): Promise<CreatePortfolioSnapshotResult> {
  const scope = options?.scope ?? 'watchlist';
  const snapshotDate = options?.date ?? new Date().toISOString().split('T')[0];
  const forceRefresh = options?.forceRefresh === true;
  const symbols = await resolveSymbols(scope, options?.symbols);
  const weights = await resolveWeights(scope, symbols);
  const analysis = await generatePortfolioDecisionSupport(symbols, { weights });

  const limitations = [...analysis.limitations];
  if (symbols.length < 3) limitations.push(`symbols 僅 ${symbols.length} 檔，集中度與群聚判斷可信度有限。`);

  const existing = await prisma.portfolioImpactSnapshot.findUnique({
    where: { snapshotDate_scope: { snapshotDate, scope } },
  });

  if (existing && !forceRefresh) {
    const snapshot = toSnapshotRecord(existing as unknown as SnapshotRow);
    return {
      success: true,
      created: false,
      updated: false,
      snapshot,
      limitations: [...snapshot.limitations, '同日 snapshot 已存在，可使用 forceRefresh 覆蓋。'],
    };
  }

  const upserted = await prisma.portfolioImpactSnapshot.upsert({
    where: { snapshotDate_scope: { snapshotDate, scope } },
    create: {
      snapshotDate,
      scope,
      symbols: JSON.stringify(symbols),
      themeConcentration: JSON.stringify(analysis.themeConcentration),
      sectorConcentration: JSON.stringify(analysis.sectorConcentration),
      riskClusters: JSON.stringify(analysis.riskClusters),
      regimeExposure: JSON.stringify(analysis.regimeExposure),
      summary: analysis.summary,
      limitations: JSON.stringify([...new Set(limitations)]),
    },
    update: {
      symbols: JSON.stringify(symbols),
      themeConcentration: JSON.stringify(analysis.themeConcentration),
      sectorConcentration: JSON.stringify(analysis.sectorConcentration),
      riskClusters: JSON.stringify(analysis.riskClusters),
      regimeExposure: JSON.stringify(analysis.regimeExposure),
      summary: analysis.summary,
      limitations: JSON.stringify([...new Set(limitations)]),
    },
  });

  return {
    success: true,
    created: !existing,
    updated: !!existing,
    snapshot: toSnapshotRecord(upserted as unknown as SnapshotRow),
    limitations: [...new Set(limitations)],
  };
}

export async function getLatestPortfolioImpactSnapshot(options?: {
  scope?: PortfolioSnapshotScope;
  comparison?: boolean;
  compareWindow?: CompareWindow;
}): Promise<{ snapshot: PortfolioImpactSnapshotRecord; comparison: PortfolioImpactSnapshotComparison }> {
  const scope = options?.scope ?? 'watchlist';
  const compareWindow = options?.compareWindow ?? '1d';
  const latest = await prisma.portfolioImpactSnapshot.findFirst({
    where: { scope },
    orderBy: { snapshotDate: 'desc' },
  });

  if (!latest) {
    const empty: PortfolioImpactSnapshotRecord = {
      snapshotDate: new Date().toISOString().split('T')[0],
      scope,
      symbols: [],
      ...emptyDecisionSupport('尚無組合快照，請先建立 snapshot。'),
    };
    return {
      snapshot: empty,
      comparison: comparePortfolioSnapshots(empty, null, compareWindow),
    };
  }

  const current = toSnapshotRecord(latest as unknown as SnapshotRow);
  if (!options?.comparison) {
    return {
      snapshot: current,
      comparison: comparePortfolioSnapshots(current, null, compareWindow),
    };
  }

  const baseDate = new Date(`${current.snapshotDate}T00:00:00.000Z`);
  baseDate.setUTCDate(baseDate.getUTCDate() - WINDOW_DAYS[compareWindow]);
  const targetDate = baseDate.toISOString().split('T')[0];

  const previous = await prisma.portfolioImpactSnapshot.findFirst({
    where: { scope, snapshotDate: targetDate },
  });
  return {
    snapshot: current,
    comparison: comparePortfolioSnapshots(current, previous ? toSnapshotRecord(previous as unknown as SnapshotRow) : null, compareWindow),
  };
}
