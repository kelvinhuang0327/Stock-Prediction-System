import { useState, useEffect } from 'react';
import { fetchStockData } from '@/lib/api';

export function useStockData(symbol: string) {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<Error | null>(null);

    useEffect(() => {
        let isMounted = true;
        setLoading(true);
        fetchStockData(symbol)
            .then((result) => {
                if (isMounted) {
                    setData(result);
                    setError(null);
                }
            })
            .catch((err) => {
                if (isMounted) {
                    setError(err);
                    setData(null);
                }
            })
            .finally(() => {
                if (isMounted) setLoading(false);
            });
        return () => {
            isMounted = false;
        };
    }, [symbol]);

    return { data, loading, error };
}
