import { StockDataPoint, StockDataWithIndicators, TechnicalIndicatorValues } from '../types/stock';

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

        // Standard KD smoothing: K = (1/3)*K_prev + (2/3)*RSV
        k = (1 / 3) * k + (2 / 3) * rsv;
        d = (1 / 3) * d + (2 / 3) * k;

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
 * Calculate Ichimoku Cloud (一目均衡表)
 */
export const calculateIchimoku = (
    data: StockDataWithIndicators[],
    tenkanPeriod: number = 9,
    kijunPeriod: number = 26,
    senkouBPeriod: number = 52
): StockDataWithIndicators[] => {
    const getHighLow = (slice: StockDataWithIndicators[]) => {
        const high = Math.max(...slice.map(d => d.high));
        const low = Math.min(...slice.map(d => d.low));
        return { high, low };
    };

    return data.map((entry, index) => {
        // Tenkan-sen (Conversion Line)
        let tenkanSen: number | undefined;
        if (index >= tenkanPeriod - 1) {
            const { high, low } = getHighLow(data.slice(index - tenkanPeriod + 1, index + 1));
            tenkanSen = (high + low) / 2;
        }

        // Kijun-sen (Base Line)
        let kijunSen: number | undefined;
        if (index >= kijunPeriod - 1) {
            const { high, low } = getHighLow(data.slice(index - kijunPeriod + 1, index + 1));
            kijunSen = (high + low) / 2;
        }

        // Senkou Span A (Leading Span A) - plotted 26 periods ahead
        const senkouSpanA = tenkanSen !== undefined && kijunSen !== undefined
            ? (tenkanSen + kijunSen) / 2
            : undefined;

        // Senkou Span B (Leading Span B) - plotted 26 periods ahead
        let senkouSpanB: number | undefined;
        if (index >= senkouBPeriod - 1) {
            const { high, low } = getHighLow(data.slice(index - senkouBPeriod + 1, index + 1));
            senkouSpanB = (high + low) / 2;
        }

        // Chikou Span (Lagging Span) - current close plotted 26 periods back
        const chikouSpan = entry.close;

        return {
            ...entry,
            tenkanSen: tenkanSen !== undefined ? Math.round(tenkanSen * 100) / 100 : undefined,
            kijunSen: kijunSen !== undefined ? Math.round(kijunSen * 100) / 100 : undefined,
            senkouSpanA: senkouSpanA !== undefined ? Math.round(senkouSpanA * 100) / 100 : undefined,
            senkouSpanB: senkouSpanB !== undefined ? Math.round(senkouSpanB * 100) / 100 : undefined,
            chikouSpan: Math.round(chikouSpan * 100) / 100,
        };
    });
};

/**
 * Calculate Parabolic SAR (拋物線轉向指標)
 */
export const calculateParabolicSAR = (
    data: StockDataWithIndicators[],
    step: number = 0.02,
    maxStep: number = 0.2
): StockDataWithIndicators[] => {
    if (data.length < 2) return data;

    const result: StockDataWithIndicators[] = [];
    let isUptrend = data[1].close > data[0].close;
    let sar = isUptrend ? data[0].low : data[0].high;
    let ep = isUptrend ? data[0].high : data[0].low;
    let af = step;

    for (let i = 0; i < data.length; i++) {
        const entry = data[i];

        if (i === 0) {
            result.push({ ...entry, sar: Math.round(sar * 100) / 100 });
            continue;
        }

        // Calculate new SAR
        let newSar = sar + af * (ep - sar);

        if (isUptrend) {
            newSar = Math.min(newSar, data[i - 1].low, i > 1 ? data[i - 2].low : data[i - 1].low);
            if (entry.low < newSar) {
                isUptrend = false;
                newSar = ep;
                ep = entry.low;
                af = step;
            } else {
                if (entry.high > ep) {
                    ep = entry.high;
                    af = Math.min(af + step, maxStep);
                }
            }
        } else {
            newSar = Math.max(newSar, data[i - 1].high, i > 1 ? data[i - 2].high : data[i - 1].high);
            if (entry.high > newSar) {
                isUptrend = true;
                newSar = ep;
                ep = entry.high;
                af = step;
            } else {
                if (entry.low < ep) {
                    ep = entry.low;
                    af = Math.min(af + step, maxStep);
                }
            }
        }

        sar = newSar;
        result.push({ ...entry, sar: Math.round(sar * 100) / 100 });
    }

    return result;
};

/**
 * Calculate ADX (Average Directional Index - 平均趨向指數)
 */
