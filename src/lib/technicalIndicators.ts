import { StockDataPoint, StockDataWithIndicators, TechnicalIndicatorValues } from '@/types/stock';

/**
 * Calculate Simple Moving Average (SMA)
 */
export const calculateSMA = (data: StockDataPoint[], window: number): StockDataWithIndicators[] => {
    return data.map((entry, index) => {
        if (index < window - 1) {
            return { ...entry, [`ma${window}`]: undefined };
        }
        const slice = data.slice(index - window + 1, index + 1);
        const sum = slice.reduce((acc, curr) => acc + curr.close, 0);
        return { ...entry, [`ma${window}`]: Math.round((sum / window) * 100) / 100 };
    }) as StockDataWithIndicators[];
};

/**
 * Calculate Exponential Moving Average (EMA)
 */
export const calculateEMA = (
    data: StockDataWithIndicators[],
    window: number,
    key: keyof StockDataPoint = 'close'
): StockDataWithIndicators[] => {
    const k = 2 / (window + 1);
    let ema = data[0][key] as number;

    return data.map((entry, index) => {
        if (index === 0) {
            return { ...entry, [`ema${window}`]: ema };
        }
        ema = (entry[key] as number) * k + ema * (1 - k);
        return { ...entry, [`ema${window}`]: Math.round(ema * 100) / 100 };
    });
};

/**
 * Calculate Bollinger Bands
 */
export const calculateBollingerBands = (
    data: StockDataWithIndicators[],
    window: number = 20,
    multiplier: number = 2
): StockDataWithIndicators[] => {
    return data.map((entry, index) => {
        if (index < window - 1) {
            return { ...entry, bbUpper: undefined, bbLower: undefined, bbMiddle: undefined };
        }

        const slice = data.slice(index - window + 1, index + 1);
        const sum = slice.reduce((acc, curr) => acc + curr.close, 0);
        const mean = sum / window;

        const squaredDiffs = slice.map(d => Math.pow(d.close - mean, 2));
        const variance = squaredDiffs.reduce((acc, curr) => acc + curr, 0) / window;
        const stdDev = Math.sqrt(variance);

        return {
            ...entry,
            bbMiddle: Math.round(mean * 100) / 100,
            bbUpper: Math.round((mean + multiplier * stdDev) * 100) / 100,
            bbLower: Math.round((mean - multiplier * stdDev) * 100) / 100
        };
    });
};

/**
 * Calculate KD Stochastic Oscillator
 */
export const calculateKD = (
    data: StockDataWithIndicators[],
    period: number = 9
): StockDataWithIndicators[] => {
    let k = 50;
    let d = 50;

    return data.map((entry, index) => {
        if (index < period - 1) {
            return { ...entry, k: 50, d: 50 };
        }

        const slice = data.slice(index - period + 1, index + 1);
        const low = Math.min(...slice.map(d => d.low));
        const high = Math.max(...slice.map(d => d.high));

        let rsv = 50;
        if (high !== low) {
            rsv = ((entry.close - low) / (high - low)) * 100;
        }

        k = (2 / 3) * k + (1 / 3) * rsv;
        d = (2 / 3) * d + (1 / 3) * k;

        return {
            ...entry,
            k: Math.round(k * 100) / 100,
            d: Math.round(d * 100) / 100
        };
    });
};

/**
 * Calculate MACD (Moving Average Convergence Divergence)
 */
export const calculateMACD = (data: StockDataWithIndicators[]): StockDataWithIndicators[] => {
    const withEma12 = calculateEMA(data, 12, 'close');
    const withEma26 = calculateEMA(withEma12, 26, 'close');

    const withDif = withEma26.map(d => ({
        ...d,
        dif: (d.ema12 !== undefined && d.ema26 !== undefined) ? d.ema12 - d.ema26 : 0
    }));

    const withSignal = calculateEMA(withDif, 9, 'dif' as keyof StockDataPoint);

    return withSignal.map(d => {
        const ema9Value = (d as any).ema9; // Dynamic property access
        return {
            ...d,
            dem: ema9Value,
            osc: (d.dif !== undefined && ema9Value !== undefined) ? d.dif - ema9Value : 0
        };
    });
};

