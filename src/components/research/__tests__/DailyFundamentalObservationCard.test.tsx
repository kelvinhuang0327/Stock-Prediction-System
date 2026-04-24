import { render, screen } from '@testing-library/react';
import { DailyFundamentalObservationCard } from '../DailyFundamentalObservationCard';
import type { FundamentalObservationSummary } from '@/lib/report/DailyReportEngine';

const baseSummary: FundamentalObservationSummary = {
  summary: '已將 watchlist 個股的同組基本面位置轉成研究風險觀察，供每日優先檢視。',
  dataCoverage: 'limited',
  matrixSections: {
    growth: {
      title: '成長',
      status: 'strong',
      summary: '多數 watchlist 標的成長表現偏穩，仍以個股差異為主。',
      highlights: ['營收動能較佳的標的仍有延續性'],
      warnings: [],
      limitations: [],
    },
    valuation: {
      title: '估值',
      status: 'pressure',
      summary: '部分標的估值壓力偏高，需與成長延續性一併觀察。',
      highlights: [],
      warnings: ['高估值標的需搭配後續財報確認'],
      limitations: [],
    },
    financialStructure: {
      title: '財務體質',
      status: 'neutral',
      summary: '多數標的財務結構中性，部分個股仍有現金流壓力。',
      highlights: [],
      warnings: ['現金流轉化仍需持續追蹤'],
      limitations: [],
    },
    efficiency: {
      title: '經營效率',
      status: 'neutral',
      summary: '資本效率整體中性，個別標的需觀察獲利轉現品質。',
      highlights: [],
      warnings: [],
      limitations: [],
    },
    peerPosition: {
      title: '同組位置',
      status: 'neutral',
      summary: '同組相對位置整體中性，優勢與壓力並存。',
      highlights: ['部分標的在同組流動性位置偏佳'],
      warnings: ['樣本有限的群組需保守解讀'],
      limitations: [],
    },
  },
  strongItems: [
    {
      symbol: '2330',
      name: '台積電',
      riskLevel: 'low',
      summary: '同組相對位置偏強，且估值壓力尚可控，基本面風險較低。',
      strengths: ['同組成長表現偏強'],
      pressures: [],
    },
  ],
  pressureItems: [
    {
      symbol: '3008',
      name: '大立光',
      riskLevel: 'elevated',
      summary: '同組成長表現不差，但估值壓力偏高，宜保守看待追價風險。',
      strengths: [],
      pressures: ['估值壓力較高'],
    },
  ],
  cashflowPressureItems: [
    {
      symbol: '2308',
      name: '台達電',
      riskLevel: 'elevated',
      summary: '營運成長不差，但現金流轉化仍偏弱，成長延續性需持續追蹤。',
      strengths: [],
      pressures: ['成長延續需持續觀察現金流轉化能力'],
    },
  ],
  capitalEfficiencyItems: [
    {
      symbol: '2454',
      name: '聯發科',
      riskLevel: 'elevated',
      summary: '帳面報酬不差，但部分表現可能受槓桿放大影響。',
      strengths: [],
      pressures: ['高 ROE 可能受槓桿放大影響'],
    },
  ],
  limitations: [],
};

describe('DailyFundamentalObservationCard', () => {
  it('renders strong and pressure observations', () => {
    render(<DailyFundamentalObservationCard summary={baseSummary} />);

    expect(screen.getByText('基本面觀察（研究）')).toBeInTheDocument();
    expect(screen.getByText('相對偏強')).toBeInTheDocument();
    expect(screen.getByText('估值 / 基本面壓力')).toBeInTheDocument();
    expect(screen.getByText('現金流 / 財務槓桿壓力')).toBeInTheDocument();
    expect(screen.getByText('資本效率觀察（研究）')).toBeInTheDocument();
    expect(screen.getByText('成長')).toBeInTheDocument();
    expect(screen.getByText('同組位置')).toBeInTheDocument();
    expect(screen.getByText('台積電')).toBeInTheDocument();
    expect(screen.getByText('大立光')).toBeInTheDocument();
    expect(screen.getByText('台達電')).toBeInTheDocument();
    expect(screen.getByText('聯發科')).toBeInTheDocument();
  });

  it('renders degraded state cleanly', () => {
    render(
      <DailyFundamentalObservationCard
        summary={{
          ...baseSummary,
          dataCoverage: 'insufficient',
          matrixSections: {
            growth: {
              title: '成長',
              status: 'unknown',
              summary: 'Watchlist 基本面矩陣暫時不可用。',
              highlights: [],
              warnings: [],
              limitations: ['資料不足'],
            },
            valuation: {
              title: '估值',
              status: 'unknown',
              summary: 'Watchlist 基本面矩陣暫時不可用。',
              highlights: [],
              warnings: [],
              limitations: ['資料不足'],
            },
            financialStructure: {
              title: '財務體質',
              status: 'unknown',
              summary: 'Watchlist 基本面矩陣暫時不可用。',
              highlights: [],
              warnings: [],
              limitations: ['資料不足'],
            },
            efficiency: {
              title: '經營效率',
              status: 'unknown',
              summary: 'Watchlist 基本面矩陣暫時不可用。',
              highlights: [],
              warnings: [],
              limitations: ['資料不足'],
            },
            peerPosition: {
              title: '同組位置',
              status: 'unknown',
              summary: 'Watchlist 基本面矩陣暫時不可用。',
              highlights: [],
              warnings: [],
              limitations: ['資料不足'],
            },
          },
          strongItems: [],
          pressureItems: [],
          cashflowPressureItems: [],
          capitalEfficiencyItems: [],
        }}
      />,
    );

    expect(screen.getAllByText('資料不足').length).toBeGreaterThan(0);
    expect(screen.getByText('目前沒有明確相對偏強的 watchlist 基本面標的。')).toBeInTheDocument();
  });
});
