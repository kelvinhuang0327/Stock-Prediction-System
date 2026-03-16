"use client";

import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useApiData } from '@/hooks/useApiData';
import { DataTable, ColumnDef } from '@/components/ui/data-table';
import { Disclaimer } from '@/components/ui/disclaimer';
import { DataStatusBar } from '@/components/ui/data-availability-guard';
import { GlassCard } from '@/components/ui/glass-card';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/ui/loading';
import {
    Shield, AlertTriangle, Eye, ChevronDown, ChevronUp,
    Activity, TrendingUp, Info
} from 'lucide-react';

interface SignalDetail {
    type: string;
    severity: string;
    score: number;
    reasoning: string;
}

interface InstitutionalItem {
    symbol: string;
    name: string;
    industry: string;
    price: number | null;
    change: number | null;
    volume: number | null;
    anomalyScore: number;
    phase: string;
    phaseDescription: string;
    signals: SignalDetail[];
}

interface InstitutionalResponse {
    data: InstitutionalItem[];
    source: string;
    methodology: string;
    disclaimer: string;
    coverage?: { stocksWithChipData: number; totalChipRows: number; minRequired: number; limitations: string[] };
    updatedAt: string;
}

const SEVERITY_OPTIONS = [
    { key: '', label: '全部強度' },
    { key: 'HIGH', label: '🔴 高度異常' },
    { key: 'MEDIUM', label: '🟡 中度異常' },
    { key: 'LOW', label: '🟢 低度異常' },
];

