import { fireEvent, render, screen } from '@testing-library/react';
import { CandidateFundamentalResearchCard } from '../CandidateFundamentalResearchCard';
import type { StockFundamentalSnapshot } from '@/lib/fundamentals/StockFundamentalSnapshot';
import type { StockPeerComparison } from '@/lib/fundamentals/StockPeerComparison';
import type { FundamentalRiskOverlay } from '@/lib/fundamental/FundamentalRiskOverlayEngine';
import type { CashflowLeverageOverlay } from '@/lib/fundamental/CashflowLeverageOverlayEngine';
import type { CapitalEfficiencyOverlay } from '@/lib/fundamental/CapitalEfficiencyOverlayEngine';
import type { FinancialStructurePeerComparison } from '@/lib/fundamental/FinancialStructurePeerComparisonEngine';
import type { FullFundamentalComparisonMatrix } from '@/lib/fundamental/FullFundamentalComparisonMatrixBuilder';

const baseFundamentals: StockFundamentalSnapshot = {
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

const baseComparison: StockPeerComparison = {
  basis: 'industry',
  groupLabel: '半導體業',
  peerCount: 6,
  dataCoverage: 'limited',
  summary: '相較半導體業同組樣本，基本面優勢與壓力並存。',
  metrics: [],
  strengths: ['營收 YoY相對同組偏強'],
  cautions: ['PE相對同組偏高'],
  limitations: ['同 industry 樣本不足，已退回 sector 層級比較。'],
};

const baseCashflowOverlay: CashflowLeverageOverlay = {
  riskLevel: 'elevated',
  cashflowContext: '營運成長不差，但現金流轉化仍偏弱，後續需觀察成長品質。',
  leverageContext: '負債壓力不高，但流動性支撐仍偏弱，短期周轉能力需留意。',
  strengths: ['負債壓力不高'],
  pressures: ['成長延續需持續觀察現金流轉化能力', '流動性支撐偏弱'],
  summary: '營運成長不差，但現金流轉化仍偏弱，成長延續性需持續追蹤。',
  limitations: ['目前未提供穩定的營運現金流或槓桿欄位，部分情境僅能保守解讀。'],
};

const baseCapitalOverlay: CapitalEfficiencyOverlay = {
  riskLevel: 'moderate',
  efficiencyContext: '部分效率指標不差，但尚未形成全面性的效率優勢。',
  profitabilityContext: '帳面獲利效率大致中性，需搭配財務體質與後續季度觀察。',
  conversionContext: '現金流與獲利大致同向，但轉現效率尚未形成明確優勢。',
  strengths: ['部分效率指標仍具支撐'],
  pressures: [],
  summary: '資本效率與獲利品質大致中性，建議搭配後續財報持續追蹤。',
  limitations: [],
};

const baseFinancialStructureComparison: FinancialStructurePeerComparison = {
  basis: 'industry',
  groupLabel: '半導體業',
  peerSampleSize: 6,
  dataCoverage: 'limited',
  metrics: {
    debtRatio: { value: 18, median: 24, percentile: 82, interpretation: '相對同組槓桿壓力不高。' },
    currentRatio: { value: 1.8, median: 1.5, percentile: 75, interpretation: '相對同組流動性支撐較佳。' },
    roe: { value: 18, median: 15, percentile: 78, interpretation: '優於多數同組樣本。' },
    cashflowConversion: { value: 0.88, median: 0.95, percentile: 42, interpretation: '接近同組中位水準。' },
  },
  strengths: ['同組槓桿與流動性結構相對穩健'],
  pressures: ['資本報酬不差，但部分表現可能受槓桿放大'],
  summary: '相較半導體業同組樣本，財務結構與效率優勢與壓力並存。',
  limitations: ['同 industry 樣本不足，已退回 sector 層級比較。'],
};

const baseFundamentalMatrix: FullFundamentalComparisonMatrix = {
  overallSummary: '基本面優勢與壓力並存，建議搭配同組位置與後續財報持續追蹤。',
  limitations: ['同組樣本有限，解讀已保守處理。'],
  sections: {
    growth: {
      title: '成長',
      status: 'strong',
      summary: '同組成長表現偏強，但估值壓力較高。',
      highlights: ['同組成長表現偏強'],
      warnings: [],
      basis: 'industry · 半導體業',
      peerSampleSize: 6,
      limitations: [],
    },
    valuation: {
      title: '估值',
      status: 'pressure',
      summary: 'PE / PB 相對同組偏高，後續需要成長持續性支撐。',
      highlights: [],
      warnings: ['相對同組估值偏高'],
      basis: 'industry · 半導體業',
      peerSampleSize: 6,
      limitations: [],
    },
    financialStructure: {
      title: '財務體質',
      status: 'pressure',
      summary: baseCashflowOverlay.summary,
      highlights: ['負債壓力不高'],
      warnings: ['流動性支撐偏弱'],
      basis: 'industry · 半導體業',
      peerSampleSize: 6,
      limitations: [],
    },
    efficiency: {
      title: '經營效率',
      status: 'neutral',
      summary: baseCapitalOverlay.summary,
      highlights: ['部分效率指標仍具支撐'],
      warnings: [],
      basis: 'industry · 半導體業',
      peerSampleSize: 6,
      limitations: [],
    },
    peerPosition: {
      title: '同組位置',
      status: 'neutral',
      summary: baseFinancialStructureComparison.summary,
      highlights: baseFinancialStructureComparison.strengths,
      warnings: baseFinancialStructureComparison.pressures,
      basis: 'industry · 半導體業',
      peerSampleSize: 6,
      limitations: [],
    },
  },
};

const basePeerPercentileDetailTable = {
  basis: 'industry',
  peerSampleSize: 6,
  limitations: ['同組樣本有限，解讀已保守處理。'],
  rows: [
    {
      key: 'revenueYoY',
      label: '營收 YoY',
      category: 'growth',
      value: 18.5,
      median: 10.1,
      percentile: 83,
      interpretation: '同組相對偏強',
      basis: 'industry',
      peerSampleSize: 6,
      limitations: [],
      displayUnit: 'percent',
    },
    {
      key: 'pe',
      label: 'P/E',
      category: 'valuation',
      value: 24.6,
      median: 21.2,
      percentile: 35,
      interpretation: '同組中性',
      basis: 'industry',
      peerSampleSize: 6,
      limitations: [],
      displayUnit: 'number',
    },
    {
      key: 'debtRatio',
      label: '負債比',
      category: 'financialStructure',
      value: 18,
      median: 24,
      percentile: 82,
      interpretation: '同組相對偏強',
      basis: 'industry',
      peerSampleSize: 6,
      limitations: [],
      displayUnit: 'percent',
    },
    {
      key: 'roe',
      label: 'ROE',
      category: 'efficiency',
      value: 18,
      median: 15,
      percentile: 78,
      interpretation: '同組相對偏強',
      basis: 'industry',
      peerSampleSize: 6,
      limitations: [],
      displayUnit: 'percent',
    },
  ],
};

describe('CandidateFundamentalResearchCard', () => {
  it('renders risk badge, contexts, basis and sample size', () => {
    render(
      <CandidateFundamentalResearchCard
        fundamentals={baseFundamentals}
        overlay={baseOverlay}
        peerComparison={baseComparison}
        cashflowLeverageOverlay={baseCashflowOverlay}
        capitalEfficiencyOverlay={baseCapitalOverlay}
        financialStructurePeerComparison={baseFinancialStructureComparison}
        fundamentalMatrix={baseFundamentalMatrix}
        peerPercentileDetailTable={basePeerPercentileDetailTable}
      />,
    );

    expect(screen.getByText('基本面研究卡')).toBeInTheDocument();
    expect(screen.getByText('基本面壓力')).toBeInTheDocument();
    expect(screen.getByText('成長脈絡')).toBeInTheDocument();
    expect(screen.getByText('估值脈絡')).toBeInTheDocument();
    expect(screen.getByText('現金流 / 財務槓桿觀察')).toBeInTheDocument();
    expect(screen.getByText('資本效率 / 獲利品質觀察')).toBeInTheDocument();
    expect(screen.getByText('財務結構 / 效率同組比較')).toBeInTheDocument();
    expect(screen.getByText('完整基本面研究矩陣')).toBeInTheDocument();
    expect(screen.getByText('同組百分位明細')).toBeInTheDocument();
    expect(screen.getByText('同組位置')).toBeInTheDocument();
    expect(screen.getAllByText(/industry · 半導體業/).length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText('6 檔').length).toBeGreaterThanOrEqual(2);

    fireEvent.click(screen.getAllByRole('button', { name: /成長/ })[0]);
    expect(screen.getByText('營收 YoY')).toBeInTheDocument();
  });

  it('drills down from peer position to financial structure rows', () => {
    render(
      <CandidateFundamentalResearchCard
        fundamentals={baseFundamentals}
        overlay={baseOverlay}
        peerComparison={baseComparison}
        cashflowLeverageOverlay={baseCashflowOverlay}
        capitalEfficiencyOverlay={baseCapitalOverlay}
        financialStructurePeerComparison={baseFinancialStructureComparison}
        fundamentalMatrix={baseFundamentalMatrix}
        peerPercentileDetailTable={basePeerPercentileDetailTable}
      />,
    );

    fireEvent.click(screen.getAllByRole('button', { name: /同組位置/ })[0]);
    expect(screen.getByText('負債比')).toBeInTheDocument();
  });

  it('renders unknown / degraded state without pretending precise comparison', () => {
    render(
      <CandidateFundamentalResearchCard
        fundamentals={{ ...baseFundamentals, kind: 'etf', dataCoverage: 'limited' }}
        overlay={{
          riskLevel: 'unknown',
          strengths: [],
          pressures: [],
          valuationContext: 'ETF 不適用公司營運式估值壓力解讀。',
          growthContext: 'ETF 不適用營收 / EPS / 毛利率式成長判讀。',
          summary: 'ETF 暫不做公司營運式基本面同組比較。',
          limitations: ['ETF 不適用公司營運式基本面風險 overlay。'],
        }}
        peerComparison={null}
        cashflowLeverageOverlay={{
          riskLevel: 'unknown',
          cashflowContext: 'ETF 不適用公司營運式現金流與轉現能力判讀。',
          leverageContext: 'ETF 不適用公司負債 / 流動性結構判讀。',
          strengths: [],
          pressures: [],
          summary: 'ETF 暫不建立公司財務結構式的現金流 / 槓桿判讀。',
          limitations: ['ETF 不適用公司財務結構式 cashflow / leverage overlay。'],
        }}
        capitalEfficiencyOverlay={{
          riskLevel: 'unknown',
          efficiencyContext: 'ETF 不適用公司資本使用效率與營運週轉判讀。',
          profitabilityContext: 'ETF 不適用公司 ROE / ROA 式經營效率判讀。',
          conversionContext: 'ETF 不適用公司獲利轉現品質判讀。',
          strengths: [],
          pressures: [],
          summary: 'ETF 暫不建立公司營運式的資本效率與獲利品質判讀。',
          limitations: ['ETF 不適用公司營運式 capital efficiency overlay。'],
        }}
        financialStructurePeerComparison={{
          basis: 'none',
          groupLabel: null,
          peerSampleSize: 0,
          dataCoverage: 'insufficient',
          metrics: {},
          strengths: [],
          pressures: [],
          summary: 'ETF 暫不建立公司財務結構與效率的同組比較。',
          limitations: ['ETF 不適用公司財務結構 / 經營效率的同組相對位置判讀。'],
        }}
        fundamentalMatrix={{
          overallSummary: 'ETF 暫不做公司營運式完整基本面矩陣判讀。',
          limitations: ['ETF 不適用公司營運式完整基本面矩陣判讀。'],
          sections: {
            growth: { title: '成長', status: 'unknown', summary: 'ETF 暫不做公司營運式完整基本面矩陣判讀。', highlights: [], warnings: [], limitations: ['ETF 不適用'] },
            valuation: { title: '估值', status: 'unknown', summary: 'ETF 暫不做公司營運式完整基本面矩陣判讀。', highlights: [], warnings: [], limitations: ['ETF 不適用'] },
            financialStructure: { title: '財務體質', status: 'unknown', summary: 'ETF 暫不做公司營運式完整基本面矩陣判讀。', highlights: [], warnings: [], limitations: ['ETF 不適用'] },
            efficiency: { title: '經營效率', status: 'unknown', summary: 'ETF 暫不做公司營運式完整基本面矩陣判讀。', highlights: [], warnings: [], limitations: ['ETF 不適用'] },
            peerPosition: { title: '同組位置', status: 'unknown', summary: 'ETF 暫不做公司營運式完整基本面矩陣判讀。', highlights: [], warnings: [], limitations: ['ETF 不適用'] },
          },
        }}
        peerPercentileDetailTable={{
          basis: 'none',
          peerSampleSize: 0,
          limitations: ['ETF 不適用公司營運式同組百分位判讀。'],
          rows: [],
        }}
      />,
    );

    expect(screen.getByText('基本面未知')).toBeInTheDocument();
    expect(screen.getByText('ETF / 不適用')).toBeInTheDocument();
    expect(screen.getByText(/ETF 暫不做公司營運式基本面同組比較/)).toBeInTheDocument();
    expect(screen.getByText(/ETF 暫不建立公司財務結構與效率的同組比較/)).toBeInTheDocument();
  });
});
