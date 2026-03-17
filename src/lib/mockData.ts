// Mock Data Generation for Taiwan Stock Market
// This file provides realistic simulated data for all features

export type Stock = {
    symbol: string;
    name: string;
    price: number;
    change: number;
    changePercent: number;
    volume: number;
    amount?: number; // 成交值 (億)
    open?: number;
    high?: number;
    low?: number;
    prevClose?: number;
    marketCap?: number;
    pe?: number;
    pb?: number;
    dividendYield?: number;
    eps?: number;
    sector?: string;
    industry?: string;
    institutional?: {
        foreign: number;
        trust: number;
        dealer: number;
    };
    // Technical Indicators
    rsi?: number;
    macd?: number;
    ma20?: number;
    ma60?: number;
};

export type Sector = {
    id: string;
    name: string;
    change: number;
    changePercent: number;
    volume: number;
    stocks: number;
};

export type EconomicEvent = {
    id: string;
    date: string;
    time?: string;
    title: string;
    type: 'earnings' | 'dividend' | 'economic' | 'meeting';
    importance: 'high' | 'medium' | 'low';
    symbol?: string;
    description?: string;
};

// Taiwan Stock Sectors
export const SECTORS: Sector[] = [
    { id: 'semiconductor', name: '半導體', change: 15.2, changePercent: 1.8, volume: 125000, stocks: 45 },
    { id: 'electronics', name: '電子', change: 8.5, changePercent: 0.95, volume: 98000, stocks: 120 },
    { id: 'finance', name: '金融', change: -2.3, changePercent: -0.45, volume: 45000, stocks: 35 },
    { id: 'shipping', name: '航運', change: -5.8, changePercent: -1.2, volume: 78000, stocks: 28 },
    { id: 'steel', name: '鋼鐵', change: 1.2, changePercent: 0.3, volume: 23000, stocks: 18 },
    { id: 'plastic', name: '塑膠', change: 0.8, changePercent: 0.15, volume: 15000, stocks: 22 },
    { id: 'food', name: '食品', change: 2.1, changePercent: 0.6, volume: 8500, stocks: 30 },
    { id: 'biotech', name: '生技醫療', change: 3.5, changePercent: 1.1, volume: 12000, stocks: 42 },
    { id: 'telecom', name: '通信網路', change: -0.5, changePercent: -0.1, volume: 6800, stocks: 15 },
    { id: 'construction', name: '營建', change: 1.8, changePercent: 0.4, volume: 9200, stocks: 38 },
];

