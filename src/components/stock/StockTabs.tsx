import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { StockChart } from '@/components/stock/StockChart';
import { TechnicalIndicators } from '@/components/stock/TechnicalIndicators';
import { InstitutionalChips } from '@/components/stock/InstitutionalChips';
import { Financials } from '@/components/stock/Financials';
import { TechnicalAnalysis } from '@/components/stock/TechnicalAnalysis';
import { StockComparison } from '@/components/stock/StockComparison';
import { EventsCalendar } from '@/components/stock/EventsCalendar';
import { BacktestPanel } from '@/components/stock/BacktestPanel';
import { BarChart3, LineChart, PieChart, FileText, Scale, FlaskConical } from 'lucide-react';

import { StockDataPoint } from '@/types/stock';

export function StockTabs({ symbol, historicalData }: { symbol: string, historicalData?: StockDataPoint[] }) {
    return (
        <Tabs defaultValue="overview" className="w-full">
            <div className="overflow-x-auto pb-2">
                <TabsList className="grid w-full min-w-[600px] grid-cols-6 lg:w-[900px]">
                    <TabsTrigger value="overview" className="gap-2">
                        <BarChart3 className="w-4 h-4" /> 總覽
                    </TabsTrigger>
                    <TabsTrigger value="technical" className="gap-2">
                        <LineChart className="w-4 h-4" /> 技術分析
                    </TabsTrigger>
                    <TabsTrigger value="chips" className="gap-2">
                        <PieChart className="w-4 h-4" /> 法人資券
                    </TabsTrigger>
                    <TabsTrigger value="financials" className="gap-2">
                        <FileText className="w-4 h-4" /> 基本面
                    </TabsTrigger>
                    <TabsTrigger value="comparison" className="gap-2">
                        <Scale className="w-4 h-4" /> 同業比較
                    </TabsTrigger>
                    <TabsTrigger value="backtest" className="gap-2">
                        <FlaskConical className="w-4 h-4" /> 回測分析
                    </TabsTrigger>
                </TabsList>
            </div>

            <TabsContent value="overview" className="space-y-6 mt-6">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2">
                        <StockChart symbol={symbol} />
                    </div>
                    <div className="space-y-6">
                        {/* Quick Technical Summary */}
                        <div className="bg-card p-4 rounded-lg border">
                            <h3 className="font-semibold mb-4">技術指標概況</h3>
                            <TechnicalIndicators symbol={symbol} data={historicalData} />
                        </div>

                        {/* Events Calendar (New Feature) */}
                        <EventsCalendar />
                    </div>
                </div>
            </TabsContent>

            <TabsContent value="technical" className="mt-6">
                <TechnicalAnalysis symbol={symbol} />
            </TabsContent>

            <TabsContent value="chips" className="mt-6">
                <InstitutionalChips symbol={symbol} />
            </TabsContent>

            <TabsContent value="financials" className="mt-6">
                <Financials symbol={symbol} />
            </TabsContent>

            <TabsContent value="comparison" className="mt-6">
                <div className="bg-card rounded-lg border p-6">
                    <StockComparison baseSymbol={symbol} />
                </div>
            </TabsContent>

            <TabsContent value="backtest" className="mt-6">
                <BacktestPanel symbol={symbol} />
            </TabsContent>
        </Tabs >
    );
}
