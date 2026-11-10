'use client';

import { useState, useEffect, useCallback } from 'react';
import { PriceAlert } from '@/components/watchlist/PriceAlertDialog';

export function useWatchlistAlerts() {
    const [alerts, setAlerts] = useState<PriceAlert[]>([]);

    const fetchAlerts = useCallback(async () => {
        try {
            const res = await fetch('/api/alerts');
            if (res.ok) {
                setAlerts(await res.json());
            }
        } catch (e) {
            console.error('Failed to fetch alerts', e);
        }
    }, []);

    useEffect(() => {
        let isActive = true;
        fetch('/api/alerts')
            .then(async (res) => res.ok ? await res.json() as PriceAlert[] : null)
            .then((data) => {
                if (isActive && data) setAlerts(data);
            })
            .catch((e: unknown) => console.error('Failed to fetch alerts', e));
        return () => { isActive = false; };
    }, []);

    const saveAlert = useCallback(async (alert: PriceAlert) => {
        try {
            await fetch('/api/alerts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(alert),
            });
            fetchAlerts();
        } catch (e) {
            console.error('Failed to save alert', e);
        }
    }, [fetchAlerts]);

    const deleteAlert = useCallback(async (id?: number) => {
        if (!id) return;
        try {
            await fetch(`/api/alerts?id=${id}`, { method: 'DELETE' });
            fetchAlerts();
        } catch (e) {
            console.error('Failed to delete alert', e);
        }
    }, [fetchAlerts]);

    return { alerts, saveAlert, deleteAlert };
}
