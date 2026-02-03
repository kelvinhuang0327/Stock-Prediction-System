"use client";

import React, { useState } from 'react';
import { X, Search } from 'lucide-react';
import { stockService } from '@/lib/stockService';
import { Stock } from '@/lib/mockData';

interface AddStockDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onAdd: (stock: Stock) => void;
}

export function AddStockDialog({ isOpen, onClose, onAdd }: AddStockDialogProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<Stock[]>([]);
    const [loading, setLoading] = useState(false);

    const handleSearch = async (query: string) => {
        setSearchQuery(query);
        if (query.length < 1) {
            setSearchResults([]);
            return;
        }

        setLoading(true);
        const results = await stockService.searchStocks(query);
        setSearchResults(results);
        setLoading(false);
    };

    const handleAdd = (stock: Stock) => {
        onAdd(stock);
        setSearchQuery('');
        setSearchResults([]);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
            <div
                className="bg-card rounded-xl shadow-xl border max-w-md w-full mx-4"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="p-4 border-b flex items-center justify-between">
                    <h3 className="text-lg font-bold">加入自選股</h3>
                    <button
                        onClick={onClose}
                        className="p-1 hover:bg-accent rounded-full transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-4">
                    <div className="relative mb-4">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input
                            type="text"
                            placeholder="搜尋股票代號或名稱..."
                            className="w-full pl-10 pr-4 py-2 border rounded-md bg-background"
                            value={searchQuery}
                            onChange={(e) => handleSearch(e.target.value)}
                            autoFocus
                        />
                    </div>

                    <div className="max-h-80 overflow-y-auto">
                        {loading ? (
                            <div className="text-center py-8 text-muted-foreground">
                                搜尋中...
                            </div>
                        ) : searchResults.length > 0 ? (
                            <div className="space-y-2">
                                {searchResults.map((stock) => {
                                    const isPositive = stock.change >= 0;
                                    const colorClass = isPositive ? 'text-red-600' : 'text-green-600';

                                    return (
                                        <button
                                            key={stock.symbol}
                                            onClick={() => handleAdd(stock)}
                                            className="w-full p-3 border rounded-lg hover:bg-accent transition-colors text-left"
                                        >
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <div className="font-bold">{stock.name}</div>
                                                    <div className="text-sm text-muted-foreground font-mono">
                                                        {stock.symbol}
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <div className={`font-bold ${colorClass}`}>
                                                        {stock.price}
                                                    </div>
                                                    <div className={`text-sm ${colorClass}`}>
                                                        {stock.changePercent > 0 ? '+' : ''}
                                                        {stock.changePercent.toFixed(2)}%
                                                    </div>
                                                </div>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        ) : searchQuery.length > 0 ? (
                            <div className="text-center py-8 text-muted-foreground">
                                找不到相關股票
                            </div>
                        ) : (
                            <div className="text-center py-8 text-muted-foreground">
                                請輸入股票代號或名稱進行搜尋
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
