import { render, screen } from '@testing-library/react';
import {
  CandidateFundamentalCard,
  CandidateFundamentalCue,
} from '../CandidateFundamentalCard';
import type { StockFundamentalSnapshot } from '@/lib/fundamentals/StockFundamentalSnapshot';
import type { FundamentalRiskOverlay } from '@/lib/fundamental/FundamentalRiskOverlayEngine';

const baseSnapshot: StockFundamentalSnapshot = {
  kind: 'stock',
  dataCoverage: 'full',
  revenue: {
    latestMonth: '2026/02',
    revenue: 2100,
    yoyGrowth: 18.5,
    momGrowth: 2.1,
    trend: 'improving',
    consecutivePositiveYoYMonths: 4,
  },
  profitability: {
    latestPeriod: '2025 Q4',
    eps: 9.2,
    previousEps: 8.7,
    epsQoQDelta: 0.5,
    grossMargin: 54.1,
    grossMarginDelta: 1.1,
    operatingMargin: 42.3,
    operatingMarginDelta: 0.7,
  },
  valuation: {
    asOfDate: '2026-03-24',
    pe: 24.6,
    pb: 3.1,
    dividendYield: 2.2,
  },
  keySignals: ['營收年增維持雙位數'],
  keyRisks: ['估值偏高，需結合同業比較與成長性一併解讀。'],
  summary: '基本面整體穩定，營運訊號偏正向。',
  limitations: [],
};

const baseOverlay: FundamentalRiskOverlay = {
  riskLevel: 'elevated',
  strengths: ['同組成長表現偏強'],
  pressures: ['相對同組估值偏高'],
  valuationContext: 'PE / PB 相對同組偏高，後續需要成長持續性支撐。',
  growthContext: '同組成長表現偏強，但估值壓力較高。',
  summary: '同組成長表現偏強，但估值壓力較高。',
  limitations: ['同組樣本有限，解讀已保守處理。'],
};

describe('CandidateFundamentalCue', () => {
  test('shows overlay badge and summary when overlay is provided', () => {
    render(<CandidateFundamentalCue fundamentals={baseSnapshot} overlay={baseOverlay} />);
    expect(screen.getByText('基本面壓力')).toBeInTheDocument();
    expect(screen.getByText('同組成長表現偏強，但估值壓力較高。')).toBeInTheDocument();
  });

  test('shows revenue YoY cue for stocks', () => {
    render(<CandidateFundamentalCue fundamentals={baseSnapshot} />);
    expect(screen.getByText(/基本面：營收 YoY \+18.5%/i)).toBeInTheDocument();
  });

  test('shows ETF cue for etf snapshots', () => {
    render(
      <CandidateFundamentalCue
        fundamentals={{ ...baseSnapshot, kind: 'etf', revenue: { ...baseSnapshot.revenue, yoyGrowth: null } }}
      />,
    );
    expect(screen.getByText(/ETF 以估值\/收益視角解讀/i)).toBeInTheDocument();
  });
});

describe('CandidateFundamentalCard', () => {
  test('renders summary, metrics, signals and risks', () => {
    render(<CandidateFundamentalCard fundamentals={baseSnapshot} />);

    expect(screen.getByText('基本面研究')).toBeInTheDocument();
    expect(screen.getByText('基本面整體穩定，營運訊號偏正向。')).toBeInTheDocument();
    expect(screen.getByText('營收')).toBeInTheDocument();
    expect(screen.getByText('獲利')).toBeInTheDocument();
    expect(screen.getByText('估值')).toBeInTheDocument();
    expect(screen.getByText('營收年增維持雙位數')).toBeInTheDocument();
    expect(screen.getByText('估值偏高，需結合同業比較與成長性一併解讀。')).toBeInTheDocument();
  });

  test('renders overlay summary, strengths, pressures and limitations', () => {
    render(<CandidateFundamentalCard fundamentals={baseSnapshot} overlay={baseOverlay} />);

    expect(screen.getByText('同組基本面風險 overlay')).toBeInTheDocument();
    expect(screen.getByText('基本面壓力')).toBeInTheDocument();
    expect(screen.getAllByText(/同組成長表現偏強/).length).toBeGreaterThan(0);
    expect(screen.getByText(/相對同組估值偏高/)).toBeInTheDocument();
    expect(screen.getByText(/同組樣本有限，解讀已保守處理/)).toBeInTheDocument();
  });
});
