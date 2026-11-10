import {
  calculateTechnicalSignals,
  r,
  type OHLCVBar,
} from '../TechnicalSignalCalculator';

function makeHistory(
  count: number,
  closeAt: (index: number) => number = () => 100,
  volumeAt: (index: number) => number = () => 1_000,
  spread = 1,
): OHLCVBar[] {
  return Array.from({ length: count }, (_, index) => {
    const close = closeAt(index);
    return { close, high: close + spread, low: close - spread, volume: volumeAt(index) };
  });
}

function calculate(history: OHLCVBar[], currentPrice = history.at(-1)?.close ?? 100) {
  return calculateTechnicalSignals(
    '2330',
    '台積電',
    '半導體',
    currentPrice,
    history,
    { first: '2026-01-01', last: '2026-03-31', count: history.length },
  );
}

describe('TechnicalSignalCalculator', () => {
  it('rejects insufficient history and rounds displayed prices to two decimals', () => {
    expect(calculate(makeHistory(19))).toBeNull();
    expect(r(12.345)).toBe(12.35);
    expect(r(-12.344)).toBe(-12.34);
  });

  it('produces the bearish flat-market result and uses fallback support and resistance levels', () => {
    const result = calculate(makeHistory(20, () => 100, () => 0, 0), 100);

    expect(result).not.toBeNull();
    expect(result).toMatchObject({
      symbol: '2330',
      name: '台積電',
      industry: '半導體',
      signal: 'SELL',
      dataPoints: 20,
      dataPeriod: '2026-01-01 ~ 2026-03-31',
      buyPrice: { price: 95 },
      targetPrice: { price: 105 },
    });
    expect(result?.indicators.find(item => item.name === 'KD')?.value).toBe('K:50 D:50');
    expect(result?.indicators.find(item => item.name === '成交量')?.value).toBe('1x');
    expect(result?.stopLoss.price).toBe(100);
  });

  it('distinguishes buy, watch, and hold signals from trend and momentum alignment', () => {
    const buyHistory = makeHistory(
      60,
      index => index < 45 ? 100 + index * 0.8 : 136 - (index - 45) * 1.5,
      index => index >= 57 ? 5_000 : 1_000,
    );
    const buy = calculate(buyHistory, 200);
    expect(buy?.signal).toBe('BUY');
    expect(buy?.indicators.find(item => item.name === 'MACD')?.signal).toBe('bearish');

    const watchHistory = makeHistory(60, index => index < 50 ? 100 + index * 0.5 : 125 - (index - 50) * 0.7);
    expect(calculate(watchHistory)?.signal).toBe('WATCH');

    const holdHistory = makeHistory(20, index => 100 + index);
    expect(calculate(holdHistory)?.signal).toBe('HOLD');
  });

  it('calculates MACD in both directions and switches support and resistance selections', () => {
    const risingHistory = makeHistory(60, index => 100 + index);
    const rising = calculate(risingHistory, 155);
    const falling = calculate(makeHistory(60, index => 160 - index), 1);

    expect(rising?.indicators.find(item => item.name === 'MACD')?.signal).toBe('bullish');
    expect(falling?.indicators.find(item => item.name === 'MACD')?.signal).toBe('bearish');
    expect(rising?.targetPrice.methodology).toContain('布林上軌');
    expect(falling?.buyPrice.price).toBe(0.95);
  });

  it('marks high-volume moves up and down separately and handles flat prices with no volume', () => {
    const history = makeHistory(20, index => 100 + index, index => index >= 17 ? 5_000 : 1_000);
    const up = calculate(history, 120);
    const down = calculate(history, 118);
    const noRange = calculate(makeHistory(20, () => 100, () => 1_000, 0));

    expect(up?.indicators.find(item => item.name === '成交量')?.signal).toBe('bullish');
    expect(down?.indicators.find(item => item.name === '成交量')?.signal).toBe('bearish');
    expect(noRange?.indicators.find(item => item.name === 'KD')?.value).toBe('K:50 D:50');
    expect(noRange?.indicators.find(item => item.name === 'BB')?.signal).toBe('neutral');
  });
});
