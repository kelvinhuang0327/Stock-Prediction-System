"use client";

import React, { useState } from 'react';
import { X, Bell } from 'lucide-react';
import { Stock } from '@/lib/mockData';

interface PriceAlertDialogProps {
    isOpen: boolean;
    onClose: () => void;
    stock: Stock | null;
    onSave: (alert: PriceAlert) => void;
}

export type PriceAlert = {
    symbol: string;
    type: 'above' | 'below' | 'change_up' | 'change_down';
    value: number;
    enabled: boolean;
};

export function PriceAlertDialog({ isOpen, onClose, stock, onSave }: PriceAlertDialogProps) {
    const [alertType, setAlertType] = useState<PriceAlert['type']>('above');
    const [alertValue, setAlertValue] = useState('');

    const handleSave = () => {
        if (!stock || !alertValue) return;

        const alert: PriceAlert = {
            symbol: stock.symbol,
            type: alertType,
            value: Number(alertValue),
            enabled: true,
        };

        onSave(alert);
        setAlertValue('');
        onClose();
    };

    if (!isOpen || !stock) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
            <div
                className="bg-card rounded-xl shadow-xl border max-w-md w-full mx-4"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="p-4 border-b flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Bell className="w-5 h-5 text-primary" />
                        <h3 className="text-lg font-bold">設定價格警示</h3>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1 hover:bg-accent rounded-full transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 space-y-4">
                    {/* Stock Info */}
                    <div className="bg-muted/50 rounded-lg p-4">
                        <div className="font-bold text-lg">{stock.name}</div>
                        <div className="text-sm text-muted-foreground font-mono">{stock.symbol}</div>
                        <div className="mt-2 text-2xl font-bold">
                            目前價格: {stock.price}
                        </div>
                    </div>

                    {/* Alert Type */}
                    <div>
                        <label className="text-sm font-medium mb-2 block">警示類型</label>
                        <select
                            className="w-full p-2 border rounded-md bg-background"
                            value={alertType}
                            onChange={(e) => setAlertType(e.target.value as PriceAlert['type'])}
                        >
                            <option value="above">價格高於</option>
                            <option value="below">價格低於</option>
                            <option value="change_up">單日漲幅超過 (%)</option>
                            <option value="change_down">單日跌幅超過 (%)</option>
                        </select>
                    </div>

                    {/* Alert Value */}
                    <div>
                        <label className="text-sm font-medium mb-2 block">
                            {alertType.includes('change') ? '漲跌幅 (%)' : '目標價格'}
                        </label>
                        <input
                            type="number"
                            step={alertType.includes('change') ? '0.1' : '0.5'}
                            placeholder={alertType.includes('change') ? '例: 5' : `例: ${stock.price * 1.05}`}
                            className="w-full p-2 border rounded-md bg-background"
                            value={alertValue}
                            onChange={(e) => setAlertValue(e.target.value)}
                        />
                    </div>

                    {/* Preview */}
                    {alertValue && (
                        <div className="bg-primary/10 rounded-lg p-3 text-sm">
                            <div className="font-medium mb-1">警示預覽:</div>
                            <div className="text-muted-foreground">
                                當 {stock.name} ({stock.symbol}) 的
                                {alertType === 'above' && ` 價格高於 ${alertValue} 元`}
                                {alertType === 'below' && ` 價格低於 ${alertValue} 元`}
                                {alertType === 'change_up' && ` 單日漲幅超過 ${alertValue}%`}
                                {alertType === 'change_down' && ` 單日跌幅超過 ${alertValue}%`}
                                時，將發送通知
                            </div>
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-3 pt-2">
                        <button
                            onClick={handleSave}
                            disabled={!alertValue}
                            className="flex-1 bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            儲存警示
                        </button>
                        <button
                            onClick={onClose}
                            className="px-4 py-2 border rounded-md hover:bg-accent transition-colors"
                        >
                            取消
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
