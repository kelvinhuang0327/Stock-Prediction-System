import React from 'react';
import { ArrowUp, ArrowDown, TrendingUp, TrendingDown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

type Stock = {
    symbol: string;
    name: string;
    price: number;
    change: number;
    changePercent: number;
    volume: number; // 張
};

export function HotStocksList() {
    // Mock data
    const gainers: Stock[] = [
        { symbol: '2330', name: '台積電', price: 580, change: 12, changePercent: 2.1, volume: 45000 },
        { symbol: '2454', name: '聯發科', price: 950, change: 25, changePercent: 2.7, volume: 8500 },
        { symbol: '2317', name: '鴻海', price: 105, change: 1.5, changePercent: 1.45, volume: 62000 },
        { symbol: '3008', name: '大立光', price: 2350, change: 45, changePercent: 1.95, volume: 450 },
        { symbol: '2303', name: '聯電', price: 48.5, change: 0.8, changePercent: 1.68, volume: 125000 },
    ];

    const losers: Stock[] = [
        { symbol: '2603', name: '長榮', price: 150, change: -3, changePercent: -1.9, volume: 25000 },
        { symbol: '2609', name: '陽明', price: 45, change: -1.5, changePercent: -3.2, volume: 32000 },
        { symbol: '2615', name: '萬海', price: 52, change: -1.2, changePercent: -2.25, volume: 18000 },
        { symbol: '2308', name: '台達電', price: 320, change: -5, changePercent: -1.54, volume: 5600 },
        { symbol: '1301', name: '台塑', price: 78, change: -0.5, changePercent: -0.64, volume: 12000 },
    ];

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <StockTable title="強勢股排行" stocks={gainers} type="gainer" icon={<TrendingUp className="w-5 h-5 text-red-500" />} />
            <StockTable title="弱勢股排行" stocks={losers} type="loser" icon={<TrendingDown className="w-5 h-5 text-green-500" />} />
        </div>
    );
}

function StockTable({ title, stocks, type, icon }: { title: string; stocks: Stock[]; type: 'gainer' | 'loser'; icon: React.ReactNode }) {
    return (
        <div className="bg-card rounded-xl shadow-sm border overflow-hidden">
            <div className="p-4 border-b bg-muted/30 flex items-center gap-2">
                {icon}
                <h3 className="font-bold text-lg">{title}</h3>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b bg-muted/10">
                            <th className="text-left p-3 font-medium text-muted-foreground">股名/代號</th>
                            <th className="text-right p-3 font-medium text-muted-foreground">成交價</th>
                            <th className="text-right p-3 font-medium text-muted-foreground">漲跌</th>
                            <th className="text-right p-3 font-medium text-muted-foreground">漲跌幅</th>
                            <th className="text-right p-3 font-medium text-muted-foreground">成交量</th>
                        </tr>
                    </thead>
                    <tbody>
                        {stocks.map((stock) => {
                            const isPositive = stock.change >= 0;
                            const colorClass = isPositive ? 'text-red-600' : 'text-green-600';

                            return (
                                <tr key={stock.symbol} className="border-b last:border-0 hover:bg-muted/50 transition-colors">
                                    <td className="p-3">
                                        <div className="font-bold">{stock.name}</div>
                                        <div className="text-xs text-muted-foreground font-mono">{stock.symbol}</div>
                                    </td>
                                    <td className={`p-3 text-right font-bold font-mono ${colorClass}`}>
                                        {stock.price}
                                    </td>
                                    <td className={`p-3 text-right font-medium ${colorClass}`}>
                                        <div className="flex items-center justify-end gap-1">
                                            {isPositive ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
                                            {Math.abs(stock.change)}
                                        </div>
                                    </td>
                                    <td className={`p-3 text-right font-medium ${colorClass}`}>
                                        <Badge variant={isPositive ? "destructive" : "secondary"} className={`bg-opacity-10 hover:bg-opacity-20 text-xs ${isPositive ? 'bg-red-500 text-red-600' : 'bg-green-500 text-green-600'}`}>
                                            {Math.abs(stock.changePercent)}%
                                        </Badge>
                                    </td>
                                    <td className="p-3 text-right font-mono text-muted-foreground">
                                        {stock.volume.toLocaleString()}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