// Popular Taiwan Stocks
export const POPULAR_STOCKS: Stock[] = [
    {
        symbol: '2330', name: '台積電', price: 1025, change: 15, changePercent: 1.48, volume: 32000, amount: 328,
        open: 1010, high: 1030, low: 1005, prevClose: 1010,
        marketCap: 26000000, pe: 28.5, pb: 8.2, dividendYield: 1.8, eps: 35.4, sector: 'semiconductor', industry: '半導體',
        institutional: { foreign: 5250, trust: 800, dealer: 450 },
        rsi: 68, macd: 5.5, ma20: 980, ma60: 940
    },
    {
        symbol: '2454', name: '聯發科', price: 1285, change: 35, changePercent: 2.79, volume: 5500, amount: 70,
        open: 1250, high: 1295, low: 1245, prevClose: 1250,
        marketCap: 2050000, pe: 18.2, pb: 5.8, dividendYield: 3.5, eps: 65.6, sector: 'semiconductor', industry: '半導體',
        institutional: { foreign: 1200, trust: 500, dealer: 150 },
        rsi: 72, macd: 8.8, ma20: 1220, ma60: 1150
    },
    {
        symbol: '2317', name: '鴻海', price: 215, change: 4.5, changePercent: 2.14, volume: 95000, amount: 204,
        open: 210.5, high: 216, low: 209, prevClose: 210.5,
        marketCap: 2980000, pe: 15.3, pb: 2.8, dividendYield: 4.2, eps: 12.5, sector: 'electronics', industry: '電子',
        institutional: { foreign: 3500, trust: 1200, dealer: 800 },
        rsi: 75, macd: 4.5, ma20: 205, ma60: 185
    },
    { symbol: '3008', name: '大立光', price: 2350, change: 45, changePercent: 1.95, volume: 450, marketCap: 320000, pe: 22.1, pb: 6.5, dividendYield: 2.8, eps: 106.3, sector: 'electronics', industry: '光學', rsi: 45, macd: -5, ma20: 2380, ma60: 2400 },
    { symbol: '2303', name: '聯電', price: 48.5, change: 0.8, changePercent: 1.68, volume: 125000, marketCap: 605000, pe: 14.5, pb: 2.1, dividendYield: 3.5, eps: 3.34, sector: 'semiconductor', industry: '半導體', rsi: 62, macd: 0.2, ma20: 47.5, ma60: 46 },
    { symbol: '2603', name: '長榮', price: 150, change: -3, changePercent: -1.9, volume: 25000, marketCap: 380000, pe: 8.5, pb: 1.2, dividendYield: 5.2, eps: 17.6, sector: 'shipping', industry: '航運', rsi: 35, macd: -2.5, ma20: 155, ma60: 160 },
    { symbol: '2609', name: '陽明', price: 45, change: -1.5, changePercent: -3.2, volume: 32000, marketCap: 195000, pe: 6.8, pb: 0.9, dividendYield: 6.5, eps: 6.6, sector: 'shipping', industry: '航運', rsi: 28, macd: -1.2, ma20: 48, ma60: 52 },
    { symbol: '2615', name: '萬海', price: 52, change: -1.2, changePercent: -2.25, volume: 18000, marketCap: 145000, pe: 7.2, pb: 1.1, dividendYield: 5.8, eps: 7.2, sector: 'shipping', industry: '航運', rsi: 32, macd: -0.8, ma20: 54, ma60: 58 },
    { symbol: '2308', name: '台達電', price: 320, change: -5, changePercent: -1.54, volume: 5600, marketCap: 830000, pe: 19.8, pb: 4.5, dividendYield: 2.5, eps: 16.2, sector: 'electronics', industry: '電源', rsi: 48, macd: 0.1, ma20: 322, ma60: 315 },
    { symbol: '1301', name: '台塑', price: 78, change: -0.5, changePercent: -0.64, volume: 12000, marketCap: 980000, pe: 11.2, pb: 1.5, dividendYield: 4.8, eps: 6.96, sector: 'plastic', industry: '塑膠', rsi: 42, macd: -0.3, ma20: 79, ma60: 82 },
    { symbol: '2882', name: '國泰金', price: 58.5, change: 0.5, changePercent: 0.86, volume: 18500, marketCap: 890000, pe: 10.5, pb: 1.3, dividendYield: 5.5, eps: 5.57, sector: 'finance', industry: '金融', rsi: 55, macd: 0.4, ma20: 57, ma60: 55 },
    { symbol: '2881', name: '富邦金', price: 72.8, change: -0.3, changePercent: -0.41, volume: 15200, marketCap: 1010000, pe: 11.8, pb: 1.4, dividendYield: 5.2, eps: 6.17, sector: 'finance', industry: '金融', rsi: 52, macd: 0.3, ma20: 72, ma60: 70 },
    { symbol: '2412', name: '中華電', price: 123, change: 0.5, changePercent: 0.41, volume: 8900, marketCap: 955000, pe: 16.5, pb: 2.8, dividendYield: 4.2, eps: 7.45, sector: 'telecom', industry: '通信', rsi: 50, macd: 0.1, ma20: 122, ma60: 120 },
    { symbol: '2002', name: '中鋼', price: 28.5, change: 0.2, changePercent: 0.71, volume: 45000, marketCap: 360000, pe: 9.8, pb: 1.1, dividendYield: 4.5, eps: 2.91, sector: 'steel', industry: '鋼鐵', rsi: 46, macd: -0.1, ma20: 28.2, ma60: 29 },
    { symbol: '2886', name: '兆豐金', price: 38.2, change: -0.15, changePercent: -0.39, volume: 22000, marketCap: 485000, pe: 10.2, pb: 1.2, dividendYield: 5.8, eps: 3.75, sector: 'finance', industry: '金融', rsi: 53, macd: 0.2, ma20: 38, ma60: 37 },
    { symbol: '0052', name: '富邦科技', price: 165, change: 2.5, changePercent: 1.54, volume: 1500, marketCap: 15000, pe: 0, pb: 0, dividendYield: 2.5, eps: 0, sector: 'semiconductor', industry: 'ETF' },
];

