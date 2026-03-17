
interface CacheItem<T> {
    value: T;
    expiry: number; // Unix timestamp in ms
}

export class SimpleCacheService {
    private cache: Map<string, CacheItem<any>> = new Map();

    /**
     * Get value from cache if it exists and hasn't expired
     */
    get<T>(key: string): T | null {
        const item = this.cache.get(key);
        if (!item) {
            return null;
        }

        if (Date.now() > item.expiry) {
            this.cache.delete(key);
            return null;
        }

        return item.value as T;
    }

    /**
     * Set value in cache with TTL
     * @param ttlSeconds Time to live in seconds
     */
    set<T>(key: string, value: T, ttlSeconds: number): void {
        const expiry = Date.now() + (ttlSeconds * 1000);
        this.cache.set(key, { value, expiry });
    }

    /**
     * Clear all cached items
     */
    clear(): void {
        this.cache.clear();
    }

    /**
     * Remove specific key
     */
    delete(key: string): void {
        this.cache.delete(key);
    }
}

export const simpleCacheService = new SimpleCacheService();
