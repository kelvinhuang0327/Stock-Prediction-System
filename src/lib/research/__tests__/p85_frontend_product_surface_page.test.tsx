/**
 * @jest-environment node
 */

import fs from 'fs';
import path from 'path';

const PAGE_SOURCE_PATH = path.resolve(__dirname, '../../../app/research/product-surface/page.tsx');
const PAGE_SOURCE = fs.readFileSync(PAGE_SOURCE_PATH, 'utf-8');

describe('P85 Product Surface Wrapper Regression', () => {
  it('keeps the page route and default export wiring intact', () => {
    expect(fs.existsSync(PAGE_SOURCE_PATH)).toBe(true);
    expect(PAGE_SOURCE).toContain('export default function ProductSurfacePage');
  });

  it('imports StrategyResearchStaticView from tracked research components', () => {
    expect(PAGE_SOURCE).toContain('StrategyResearchStaticView');
    expect(PAGE_SOURCE).toContain('../../../lib/research/components/StrategyResearchStaticView');
  });

  it('imports and passes STOCK_STRATEGY_RESEARCH_STATIC_FIXTURE to wrapper view', () => {
    expect(PAGE_SOURCE).toContain('STOCK_STRATEGY_RESEARCH_STATIC_FIXTURE');
    expect(PAGE_SOURCE).toContain('../../../lib/research/fixtures/StockStrategyResearchStaticFixture');
    expect(PAGE_SOURCE).toContain('<StrategyResearchStaticView fixture={STOCK_STRATEGY_RESEARCH_STATIC_FIXTURE} />');
  });
});
