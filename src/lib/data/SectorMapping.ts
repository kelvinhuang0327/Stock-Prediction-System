/**
 * SectorMapping (data layer only)
 * - symbol -> sector/industry lookup helpers
 * - no scoring/strategy logic
 */

export interface SectorMappingItem {
  symbol: string;
  sector: string;
  industry?: string;
}

const OVERRIDE_GROUPS: Array<{ sector: string; industry: string; symbols: string[] }> = [
  {
    sector: '半導體',
    industry: '半導體業',
    symbols: ['2330', '2454', '2303', '3034', '3037', '5347', '6770', '6415', '5274', '3661', '3711', '4967', '6531'],
  },
  {
    sector: '電子製造',
    industry: '電腦及週邊設備業',
    symbols: ['2317', '2382', '2357', '2356', '2395', '6669', '4938', '2377', '2474', '2345', '3006'],
  },
  {
    sector: '電子零組件',
    industry: '電子零組件業',
    symbols: ['2379', '2308', '3529', '2327', '2344', '2408', '2301', '2347'],
  },
  {
    sector: '光電',
    industry: '光電業',
    symbols: ['3008', '2451'],
  },
  {
    sector: '金融',
    industry: '金融保險業',
    symbols: ['2881', '2882', '2884', '2886', '2887', '2891', '2880', '2883', '2885', '2890', '5876', '5880'],
  },
  {
    sector: '航運',
    industry: '航運業',
    symbols: ['2603', '2615', '2609'],
  },
  {
    sector: '塑化',
    industry: '塑膠工業',
    symbols: ['1301', '1303', '1326', '6505'],
  },
  {
    sector: '水泥',
    industry: '水泥工業',
    symbols: ['1101', '1102'],
  },
  {
    sector: '鋼鐵',
    industry: '鋼鐵工業',
    symbols: ['2002', '8374'],
  },
  {
    sector: '汽車',
    industry: '汽車工業',
    symbols: ['2207', '1503', '1504', '1519', '9910'],
  },
  {
    sector: '食品',
    industry: '食品工業',
    symbols: ['1216', '2912', '9904'],
  },
  {
    sector: '電信',
    industry: '通信網路業',
    symbols: ['2412', '3045', '4904'],
  },
  {
    sector: 'ETF',
    industry: 'ETF',
    symbols: ['0050', '0056', '00878', '00919', '00929', '00940'],
  },
];

const SYMBOL_OVERRIDES: Record<string, SectorMappingItem> = OVERRIDE_GROUPS.reduce<Record<string, SectorMappingItem>>(
  (acc, group) => {
    for (const symbol of group.symbols) {
      acc[symbol] = { symbol, sector: group.sector, industry: group.industry };
    }
    return acc;
  },
  {}
);

const INDUSTRY_TO_SECTOR: Array<{ pattern: RegExp; sector: string }> = [
  { pattern: /半導體|晶片/i, sector: '半導體' },
  { pattern: /電腦|週邊|電子|光電/i, sector: '電子' },
  { pattern: /金融|保險|銀行|證券/i, sector: '金融' },
  { pattern: /航運|船舶/i, sector: '航運' },
  { pattern: /鋼鐵/i, sector: '鋼鐵' },
  { pattern: /塑膠|化學|油電|橡膠/i, sector: '塑化' },
  { pattern: /汽車|車用/i, sector: '汽車' },
  { pattern: /建材|營建/i, sector: '營建' },
  { pattern: /食品/i, sector: '食品' },
  { pattern: /生技|醫療/i, sector: '生技醫療' },
  { pattern: /紡織/i, sector: '紡織' },
];

export function inferSectorFromIndustry(industry?: string | null): string | null {
  const text = (industry ?? '').trim();
  if (!text) return null;
  const hit = INDUSTRY_TO_SECTOR.find((r) => r.pattern.test(text));
  return hit?.sector ?? text;
}

export function getSectorMapping(symbol: string, industry?: string | null): SectorMappingItem | null {
  const key = symbol.trim().toUpperCase();
  if (!key) return null;
  const override = SYMBOL_OVERRIDES[key];
  if (override) return override;
  const sector = inferSectorFromIndustry(industry);
  if (!sector) return null;
  return {
    symbol: key,
    sector,
    industry: industry?.trim() || undefined,
  };
}

export function getSymbolOverrides(): SectorMappingItem[] {
  return Object.values(SYMBOL_OVERRIDES);
}
