"use client";

import React from 'react';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    LineChart,
    Line,
    ComposedChart
} from 'recharts';

const revenueData = [
    { month: '7月', revenue: 150, yoy: 15 },
    { month: '8月', revenue: 160, yoy: 18 },
    { month: '9月', revenue: 155, yoy: 12 },
    { month: '10月', revenue: 170, yoy: 20 },
    { month: '11月', revenue: 180, yoy: 25 },
    { month: '12月', revenue: 175, yoy: 22 },
];

const dividendData = [
    { year: '2019', cash: 10, stock: 0 },
    { year: '2020', cash: 12, stock: 0 },
    { year: '2021', cash: 15, stock: 0 },
    { year: '2022', cash: 18, stock: 0 },
    { year: '2023', cash: 20, stock: 0 },
];

const profitabilityData = [
    { quarter: '22Q4', gross: 52.5, operating: 42.1, net: 38.5 },
    { quarter: '23Q1', gross: 50.1, operating: 40.5, net: 36.2 },
    { quarter: '23Q2', gross: 53.2, operating: 43.8, net: 39.1 },
    { quarter: '23Q3', gross: 54.5, operating: 45.2, net: 40.5 },
    { quarter: '23Q4', gross: 55.1, operating: 46.0, net: 41.2 },
];

const epsData = [
    { quarter: '22Q4', eps: 8.5, yoy: 15.2 },
    { quarter: '23Q1', eps: 7.8, yoy: -5.1 },
    { quarter: '23Q2', eps: 8.2, yoy: 8.5 },
    { quarter: '23Q3', eps: 9.1, yoy: 22.4 },
    { quarter: '23Q4', eps: 9.5, yoy: 25.8 },
];

export function Financials({ symbol }: { symbol: string }) {
    return (
        <div className="space-y-8">
            {/* Profitability Section (Three Rates) */}
            <div className="bg-card rounded-lg border p-6">
                <h3 className="text-lg font-semibold mb-4">獲利能力分析 (三率)</h3>
                <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={profitabilityData}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                            <XAxis dataKey="quarter" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} unit="%" />
                            <Tooltip
                                contentStyle={{ backgroundColor: 'hsl(var(--popover))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                            />
                            <Legend />
                            <Line type="monotone" dataKey="gross" name="毛利率" stroke="#ef4444" strokeWidth={2} dot={{ r: 4 }} />
                            <Line type="monotone" dataKey="operating" name="營益率" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4 }} />
                            <Line type="monotone" dataKey="net" name="淨利率" stroke="#10b981" strokeWidth={2} dot={{ r: 4 }} />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* EPS Section */}
            <div className="bg-card rounded-lg border p-6">
                <h3 className="text-lg font-semibold mb-4">每股盈餘 (EPS) 趨勢</h3>
                <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={epsData}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                            <XAxis dataKey="quarter" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                            <YAxis yAxisId="left" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                            <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} unit="%" />
                            <Tooltip
                                contentStyle={{ backgroundColor: 'hsl(var(--popover))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                            />
                            <Legend />
                            <Bar yAxisId="left" dataKey="eps" name="EPS (元)" fill="#8b5cf6" barSize={40} />
                            <Line yAxisId="right" type="monotone" dataKey="yoy" name="年增率 (%)" stroke="#f59e0b" strokeWidth={2} />
                        </ComposedChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Revenue Section */}
            <div className="bg-card rounded-lg border p-6">
                <h3 className="text-lg font-semibold mb-4">月營收趨勢 (億元)</h3>
                <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={revenueData}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                            <XAxis dataKey="month" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                            <YAxis yAxisId="left" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                            <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} unit="%" />
                            <Tooltip
                                contentStyle={{ backgroundColor: 'hsl(var(--popover))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                            />
                            <Legend />
                            <Bar yAxisId="left" dataKey="revenue" name="營收" fill="#3b82f6" barSize={40} />
                            <Line yAxisId="right" type="monotone" dataKey="yoy" name="年增率" stroke="#f59e0b" strokeWidth={2} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Dividend Section */}
            <div className="bg-card rounded-lg border p-6">
                <h3 className="text-lg font-semibold mb-4">歷年股利政策 (元)</h3>
                <div className="h-[300px] mb-6">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={dividendData}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                            <XAxis dataKey="year" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                            <Tooltip
                                contentStyle={{ backgroundColor: 'hsl(var(--popover))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                            />
                            <Legend />
                            <Bar dataKey="cash" name="現金股利" stackId="a" fill="#10b981" barSize={40} />
                            <Bar dataKey="stock" name="股票股利" stackId="a" fill="#6366f1" barSize={40} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-muted/30">
                            <tr>
                                <th className="p-3 text-left">年度</th>
                                <th className="p-3 text-right">現金股利</th>
                                <th className="p-3 text-right">股票股利</th>
                                <th className="p-3 text-right">合計</th>
                                <th className="p-3 text-right">除息日</th>
                                <th className="p-3 text-right">填息天數</th>
                                <th className="p-3 text-right">殖利率</th>
                            </tr>
                        </thead>
                        <tbody>
                            {dividendData.slice().reverse().map((item) => (
                                <tr key={item.year} className="border-b last:border-0 hover:bg-muted/10">
                                    <td className="p-3 font-medium">{item.year}</td>
                                    <td className="p-3 text-right font-mono">{item.cash.toFixed(2)}</td>
                                    <td className="p-3 text-right font-mono">{item.stock.toFixed(2)}</td>
                                    <td className="p-3 text-right font-mono font-bold">{(item.cash + item.stock).toFixed(2)}</td>
                                    <td className="p-3 text-right text-muted-foreground">06/15</td>
                                    <td className="p-3 text-right font-mono">
                                        {item.year === '2023' ? <span className="text-red-600 font-bold">12天</span> :
                                            item.year === '2022' ? <span className="text-red-600 font-bold">8天</span> : '25天'}
                                    </td>
                                    <td className="p-3 text-right font-mono text-red-600">
                                        {((item.cash / (item.year === '2023' ? 580 : 450)) * 100).toFixed(2)}%
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
