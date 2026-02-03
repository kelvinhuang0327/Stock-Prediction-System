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
    ma20?: number;
    ma60?: number;
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
