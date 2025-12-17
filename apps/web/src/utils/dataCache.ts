interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

class DataCache {
  private cache: Map<string, CacheEntry<any>> = new Map();
  private defaultTTL: number = 5 * 60 * 1000;

  set<T>(key: string, data: T, ttl?: number): void {
    const timestamp = Date.now();
    const expiresAt = timestamp + (ttl || this.defaultTTL);

    this.cache.set(key, {
      data,
      timestamp,
      expiresAt
    });
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  has(key: string): boolean {
    const entry = this.cache.get(key);

    if (!entry) {
      return false;
    }

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  invalidatePattern(pattern: RegExp): void {
    const keysToDelete: string[] = [];

    this.cache.forEach((_, key) => {
      if (pattern.test(key)) {
        keysToDelete.push(key);
      }
    });

    keysToDelete.forEach(key => this.cache.delete(key));
  }

  getOrFetch<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttl?: number
  ): Promise<T> {
    const cached = this.get<T>(key);

    if (cached !== null) {
      return Promise.resolve(cached);
    }

    return fetcher().then(data => {
      this.set(key, data, ttl);
      return data;
    });
  }

  prefetch<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttl?: number
  ): void {
    if (!this.has(key)) {
      fetcher().then(data => {
        this.set(key, data, ttl);
      }).catch(error => {
        console.error(`Prefetch failed for ${key}:`, error);
      });
    }
  }
}

export const dataCache = new DataCache();

export const getCacheKey = (...parts: (string | number)[]): string => {
  return parts.join(':');
};

export const invalidatePatientCache = (patientId: number): void => {
  dataCache.invalidatePattern(new RegExp(`^patient:${patientId}:`));
};

export const invalidateDateCache = (date: string): void => {
  dataCache.invalidatePattern(new RegExp(`:${date}($|:)`));
};