/**
 * Calculate RSI (Relative Strength Index)
 */
export const calculateRSI = (
    data: StockDataWithIndicators[],
    period: number = 14
): StockDataWithIndicators[] => {
    return data.map((entry, index) => {
        if (index < period) {
            return { ...entry, rsi: 50 };
        }

        const slice = data.slice(index - period, index + 1);
        let gains = 0;
        let losses = 0;

        for (let i = 1; i < slice.length; i++) {
            const change = slice[i].close - slice[i - 1].close;
            if (change > 0) {
                gains += change;
            } else {
                losses += Math.abs(change);
            }
        }

        const avgGain = gains / period;
        const avgLoss = losses / period;

        if (avgLoss === 0) {
            return { ...entry, rsi: 100 };
        }

        const rs = avgGain / avgLoss;
        const rsi = 100 - (100 / (1 + rs));

        return { ...entry, rsi: Math.round(rsi * 100) / 100 };
    });
};

/**
 * Calculate ATR (Average True Range)
 */
export const calculateATR = (
    data: StockDataWithIndicators[],
    period: number = 14
): StockDataWithIndicators[] => {
    // First calculate True Range for each period
    const withTR = data.map((entry, index) => {
        if (index === 0) {
            return { ...entry, tr: entry.high - entry.low };
        }

        const prevClose = data[index - 1].close;
        const tr = Math.max(
            entry.high - entry.low,
            Math.abs(entry.high - prevClose),
            Math.abs(entry.low - prevClose)
        );

        return { ...entry, tr: Math.round(tr * 100) / 100 };
    });

    // Then calculate ATR as moving average of TR
    return withTR.map((entry, index) => {
        if (index < period - 1) {
            return { ...entry, atr: undefined };
        }

        const slice = withTR.slice(index - period + 1, index + 1);
        const sum = slice.reduce((acc, curr) => acc + (curr.tr || 0), 0);
        const atr = sum / period;

        return { ...entry, atr: Math.round(atr * 100) / 100 };
    });
};

/**
 * Calculate Williams %R
 */
export const calculateWilliamsR = (
    data: StockDataWithIndicators[],
    period: number = 14
): StockDataWithIndicators[] => {
    return data.map((entry, index) => {
        if (index < period - 1) {
            return { ...entry, williamsR: -50 };
        }

        const slice = data.slice(index - period + 1, index + 1);
        const high = Math.max(...slice.map(d => d.high));
        const low = Math.min(...slice.map(d => d.low));

        if (high === low) {
            return { ...entry, williamsR: -50 };
        }

        const williamsR = ((high - entry.close) / (high - low)) * -100;

        return { ...entry, williamsR: Math.round(williamsR * 100) / 100 };
    });
};

/**
 * Calculate CCI (Commodity Channel Index)
 */
export const calculateCCI = (
    data: StockDataWithIndicators[],
    period: number = 20
): StockDataWithIndicators[] => {
    return data.map((entry, index) => {
        if (index < period - 1) {
            return { ...entry, cci: 0 };
        }

        const slice = data.slice(index - period + 1, index + 1);

        // Calculate Typical Price for each period
        const typicalPrices = slice.map(d => (d.high + d.low + d.close) / 3);

        // Calculate SMA of Typical Price
        const sma = typicalPrices.reduce((acc, curr) => acc + curr, 0) / period;

        // Calculate Mean Deviation
        const meanDeviation = typicalPrices.reduce((acc, curr) => acc + Math.abs(curr - sma), 0) / period;

        const currentTP = (entry.high + entry.low + entry.close) / 3;

        if (meanDeviation === 0) {
            return { ...entry, cci: 0 };
        }

        const cci = (currentTP - sma) / (0.015 * meanDeviation);

        return { ...entry, cci: Math.round(cci * 100) / 100 };
    });
};

