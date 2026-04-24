export interface MockEventItem {
  symbol?: string;
  title: string;
  summary: string;
  publishedAt: string;
  source: string;
}

const MOCK_EVENTS: MockEventItem[] = [
  {
    symbol: '2330',
    title: '2330 法說會後市場關注 AI 訂單展望',
    summary: '公司於法說會提到先進製程需求仍強，市場持續追蹤後續產能配置。',
    publishedAt: '2026-03-17T09:30:00+08:00',
    source: 'MockEventSource:IR',
  },
  {
    symbol: '2330',
    title: '外資報告調整 2330 評等為中立觀察',
    summary: '報告指出估值已反映部分成長預期，建議持續觀察毛利率變化。',
    publishedAt: '2026-03-16T10:20:00+08:00',
    source: 'MockEventSource:Broker',
  },
  {
    symbol: '2330',
    title: '2330 海外擴產議題再度升溫',
    summary: '供應鏈消息顯示海外擴產計畫持續推進，市場關注成本與時程。',
    publishedAt: '2026-03-15T13:10:00+08:00',
    source: 'MockEventSource:Industry',
  },
  {
    symbol: '2317',
    title: '2317 新廠投產時程更新',
    summary: '供應鏈消息顯示新產能將分階段導入，短期對營運影響仍待驗證。',
    publishedAt: '2026-03-17T14:15:00+08:00',
    source: 'MockEventSource:SupplyChain',
  },
  {
    symbol: '0050',
    title: '0050 成分調整預告',
    summary: '市場關注 ETF 成分股調整可能帶來的短期資金再平衡。',
    publishedAt: '2026-03-15T08:50:00+08:00',
    source: 'MockEventSource:ETF',
  },
  {
    symbol: '2454',
    title: '2454 新產品發表進度受關注',
    summary: '市場討論新品時程與競品對位，實際影響仍需後續數據確認。',
    publishedAt: '2026-03-14T11:00:00+08:00',
    source: 'MockEventSource:TechNews',
  },
];

export function getMockEvents(symbol?: string): MockEventItem[] {
  const list = symbol
    ? MOCK_EVENTS.filter((e) => e.symbol === symbol)
    : MOCK_EVENTS;
  return [...list].sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));
}
