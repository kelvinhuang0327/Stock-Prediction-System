"use client";

import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useApiData } from '@/hooks/useApiData';
import { DataTable, ColumnDef } from '@/components/ui/data-table';
import { Disclaimer } from '@/components/ui/disclaimer';
import { DataStatusBar, DataAvailabilityGuard } from '@/components/ui/data-availability-guard';
import { GlassCard } from '@/components/ui/glass-card';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/ui/loading';
import {
    TrendingUp, TrendingDown, BarChart3, Building2, Users,
    Briefcase, DollarSign, ArrowUpDown
} from 'lucide-react';

type RankingType = 'volume' | 'gainers' | 'losers' | 'foreign' | 'trust' | 'dealer' | 'sector';

interface RankingItem {
    symbol: string;
    name: string;
    industry: string;
    price: number | null;
    change: number | null;
    changePercent?: number | null;
    volume: number | null;
    foreignBuy: number | null;
    trustBuy: number | null;
    dealerBuy: number | null;
    totalBuy: number | null;
    stockCount?: number;
}

interface RankingResponse {
    data: RankingItem[];
    source: string;
    type: string;
    coverage: { stocks: number; total: number; dates?: number; limitations: string[] };
    sample_size: number;
    last_updated: string | null;
    updatedAt: string;
}

const RANKING_TABS: { key: RankingType; label: string; icon: React.ReactNode }[] = [
    { key: 'volume', label: '成交量排行', icon: <BarChart3 className="w-4 h-4" /> },
    { key: 'gainers', label: '漲幅排行', icon: <TrendingUp className="w-4 h-4" /> },
    { key: 'losers', label: '跌幅排行', icon: <TrendingDown className="w-4 h-4" /> },
    { key: 'foreign', label: '外資買超', icon: <DollarSign className="w-4 h-4" /> },
    { key: 'trust', label: '投信買超', icon: <Briefcase className="w-4 h-4" /> },
    { key: 'dealer', label: '自營商買超', icon: <Building2 className="w-4 h-4" /> },
    { key: 'sector', label: '類股指數', icon: <Users className="w-4 h-4" /> },
];

