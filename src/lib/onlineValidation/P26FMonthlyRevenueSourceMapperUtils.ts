/**
 * P26F-HARDRESET: MonthlyRevenue Source Mapper (Pure Functions)
 *
 * Maps MonthlyRevenue DB rows to candidate replay corpus rows.
 * PIT gate: releaseDate <= asOfDate. Null releaseDate = NOT visible.
 * ZERO external imports. No random number generation. No mutation of input objects.
 *
 * Disclaimer: No investment recommendations. No ROI/win-rate/profit/outperform/buy/sell claims.
 */

export interface MonthlyRevenueSourceRow {
  stockId: string;
  year: number;
  month: number;
  revenue: number;
  yoyGrowth?: number | null;
  momGrowth?: number | null;
  releaseDate?: string | Date | null;
  releaseDateSource?: string | null;
  releaseDateConfidence?: string | null;
  createdAt?: string | Date | null;
}

export interface MonthlyRevenueContext {
  readOnly: true;
  entersAlphaScore: false;
  visibilityGate: "releaseDate <= asOfDate";
  sourceMatched: boolean;
  releaseDate: string | null;
  revenueYear: number | null;
  revenueMonth: number | null;
  revenue: number | null;
  yoyGrowth: number | null;
  momGrowth: number | null;
  sourceHash: string;
  sourceMode: string;
  pitGateStatus: string;
}

export function normalizeMonthlyRevenueSourceRow(rawRow: MonthlyRevenueSourceRow): MonthlyRevenueSourceRow {
  const releaseDate = rawRow.releaseDate instanceof Date
    ? rawRow.releaseDate.toISOString()
    : rawRow.releaseDate ?? null;
  const createdAt = rawRow.createdAt instanceof Date
    ? rawRow.createdAt.toISOString()
    : rawRow.createdAt ?? null;
  return {
    stockId: rawRow.stockId,
    year: rawRow.year,
    month: rawRow.month,
    revenue: rawRow.revenue,
    yoyGrowth: rawRow.yoyGrowth ?? null,
    momGrowth: rawRow.momGrowth ?? null,
    releaseDate,
    releaseDateSource: rawRow.releaseDateSource ?? null,
    releaseDateConfidence: rawRow.releaseDateConfidence ?? null,
    createdAt,
  };
}

export function resolveMonthlyRevenueReleaseDate(row: MonthlyRevenueSourceRow): string | null {
  if (row.releaseDate === null || row.releaseDate === undefined) return null;
  const ts = row.releaseDate instanceof Date
    ? row.releaseDate.toISOString()
    : String(row.releaseDate);
  return new Date(Date.parse(ts) + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export function buildMonthlyRevenueSourceHash(row: MonthlyRevenueSourceRow): string {
  return `${row.stockId}|${row.year}|${row.month}`;
}

export function isMonthlyRevenueVisibleAsOf(row: MonthlyRevenueSourceRow, asOfDate: string): boolean {
  const rd = resolveMonthlyRevenueReleaseDate(row);
  if (!rd) return false;
  return rd <= asOfDate;
}

export function selectLatestMonthlyRevenueAsOf(
  sourceRows: MonthlyRevenueSourceRow[],
  symbol: string,
  asOfDate: string,
): MonthlyRevenueSourceRow | null {
  const visible = sourceRows.filter(
    r => r.stockId === symbol && isMonthlyRevenueVisibleAsOf(r, asOfDate),
  );
  if (visible.length === 0) return null;
  visible.sort((a, b) => {
    const rdA = resolveMonthlyRevenueReleaseDate(a)!;
    const rdB = resolveMonthlyRevenueReleaseDate(b)!;
    if (rdB !== rdA) return rdB < rdA ? -1 : 1;
    const mA = a.year * 12 + a.month;
    const mB = b.year * 12 + b.month;
    if (mB !== mA) return mB - mA;
    const hA = buildMonthlyRevenueSourceHash(a);
    const hB = buildMonthlyRevenueSourceHash(b);
    return hA < hB ? -1 : hA > hB ? 1 : 0;
  });
  return visible[0];
}

export function buildMonthlyRevenueContextForReplayRow(
  _corpusRow: object,
  selectedSource: MonthlyRevenueSourceRow | null,
  sourceMode: string,
): MonthlyRevenueContext {
  if (selectedSource === null) {
    return {
      readOnly: true,
      entersAlphaScore: false,
      visibilityGate: "releaseDate <= asOfDate",
      sourceMatched: false,
      releaseDate: null,
      revenueYear: null,
      revenueMonth: null,
      revenue: null,
      yoyGrowth: null,
      momGrowth: null,
      sourceHash: "NO_MATCH",
      sourceMode,
      pitGateStatus: "NO_VISIBLE_SOURCE_ROW",
    };
  }
  return {
    readOnly: true,
    entersAlphaScore: false,
    visibilityGate: "releaseDate <= asOfDate",
    sourceMatched: true,
    releaseDate: resolveMonthlyRevenueReleaseDate(selectedSource),
    revenueYear: selectedSource.year,
    revenueMonth: selectedSource.month,
    revenue: selectedSource.revenue,
    yoyGrowth: selectedSource.yoyGrowth ?? null,
    momGrowth: selectedSource.momGrowth ?? null,
    sourceHash: buildMonthlyRevenueSourceHash(selectedSource),
    sourceMode,
    pitGateStatus: "VISIBLE_RELEASE_DATE_GATE_PASS",
  };
}

export function mapMonthlyRevenueToReplayRow(
  corpusRow: object,
  sourceRows: MonthlyRevenueSourceRow[],
  sourceMode: string,
): object {
  const row = corpusRow as Record<string, unknown>;
  const symbol = row['symbol'] as string;
  const asOfDate = row['originalAsOfDate'] as string;
  const selectedSource = selectLatestMonthlyRevenueAsOf(sourceRows, symbol, asOfDate);
  const context = buildMonthlyRevenueContextForReplayRow(corpusRow, selectedSource, sourceMode);
  return { ...row, p26fMonthlyRevenueContext: context };
}

export function validateMonthlyRevenueMappingNoOutcomeFields(mappedRow: object): { valid: boolean; violations: string[] } {
  const row = mappedRow as Record<string, unknown>;
  const context = row['p26fMonthlyRevenueContext'] as Record<string, unknown> | undefined;
  const forbidden = ['outcomePrice', 'returnPct', 'realizedReturnClass'];
  const violations: string[] = [];
  if (context) {
    for (const f of forbidden) {
      if (f in context) violations.push(`Forbidden field "${f}" found in p26fMonthlyRevenueContext`);
    }
  }
  return { valid: violations.length === 0, violations };
}

export function validateMonthlyRevenueMappingReadOnly(mappedRow: object): { valid: boolean; violations: string[] } {
  const row = mappedRow as Record<string, unknown>;
  const context = row['p26fMonthlyRevenueContext'] as Record<string, unknown> | undefined;
  const violations: string[] = [];
  if (!context || context['readOnly'] !== true) {
    violations.push('p26fMonthlyRevenueContext.readOnly must be true');
  }
  return { valid: violations.length === 0, violations };
}

export function validateMonthlyRevenueDoesNotEnterScoring(mappedRow: object): { valid: boolean; violations: string[] } {
  const row = mappedRow as Record<string, unknown>;
  const context = row['p26fMonthlyRevenueContext'] as Record<string, unknown> | undefined;
  const violations: string[] = [];
  if (!context || context['entersAlphaScore'] !== false) {
    violations.push('p26fMonthlyRevenueContext.entersAlphaScore must be false');
  }
  return { valid: violations.length === 0, violations };
}
