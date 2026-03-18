"use client";

import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useApiData } from '@/hooks/useApiData';
import { DataTable, ColumnDef } from '@/components/ui/data-table';
import { Disclaimer } from '@/components/ui/disclaimer';
import { DataStatusBar, DataAvailabilityGuard } from '@/components/ui/data-availability-guard';
import { GlassCard } from '@/components/ui/glass-card';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/ui/loading';
import { BucketBadge } from '@/components/ui/badges';
import {
    TrendingUp, TrendingDown, BarChart3, Building2, Users,
    Briefcase, DollarSign, ArrowUpDown, Sparkles
} from 'lucide-react';

type RankingType = 'volume' | 'gainers' | 'losers' | 'foreign' | 'trust' | 'dealer' | 'sector' | 'alpha';

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

interface AlphaItem {
    symbol: string;
    name: string;
    alphaScore: number;
    recommendationBucket: string;
    screenBucket: string;
    confidence: number;
    technicalScore: number;
    chipScore: number;
    fundamentalScore: number;
    riskLevel: string;
    topFactors: string[];
    keyRisks: string[];
    whyIncluded: string;
    summary: string;
    usedSources: string[];
    missingSources: string[];
    limitations: string[];
}

const RANKING_TABS: { key: RankingType; label: string; icon: React.ReactNode }[] = [
    { key: 'volume', label: '成交量排行', icon: <BarChart3 className="w-4 h-4" /> },
    { key: 'gainers', label: '漲幅排行', icon: <TrendingUp className="w-4 h-4" /> },
    { key: 'losers', label: '跌幅排行', icon: <TrendingDown className="w-4 h-4" /> },
    { key: 'foreign', label: '外資買超', icon: <DollarSign className="w-4 h-4" /> },
    { key: 'trust', label: '投信買超', icon: <Briefcase className="w-4 h-4" /> },
    { key: 'dealer', label: '自營商買超', icon: <Building2 className="w-4 h-4" /> },
    { key: 'sector', label: '類股指數', icon: <Users className="w-4 h-4" /> },
    { key: 'alpha', label: 'Alpha 候選', icon: <Sparkles className="w-4 h-4" /> },
];

export default function RankingsPage() {
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<RankingType>('volume');
    const [sectorFilter, setSectorFilter] = useState('');

    // Standard rankings API
    const url = useMemo(() => {
        if (activeTab === 'alpha') return null; // alpha uses different API
        const params = new URLSearchParams({ type: activeTab, limit: '100' });
        if (sectorFilter) params.set('sector', sectorFilter);
        return `/api/rankings?${params}`;
    }, [activeTab, sectorFilter]);

    const { data: response, loading, error } = useApiData<RankingResponse>(url);

    // Alpha candidates state
    const [alphaData, setAlphaData] = useState<AlphaItem[]>([]);
    const [alphaLoading, setAlphaLoading] = useState(false);
    const [alphaError, setAlphaError] = useState<string | null>(null);
    const [screenMeta, setScreenMeta] = useState<{
        regime: string; regimeConfidence: number; totalScanned: number; excludedCount: number;
        appliedRegimeAdjustment: string; limitations: string[];
    } | null>(null);

    // Fetch alpha data from screen API when tab selected
    React.useEffect(() => {
        if (activeTab !== 'alpha') return;
        let cancelled = false;
        async function fetchAlpha() {
            setAlphaLoading(true);
            setAlphaError(null);
            try {
                const res = await fetch('/api/strategy/screen?maxResults=50');
                if (!res.ok) throw new Error('候選股篩選失敗');
                const data = await res.json();
                if (!cancelled) {
                    setAlphaData(data.candidates || []);
                    setScreenMeta({
                        regime: data.regime,
                        regimeConfidence: data.regimeConfidence,
                        totalScanned: data.totalScanned,
                        excludedCount: data.excludedCount,
                        appliedRegimeAdjustment: data.screenParams?.appliedRegimeAdjustment || '無',
                        limitations: data.limitations || [],
                    });
                }
            } catch (e: unknown) {
                if (!cancelled) setAlphaError(e instanceof Error ? e.message : '載入失敗');
            } finally {
                if (!cancelled) setAlphaLoading(false);
            }
        }
        fetchAlpha();
        return () => { cancelled = true; };
    }, [activeTab]);

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
            {error && activeTab !== 'alpha' && (
                <GlassCard className="p-4 text-destructive text-sm">
                    資料載入失敗：{error}
                </GlassCard>
            )}
            {alphaError && activeTab === 'alpha' && (
                <GlassCard className="p-4 text-destructive text-sm">
                    Alpha 分析失敗：{alphaError}
                </GlassCard>
            )}

            {/* Loading */}
            {((loading && activeTab !== 'alpha') || (alphaLoading && activeTab === 'alpha')) && (
                <div className="flex items-center justify-center py-20">
                    <LoadingSpinner size="lg" />
                </div>
            )}

            {/* Standard Rankings Table */}
            {!loading && response && activeTab !== 'alpha' && (
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
                            router.push(`/stocks/${item.symbol}`);
                        }
                    }}
                    getRowKey={(item) => item.symbol}
                    emptyMessage="無排行資料"
                    emptyDescription="目前無符合條件的排行資料"
                />
            )}

            {/* Alpha Candidates */}
            {!alphaLoading && activeTab === 'alpha' && (
                <AlphaCandidatesPanel data={alphaData} meta={screenMeta} onRowClick={(s) => router.push(`/stocks/${s}`)} />
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
        case 'alpha': return 'alphaScore';
        default: return 'volume';
    }
}

