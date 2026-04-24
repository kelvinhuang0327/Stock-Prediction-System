export type PeerPercentileDetailCategory =
  | 'growth'
  | 'valuation'
  | 'financialStructure'
  | 'efficiency';

export interface PeerPercentileDetailRow {
  key: string;
  label: string;
  category: PeerPercentileDetailCategory;
  value: number | null;
  median: number | null;
  percentile: number | null;
  interpretation: string;
  basis?: 'industry' | 'sector' | 'none';
  peerSampleSize?: number | null;
  limitations?: string[];
  displayUnit?: 'percent' | 'ratio' | 'currency' | 'number';
}

export interface PeerPercentileDetailTable {
  rows: PeerPercentileDetailRow[];
  basis: 'industry' | 'sector' | 'none';
  peerSampleSize: number | null;
  limitations: string[];
}
