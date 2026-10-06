
"use client";

import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SimplifiedIndicatorCard } from '@/components/stock/SimplifiedIndicatorCard';
import { TrendingUp, Activity, BarChart3, LineChart } from 'lucide-react';

export default function SimplifiedPage() {
    return (
        <div className="container mx-auto py-8 px-4 max-w-6xl">
            <header className="mb-8 space-y-2">
                <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/60">
                    股市極簡極速看板
                </h1>
                <p className="text-muted-foreground">以指標為核心，快速掌握今日最佳標的與個別股票狀態。</p>
            </header>

            <Tabs defaultValue="momentum" className="space-y-6">
                <TabsList className="bg-white/5 border border-white/10 p-1 rounded-xl h-auto flex-wrap gap-1">
                    <TabsTrigger value="trend" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground px-6 py-2.5 rounded-lg flex gap-2">
                        <TrendingUp className="h-4 w-4" /> 趨勢 (Trend)
                    </TabsTrigger>
                    <TabsTrigger value="momentum" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground px-6 py-2.5 rounded-lg flex gap-2">
                        <Activity className="h-4 w-4" /> 動能 (Momentum)
                    </TabsTrigger>
                    <TabsTrigger value="flow" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground px-6 py-2.5 rounded-lg flex gap-2">
                        <BarChart3 className="h-4 w-4" /> 籌碼 (Flow)
                    </TabsTrigger>
                    <TabsTrigger value="growth" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground px-6 py-2.5 rounded-lg flex gap-2">
                        <LineChart className="h-4 w-4" /> 成長 (Growth)
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="trend" className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <SimplifiedIndicatorCard
                        title="MA 多頭排列"
                        metric="technical"
                        description="收盤價高於長期均線，趨勢向上。"
                    />
                    <SimplifiedIndicatorCard
                        title="RS 相對強度"
                        metric="rs"
                        description="股價表現優於大盤的強度指標。"
                    />
                </TabsContent>

                <TabsContent value="momentum" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <SimplifiedIndicatorCard
                        title="RSI 動能"
                        metric="rsi"
                        description="相對強弱指標，判斷噴發力道。"
                    />
                    <SimplifiedIndicatorCard
                        title="KD 隨機指標"
                        metric="technical"
                        description="判斷短期轉折點與超買超賣。"
                    />
                    <SimplifiedIndicatorCard
                        title="MACD 趨勢動能"
                        metric="technical"
                        description="結合趨勢與動能的綜合判斷。"
                    />
                </TabsContent>

                <TabsContent value="flow" className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <SimplifiedIndicatorCard
                        title="法人大戶買超"
                        metric="chip"
                        description="三大法人與 400 張大戶持股集中度。"
                    />
                    <SimplifiedIndicatorCard
                        title="成交量爆發"
                        metric="technical"
                        description="量能異常增加，代表主力介入訊號。"
                    />
                </TabsContent>

                <TabsContent value="growth" className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <SimplifiedIndicatorCard
                        title="營收成長 YoY"
                        metric="revenue"
                        description="單月營收年增率，業績成長動能。"
                    />
                    <SimplifiedIndicatorCard
                        title="盈餘成長 EPS"
                        metric="technical"
                        description="季度每股盈餘與獲利能力趨勢。"
                    />
                </TabsContent>
            </Tabs>

            <footer className="mt-12 p-6 rounded-2xl bg-gradient-to-br from-primary/5 to-transparent border border-primary/10">
                <div className="flex gap-4 items-center">
                    <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center text-primary text-xl">💡</div>
                    <div>
                        <h4 className="font-bold text-primary">使用小技巧</h4>
                        <p className="text-sm text-muted-foreground mt-1">
                            每個指標區域都可獨立搜尋股票。例如在「RSI 動能」搜尋 2330，系統會即時為您計算該股今日的 RSI 狀態。
                        </p>
                    </div>
                </div>
            </footer>
        </div>
    );
}