export default function InstitutionalPage() {
    const router = useRouter();
    const [severityFilter, setSeverityFilter] = useState('');
    const [expandedRow, setExpandedRow] = useState<string | null>(null);

    const url = useMemo(() => {
        const params = new URLSearchParams({ limit: '100' });
        if (severityFilter) params.set('severity', severityFilter);
        return `/api/institutional?${params}`;
    }, [severityFilter]);

    const { data: response, loading, error, refetch } = useApiData<InstitutionalResponse>(url);

    const columns: ColumnDef<InstitutionalItem>[] = useMemo(() => [
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
            key: 'price', header: '股價', sortable: true, align: 'right', hideOnMobile: true,
            accessor: (item) => item.price,
            render: (item) => item.price != null ? `$${item.price.toLocaleString()}` : '-',
        },
        {
            key: 'change', header: '漲跌', sortable: true, align: 'right', hideOnMobile: true,
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
            key: 'anomalyScore', header: '控盤分數', sortable: true, align: 'center',
            accessor: (item) => item.anomalyScore,
            render: (item) => (
                <div className="flex items-center justify-center gap-1">
                    <div className="w-16 h-2 rounded-full bg-muted/30 overflow-hidden">
                        <div
                            className={`h-full rounded-full transition-all ${
                                item.anomalyScore >= 70 ? 'bg-red-500' :
                                item.anomalyScore >= 40 ? 'bg-yellow-500' : 'bg-blue-500'
                            }`}
                            style={{ width: `${item.anomalyScore}%` }}
                        />
                    </div>
                    <span className="text-xs font-mono w-8">{item.anomalyScore}</span>
                </div>
            ),
        },
        {
            key: 'phase', header: '推估階段', sortable: true,
            render: (item) => {
                const phaseConfig: Record<string, { color: string; icon: React.ReactNode }> = {
                    '可能佈局期': { color: 'bg-blue-500/20 text-blue-400 border-blue-500/30', icon: <Eye className="w-3 h-3" /> },
                    '可能拉抬期': { color: 'bg-red-500/20 text-red-400 border-red-500/30', icon: <TrendingUp className="w-3 h-3" /> },
                    '可能出貨期': { color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30', icon: <AlertTriangle className="w-3 h-3" /> },
                    '觀察中': { color: 'bg-muted/20 text-muted-foreground border-border/30', icon: <Activity className="w-3 h-3" /> },
                };
                const config = phaseConfig[item.phase] || phaseConfig['觀察中'];
                return (
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border ${config.color}`}>
                        {config.icon}
                        {item.phase}
                    </span>
                );
            },
        },
        {
            key: 'signals', header: '異常信號', align: 'center',
            render: (item) => {
                const highCount = item.signals.filter(s => s.severity === 'HIGH').length;
                const medCount = item.signals.filter(s => s.severity === 'MEDIUM').length;
                return (
                    <div className="flex items-center justify-center gap-1">
                        {highCount > 0 && <Badge className="bg-red-500/20 text-red-400 text-[10px] px-1.5">{highCount} 高</Badge>}
                        {medCount > 0 && <Badge className="bg-yellow-500/20 text-yellow-400 text-[10px] px-1.5">{medCount} 中</Badge>}
                    </div>
                );
            },
        },
        {
            key: 'expand', header: '', align: 'center',
            render: (item) => (
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        setExpandedRow(expandedRow === item.symbol ? null : item.symbol);
                    }}
                    className="p-1 hover:bg-muted/20 rounded transition-colors"
                >
                    {expandedRow === item.symbol
                        ? <ChevronUp className="w-4 h-4" />
                        : <ChevronDown className="w-4 h-4" />}
                </button>
            ),
        },
    ], [expandedRow]);

    return (
        <div className="container mx-auto px-4 py-6 space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <Shield className="w-6 h-6 text-primary" />
                        主力控盤偵測
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        透過量價與籌碼結構偵測可能存在的主力布局股票
                    </p>
                </div>
                <button
                    onClick={refetch}
                    className="px-4 py-2 text-sm rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                >
                    重新掃描
                </button>
            </div>

            {/* Important disclaimer at top */}
            <GlassCard className="p-4 border-yellow-500/30">
                <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-yellow-500 shrink-0 mt-0.5" />
                    <div className="text-sm">
                        <p className="font-medium text-yellow-500">重要聲明</p>
                        <p className="text-muted-foreground mt-1">
                            本頁所有分析均為<strong>模型推估</strong>，基於公開的法人買賣超與量價資料。
                            系統無法得知實際主力身份或意圖。「控盤分數」與「推估階段」僅為統計模型輸出，
                            不代表事實。請勿據此作為唯一投資依據。
                        </p>
                    </div>
                </div>
            </GlassCard>

            {/* Filters */}
            <div className="flex flex-wrap gap-2">
                {SEVERITY_OPTIONS.map(opt => (
                    <button
                        key={opt.key}
                        onClick={() => setSeverityFilter(opt.key)}
                        className={`px-3 py-1.5 rounded-lg text-sm transition-all ${
                            severityFilter === opt.key
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-muted/20 text-muted-foreground hover:bg-muted/40'
                        }`}
                    >
                        {opt.label}
                    </button>
                ))}
            </div>

            {/* Data Status */}
            {response && (
                <DataStatusBar
                    mode={response.source === 'empty' || response.source === 'error' ? 'unavailable' : response.coverage?.limitations?.length ? 'limited' : 'full'}
                    coverage={response.coverage ? { stocks: response.coverage.stocksWithChipData, total: response.coverage.minRequired } : undefined}
                    lastUpdated={new Date(response.updatedAt).toLocaleString('zh-TW')}
                    limitations={response.coverage?.limitations}
                />
            )}

            {error && (
                <GlassCard className="p-4 text-destructive text-sm">
                    掃描失敗：{error}
                </GlassCard>
            )}

            {loading && (
                <div className="flex flex-col items-center justify-center py-20 gap-3">
                    <LoadingSpinner size="lg" />
                    <p className="text-sm text-muted-foreground">正在掃描籌碼異常...</p>
                </div>
            )}

            {/* Table with expandable rows */}
            {!loading && response && (
                <>
                    <DataTable
                        data={response.data}
                        columns={columns}
                        searchable
                        searchPlaceholder="搜尋股票代號或名稱..."
                        searchKeys={['symbol', 'name']}
                        defaultSort={{ key: 'anomalyScore', direction: 'desc' }}
                        pageSize={20}
                        onRowClick={(item) => router.push(`/stock/${item.symbol}`)}
                        getRowKey={(item) => item.symbol}
                        emptyMessage="未偵測到籌碼異常"
                        emptyDescription="目前無符合篩選條件的異常信號"
                    />

                    {/* Expanded detail panel */}
                    {expandedRow && response.data.find(d => d.symbol === expandedRow) && (
                        <GlassCard className="p-4 space-y-3 animate-in fade-in">
                            {(() => {
                                const item = response.data.find(d => d.symbol === expandedRow)!;
                                return (
                                    <>
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-lg">{item.symbol} {item.name}</span>
                                            <span className="text-xs text-muted-foreground">— 分析詳情</span>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            {/* Phase */}
                                            <div className="p-3 rounded-lg bg-muted/10 border border-border/30">
                                                <div className="text-xs text-muted-foreground mb-1">推估階段</div>
                                                <div className="font-medium">{item.phase}</div>
                                                <div className="text-xs text-muted-foreground mt-1">{item.phaseDescription}</div>
                                            </div>

                                            {/* Score */}
                                            <div className="p-3 rounded-lg bg-muted/10 border border-border/30">
                                                <div className="text-xs text-muted-foreground mb-1">控盤可能性分數</div>
                                                <div className="text-3xl font-bold">
                                                    <span className={item.anomalyScore >= 70 ? 'text-red-500' : item.anomalyScore >= 40 ? 'text-yellow-500' : 'text-blue-500'}>
                                                        {item.anomalyScore}
                                                    </span>
                                                    <span className="text-sm text-muted-foreground font-normal"> / 100</span>
                                                </div>
                                                <div className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
                                                    <Info className="w-3 h-3" />
                                                    模型推估分數，非確定性結論
                                                </div>
                                            </div>
                                        </div>

                                        {/* Signals */}
                                        <div className="space-y-2">
                                            <div className="text-sm font-medium">偵測到的異常信號：</div>
                                            {item.signals.map((signal, idx) => (
                                                <div key={idx} className="flex items-start gap-2 p-2 rounded bg-muted/10 text-sm">
                                                    <Badge className={
                                                        signal.severity === 'HIGH' ? 'bg-red-500/20 text-red-400' :
                                                        signal.severity === 'MEDIUM' ? 'bg-yellow-500/20 text-yellow-400' :
                                                        'bg-blue-500/20 text-blue-400'
                                                    }>
                                                        {signal.severity}
                                                    </Badge>
                                                    <div>
                                                        <div className="font-medium text-xs">
                                                            {signal.type === 'CONCENTRATION_SURGE' ? '籌碼急速集中' :
                                                             signal.type === 'TRUST_ACCUMULATION' ? '投信連續買超' :
                                                             signal.type === 'COLD_BROKER_BUY' ? '冷門分點大買' : signal.type}
                                                        </div>
                                                        <div className="text-xs text-muted-foreground">{signal.reasoning}</div>
                                                    </div>
                                                    <span className="ml-auto text-xs font-mono text-muted-foreground">{signal.score}分</span>
                                                </div>
                                            ))}
                                        </div>
                                    </>
                                );
                            })()}
                        </GlassCard>
                    )}
                </>
            )}

            {/* Disclaimer */}
            <Disclaimer
                variant="detailed"
                source={response?.source || 'TWSE 公開法人買賣超資料'}
                methodology={response?.methodology || '依據近 20 日法人籌碼集中度變化、投信連續買超天數、量價結構偵測'}
                warning="本頁所有分析均為模型推估結果，基於公開統計資料。系統無法得知實際主力身份、意圖或策略。「控盤分數」為統計指標，不代表確實存在控盤行為。請勿將此作為唯一投資依據。"
            />
        </div>
    );
}
