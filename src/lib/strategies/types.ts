

export interface ScreeningResult {
    stockId: string;
    name: string;
    revenueYoY: number;
    eps: number;
    chipStrength: number;
    technicalScore: number;
    reason: string;
    closePrice?: number;
    priceChangePercent?: number;
    isETF?: boolean;
    riskScore?: number;
    riskLevel?: 'Low' | 'Medium' | 'High';
    potentialLabel?: string;
    climbPercent?: number;
    backtestEvidence?: {
        date: string;
        maxGain: number;
        duration: number;
    };
    rsScore?: number; // Relative Strength (0-100)
    suggestedStopLoss?: number;
    stopLossReason?: string;

    // Phase 18: Money Management
    suggestedPositionSize?: number; // Recommended shares/lots
    riskPerShare?: number;          // Risk amount per share (Entry - Stop)

    // Kelly Criterion Position Sizing
    kellyPositionPct?: number;      // Kelly-recommended position % (0-100)
    kellyReasoning?: string;        // Explanation of Kelly calculation
    kellyRisk?: 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME';
    marketRegime?: 'BULL' | 'NEUTRAL' | 'CORRECTION' | 'BEAR';
    marketScalingFactor?: number;   // Position size multiplier based on market

    anomaly?: {
        type: string;        // e.g. 'CONCENTRATION_SURGE', 'TRUST_ACCUMULATION'
        severity: 'LOW' | 'MEDIUM' | 'HIGH';
        score: number;       // 0-100
        description: string; // Human readable reason
    };
    concentrationHistory?: number[]; // Phase 22: Recent N days concentration (HHI or TopN)
}


export interface StockQuote {
    date: string;
    close: number;
    high: number;
    low: number;
    open: number;
    volume: number;
}

export interface StockData {
    stockId: string;
    name: string;
    quotes: any[]; // Ideally defined as Quote[]
    monthlyRevenues: any[]; // Ideally defined as Revenue[]
    financialReports: any[]; // Ideally defined as FinancialReport[]
    institutionalChips: any[]; // Ideally defined as Chip[]
    capital?: number;
}

export interface StrategyResult extends ScreeningResult {
    // Additional strategy-specific metrics can go here
}

export interface Strategy {
    name: string;
    description: string;

    /**
     * Rapidly screen a list of stocks to find potential candidates.
     * Should hold minimal state.
     */
    screen(data: StockData[], marketData?: any[], options?: {
        scalingFactor?: number;
        regime?: 'BULL' | 'NEUTRAL' | 'CORRECTION' | 'BEAR';
        skipFilters?: boolean;
    }): Promise<StrategyResult[]>;

    /**
     * Detailed analysis of a single stock.
     */
    analyze?(stock: StockData): Promise<StrategyResult | null>;
    getOnGoingStopLoss?(quote: StockQuote, history: StockQuote[]): number | undefined;
}
