"use client";

import React, { useState } from 'react';
import { AddStockDialog } from '@/components/watchlist/AddStockDialog';
import { PriceAlertDialog } from '@/components/watchlist/PriceAlertDialog';
import { EditHoldingsDialog } from '@/components/watchlist/EditHoldingsDialog';
import { useWatchlistData } from '@/hooks/useWatchlistData';
import { useWatchlistAlerts } from '@/hooks/useWatchlistAlerts';
import { WatchlistToolbar } from '@/components/watchlist/WatchlistToolbar';
import { WatchlistSummaryCards } from '@/components/watchlist/WatchlistSummaryCards';
import { WatchlistTable } from '@/components/watchlist/WatchlistTable';
import { WatchlistAlertsPanel } from '@/components/watchlist/WatchlistAlertsPanel';
import { GlassCard } from '@/components/ui/glass-card';
import { RelevantInsightsPanel } from '@/components/relevance/RelevantInsightsPanel';
import { useApiData } from '@/hooks/useApiData';
import { PortfolioItem } from '@/types/watchlist';
import type { PortfolioDecisionSupport, PortfolioImpactSnapshotComparison } from '@/types/portfolio';

interface PortfolioSnapshotApiResponse {
    scope: 'watchlist' | 'candidates';
    compareWindow: '1d' | '7d' | '30d';
    snapshot: PortfolioDecisionSupport & { snapshotDate: string; scope: 'watchlist' | 'candidates'; symbols: string[] };
    comparison: PortfolioImpactSnapshotComparison;
    limitations?: string[];
    generatedAt: string;
}

export default function WatchlistPage() {
    // ── Data & state ──
    const {
        watchlist,
        rows,
        searchQuery, setSearchQuery,
        sortConfig, toggleSort,
        isAnalyzing,
        dbLastUpdated,
        portfolioSummary,
        addStock, removeStock, updateHoldings,
        refreshAnalysis,
        migrationStatus,
        migrationMessage,
        useDbSource,
    } = useWatchlistData();

    const { alerts, saveAlert, deleteAlert } = useWatchlistAlerts();
    const { data: portfolioSnapshot } = useApiData<PortfolioSnapshotApiResponse>('/api/portfolio/impact-snapshot?scope=watchlist&comparison=true&compareWindow=1d', { refetchInterval: 180000 });

    // ── Dialog state ──
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [isAlertDialogOpen, setIsAlertDialogOpen] = useState(false);
    const [isHoldingsDialogOpen, setIsHoldingsDialogOpen] = useState(false);
    const [selectedStock, setSelectedStock] = useState<PortfolioItem | null>(null);

    const findStock = (symbol: string) => watchlist.find(s => s.symbol === symbol) ?? null;

    const handleEditHoldings = (symbol: string) => {
        setSelectedStock(findStock(symbol));
        setIsHoldingsDialogOpen(true);
    };

    const handleSetAlert = (symbol: string) => {
        setSelectedStock(findStock(symbol));
        setIsAlertDialogOpen(true);
    };

    // ── Render ──
    return (
        <div className="space-y-6 max-w-7xl mx-auto pb-20">
            <WatchlistToolbar
                dbLastUpdated={dbLastUpdated}
                isAnalyzing={isAnalyzing}
                onRefresh={refreshAnalysis}
                onAddStock={() => setIsAddDialogOpen(true)}
                migrationStatus={migrationStatus}
                migrationMessage={migrationMessage}
                useDbSource={useDbSource}
            />

            <WatchlistSummaryCards summary={portfolioSummary} />
            <PortfolioContextCard data={portfolioSnapshot} />
            <RelevantInsightsPanel
                mode="watchlist"
                maxItems={3}
                variant="compact"
                minimumScore={45}
                title="持倉最值得關注"
                description="依 relevance 保守排序持倉研究線索，優先顯示較直接、較可信、仍具時效性的資訊。"
                emptyStateMessage="目前沒有高 relevance 的持倉 insight，系統已保守降級顯示。"
            />

            <div id="watchlist-table">
                <WatchlistTable
                    rows={rows}
                    totalCount={watchlist.length}
                    searchQuery={searchQuery}
                    sortConfig={sortConfig}
                    onSearchChange={setSearchQuery}
                    onSort={toggleSort}
                    onEditHoldings={handleEditHoldings}
                    onSetAlert={handleSetAlert}
                    onRemove={removeStock}
                />
            </div>

            <WatchlistAlertsPanel alerts={alerts} onDelete={deleteAlert} />

            {/* Dialogs */}
            <AddStockDialog
                isOpen={isAddDialogOpen}
                onClose={() => setIsAddDialogOpen(false)}
                onAdd={addStock}
            />
            <PriceAlertDialog
                isOpen={isAlertDialogOpen}
                onClose={() => setIsAlertDialogOpen(false)}
                stock={selectedStock}
                onSave={saveAlert}
            />
            <EditHoldingsDialog
                isOpen={isHoldingsDialogOpen}
                onClose={() => setIsHoldingsDialogOpen(false)}
                stock={selectedStock}
                currentHoldings={selectedStock?.avgCost && selectedStock?.quantity ? { avgCost: selectedStock.avgCost, quantity: selectedStock.quantity } : undefined}
                onSave={updateHoldings}
            />
        </div>
    );
}

