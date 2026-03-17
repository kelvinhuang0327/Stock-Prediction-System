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
import { PortfolioItem } from '@/types/watchlist';

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
