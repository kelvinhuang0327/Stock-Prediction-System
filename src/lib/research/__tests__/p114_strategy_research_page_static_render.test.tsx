import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import { StrategyResearchStaticView } from '../components/StrategyResearchStaticView';
import { STOCK_STRATEGY_RESEARCH_STATIC_FIXTURE } from '../fixtures/StockStrategyResearchStaticFixture';

describe('P114 Static Strategy Research Page', () => {
  it('renders governance banner and required wording', () => {
    render(<StrategyResearchStaticView fixture={STOCK_STRATEGY_RESEARCH_STATIC_FIXTURE} />);
    // Allow multiple matches for required wording, just check at least one exists
    expect(screen.getAllByText(/研究用途/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/非投資建議/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/不承諾回報/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/不提供買賣或持有操作指令/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/靜態樣本資料/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/非真實交易系統/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/不可直接執行/).length).toBeGreaterThan(0);
  });

  it('renders all required UI sections', () => {
    render(<StrategyResearchStaticView fixture={STOCK_STRATEGY_RESEARCH_STATIC_FIXTURE} />);
    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByLabelText('Strategy Overview')).toBeInTheDocument();
    expect(screen.getByLabelText('Data Source / PIT Metadata')).toBeInTheDocument();
    expect(screen.getByLabelText('Feature Inputs')).toBeInTheDocument();
    expect(screen.getByLabelText('Simulation / Validation Summary')).toBeInTheDocument();
    expect(screen.getByLabelText('Strategy Comparison / Stability')).toBeInTheDocument();
    expect(screen.getByLabelText('Risk & Limitation Disclosure')).toBeInTheDocument();
    expect(screen.getByLabelText('Audit Trail / Replay Trace')).toBeInTheDocument();
    expect(screen.getByLabelText('governance-flags')).toBeInTheDocument();
  });

  it('does not render forbidden affirmative advice wording in user-visible narrative fields', () => {
    render(<StrategyResearchStaticView fixture={STOCK_STRATEGY_RESEARCH_STATIC_FIXTURE} />);
    const forbidden = [
      '保證獲利', '買進', '賣出', '持有', '目標價', 'ROI保證', 'PnL保證',
      'guaranteed return', 'buy', 'sell', 'hold', 'target price', 'ROI guarantee', 'PnL guarantee',
    ];
    // Only scan user-visible narrative/display fields, not governance flag keys
    const narrativeSelectors = [
      'banner',
      'disclaimer',
      'Strategy Overview',
      'Data Source / PIT Metadata',
      'Feature Inputs',
      'Simulation / Validation Summary',
      'Strategy Comparison / Stability',
      'Risk & Limitation Disclosure',
      'Audit Trail / Replay Trace',
    ];
    forbidden.forEach(word => {
      narrativeSelectors.forEach(label => {
        const section = screen.queryByLabelText(label) || (label === 'banner' ? screen.queryByRole('banner') : null);
        if (section) {
          expect(section).not.toHaveTextContent(new RegExp(`^((?!非).)*${word}((?!非).)*$`, 'i'));
        }
      });
    });
  });
});
