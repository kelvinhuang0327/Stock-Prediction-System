import { useState, useEffect } from 'react';
import { fetchStockData } from '@/lib/api';

export function useStockData(symbol: string) {
    const [result, setResult] = useState<{ symbol: string; data: unknown; error: Error | null } | null>(null);

    useEffect(() => {
        let isMounted = true;
        fetchStockData(symbol)
            .then((data) => {
                if (isMounted) {
                    setResult({ symbol, data, error: null });
                }
            })
            .catch((err) => {
                if (isMounted) {
                    setResult({
                        symbol,
                        data: null,
                        error: err instanceof Error ? err : new Error(String(err)),
                    });
                }
            })
        return () => {
            isMounted = false;
        };
    }, [symbol]);

    const currentResult = result?.symbol === symbol ? result : null;
    return {
        data: currentResult?.data ?? null,
        loading: currentResult === null,
        error: currentResult?.error ?? null,
    };
}
