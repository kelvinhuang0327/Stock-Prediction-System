import {
  buildStockTabHref,
  isValidStockTabQuery,
  parseStockTabQuery,
  stockTabToQuery,
} from '../stockTabNavigation';

describe('stockTabNavigation', () => {
  it('maps stable query names to internal tab keys', () => {
    expect(parseStockTabQuery('overview')).toBe('analysis');
    expect(parseStockTabQuery('analysis')).toBe('analysis');
    expect(parseStockTabQuery('signals')).toBe('signals');
    expect(parseStockTabQuery('unknown')).toBe('analysis');
    expect(parseStockTabQuery(null)).toBe('analysis');
  });

  it('builds stable hrefs for shareable stock tab links', () => {
    expect(stockTabToQuery('analysis')).toBe('overview');
    expect(buildStockTabHref({
      basePath: '/stocks/2330',
      tab: 'signals',
      anchor: 'stock-signal-effectiveness',
    })).toBe('/stocks/2330?tab=signals#stock-signal-effectiveness');
    expect(buildStockTabHref({
      basePath: '/stocks/2330',
      tab: 'analysis',
    })).toBe('/stocks/2330?tab=overview');
  });

  it('recognizes valid queries while allowing graceful fallback for invalid ones', () => {
    expect(isValidStockTabQuery('overview')).toBe(true);
    expect(isValidStockTabQuery('signals')).toBe(true);
    expect(isValidStockTabQuery('bogus')).toBe(false);
    expect(isValidStockTabQuery(undefined)).toBe(false);
  });
});
