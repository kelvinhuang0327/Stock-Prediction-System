// P26F3-2-HARDRESET: Manual Source Acceptance Validator
// DISCLAIMER: Does not constitute investment advice.
// No DB write. No corpus write. No scoring change. No external API. No Math.random.

import {
  P26F3_2_TARGET_PERIODS,
  P26F3_2_TARGET_SYMBOLS,
  P26F3_2_FORBIDDEN_FIELDS,
  P26F3_2_CLASSIFICATIONS,
  P26F3_2_ALLOWED_SOURCE_NAMES,
  P26F3_2_DRY_RUN_CONTRACT,
} from "./P26F32ManualSourceAcquisitionContractUtils";

export interface ManualMonthlyRevenueRow {
  stockId?: string;
  symbol?: string;
  year: number | string;
  month: number | string;
  revenue: number | string;
  releaseDate?: string;
  sourceReleaseDate?: string;
  sourceName: string;
  sourceFileName: string;
  [key: string]: unknown;
}

export interface AcceptedManualRevenueRow {
  stockId: string;
  year: number;
  month: number;
  period: string;
  revenue: number;
  releaseDate: string;
  sourceName: string;
  sourceFileName: string;
  dryRunOnly: true;
  dbWriteAllowed: false;
  corpusWriteAllowed: false;
  rowHash: string;
  normalizedAt: string;
  companyName?: string;
  yoyGrowth?: number | null;
  momGrowth?: number | null;
  accumulatedRevenue?: number | null;
  accumulatedYoyGrowth?: number | null;
  sourceUrl?: string;
  sourceHash?: string;
}

export interface ManualRowValidationResult {
  valid: boolean;
  row: ManualMonthlyRevenueRow;
  violations: string[];
  accepted?: AcceptedManualRevenueRow;
}

export interface ManualSourceManifest {
  generatedAt: string;
  totalRows: number;
  acceptedRows: number;
  rejectedRows: number;
  classification: string;
  dryRunContract: typeof P26F3_2_DRY_RUN_CONTRACT;
  readyForP26F4: boolean;
  rows: AcceptedManualRevenueRow[];
}