// Generate more stocks for screener
export function generateStockList(count: number = 100): Stock[] {
    const stocks = [...POPULAR_STOCKS];
    const sectors = SECTORS.map(s => s.id);

    for (let i = stocks.length; i < count; i++) {
        const symbol = (1000 + i).toString();
        const sector = sectors[Math.floor(Math.random() * sectors.length)];
        const sectorInfo = SECTORS.find(s => s.id === sector);
        const price = Math.round((Math.random() * 500 + 20) * 100) / 100;
        const change = Math.round((Math.random() - 0.5) * 10 * 100) / 100;
        const prevClose = price - change;

        stocks.push({
            symbol,
            name: `股票${symbol}`,
            price,
            change,
            changePercent: Math.round((change / prevClose) * 100 * 100) / 100,
            volume: Math.round(Math.random() * 50000 + 1000),
            amount: Math.round(Math.random() * 100 + 10),
            open: price + (Math.random() - 0.5) * 2,
            high: price + Math.random() * 5,
            low: price - Math.random() * 5,
            prevClose,
            marketCap: Math.round(Math.random() * 1000000 + 50000),
            pe: Math.round((Math.random() * 30 + 5) * 10) / 10,
            pb: Math.round((Math.random() * 8 + 0.5) * 10) / 10,
            dividendYield: Math.round((Math.random() * 8 + 1) * 10) / 10,
            eps: Math.round((Math.random() * 20 + 1) * 100) / 100,
            sector,
            industry: sectorInfo?.name || '其他',
            institutional: {
                foreign: Math.round((Math.random() - 0.5) * 1000),
                trust: Math.round((Math.random() - 0.5) * 500),
                dealer: Math.round((Math.random() - 0.5) * 200),
            },
            // Random technical indicators
            rsi: Math.round(Math.random() * 80 + 10),
            macd: Math.round((Math.random() - 0.5) * 5 * 100) / 100,
            ma20: Math.round((price * (1 + (Math.random() - 0.5) * 0.1)) * 100) / 100,
            ma60: Math.round((price * (1 + (Math.random() - 0.5) * 0.2)) * 100) / 100,
        });
    }

    return stocks;
}

// Generate time series data for charts
export function generatePriceHistory(days: number = 60, basePrice: number = 100): any[] {
    const data = [];
    let price = basePrice;

    for (let i = 0; i < days; i++) {
        const date = new Date();
        date.setDate(date.getDate() - (days - i));

        const change = (Math.random() - 0.5) * (basePrice * 0.05);
        price = Math.max(price + change, basePrice * 0.7);

        const open = price;
        const close = price + (Math.random() - 0.5) * (basePrice * 0.03);
        const high = Math.max(open, close) + Math.random() * (basePrice * 0.02);
        const low = Math.min(open, close) - Math.random() * (basePrice * 0.02);

        data.push({
            date: date.toISOString().split('T')[0],
            open: Math.round(open * 100) / 100,
            high: Math.round(high * 100) / 100,
            low: Math.round(low * 100) / 100,
            close: Math.round(close * 100) / 100,
            volume: Math.round(Math.random() * 5000 + 1000),
        });

        price = close;
    }

    return data;
}

