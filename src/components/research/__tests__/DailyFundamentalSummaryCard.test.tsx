import { render, screen } from '@testing-library/react';
import { DailyFundamentalSummaryCard } from '../DailyFundamentalSummaryCard';
import type { DailyFundamentalSummary } from '@/lib/report/DailyFundamentalSummary';

const baseSummary: DailyFundamentalSummary = {
  items: [
    {
      symbol: '2330',
      name: '台積電',
      dataCoverage: 'full',
      summary: '營收與獲利結構同步改善，基本面偏正向。',
      keySignals: ['最新月營收年增 +18.0%，維持成長。'],
      keyRisks: ['估值偏高，需結合同業比較與成長性一併解讀。'],
      revenueYoY: 18,
      eps: 12.5,
      pe: 18.2,
      pb: 4.1,
    },
  ],
  highlights: ['最新月營收年增 +18.0%，維持成長。'],
  risks: ['估值偏高，需結合同業比較與成長性一併解讀。'],
  summary: '候選股基本面整體偏正向，已整理 1 檔值得持續追蹤的營運亮點。',
  dataCoverage: 'limited',
  limitations: ['1 檔候選股基本面資料不足，相關結論需保守解讀。'],
};

describe('DailyFundamentalSummaryCard', () => {
  it('renders summary, metrics, highlights, and risks', () => {
    render(<DailyFundamentalSummaryCard summary={baseSummary} />);

    expect(screen.getByText('候選股基本面摘要')).toBeInTheDocument();
    expect(screen.getByText('台積電')).toBeInTheDocument();
    expect(screen.getByText('營收 YoY')).toBeInTheDocument();
    expect(screen.getByText('今日基本面亮點')).toBeInTheDocument();
    expect(screen.getByText('今日基本面風險')).toBeInTheDocument();
    expect(screen.getByText('資料有限')).toBeInTheDocument();
  });

  it('renders empty state when no items are available', () => {
    render(
      <DailyFundamentalSummaryCard
        summary={{
          ...baseSummary,
          items: [],
          highlights: [],
          risks: [],
          dataCoverage: 'insufficient',
        }}
      />,
    );

    expect(screen.getByText('目前沒有可整理的候選股基本面內容。')).toBeInTheDocument();
    expect(screen.getByText('資料不足')).toBeInTheDocument();
  });
});
