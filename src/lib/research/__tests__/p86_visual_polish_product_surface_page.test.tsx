/**
 * @jest-environment node
 */

import fs from 'fs';
import path from 'path';

const PAGE_SOURCE_PATH = path.resolve(__dirname, '../../../app/research/product-surface/page.tsx');
const COMPONENT_SOURCE_PATH = path.resolve(__dirname, '../components/StrategyResearchStaticView.tsx');

const PAGE_SOURCE = fs.readFileSync(PAGE_SOURCE_PATH, 'utf-8');
const COMPONENT_SOURCE = fs.readFileSync(COMPONENT_SOURCE_PATH, 'utf-8');

describe('P86 Product Surface Visual Wrapper Regression', () => {
  it('keeps route file focused on wrapper delegation', () => {
    expect(PAGE_SOURCE).toContain('return <StrategyResearchStaticView fixture={STOCK_STRATEGY_RESEARCH_STATIC_FIXTURE} />;');
  });

  it('keeps governance banner and disclaimer wording in static view', () => {
    expect(COMPONENT_SOURCE).toContain('研究用途');
    expect(COMPONENT_SOURCE).toContain('非投資建議');
    expect(COMPONENT_SOURCE).toContain('不承諾回報');
    expect(COMPONENT_SOURCE).toContain('不提供買賣或持有操作指令');
    expect(COMPONENT_SOURCE).toContain('不可直接執行');
  });

  it('keeps all required sections rendered by static view component', () => {
    [
      'Strategy Overview',
      'Data Source / PIT Metadata',
      'Feature Inputs',
      'Simulation / Validation Summary',
      'Strategy Comparison / Stability',
      'Risk & Limitation Disclosure',
      'Audit Trail / Replay Trace',
      'governance-flags',
    ].forEach(section => {
      expect(COMPONENT_SOURCE).toContain(`aria-label="${section}"`);
    });
  });
});