// Economic Calendar Events
export function generateEconomicEvents(): EconomicEvent[] {
    const today = new Date();
    const events: EconomicEvent[] = [];

    // Generate events for next 30 days
    for (let i = 0; i < 30; i++) {
        const date = new Date(today);
        date.setDate(date.getDate() + i);
        const dateStr = date.toISOString().split('T')[0];

        // Random earnings announcements
        if (Math.random() > 0.7) {
            const stock = POPULAR_STOCKS[Math.floor(Math.random() * POPULAR_STOCKS.length)];
            events.push({
                id: `earnings-${i}`,
                date: dateStr,
                time: '14:00',
                title: `${stock.name} 法說會`,
                type: 'earnings',
                importance: 'high',
                symbol: stock.symbol,
                description: `${stock.name} 舉行法人說明會`,
            });
        }

        // Random dividend dates
        if (Math.random() > 0.8) {
            const stock = POPULAR_STOCKS[Math.floor(Math.random() * POPULAR_STOCKS.length)];
            events.push({
                id: `dividend-${i}`,
                date: dateStr,
                title: `${stock.name} 除息`,
                type: 'dividend',
                importance: 'medium',
                symbol: stock.symbol,
                description: `現金股利 ${(Math.random() * 5 + 1).toFixed(2)} 元`,
            });
        }

        // Economic indicators
        if (i % 7 === 0) {
            events.push({
                id: `economic-${i}`,
                date: dateStr,
                time: '17:00',
                title: '央行利率決議',
                type: 'economic',
                importance: 'high',
                description: '中央銀行理監事會議',
            });
        }
    }

    return events.sort((a, b) => a.date.localeCompare(b.date));
}

// Market Breadth Data
export function getMarketBreadth() {
    return {
        advancing: 892,
        declining: 543,
        unchanged: 165,
        advancingVolume: 125000,
        decliningVolume: 78000,
        totalVolume: 203000,
        newHighs: 45,
        newLows: 12,
    };
}

// Foreign Investor Data
export function getForeignInvestorData() {
    return {
        netBuy: 8520, // Million TWD
        buyAmount: 45230,
        sellAmount: 36710,
        trend: 'buying' as const,
    };
}

// Sentiment Data
export function getSentimentData() {
    return {
        fearGreedIndex: 65, // 0-100, higher = more greed
        sentiment: 'bullish' as const,
        newsPositive: 68,
        newsNegative: 32,
        socialMediaBuzz: 72,
        volatilityIndex: 18.5,
    };
}

// Dividend History
export function getDividendHistory(symbol: string) {
    const years = [2023, 2022, 2021, 2020, 2019];
    return years.map(year => ({
        year,
        cashDividend: Math.round((Math.random() * 5 + 1) * 100) / 100,
        stockDividend: Math.round((Math.random() * 0.5) * 100) / 100,
        exDividendDate: `${year}-08-15`,
        paymentDate: `${year}-09-20`,
        yield: Math.round((Math.random() * 6 + 2) * 100) / 100,
    }));
}

// Stock Comparison Data
export function getStockComparison(symbols: string[]) {
    return symbols.map(symbol => {
        const stock = POPULAR_STOCKS.find(s => s.symbol === symbol) || POPULAR_STOCKS[0];
        return {
            ...stock,
            revenue: Math.round(Math.random() * 100000 + 10000),
            netIncome: Math.round(Math.random() * 20000 + 2000),
            roe: Math.round((Math.random() * 20 + 5) * 100) / 100,
            roa: Math.round((Math.random() * 10 + 2) * 100) / 100,
            debtRatio: Math.round((Math.random() * 50 + 10) * 100) / 100,
        };
    });
}
