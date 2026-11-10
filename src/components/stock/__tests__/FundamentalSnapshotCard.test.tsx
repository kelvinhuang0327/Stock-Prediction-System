import { fireEvent, render, screen } from '@testing-library/react';
import { FundamentalSnapshotCard } from '../FundamentalSnapshotCard';
import type { StockFundamentalSnapshot } from '@/lib/fundamentals/StockFundamentalSnapshot';
import type { CashflowLeverageOverlay } from '@/lib/fundamental/CashflowLeverageOverlayEngine';
import type { CapitalEfficiencyOverlay } from '@/lib/fundamental/CapitalEfficiencyOverlayEngine';
import type { FinancialStructurePeerComparison } from '@/lib/fundamental/FinancialStructurePeerComparisonEngine';
import type { FullFundamentalComparisonMatrix } from '@/lib/fundamental/FullFundamentalComparisonMatrixBuilder';
import type { PeerPercentileDetailTable } from '@/lib/fundamental/types';

jest.mock('@/components/fundamental/FundamentalComparisonMatrix', () => ({
  FundamentalComparisonMatrix: ({
    selectedSectionKey,
    onSectionSelect,
  }: {
    selectedSectionKey?: string | null;
    onSectionSelect?: (key: string) => void;
  }) => (
    <div>
      <span>matrix-section:{selectedSectionKey ?? 'none'}</span>
      <button onClick={() => onSectionSelect?.('peerPosition')}>Select peer position</button>
      <button onClick={() => onSectionSelect?.('growth')}>Select growth</button>
    </div>
  ),
}));

jest.mock('@/components/fundamental/PeerPercentileDetailTable', () => ({
  PeerPercentileDetailTable: ({ activeCategory }: { activeCategory?: string | null }) => (
    <div data-testid="peer-detail-category">{activeCategory ?? 'none'}</div>
  ),
}));

