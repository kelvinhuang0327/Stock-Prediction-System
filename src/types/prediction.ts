export interface AnalysisResult {
    sentiment: number;  // -1.0 to 1.0
    explanation: string;
    suggestedAction: 'BUY' | 'SELL' | 'HOLD';
}

export interface BacktestResult {
    stockId: string;
    date: string;
    predictionSignal: string;
    actualNextDayReturn: number;
    success: boolean;
}
