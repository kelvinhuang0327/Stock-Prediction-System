'use client';

import React from 'react';
import { Bell, Trash2 } from 'lucide-react';
import { PriceAlert } from '@/components/watchlist/PriceAlertDialog';

interface Props {
    alerts: PriceAlert[];
    onDelete: (id?: number) => void;
}

const ALERT_LABELS: Record<string, (v: number) => string> = {
    above: (v) => `價格高於 ${v}`,
    below: (v) => `價格低於 ${v}`,
    change_up: (v) => `漲幅超過 ${v}%`,
    change_down: (v) => `跌幅超過 ${v}%`,
};

export function WatchlistAlertsPanel({ alerts, onDelete }: Props) {
    if (alerts.length === 0) return null;

    return (
        <div className="bg-card rounded-xl shadow-sm border p-6">
            <h3 className="text-lg font-bold mb-4">價格警示 ({alerts.length})</h3>
            <div className="space-y-2">
                {alerts.map((alert, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                        <div className="flex items-center gap-3">
                            <Bell className="w-4 h-4 text-primary" />
                            <div>
                                <div className="font-medium">{alert.symbol}</div>
                                <div className="text-sm text-muted-foreground">
                                    {ALERT_LABELS[alert.type]?.(alert.value) ?? `${alert.type}: ${alert.value}`}
                                </div>
                            </div>
                        </div>
                        <button
                            onClick={() => onDelete(alert.id)}
                            className="text-muted-foreground hover:text-destructive transition-colors"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
}