function PortfolioContextCard({ data }: { data: PortfolioSnapshotApiResponse | null }) {
    if (!data) {
        return (
            <GlassCard id="watchlist-portfolio-context" className="p-5">
                <h3 className="text-sm font-semibold">組合風險與集中度</h3>
                <p className="text-xs text-muted-foreground mt-2">載入中...</p>
            </GlassCard>
        );
    }

    const snapshot = data.snapshot;
    const topTheme = snapshot.themeConcentration.topThemes[0];
    const topSector = snapshot.sectorConcentration.sectors[0];
    return (
        <GlassCard id="watchlist-portfolio-context" className="p-5 space-y-3">
            <h3 className="text-sm font-semibold">組合風險與集中度（研究）</h3>
            <p className="text-xs text-muted-foreground">{snapshot.summary}</p>
            <div className="flex flex-wrap items-center gap-2 text-[11px]">
                <span className="px-2 py-1 rounded border border-border/40">主題變化: {data.comparison.themeChanged ? 'changed' : 'stable'}</span>
                <span className="px-2 py-1 rounded border border-border/40">風險變化: {data.comparison.riskChanged ? 'changed' : 'stable'}</span>
                <span className="px-2 py-1 rounded border border-border/40">比較({data.compareWindow}): {data.comparison.comparisonAvailable ? `vs ${data.comparison.previousSnapshotDate}` : 'unavailable'}</span>
            </div>
            <p className="text-[11px] text-muted-foreground">{data.comparison.summaryNote}</p>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
                <div className="rounded-lg border border-border/40 p-3">
                    <div className="text-muted-foreground">主題集中度</div>
                    <div className="font-semibold mt-1">{snapshot.themeConcentration.concentrationLevel}</div>
                    <div className="text-muted-foreground mt-1">{topTheme ? `${topTheme.theme} (${topTheme.weight}%)` : 'insufficient'}</div>
                </div>
                <div className="rounded-lg border border-border/40 p-3">
                    <div className="text-muted-foreground">產業集中度</div>
                    <div className="font-semibold mt-1">{snapshot.sectorConcentration.concentrationLevel}</div>
                    <div className="text-muted-foreground mt-1">{topSector ? `${topSector.sector} (${topSector.weight}%)` : 'unknown'}</div>
                </div>
                <div id="watchlist-risk-context" className="rounded-lg border border-border/40 p-3">
                    <div className="text-muted-foreground">風險群聚</div>
                    <div className="font-semibold mt-1">{snapshot.riskClusters.overallRiskLevel}</div>
                    <div className="text-muted-foreground mt-1">{snapshot.riskClusters.clusters[0]?.reason ?? '無顯著群聚'}</div>
                </div>
                <div className="rounded-lg border border-border/40 p-3">
                    <div className="text-muted-foreground">市場曝險</div>
                    <div className="font-semibold mt-1">{snapshot.regimeExposure.sensitivity}</div>
                    <div className="text-muted-foreground mt-1">{snapshot.regimeExposure.regime} / {snapshot.regimeExposure.confidence}%</div>
                </div>
            </div>
            {snapshot.limitations.length > 0 && (
                <p className="text-[11px] text-amber-600 dark:text-amber-400">
                    限制：{snapshot.limitations.slice(0, 2).join('；')}
                </p>
            )}
        </GlassCard>
    );
}
