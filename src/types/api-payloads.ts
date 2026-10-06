/**
 * Shared API response payload interfaces.
 *
 * These types mirror the actual contract returned by the API routes.
 * Do NOT change field names here without also updating the corresponding route.
 */

import type { DataAvailabilityType } from './status';

// ── Common building blocks ───────────────────────────────────────────────────

export interface DataCoverageBase {
  /** Limitation notes to surface in the UI */
  limitations: string[];
}

/** Coverage metadata returned alongside rankings data */
export interface RankingsCoverage extends DataCoverageBase {
  stocks: number;
  total: number;
  dates?: number;
}

/** Coverage metadata returned alongside signal data */
export interface SignalsCoverage extends DataCoverageBase {
  analyzed: number;
  sufficient: number;
  total: number;
  minDays: number;
}

/** Coverage metadata returned alongside institutional (chip) data */
export interface InstitutionalCoverage extends DataCoverageBase {
  stocksWithChipData: number;
  totalChipRows: number;
  minRequired: number;
}

// ── Rankings (/api/rankings) ─────────────────────────────────────────────────

export interface RankingsRowItem {
  symbol: string;
  name: string;
  industry: string;
  price: number | null;
  change: number | null;
  volume: number | null;
  foreignBuy?: number | null;
  trustBuy?: number | null;
  dealerBuy?: number | null;
  totalBuy?: number | null;
  date?: string | null;
  changePercent?: number | null;
  stockCount?: number | null;
}

export interface RankingsApiResponse {
  data: RankingsRowItem[];
  source: string;
  type: string;
  coverage: RankingsCoverage;
  sample_size: number;
  last_updated: string | null;
  updatedAt: string;
}

// ── Institutional / Chip Anomaly (/api/institutional) ───────────────────────

export interface InstitutionalSignalItem {
  type: string;
  severity: string;
  score: number;
  reasoning: string;
}

export interface InstitutionalScanItem {
  symbol: string;
  name: string;
  industry: string;
  price: number | null;
  change: number | null;
  volume: number | null;
  anomalyScore: number;
  phase: string;
  phaseDescription: string;
  signals: InstitutionalSignalItem[];
}

export interface InstitutionalApiResponse {
  data: InstitutionalScanItem[];
  source: string;
  methodology: string;
  disclaimer: string;
  coverage: InstitutionalCoverage;
  updatedAt: string;
}

// ── Signals / Technical Indicators (/api/signals) ───────────────────────────

export type TradingSignalType = 'BUY' | 'SELL' | 'HOLD' | 'WATCH';

export interface SignalIndicatorDetail {
  ma20: number | null;
  ma60: number | null;
  rsi: number | null;
  macdHistogram: number | null;
  bollingerUpper: number | null;
  bollingerLower: number | null;
  avgVolume20: number | null;
  volumeRatio: number | null;
}

export interface SignalPriceLevels {
  /** Suggested observation range */
  observeRange: { low: number; high: number } | null;
  buyTarget: number | null;
  stopLoss: number | null;
  priceTarget: number | null;
  /** Basis for each price level */
  methodology: string;
}

export interface SignalResultItem {
  symbol: string;
  name: string;
  industry: string;
  currentPrice: number;
  signal: TradingSignalType;
  strength: number;
  signalDate: string;
  dataPeriod: string;
  dataPoints: number;
  indicators: SignalIndicatorDetail;
  priceLevels: SignalPriceLevels;
  reasoning: string[];
  disclaimer: string;
}

export interface SignalsApiResponse {
  data: SignalResultItem[];
  source: string;
  methodology: string;
  disclaimer: string;
  coverage: SignalsCoverage;
  sample_size: number;
  last_updated: string | null;
  updatedAt: string;
}

// ── System Health (/api/system/health) ──────────────────────────────────────

export interface SystemHealthSection {
  status: DataAvailabilityType | string;
  label?: string;
  count?: number;
  message?: string;
}

export interface SystemHealthApiResponse {
  status: string;
  sections: Record<string, SystemHealthSection>;
  updatedAt: string;
  limitations?: string[];
}

// ── Watchlist (/api/watchlist) ───────────────────────────────────────────────

export interface WatchlistItem {
  id: string;
  stockId: string;
  notes: string | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  stock?: {
    id: string;
    name: string;
    industry: string | null;
  };
}

// ── Market Status (/api/market-status) ──────────────────────────────────────

export interface MarketStatusApiResponse {
  isOpen: boolean;
  nextOpen?: string | null;
  message?: string;
}

// ── System Backup / Restore (/api/system/restore) ───────────────────────────

export interface WatchlistBackupItem {
  stockId: string;
  entryPrice?: number | null;
  quantity?: number | null;
  addedAt?: string | null;
  note?: string | null;
}

export interface AlertBackupItem {
  symbol: string;
  type: string;
  target: number;
  isActive?: boolean;
  triggered?: boolean;
}

export interface BackupPayload {
  version?: string;
  exportedAt?: string;
  data: {
    watchlist: WatchlistBackupItem[];
    alerts: AlertBackupItem[];
  };
}