export const calculateADX = (
    data: StockDataWithIndicators[],
    period: number = 14
): StockDataWithIndicators[] => {
    if (data.length < period + 1) return data;

    // Calculate +DM, -DM, and TR
    const dmPlusArr: number[] = [0];
    const dmMinusArr: number[] = [0];
    const trArr: number[] = [data[0].high - data[0].low];

    for (let i = 1; i < data.length; i++) {
        const upMove = data[i].high - data[i - 1].high;
        const downMove = data[i - 1].low - data[i].low;

        const dmPlus = upMove > downMove && upMove > 0 ? upMove : 0;
        const dmMinus = downMove > upMove && downMove > 0 ? downMove : 0;

        dmPlusArr.push(dmPlus);
        dmMinusArr.push(dmMinus);

        const tr = Math.max(
            data[i].high - data[i].low,
            Math.abs(data[i].high - data[i - 1].close),
            Math.abs(data[i].low - data[i - 1].close)
        );
        trArr.push(tr);
    }

    // Calculate smoothed averages
    const smoothedTR: number[] = [];
    const smoothedDMPlus: number[] = [];
    const smoothedDMMinus: number[] = [];

    for (let i = 0; i < data.length; i++) {
        if (i < period) {
            smoothedTR.push(0);
            smoothedDMPlus.push(0);
            smoothedDMMinus.push(0);
        } else if (i === period) {
            smoothedTR.push(trArr.slice(1, period + 1).reduce((a, b) => a + b, 0));
            smoothedDMPlus.push(dmPlusArr.slice(1, period + 1).reduce((a, b) => a + b, 0));
            smoothedDMMinus.push(dmMinusArr.slice(1, period + 1).reduce((a, b) => a + b, 0));
        } else {
            smoothedTR.push(smoothedTR[i - 1] - smoothedTR[i - 1] / period + trArr[i]);
            smoothedDMPlus.push(smoothedDMPlus[i - 1] - smoothedDMPlus[i - 1] / period + dmPlusArr[i]);
            smoothedDMMinus.push(smoothedDMMinus[i - 1] - smoothedDMMinus[i - 1] / period + dmMinusArr[i]);
        }
    }

    // Calculate +DI, -DI, DX, and ADX
    const diPlus: number[] = [];
    const diMinus: number[] = [];
    const dx: number[] = [];

    for (let i = 0; i < data.length; i++) {
        if (smoothedTR[i] === 0) {
            diPlus.push(0);
            diMinus.push(0);
            dx.push(0);
        } else {
            const plusDI = (smoothedDMPlus[i] / smoothedTR[i]) * 100;
            const minusDI = (smoothedDMMinus[i] / smoothedTR[i]) * 100;
            diPlus.push(plusDI);
            diMinus.push(minusDI);

            const diSum = plusDI + minusDI;
            dx.push(diSum === 0 ? 0 : (Math.abs(plusDI - minusDI) / diSum) * 100);
        }
    }

    // Calculate ADX (smoothed DX)
    return data.map((entry, i) => {
        if (i < period * 2 - 1) {
            return { ...entry, adx: undefined, plusDI: undefined, minusDI: undefined };
        }

        const adxSlice = dx.slice(i - period + 1, i + 1);
        const adx = adxSlice.reduce((a, b) => a + b, 0) / period;

        return {
            ...entry,
            adx: Math.round(adx * 100) / 100,
            plusDI: Math.round(diPlus[i] * 100) / 100,
            minusDI: Math.round(diMinus[i] * 100) / 100,
        };
    });
};

/**
 * Calculate Stochastic RSI (隨機相對強弱指標)
 */
export const calculateStochRSI = (
    data: StockDataWithIndicators[],
    rsiPeriod: number = 14,
    stochPeriod: number = 14,
    kSmooth: number = 3,
    dSmooth: number = 3
): StockDataWithIndicators[] => {
    // First, ensure RSI is calculated
    const withRSI = data[0].rsi !== undefined ? data : calculateRSI(data, rsiPeriod);

    return withRSI.map((entry, index) => {
        if (index < rsiPeriod + stochPeriod - 1) {
            return { ...entry, stochRsiK: undefined, stochRsiD: undefined };
        }

        // Get RSI values for the stochastic period
        const rsiValues = withRSI
            .slice(index - stochPeriod + 1, index + 1)
            .map(d => d.rsi || 50);

        const rsiMin = Math.min(...rsiValues);
        const rsiMax = Math.max(...rsiValues);
        const currentRSI = entry.rsi || 50;

        const stochRsi = rsiMax === rsiMin ? 50 : ((currentRSI - rsiMin) / (rsiMax - rsiMin)) * 100;

        // Calculate K (smoothed StochRSI)
        const kValues: number[] = [];
        for (let k = 0; k < kSmooth && index - k >= rsiPeriod + stochPeriod - 1; k++) {
            const kIdx = index - k;
            const kRsiValues = withRSI.slice(kIdx - stochPeriod + 1, kIdx + 1).map(d => d.rsi || 50);
            const kMin = Math.min(...kRsiValues);
            const kMax = Math.max(...kRsiValues);
            const kRsi = withRSI[kIdx].rsi || 50;
            kValues.push(kMax === kMin ? 50 : ((kRsi - kMin) / (kMax - kMin)) * 100);
        }
        const stochRsiK = kValues.reduce((a, b) => a + b, 0) / kValues.length;

        return {
            ...entry,
            stochRsiK: Math.round(stochRsiK * 100) / 100,
            stochRsiD: Math.round(stochRsi * 100) / 100, // Will be smoothed if needed
        };
    });
};

