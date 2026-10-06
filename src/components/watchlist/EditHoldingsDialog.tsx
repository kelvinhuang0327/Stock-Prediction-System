"use client";

import React, { useState, useEffect } from 'react';
import { X, Save } from 'lucide-react';
import { Stock } from '@/lib/mockData';

interface EditHoldingsDialogProps {
    isOpen: boolean;
    onClose: () => void;
    stock: Stock | null;
    currentHoldings?: { avgCost: number; quantity: number };
    onSave: (symbol: string, avgCost: number, quantity: number) => void;
}

export function EditHoldingsDialog({ isOpen, onClose, stock, currentHoldings, onSave }: EditHoldingsDialogProps) {
    const [avgCost, setAvgCost] = useState('');
    const [quantity, setQuantity] = useState('');

    useEffect(() => {
        if (isOpen && currentHoldings) {
            setAvgCost(currentHoldings.avgCost.toString());
            setQuantity(currentHoldings.quantity.toString());
        } else {
            setAvgCost('');
            setQuantity('');
        }
    }, [isOpen, currentHoldings]);

    const handleSave = () => {
        if (!stock) return;
        onSave(stock.symbol, Number(avgCost), Number(quantity));
        onClose();
    };

    if (!isOpen || !stock) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
            <div
                className="bg-card rounded-xl shadow-xl border max-w-sm w-full mx-4"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="p-4 border-b flex items-center justify-between">
                    <h3 className="text-lg font-bold">編輯持倉</h3>
                    <button
                        onClick={onClose}
                        className="p-1 hover:bg-accent rounded-full transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 space-y-4">
                    <div className="bg-muted/50 rounded-lg p-4 mb-4">
                        <div className="font-bold text-lg">{stock.name}</div>
                        <div className="text-sm text-muted-foreground font-mono">{stock.symbol}</div>
                        <div className="mt-2 flex justify-between items-end">
                            <span className="text-sm text-muted-foreground">目前市價</span>
                            <span className="font-bold text-xl">{stock.price}</span>
                        </div>
                    </div>

                    <div>
                        <label className="text-sm font-medium mb-2 block">平均成本 (元)</label>
                        <input
                            type="number"
                            step="0.1"
                            placeholder="輸入買入均價"
                            className="w-full p-2 border rounded-md bg-background"
                            value={avgCost}
                            onChange={(e) => setAvgCost(e.target.value)}
                        />
                    </div>

                    <div>
                        <label className="text-sm font-medium mb-2 block">持有股數 (股)</label>
                        <input
                            type="number"
                            step="1000"
                            placeholder="輸入持有股數"
                            className="w-full p-2 border rounded-md bg-background"
                            value={quantity}
                            onChange={(e) => setQuantity(e.target.value)}
                        />
                    </div>

                    <div className="pt-4">
                        <button
                            onClick={handleSave}
                            className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90 transition-colors"
                        >
                            <Save className="w-4 h-4" />
                            儲存設定
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
