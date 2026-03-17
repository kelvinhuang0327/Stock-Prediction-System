// Stock data types
export interface StockDataPoint {
    date: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}

// Technical indicator values
export interface TechnicalIndicatorValues {
    // Moving Averages
    ma5?: number;
    ma10?: number; // Added
    ma20?: number;
    ma60?: number;
    ma120?: number; // Added
    ema12?: number;
    ema26?: number;

    // Bollinger Bands
    bbUpper?: number;
    bbMiddle?: number;
    bbLower?: number;

    // KD Stochastic
    k?: number;
    d?: number;

    // MACD
    dif?: number;
    dem?: number;
    osc?: number;

    // RSI
    rsi?: number;

    // ATR
    atr?: number;
    tr?: number; // True Range

    // Williams %R
    williamsR?: number;

    // CCI
    cci?: number;

    // OBV
    obv?: number;

    // Ichimoku Cloud (一目均衡表)
    tenkanSen?: number;     // 轉換線
    kijunSen?: number;      // 基準線
    senkouSpanA?: number;   // 先行帶A
    senkouSpanB?: number;   // 先行帶B
    chikouSpan?: number;    // 遲行帶

    // Parabolic SAR (拋物線轉向)
    sar?: number;

    // ADX (平均趨向指數)
    adx?: number;
    plusDI?: number;        // +DI
    minusDI?: number;       // -DI

    // Stochastic RSI (隨機RSI)
    stochRsiK?: number;
    stochRsiD?: number;

    // VWAP (成交量加權平均價)
    vwap?: number;

    // MFI (資金流量指標)
    mfi?: number;

    // CMF (蔡金資金流)
    cmf?: number;

    // Pivot Points (軸心點)
    pivotPoint?: number;
    pivotR1?: number;
    pivotR2?: number;
    pivotR3?: number;
    pivotS1?: number;
    pivotS2?: number;
    pivotS3?: number;
}

// Combined type
export type StockDataWithIndicators = StockDataPoint & TechnicalIndicatorValues;

// Indicator calculation options
export interface IndicatorOptions {
    sma?: number[]; // periods for SMA, e.g., [5, 20, 60]
    ema?: number[]; // periods for EMA, e.g., [12, 26]
    bollinger?: { period: number; multiplier: number };
    kd?: { period: number };
    macd?: { fast: number; slow: number; signal: number };
    rsi?: { period: number };
    atr?: { period: number };
    williamsR?: { period: number };
    cci?: { period: number };
    includeOBV?: boolean;
}

// Signal types
export type SignalType = 'Buy' | 'Sell' | 'Neutral' | 'Bullish' | 'Bearish' | 'Overbought' | 'Oversold';

// Indicator summary
export interface IndicatorSummary {
    name: string;
    value: string;
    signal: SignalType;
    description?: string;
}

// Core Entity Types
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
