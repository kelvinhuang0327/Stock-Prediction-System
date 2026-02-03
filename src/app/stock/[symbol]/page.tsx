import React from 'react';
import { StockInfo } from '@/components/stock/StockInfo';
import { StockTabs } from '@/components/stock/StockTabs';

export default async function StockPage({ params }: { params: Promise<{ symbol: string }> }) {
    const { symbol } = await params;

    return (
        <div className="space-y-6">
            <StockInfo symbol={symbol} />
            <StockTabs symbol={symbol} />
        </div>
    );
}
