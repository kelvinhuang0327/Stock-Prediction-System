import React from 'react';
import { StockInfo } from '@/components/stock/StockInfo';
import { StockTabs } from '@/components/stock/StockTabs';
import { twseApi } from '@/lib/api/twseApi';
import { HybridPrediction } from '@/components/analysis/HybridPrediction';

export default async function StockPage({ params }: { params: Promise<{ symbol: string }> }) {
    const { symbol } = await params;

    // Fetch real data
    const [rawData, historicalData] = await Promise.all([
        twseApi.getFullStockData(symbol),
        twseApi.getHistorySeries(symbol, 4) // Fetch 4 months for MA60
    ]);

    const stockData = rawData ? {
        name: rawData.name,
        price: rawData.close,
        change: rawData.change,
        changePercent: rawData.close > 0 ? (rawData.change / (rawData.close - rawData.change)) * 100 : 0,
        volume: Math.round(rawData.volume / 1000), // Convert shares to lots (Zhang)
        amount: parseFloat((rawData.tradeValue / 100000000).toFixed(2)), // Convert to Billion
        open: rawData.open,
        high: rawData.high,
        low: rawData.low,
        prevClose: rawData.close - rawData.change,
        pe: rawData.pe || undefined,
        pb: rawData.pb || undefined,
        dividendYield: rawData.dividendYield || undefined,
    } : null;

    return (
        <div className="space-y-6">
            <HybridPrediction symbol={symbol} />
            <StockInfo symbol={symbol} data={stockData} />
            <StockTabs symbol={symbol} historicalData={historicalData} />
        </div>
    );
}