function deterministicRowHash(stockId: string, year: number, month: number): string {
  const key = `${stockId}:${year}:${month}`;
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = ((hash << 5) - hash) + key.charCodeAt(i);
    hash = hash & hash;
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function isNumeric(val: unknown): boolean {
  if (val === null || val === undefined || val === "") return false;
  return !isNaN(Number(val));
}

function isDateParseable(val: unknown): boolean {
  if (typeof val !== "string" || !val.trim()) return false;
  const d = new Date(val);
  return !isNaN(d.getTime());
}

function periodFromYearMonth(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

export function validateManualMonthlyRevenueRow(row: ManualMonthlyRevenueRow, contract: { targetPeriods: string[]; targetSymbols: string[] }): ManualRowValidationResult {
  const violations: string[] = [];
  const stockId = (row.stockId || row.symbol || "").toString().trim();
  if (!stockId) violations.push("Missing stockId/symbol");
  const year = Number(row.year);
  const month = Number(row.month);
  if (isNaN(year) || isNaN(month)) violations.push("year/month must be numeric");
  const period = periodFromYearMonth(year, month);
  if (!contract.targetPeriods.includes(period)) violations.push(`Period ${period} not in target periods`);
  if (stockId && !contract.targetSymbols.includes(stockId)) violations.push(`Symbol ${stockId} not in target symbols`);
  if (!isNumeric(row.revenue)) violations.push("revenue must be numeric");
  const releaseDate = (row.releaseDate || row.sourceReleaseDate || "").toString().trim();
  if (!releaseDate) violations.push("Missing releaseDate/sourceReleaseDate");
  if (releaseDate && !isDateParseable(releaseDate)) violations.push(`releaseDate not parseable: ${releaseDate}`);
  if (!row.sourceName) violations.push("Missing sourceName");
  if (row.sourceName && !P26F3_2_ALLOWED_SOURCE_NAMES.includes(row.sourceName.toUpperCase())) {
    violations.push(`sourceName must be one of ${P26F3_2_ALLOWED_SOURCE_NAMES.join(", ")}, got: ${row.sourceName}`);
  }
  if (!row.sourceFileName) violations.push("Missing sourceFileName");
  const foundForbidden = P26F3_2_FORBIDDEN_FIELDS.filter(f => f in row && row[f] != null);
  if (foundForbidden.length > 0) violations.push(`Forbidden fields: ${foundForbidden.join(", ")}`);
  if (violations.length > 0) return { valid: false, row, violations };
  const accepted: AcceptedManualRevenueRow = {
    stockId,
    year,
    month,
    period,
    revenue: Number(row.revenue),
    releaseDate,
    sourceName: row.sourceName.toUpperCase(),
    sourceFileName: row.sourceFileName as string,
    dryRunOnly: true,
    dbWriteAllowed: false,
    corpusWriteAllowed: false,
    rowHash: deterministicRowHash(stockId, year, month),
    normalizedAt: new Date().toISOString(),
  };
  if (row.companyName != null) accepted.companyName = row.companyName as string;
  if (row.yoyGrowth != null) accepted.yoyGrowth = Number(row.yoyGrowth);
  if (row.momGrowth != null) accepted.momGrowth = Number(row.momGrowth);
  if (row.accumulatedRevenue != null) accepted.accumulatedRevenue = Number(row.accumulatedRevenue);
  if (row.accumulatedYoyGrowth != null) accepted.accumulatedYoyGrowth = Number(row.accumulatedYoyGrowth);
  if (row.sourceUrl) accepted.sourceUrl = row.sourceUrl as string;
  if (row.sourceHash) accepted.sourceHash = row.sourceHash as string;
  return { valid: true, row, violations: [], accepted };
}

export function validateManualMonthlyRevenueRows(rows: ManualMonthlyRevenueRow[], contract: { targetPeriods: string[]; targetSymbols: string[] }): ManualRowValidationResult[] {
  return rows.map(r => validateManualMonthlyRevenueRow(r, contract));
}

export function normalizeAcceptedManualMonthlyRevenueRow(row: ManualMonthlyRevenueRow): AcceptedManualRevenueRow | null {
  const result = validateManualMonthlyRevenueRow(row, {
    targetPeriods: P26F3_2_TARGET_PERIODS,
    targetSymbols: P26F3_2_TARGET_SYMBOLS,
  });
  return result.valid ? result.accepted! : null;
}

export function buildAcceptedManualSourceManifest(rows: AcceptedManualRevenueRow[]): ManualSourceManifest {
  // Deterministic dedup: last row wins per stockId+year+month key (stable sort)
  const dedupMap = new Map<string, AcceptedManualRevenueRow>();
  for (const r of rows) {
    dedupMap.set(`${r.stockId}:${r.year}:${r.month}`, r);
  }
  const deduped = Array.from(dedupMap.values());
  const classification = deduped.length > 0
    ? P26F3_2_CLASSIFICATIONS.MANUAL_SOURCE_ACCEPTED_DRY_RUN
    : P26F3_2_CLASSIFICATIONS.SOURCE_NOT_PROVIDED_PACKAGE_READY;
  return {
    generatedAt: new Date().toISOString(),
    totalRows: rows.length,
    acceptedRows: deduped.length,
    rejectedRows: rows.length - deduped.length,
    classification,
    dryRunContract: P26F3_2_DRY_RUN_CONTRACT,
    readyForP26F4: deduped.length > 0,
    rows: deduped,
  };
}

export function classifyManualSourceAcceptance(rows: AcceptedManualRevenueRow[]): string {
  if (rows.length === 0) return P26F3_2_CLASSIFICATIONS.SOURCE_NOT_PROVIDED_PACKAGE_READY;
  return P26F3_2_CLASSIFICATIONS.MANUAL_SOURCE_ACCEPTED_DRY_RUN;
}

export function validateAcceptedRowsNoOutcomeFields(rows: AcceptedManualRevenueRow[]): { pass: boolean; violations: string[] } {
  const violations: string[] = [];
  for (const r of rows) {
    const forbidden = P26F3_2_FORBIDDEN_FIELDS.filter(f => f in r && (r as Record<string,unknown>)[f] != null);
    if (forbidden.length > 0) violations.push(`Row ${r.stockId}:${r.year}:${r.month} has forbidden fields: ${forbidden.join(", ")}`);
  }
  return { pass: violations.length === 0, violations };
}

export function validateAcceptedRowsPITSafe(rows: AcceptedManualRevenueRow[]): { pass: boolean; violations: string[] } {
  const violations: string[] = [];
  for (const r of rows) {
    if (!r.releaseDate || !isDateParseable(r.releaseDate)) {
      violations.push(`Row ${r.stockId}:${r.year}:${r.month} has unparseable releaseDate: ${r.releaseDate}`);
    }
    if (r.dryRunOnly !== true) violations.push(`Row ${r.stockId}:${r.year}:${r.month} dryRunOnly must be true`);
    if (r.dbWriteAllowed !== false) violations.push(`Row ${r.stockId}:${r.year}:${r.month} dbWriteAllowed must be false`);
    if (r.corpusWriteAllowed !== false) violations.push(`Row ${r.stockId}:${r.year}:${r.month} corpusWriteAllowed must be false`);
  }
  return { pass: violations.length === 0, violations };
}