/**
 * Calculate VWAP (Volume Weighted Average Price - 成交量加權平均價)
 */
export const calculateVWAP = (data: StockDataWithIndicators[]): StockDataWithIndicators[] => {
    let cumulativeTPV = 0; // Typical Price × Volume
    let cumulativeVolume = 0;

    return data.map(entry => {
        const typicalPrice = (entry.high + entry.low + entry.close) / 3;
        cumulativeTPV += typicalPrice * entry.volume;
        cumulativeVolume += entry.volume;

        const vwap = cumulativeVolume > 0 ? cumulativeTPV / cumulativeVolume : typicalPrice;

        return {
            ...entry,
            vwap: Math.round(vwap * 100) / 100,
        };
    });
};

/**
 * Calculate MFI (Money Flow Index - 資金流量指標)
 */
export const calculateMFI = (
    data: StockDataWithIndicators[],
    period: number = 14
): StockDataWithIndicators[] => {
    // Calculate Raw Money Flow and classify as positive or negative
    const typicalPrices = data.map(d => (d.high + d.low + d.close) / 3);
    const rawMoneyFlow = data.map((d, i) => typicalPrices[i] * d.volume);

    return data.map((entry, index) => {
        if (index < period) {
            return { ...entry, mfi: 50 };
        }

        let positiveFlow = 0;
        let negativeFlow = 0;

        for (let i = index - period + 1; i <= index; i++) {
            if (i > 0 && typicalPrices[i] > typicalPrices[i - 1]) {
                positiveFlow += rawMoneyFlow[i];
            } else if (i > 0 && typicalPrices[i] < typicalPrices[i - 1]) {
                negativeFlow += rawMoneyFlow[i];
            }
        }

        const moneyFlowRatio = negativeFlow === 0 ? 100 : positiveFlow / negativeFlow;
        const mfi = 100 - (100 / (1 + moneyFlowRatio));

        return {
            ...entry,
            mfi: Math.round(mfi * 100) / 100,
        };
    });
};

/**
 * Calculate CMF (Chaikin Money Flow - 蔡金資金流)
 */
export const calculateCMF = (
    data: StockDataWithIndicators[],
    period: number = 20
): StockDataWithIndicators[] => {
    // Calculate Money Flow Multiplier and Money Flow Volume
    const mfMultiplier = data.map(d => {
        const range = d.high - d.low;
        return range === 0 ? 0 : ((d.close - d.low) - (d.high - d.close)) / range;
    });
    const mfVolume = data.map((d, i) => mfMultiplier[i] * d.volume);

    return data.map((entry, index) => {
        if (index < period - 1) {
            return { ...entry, cmf: 0 };
        }

        const slice = data.slice(index - period + 1, index + 1);
        const mfvSlice = mfVolume.slice(index - period + 1, index + 1);

        const sumMFV = mfvSlice.reduce((a, b) => a + b, 0);
        const sumVolume = slice.reduce((a, b) => a + b.volume, 0);

        const cmf = sumVolume === 0 ? 0 : sumMFV / sumVolume;

        return {
            ...entry,
            cmf: Math.round(cmf * 10000) / 10000,
        };
    });
};

/**
 * Calculate Pivot Points (軸心點)
 */
export const calculatePivotPoints = (
    data: StockDataWithIndicators[]
): StockDataWithIndicators[] => {
    return data.map((entry, index) => {
        // Use previous day's data to calculate today's pivot points
        if (index === 0) {
            const pp = (entry.high + entry.low + entry.close) / 3;
            return {
                ...entry,
                pivotPoint: Math.round(pp * 100) / 100,
                pivotR1: Math.round((2 * pp - entry.low) * 100) / 100,
                pivotR2: Math.round((pp + entry.high - entry.low) * 100) / 100,
                pivotR3: Math.round((entry.high + 2 * (pp - entry.low)) * 100) / 100,
                pivotS1: Math.round((2 * pp - entry.high) * 100) / 100,
                pivotS2: Math.round((pp - entry.high + entry.low) * 100) / 100,
                pivotS3: Math.round((entry.low - 2 * (entry.high - pp)) * 100) / 100,
            };
        }

        const prev = data[index - 1];
        const pp = (prev.high + prev.low + prev.close) / 3;

        // Standard Pivot Point formula
        const r1 = 2 * pp - prev.low;
        const r2 = pp + (prev.high - prev.low);
        const r3 = prev.high + 2 * (pp - prev.low);
        const s1 = 2 * pp - prev.high;
        const s2 = pp - (prev.high - prev.low);
        const s3 = prev.low - 2 * (prev.high - pp);

        return {
            ...entry,
            pivotPoint: Math.round(pp * 100) / 100,
            pivotR1: Math.round(r1 * 100) / 100,
            pivotR2: Math.round(r2 * 100) / 100,
            pivotR3: Math.round(r3 * 100) / 100,
            pivotS1: Math.round(s1 * 100) / 100,
            pivotS2: Math.round(s2 * 100) / 100,
            pivotS3: Math.round(s3 * 100) / 100,
        };
    });
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