export default function RankingsPage() {
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<RankingType>('volume');
    const [sectorFilter, setSectorFilter] = useState('');

    const url = useMemo(() => {
        const params = new URLSearchParams({ type: activeTab, limit: '100' });
        if (sectorFilter) params.set('sector', sectorFilter);
        return `/api/rankings?${params}`;
    }, [activeTab, sectorFilter]);

    const { data: response, loading, error } = useApiData<RankingResponse>(url);

    const columns = useMemo((): ColumnDef<RankingItem>[] => {
        const base: ColumnDef<RankingItem>[] = [
            {
                key: 'symbol', header: '代號', sortable: true,
                render: (item) => (
                    <span className="font-mono font-medium text-primary">{item.symbol}</span>
                ),
            },
            {
                key: 'name', header: '名稱', sortable: true,
                render: (item) => <span className="font-medium">{item.name}</span>,
            },
            {
                key: 'industry', header: '產業', sortable: true, hideOnMobile: true,
                render: (item) => (
                    <span className="text-muted-foreground text-xs">{item.industry || '-'}</span>
                ),
            },
        ];

        if (activeTab !== 'sector') {
            base.push(
                {
                    key: 'price', header: '股價', sortable: true, align: 'right',
                    accessor: (item) => item.price,
                    render: (item) => item.price != null ? `$${item.price.toLocaleString()}` : '-',
                },
                {
                    key: 'change', header: '漲跌', sortable: true, align: 'right',
                    accessor: (item) => item.change,
                    render: (item) => {
                        if (item.change == null) return '-';
                        const isUp = item.change > 0;
                        return (
                            <span className={isUp ? 'text-red-500' : item.change < 0 ? 'text-green-500' : ''}>
                                {isUp ? '+' : ''}{item.change.toFixed(2)}
                            </span>
                        );
                    },
                },
                {
                    key: 'volume', header: '成交量', sortable: true, align: 'right', hideOnMobile: true,
                    accessor: (item) => item.volume,
                    render: (item) => item.volume != null ? item.volume.toLocaleString() : '-',
                }
            );
        }

        // Type-specific columns
        if (['foreign', 'trust', 'dealer'].includes(activeTab)) {
            base.push(
                {
                    key: 'foreignBuy', header: '外資', sortable: true, align: 'right',
                    accessor: (item) => item.foreignBuy,
                    render: (item) => renderChipValue(item.foreignBuy),
                    hideOnMobile: activeTab !== 'foreign',
                },
                {
                    key: 'trustBuy', header: '投信', sortable: true, align: 'right',
                    accessor: (item) => item.trustBuy,
                    render: (item) => renderChipValue(item.trustBuy),
                    hideOnMobile: activeTab !== 'trust',
                },
                {
                    key: 'dealerBuy', header: '自營商', sortable: true, align: 'right',
                    accessor: (item) => item.dealerBuy,
                    render: (item) => renderChipValue(item.dealerBuy),
                    hideOnMobile: activeTab !== 'dealer',
                },
                {
                    key: 'totalBuy', header: '合計', sortable: true, align: 'right',
                    accessor: (item) => item.totalBuy,
                    render: (item) => renderChipValue(item.totalBuy),
                }
            );
        }

        if (activeTab === 'sector') {
            base.push(
                {
                    key: 'change', header: '漲跌點', sortable: true, align: 'right',
                    accessor: (item) => item.change,
                    render: (item) => {
                        if (item.change == null) return '-';
                        const isUp = item.change > 0;
                        return <span className={isUp ? 'text-red-500' : 'text-green-500'}>{isUp ? '+' : ''}{item.change}</span>;
                    },
                },
                {
                    key: 'changePercent', header: '漲跌幅', sortable: true, align: 'right',
                    accessor: (item) => item.changePercent,
                    render: (item) => {
                        if (item.changePercent == null) return '-';
                        const isUp = item.changePercent > 0;
                        return <span className={isUp ? 'text-red-500' : 'text-green-500'}>{isUp ? '+' : ''}{item.changePercent}%</span>;
                    },
                },
                {
                    key: 'volume', header: '成交量', sortable: true, align: 'right',
                    accessor: (item) => item.volume,
                    render: (item) => item.volume != null ? item.volume.toLocaleString() : '-',
                },
                {
                    key: 'stockCount', header: '成分股數', sortable: true, align: 'right',
                    accessor: (item) => item.stockCount,
                },
            );
        }

        return base;
    }, [activeTab]);

    return (
        <div className="container mx-auto px-4 py-6 space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <ArrowUpDown className="w-6 h-6 text-primary" />
                        排行分析
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        多維度股票排行，整合法人籌碼與技術面資料
                    </p>
                </div>
                {/* Sector filter - only for non-sector tabs */}
                {activeTab !== 'sector' && (
                    <select
                        value={sectorFilter}
                        onChange={(e) => setSectorFilter(e.target.value)}
                        className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
                    >
                        <option value="">全部產業</option>
                    </select>
                )}
            </div>

            {/* Tabs */}
            <div className="flex flex-wrap gap-2">
                {RANKING_TABS.map(tab => (
                    <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                            activeTab === tab.key
                                ? 'bg-primary text-primary-foreground shadow-md'
                                : 'bg-muted/20 text-muted-foreground hover:bg-muted/40'
                        }`}
                    >
                        {tab.icon}
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Data Status */}
            {response && (
                <DataStatusBar
                    mode={response.source === 'empty' || response.source === 'error' ? 'unavailable' : response.coverage?.limitations?.length > 0 ? 'limited' : 'full'}
                    coverage={response.coverage ? { stocks: response.coverage.stocks, total: response.coverage.total } : undefined}
                    lastUpdated={response.last_updated || new Date(response.updatedAt).toLocaleString('zh-TW')}
                    limitations={response.coverage?.limitations}
                />
            )}
            {response && (
                <div className="flex items-center gap-3 text-xs text-muted-foreground px-4">
                    <span>樣本數：{response.sample_size} 檔</span>
                    {response.last_updated && <span>最新資料日期：{response.last_updated}</span>}
                </div>
            )}

            {/* Error */}
            {error && (
                <GlassCard className="p-4 text-destructive text-sm">
                    資料載入失敗：{error}
                </GlassCard>
            )}

            {/* Loading */}
            {loading && (
                <div className="flex items-center justify-center py-20">
                    <LoadingSpinner size="lg" />
                </div>
            )}

            {/* Table */}
            {!loading && response && (
                <DataTable
                    data={response.data}
                    columns={columns}
                    searchable
                    searchPlaceholder="搜尋股票代號或名稱..."
                    searchKeys={['symbol', 'name', 'industry']}
                    defaultSort={{ key: getSortKey(activeTab), direction: 'desc' }}
                    pageSize={20}
                    onRowClick={(item) => {
                        if (activeTab === 'sector') {
                            router.push(`/sectors/${item.symbol}`);
                        } else {
                            router.push(`/stock/${item.symbol}`);
                        }
                    }}
                    getRowKey={(item) => item.symbol}
                    emptyMessage="無排行資料"
                    emptyDescription="目前無符合條件的排行資料"
                />
            )}

            {/* Disclaimer */}
            <Disclaimer
                source={response?.source || 'TWSE 公開資訊'}
                methodology="排行依據 TWSE 公開法人買賣超與行情資料排序"
                warning="法人買賣超資料為公開資訊統計，不代表特定主力行為。"
            />
        </div>
    );
}

function renderChipValue(val: number | null) {
    if (val == null) return '-';
    const isPositive = val > 0;
    return (
        <span className={isPositive ? 'text-red-500 font-medium' : val < 0 ? 'text-green-500' : 'text-muted-foreground'}>
            {isPositive ? '+' : ''}{val.toLocaleString()}
        </span>
    );
}

function getSortKey(tab: RankingType): string {
    switch (tab) {
        case 'foreign': return 'foreignBuy';
        case 'trust': return 'trustBuy';
        case 'dealer': return 'dealerBuy';
        case 'volume': return 'volume';
        case 'gainers': return 'change';
        case 'losers': return 'change';
        case 'sector': return 'changePercent';
        default: return 'volume';
    }
}
