/**
 * Server-side caching utilities
 * Provides in-memory caching with TTL for expensive computations
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

class MemoryCache {
  private cache: Map<string, CacheEntry<unknown>> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Run cleanup every minute
    if (typeof setInterval !== "undefined") {
      this.cleanupInterval = setInterval(() => this.cleanup(), 60000);
    }
  }

  /**
   * Get a value from cache
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.value;
  }

  /**
   * Set a value in cache with TTL (in seconds)
   */
  set<T>(key: string, value: T, ttlSeconds: number = 300): void {
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  /**
   * Delete a value from cache
   */
  delete(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Delete all values matching a pattern
   */
  deletePattern(pattern: string): void {
    const regex = new RegExp(pattern);
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cached value or compute and cache it
   */
  async getOrSet<T>(
    key: string,
    compute: () => Promise<T>,
    ttlSeconds: number = 300
  ): Promise<T> {
    const cached = this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    const value = await compute();
    this.set(key, value, ttlSeconds);
    return value;
  }

  /**
   * Remove expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Get cache stats
   */
  getStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }

  /**
   * Destroy the cache and cleanup interval
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.cache.clear();
  }
}

// Singleton instance
export const cache = new MemoryCache();

// Cache key generators for consistent key naming
export const cacheKeys = {
  leagueData: (leagueId: string) => `league:${leagueId}`,
  leagueRosters: (leagueId: string) => `league:${leagueId}:rosters`,
  leagueSettings: (leagueId: string) => `league:${leagueId}:settings`,
  rosterKeepers: (rosterId: string, season: number) => `roster:${rosterId}:keepers:${season}`,
  eligibleKeepers: (rosterId: string, season: number) => `roster:${rosterId}:eligible:${season}`,
  tradeAnalysis: (hash: string) => `trade:analysis:${hash}`,
  playerProjections: (playerId: string, season: number) => `player:${playerId}:projections:${season}`,
  draftBoard: (leagueId: string, season: number) => `league:${leagueId}:draftboard:${season}`,
  userLeagues: (userId: string) => `user:${userId}:leagues`,
  nflState: () => "nfl:state",
  allPlayers: () => "players:all",
};

// TTL constants (in seconds)
export const cacheTTL = {
  short: 60, // 1 minute - frequently changing data
  medium: 300, // 5 minutes - moderately changing data
  long: 900, // 15 minutes - stable data
  veryLong: 3600, // 1 hour - rarely changing data
  daily: 86400, // 24 hours - static reference data
};

/**
 * Decorator for caching async function results
 * Usage: @cached('key-prefix', 300)
 */
export function cached<T extends unknown[], R>(
  keyPrefix: string,
  ttlSeconds: number = 300
) {
  return function (
    target: object,
    propertyKey: string,
    descriptor: TypedPropertyDescriptor<(...args: T) => Promise<R>>
  ) {
    const originalMethod = descriptor.value;
    if (!originalMethod) return descriptor;

    descriptor.value = async function (...args: T): Promise<R> {
      const key = `${keyPrefix}:${JSON.stringify(args)}`;
      return cache.getOrSet(key, () => originalMethod.apply(this, args), ttlSeconds);
    };

    return descriptor;
  };
}

/**
 * Simple hash function for creating cache keys from complex objects
 */
export function hashObject(obj: unknown): string {
  const str = JSON.stringify(obj);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
}