// ─── Alpha Candidates Panel ─────────────────────────────────────

function AlphaCandidatesPanel({ data, meta, onRowClick }: {
    data: AlphaItem[];
    meta: { regime: string; regimeConfidence: number; totalScanned: number; excludedCount: number; appliedRegimeAdjustment: string; limitations: string[] } | null;
    onRowClick: (symbol: string) => void;
}) {
    if (data.length === 0) {
        return (
            <GlassCard className="p-8 text-center text-muted-foreground">
                <Sparkles className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p className="font-medium">無 Alpha 候選資料</p>
                <p className="text-sm mt-1">系統需要足夠的歷史與籌碼資料才能進行融合評分</p>
            </GlassCard>
        );
    }

    const REGIME_EMOJI: Record<string, string> = { Bull: '🐂', Bear: '🐻', Sideways: '↔', Unknown: '❓' };

    return (
        <div className="space-y-3">
            {/* Screen summary bar */}
            {meta && (
                <div className="flex flex-wrap items-center gap-3 px-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                        <Sparkles className="w-3.5 h-3.5" />
                        掃描 {meta.totalScanned} 檔
                    </span>
                    <span>候選 {data.length} 檔</span>
                    <span>排除 {meta.excludedCount} 檔</span>
                    <span className="flex items-center gap-1">
                        {REGIME_EMOJI[meta.regime] || '❓'} 市場：{meta.regime}（{meta.regimeConfidence}%）
                    </span>
                    <span>{meta.appliedRegimeAdjustment}</span>
                    <Link href="/candidates" className="ml-auto text-primary hover:underline flex items-center gap-1">
                        完整研究頁 →
                    </Link>
                </div>
            )}

            <GlassCard className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-border">
                            <th className="p-3 text-left font-medium text-muted-foreground w-10">#</th>
                            <th className="p-3 text-left font-medium text-muted-foreground">代號</th>
                            <th className="p-3 text-left font-medium text-muted-foreground hidden sm:table-cell">名稱</th>
                            <th className="p-3 text-center font-medium text-muted-foreground">Alpha</th>
                            <th className="p-3 text-center font-medium text-muted-foreground">類別</th>
                            <th className="p-3 text-center font-medium text-muted-foreground">信心</th>
                            <th className="p-3 text-center font-medium text-muted-foreground hidden md:table-cell">風險</th>
                            <th className="p-3 text-left font-medium text-muted-foreground hidden lg:table-cell">原因</th>
                            <th className="p-3 text-left font-medium text-muted-foreground hidden xl:table-cell">來源</th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.map((item, idx) => (
                            <tr
                                key={item.symbol}
                                className="border-b border-border last:border-0 hover:bg-muted/20 cursor-pointer transition-colors"
                                onClick={() => onRowClick(item.symbol)}
                            >
                                <td className="p-3 font-mono text-muted-foreground text-xs">{idx + 1}</td>
                                <td className="p-3 font-mono font-medium text-primary">{item.symbol}</td>
                                <td className="p-3 hidden sm:table-cell text-sm">{item.name}</td>
                                <td className="p-3 text-center">
                                    <span className={`text-lg font-bold ${
                                        item.alphaScore >= 75 ? 'text-red-600' :
                                        item.alphaScore >= 55 ? 'text-amber-600' :
                                        'text-muted-foreground'
                                    }`}>
                                        {item.alphaScore}
                                    </span>
                                </td>
                                <td className="p-3 text-center">
                                    <BucketBadge bucket={item.screenBucket} labelMode="chinese" size="md" />
                                </td>
                                <td className="p-3 text-center">
                                    <div className="flex items-center justify-center gap-1">
                                        <div className="w-10 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                            <div
                                                className={`h-full rounded-full ${item.confidence >= 60 ? 'bg-green-500' : item.confidence >= 30 ? 'bg-amber-500' : 'bg-gray-400'}`}
                                                style={{ width: `${item.confidence}%` }}
                                            />
                                        </div>
                                        <span className="text-[10px] text-muted-foreground">{item.confidence}%</span>
                                    </div>
                                </td>
                                <td className="p-3 text-center hidden md:table-cell">
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                                        item.riskLevel === 'Low' ? 'bg-green-50 text-green-600 dark:bg-green-950/30' :
                                        item.riskLevel === 'Medium' ? 'bg-amber-50 text-amber-600 dark:bg-amber-950/30' :
                                        'bg-red-50 text-red-600 dark:bg-red-950/30'
                                    }`}>
                                        {item.riskLevel === 'Low' ? '低' : item.riskLevel === 'Medium' ? '中' : '高'}
                                    </span>
                                </td>
                                <td className="p-3 hidden lg:table-cell">
                                    <div className="text-[10px] text-muted-foreground max-w-[220px] truncate" title={item.whyIncluded}>
                                        {item.whyIncluded}
                                    </div>
                                </td>
                                <td className="p-3 hidden xl:table-cell">
                                    <div className="flex gap-1 flex-wrap">
                                        {item.usedSources.map((s, i) => (
                                            <span key={i} className="text-[9px] px-1 py-0.5 bg-green-50 text-green-600 rounded dark:bg-green-950/30">
                                                {s}
                                            </span>
                                        ))}
                                        {item.missingSources.map((s, i) => (
                                            <span key={i} className="text-[9px] px-1 py-0.5 bg-gray-50 text-gray-400 rounded line-through dark:bg-gray-900">
                                                {s}
                                            </span>
                                        ))}
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </GlassCard>

            {/* Limitations */}
            {meta && meta.limitations.length > 0 && (
                <div className="px-2 text-[10px] text-muted-foreground space-y-0.5">
                    {meta.limitations.map((l, i) => <div key={i}>⚠ {l}</div>)}
                </div>
            )}

            <Disclaimer
                source="StrategyScreenEngine — 技術面 + 籌碼面 + 基本面 + 市場環境"
                methodology="候選池篩選：SignalFusionEngine 融合評分 → 門檻過濾 → 市場環境調整 → 分類。權重依資料可用性自動正規化。"
                warning="候選股篩選結果為研究參考，不構成投資建議。評分基於規則計算與公開資料，不保證未來績效。"
            />
        </div>
    );
}
