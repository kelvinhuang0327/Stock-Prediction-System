import { render, screen } from '@testing-library/react';
import { FundamentalPeerComparisonCard } from '../FundamentalPeerComparisonCard';
import type { StockPeerComparison } from '@/lib/fundamentals/StockPeerComparison';

const baseComparison: StockPeerComparison = {
  basis: 'industry',
  groupLabel: '半導體業',
  peerCount: 4,
  dataCoverage: 'limited',
  summary: '相較 半導體業 同組樣本，基本面相對位置偏強。',
  metrics: [
    {
      key: 'revenueYoY',
      label: '營收 YoY',
      targetValue: 18,
      peerMedian: 9.5,
      percentile: 100,
      interpretation: '優於多數同組樣本。',
    },
  ],
  strengths: ['營收 YoY相對同組偏強'],
  cautions: ['PB相對同組偏弱'],
  limitations: ['部分同組樣本缺少完整估值資料。'],
};

describe('FundamentalPeerComparisonCard', () => {
  it('renders comparison summary and metrics', () => {
    render(<FundamentalPeerComparisonCard comparison={baseComparison} />);

    expect(screen.getByText('同組相對比較')).toBeInTheDocument();
    expect(screen.getByText(/industry · 半導體業/)).toBeInTheDocument();
    expect(screen.getByText('營收 YoY')).toBeInTheDocument();
    expect(screen.getByText('PR 100')).toBeInTheDocument();
  });

  it('renders unavailable state when comparison is missing', () => {
    render(<FundamentalPeerComparisonCard comparison={null} />);

    expect(screen.getByText('同產業相對比較暫時不可用。')).toBeInTheDocument();
  });
});
