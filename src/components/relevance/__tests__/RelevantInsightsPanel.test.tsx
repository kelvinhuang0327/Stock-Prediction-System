import { render, screen, waitFor } from '@testing-library/react';
import { RelevantInsightsPanel } from '../RelevantInsightsPanel';

global.fetch = jest.fn();

describe('RelevantInsightsPanel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders ranked insights from the API', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        insights: [
          {
            id: 'signal:test',
            category: 'signal',
            title: '高品質 signal',
            summary: '這是一個重要 signal',
            relevanceScore: 82.4,
            confidence: 78,
            explanation: '直接關聯標的；STRONG_SIGNAL 歷史品質較佳',
            breakdown: [
              { key: 'directness', label: 'Directness', score: 23, maxScore: 25, contribution: 92, available: true, reason: '直接對應目前標的' },
              { key: 'signalQuality', label: 'Signal quality', score: 20, maxScore: 20, contribution: 100, available: true, reason: 'STRONG_SIGNAL 歷史品質較佳' },
              { key: 'recency', label: 'Recency', score: 11, maxScore: 15, contribution: 73.3, available: true, reason: '最近 3 日內仍具新鮮度' },
              { key: 'persistence', label: 'Persistence', score: 8, maxScore: 10, contribution: 80, available: true, reason: '近期呈持續性發展' },
              { key: 'regime', label: 'Regime relevance', score: 10, maxScore: 10, contribution: 100, available: true, reason: '與當前 Bull regime 相符' },
              { key: 'dataQuality', label: 'Data quality', score: 18, maxScore: 20, contribution: 90, available: true, reason: '資料品質可接受' },
            ],
            sourceType: 'signal_effectiveness',
            sourceRef: '訊號有效性（研究）',
            sourceTarget: '/stocks/2330?tab=signals#stock-signal-effectiveness',
            sourceAnchor: 'stock-signal-effectiveness',
            limitations: [],
          },
        ],
        generatedAt: new Date().toISOString(),
        limitations: [],
      }),
    });

    render(
      <RelevantInsightsPanel
        mode="symbol"
        symbol="2330"
        maxItems={4}
        title="最值得關注"
        description="優先顯示重要研究資訊"
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('高品質 signal')).toBeInTheDocument();
    });

    expect(global.fetch).toHaveBeenCalledWith('/api/relevance/insights', expect.objectContaining({
      method: 'POST',
    }));
    expect(screen.getByText(/Relevance 82.4/)).toBeInTheDocument();
    expect(screen.getByText(/Confidence 78/)).toBeInTheDocument();
    expect(screen.getByText('查看來源')).toHaveAttribute('href', '/stocks/2330?tab=signals#stock-signal-effectiveness');
    expect(screen.getByText('Directness')).toBeInTheDocument();
  });

  it('shows a conservative empty state when no insight clears the minimum score', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        insights: [
          {
            id: 'signal:noise',
            category: 'signal',
            title: '低品質 signal',
            summary: '這是一個低 relevance signal',
            relevanceScore: 32,
            confidence: 24,
            explanation: 'NOISE signal 已被降權',
            breakdown: [
              { key: 'directness', label: 'Directness', score: 12, maxScore: 25, contribution: 48, available: true, reason: '與目前市場研究脈絡直接相關' },
              { key: 'signalQuality', label: 'Signal quality', score: 2, maxScore: 20, contribution: 10, available: true, reason: 'NOISE signal 已被降權' },
              { key: 'recency', label: 'Recency', score: 2, maxScore: 15, contribution: 13.3, available: true, reason: '最近性偏低' },
              { key: 'persistence', label: 'Persistence', score: 2, maxScore: 10, contribution: 20, available: true, reason: '屬一次性/短暫線索' },
              { key: 'regime', label: 'Regime relevance', score: 3, maxScore: 10, contribution: 30, available: true, reason: '存在 regime 依賴，但當前 regime 不明' },
              { key: 'dataQuality', label: 'Data quality', score: 4, maxScore: 20, contribution: 20, available: true, reason: '資料覆蓋或可信度偏弱' },
            ],
            sourceType: 'signal_effectiveness',
            limitations: ['sample too small'],
          },
        ],
        generatedAt: new Date().toISOString(),
        limitations: ['sample too small'],
      }),
    });

    render(
      <RelevantInsightsPanel
        mode="watchlist"
        maxItems={3}
        minimumScore={45}
        title="持倉最值得關注"
        description="測試"
        emptyStateMessage="目前沒有高 relevance 的持倉 insight，系統已保守降級顯示。"
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('目前沒有高 relevance 的持倉 insight，系統已保守降級顯示。')).toBeInTheDocument();
    });
    expect(screen.queryByText('查看來源')).not.toBeInTheDocument();
  });
});