/**
 * Calculate OBV (On-Balance Volume)
 */
export const calculateOBV = (data: StockDataWithIndicators[]): StockDataWithIndicators[] => {
    let obv = 0;

    return data.map((entry, index) => {
        if (index === 0) {
            obv = entry.volume;
        } else {
            const prevClose = data[index - 1].close;
            if (entry.close > prevClose) {
                obv += entry.volume;
            } else if (entry.close < prevClose) {
                obv -= entry.volume;
            }
            // If close === prevClose, OBV stays the same
        }

        return { ...entry, obv };
    });
};

/**
 * Calculate Volume Profile
 */
export const calculateVolumeProfile = (
    data: StockDataPoint[],
    buckets: number = 20
) => {
    if (!data || data.length === 0) return [];

    const minPrice = Math.min(...data.map(d => d.low));
    const maxPrice = Math.max(...data.map(d => d.high));
    const step = (maxPrice - minPrice) / buckets;

    const profile = new Array(buckets).fill(0).map((_, i) => ({
        priceStart: minPrice + i * step,
        priceEnd: minPrice + (i + 1) * step,
        volume: 0
    }));

    data.forEach(d => {
        const bucketIndex = Math.min(
            Math.floor((d.close - minPrice) / step),
            buckets - 1
        );
        if (bucketIndex >= 0) {
            profile[bucketIndex].volume += d.volume;
        }
    });

    const maxVol = Math.max(...profile.map(p => p.volume));
    return profile.map(p => ({
        ...p,
        width: (p.volume / maxVol) * 100 // Percentage width
    }));
};

/**
 * Calculate all indicators at once
 */
export const calculateAllIndicators = (
    data: StockDataPoint[],
    options?: {
        sma?: number[];
        ema?: number[];
        bollinger?: { period: number; multiplier: number };
        kd?: { period: number };
        macd?: boolean;
        rsi?: { period: number };
        atr?: { period: number };
        williamsR?: { period: number };
        cci?: { period: number };
        includeOBV?: boolean;
    }
): StockDataWithIndicators[] => {
    let result: StockDataWithIndicators[] = [...data];

    // SMA
    const smaPeriods = options?.sma || [5, 20, 60];
    smaPeriods.forEach(period => {
        result = calculateSMA(result, period);
    });

    // EMA (for MACD)
    const emaPeriods = options?.ema || [12, 26];
    emaPeriods.forEach(period => {
        result = calculateEMA(result, period);
    });

    // Bollinger Bands
    if (options?.bollinger !== undefined) {
        result = calculateBollingerBands(
            result,
            options.bollinger.period,
            options.bollinger.multiplier
        );
    } else {
        result = calculateBollingerBands(result);
    }

    // KD
    if (options?.kd !== undefined) {
        result = calculateKD(result, options.kd.period);
    } else {
        result = calculateKD(result);
    }

    // MACD
    if (options?.macd !== false) {
        result = calculateMACD(result);
    }

    // RSI
    if (options?.rsi !== undefined) {
        result = calculateRSI(result, options.rsi.period);
    } else {
        result = calculateRSI(result);
    }

    // ATR
    if (options?.atr !== undefined) {
        result = calculateATR(result, options.atr.period);
    } else {
        result = calculateATR(result);
    }

    // Williams %R
    if (options?.williamsR !== undefined) {
        result = calculateWilliamsR(result, options.williamsR.period);
    } else {
        result = calculateWilliamsR(result);
    }

    // CCI
    if (options?.cci !== undefined) {
        result = calculateCCI(result, options.cci.period);
    } else {
        result = calculateCCI(result);
    }

    // OBV
    if (options?.includeOBV !== false) {
        result = calculateOBV(result);
    }

    return result;
};
