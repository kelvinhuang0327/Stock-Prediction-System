import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import { StrategyResearchStaticView } from '../components/StrategyResearchStaticView';
import { STOCK_STRATEGY_RESEARCH_STATIC_FIXTURE } from '../fixtures/StockStrategyResearchStaticFixture';

const REQUIRED_GOVERNANCE_FLAGS = [
  'reviewOnly',
  'noInvestmentAdvice',
  'noForecast',
  'noRecommendation',
  'previewOnly',
  'paperOnly',
  'noExecution',
  'noActualMetrics',
  'entersAlphaScore',
  'notInvestmentAdvice',
] as const;

function hasAffirmativeTerm(text: string, term: string): boolean {
  let searchFrom = 0;
  while (true) {
    const index = text.indexOf(term, searchFrom);
    if (index < 0) {
      return false;
    }
    const prefix = text.slice(Math.max(0, index - 8), index);
    if (!/[不非無禁]/.test(prefix)) {
      return true;
    }
    searchFrom = index + term.length;
  }
}

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

  it('renders all required governance flags including entersAlphaScore=false', () => {
    render(<StrategyResearchStaticView fixture={STOCK_STRATEGY_RESEARCH_STATIC_FIXTURE} />);
    REQUIRED_GOVERNANCE_FLAGS.forEach(flag => {
      expect(screen.getByText(flag)).toBeInTheDocument();
    });

    const entersAlphaScoreRow = screen.getByText('entersAlphaScore').closest('li');
    expect(entersAlphaScoreRow).toBeInTheDocument();
    expect(entersAlphaScoreRow).toHaveTextContent('false');
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
    const narrativeSelectors = ['banner', 'disclaimer', 'Strategy Overview', 'Data Source / PIT Metadata', 'Feature Inputs', 'Simulation / Validation Summary', 'Strategy Comparison / Stability', 'Risk & Limitation Disclosure', 'Audit Trail / Replay Trace'] as const;
    const narrativeText = narrativeSelectors
      .map(label => screen.queryByLabelText(label) || (label === 'banner' ? screen.queryByRole('banner') : null))
      .filter(Boolean)
      .map(section => section?.textContent ?? '')
      .join('\n');

    ['保證獲利', '目標價', 'ROI保證', 'PnL保證'].forEach(term => {
      expect(narrativeText).not.toContain(term);
    });

    ['投資建議', '買進', '賣出', '持有', '可直接執行'].forEach(term => {
      expect(hasAffirmativeTerm(narrativeText, term)).toBe(false);
    });
  });
});