const fundamentals: StockFundamentalSnapshot = {
  kind: 'stock',
  dataCoverage: 'full',
  revenue: {
    latestMonth: '2026/03',
    revenue: 2100,
    yoyGrowth: 18.5,
    momGrowth: 2.2,
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
  keyRisks: ['估值偏高，須持續觀察。'],
  summary: '基本面整體穩定，營運訊號偏正向。',
  limitations: ['同組樣本有限。'],
};

const cashflowOverlay: CashflowLeverageOverlay = {
  riskLevel: 'unknown',
  cashflowContext: '現金流資料不足。',
  leverageContext: '槓桿資料不足。',
  strengths: [],
  pressures: ['現金流仍需觀察。'],
  summary: '現金流及槓桿資料有限。',
  limitations: ['缺少現金流欄位。'],
};

const capitalOverlay: CapitalEfficiencyOverlay = {
  riskLevel: 'moderate',
  efficiencyContext: '資本效率中性。',
  profitabilityContext: '獲利效率穩定。',
  conversionContext: '轉現品質尚待追蹤。',
  strengths: ['資產使用效率穩定。'],
  pressures: [],
  summary: '效率整體中性。',
  limitations: ['仍需更多期間資料。'],
};

const financialStructure: FinancialStructurePeerComparison = {
  basis: 'none',
  groupLabel: null,
  peerSampleSize: 0,
  dataCoverage: 'insufficient',
  metrics: {
    currentRatio: { value: 1.8, median: 1.5, percentile: null, interpretation: '流動性接近同組中位。' },
    roe: { value: 18, median: 15, percentile: 72, interpretation: 'ROE 高於同組中位。' },
  },
  strengths: [],
  pressures: ['樣本量不足。'],
  summary: '目前無可靠的同組基準。',
  limitations: ['同組樣本不足。'],
};

const matrix = {} as FullFundamentalComparisonMatrix;
const percentileTable: PeerPercentileDetailTable = {
  rows: [],
  basis: 'none',
  peerSampleSize: null,
  limitations: [],
};

describe('FundamentalSnapshotCard', () => {
  it('shows the unavailable state when fundamental data is absent', () => {
    render(<FundamentalSnapshotCard fundamentals={null} />);

    expect(screen.getByText('基本面資料暫時不可用。')).toBeInTheDocument();
  });

  it('renders stock metrics, positive and risk signals, and limitations', () => {
    render(<FundamentalSnapshotCard fundamentals={fundamentals} />);

    expect(screen.getByText('基本面研究摘要')).toBeInTheDocument();
    expect(screen.getByText('資料完整')).toBeInTheDocument();
    expect(screen.queryByText('ETF 規則')).not.toBeInTheDocument();
    expect(screen.getByText('基本面支撐')).toBeInTheDocument();
    expect(screen.getByText('營收年增維持雙位數')).toBeInTheDocument();
    expect(screen.getByText('基本面風險')).toBeInTheDocument();
    expect(screen.getByText('估值偏高，須持續觀察。')).toBeInTheDocument();
    expect(screen.getByText('最新月份 2026/03')).toBeInTheDocument();
    expect(screen.getByText('2,100')).toBeInTheDocument();
    expect(screen.getByText('+18.50%')).toBeInTheDocument();
    expect(screen.getByText('QoQ +0.50 元')).toBeInTheDocument();
    expect(screen.getByText('研究限制')).toBeInTheDocument();
    expect(screen.getByText('同產業相對比較暫時不可用。')).toBeInTheDocument();
  });

  it('renders ETF and insufficient-data guidance with empty signal lists', () => {
    const etf = {
      ...fundamentals,
      kind: 'etf' as const,
      dataCoverage: 'insufficient' as const,
      revenue: {
        latestMonth: null,
        revenue: null,
        yoyGrowth: null,
        momGrowth: null,
        trend: 'insufficient' as const,
        consecutivePositiveYoYMonths: 0,
      },
      profitability: {
        latestPeriod: null,
        eps: null,
        previousEps: null,
        epsQoQDelta: null,
        grossMargin: null,
        grossMarginDelta: null,
        operatingMargin: null,
        operatingMarginDelta: null,
      },
      valuation: { asOfDate: null, pe: null, pb: null, dividendYield: null },
      keySignals: [],
      keyRisks: [],
      limitations: [],
    } satisfies StockFundamentalSnapshot;

    render(<FundamentalSnapshotCard fundamentals={etf} />);

    expect(screen.getByText('資料不足')).toBeInTheDocument();
    expect(screen.getByText('ETF 規則')).toBeInTheDocument();
    expect(screen.getByText('ETF 降級')).toBeInTheDocument();
    expect(screen.getByText('月營收資料不足')).toBeInTheDocument();
    expect(screen.getByText('財報資料不足')).toBeInTheDocument();
    expect(screen.getByText('估值資料不足')).toBeInTheDocument();
    expect(screen.getByText('目前無明確正向支撐')).toBeInTheDocument();
    expect(screen.getByText('目前無明確負向風險')).toBeInTheDocument();
    expect(screen.getByText('尚未形成足夠明確的基本面正向訊號。')).toBeInTheDocument();
    expect(screen.getByText('目前未偵測到明顯的基本面惡化訊號。')).toBeInTheDocument();
  });

  it('renders optional overlays and maps selected matrix sections to the detail table', () => {
    render(
      <FundamentalSnapshotCard
        fundamentals={{ ...fundamentals, limitations: [] }}
        cashflowLeverageOverlay={cashflowOverlay}
        capitalEfficiencyOverlay={capitalOverlay}
        financialStructurePeerComparison={financialStructure}
        fundamentalMatrix={matrix}
        peerPercentileDetailTable={percentileTable}
      />,
    );

    expect(screen.getByText('財務體質未知')).toBeInTheDocument();
    expect(screen.getByText('效率結構中性')).toBeInTheDocument();
    expect(screen.getByText('同組比較不可用')).toBeInTheDocument();
    expect(screen.getByText('結構比較不足')).toBeInTheDocument();
    expect(screen.getByText('流動比率')).toBeInTheDocument();
    expect(screen.getByText('PR —')).toBeInTheDocument();
    expect(screen.getByTestId('peer-detail-category')).toHaveTextContent('none');

    fireEvent.click(screen.getByRole('button', { name: 'Select peer position' }));
    expect(screen.getByTestId('peer-detail-category')).toHaveTextContent('financialStructure');
    fireEvent.click(screen.getByRole('button', { name: 'Select growth' }));
    expect(screen.getByTestId('peer-detail-category')).toHaveTextContent('growth');
    fireEvent.click(screen.getByRole('button', { name: 'Select growth' }));
    expect(screen.getByTestId('peer-detail-category')).toHaveTextContent('none');
  });
});
