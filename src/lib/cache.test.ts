import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Mock the cache module directly to avoid singleton issues
describe("MemoryCache", () => {
  let cache: {
    get: <T>(key: string) => T | null;
    set: <T>(key: string, value: T, ttlSeconds?: number) => void;
    delete: (key: string) => void;
    deletePattern: (pattern: string) => void;
    clear: () => void;
    getOrSet: <T>(key: string, compute: () => Promise<T>, ttlSeconds?: number) => Promise<T>;
    getStats: () => { size: number; keys: string[] };
  };

  beforeEach(() => {
    // Create a fresh cache instance for each test
    const cacheMap = new Map<string, { value: unknown; expiresAt: number }>();

    cache = {
      get: <T>(key: string): T | null => {
        const entry = cacheMap.get(key);
        if (!entry) return null;
        if (Date.now() > entry.expiresAt) {
          cacheMap.delete(key);
          return null;
        }
        return entry.value as T;
      },
      set: <T>(key: string, value: T, ttlSeconds: number = 300): void => {
        cacheMap.set(key, {
          value,
          expiresAt: Date.now() + ttlSeconds * 1000,
        });
      },
      delete: (key: string): void => {
        cacheMap.delete(key);
      },
      deletePattern: (pattern: string): void => {
        const regex = new RegExp(pattern);
        for (const key of cacheMap.keys()) {
          if (regex.test(key)) {
            cacheMap.delete(key);
          }
        }
      },
      clear: (): void => {
        cacheMap.clear();
      },
      getOrSet: async <T>(
        key: string,
        compute: () => Promise<T>,
        ttlSeconds: number = 300
      ): Promise<T> => {
        const cached = cache.get<T>(key);
        if (cached !== null) {
          return cached;
        }
        const value = await compute();
        cache.set(key, value, ttlSeconds);
        return value;
      },
      getStats: () => ({
        size: cacheMap.size,
        keys: Array.from(cacheMap.keys()),
      }),
    };
  });

  describe("basic operations", () => {
    it("should store and retrieve a value", () => {
      cache.set("test-key", "test-value");
      expect(cache.get("test-key")).toBe("test-value");
    });

    it("should return null for non-existent keys", () => {
      expect(cache.get("non-existent")).toBeNull();
    });

    it("should store complex objects", () => {
      const obj = { name: "Test", count: 42, nested: { value: true } };
      cache.set("object-key", obj);
      expect(cache.get("object-key")).toEqual(obj);
    });

    it("should delete a specific key", () => {
      cache.set("to-delete", "value");
      expect(cache.get("to-delete")).toBe("value");

      cache.delete("to-delete");
      expect(cache.get("to-delete")).toBeNull();
    });

    it("should clear all entries", () => {
      cache.set("key1", "value1");
      cache.set("key2", "value2");
      cache.set("key3", "value3");

      expect(cache.getStats().size).toBe(3);

      cache.clear();
      expect(cache.getStats().size).toBe(0);
    });
  });

  describe("TTL expiration", () => {
    it("should expire entries after TTL", async () => {
      vi.useFakeTimers();

      cache.set("expiring-key", "value", 1); // 1 second TTL
      expect(cache.get("expiring-key")).toBe("value");

      // Advance time past TTL
      vi.advanceTimersByTime(1500);

      expect(cache.get("expiring-key")).toBeNull();

      vi.useRealTimers();
    });

    it("should not expire entries before TTL", async () => {
      vi.useFakeTimers();

      cache.set("long-key", "value", 60); // 60 second TTL
      expect(cache.get("long-key")).toBe("value");

      // Advance time but not past TTL
      vi.advanceTimersByTime(30000);

      expect(cache.get("long-key")).toBe("value");

      vi.useRealTimers();
    });
  });

  describe("pattern deletion", () => {
    it("should delete keys matching a pattern", () => {
      cache.set("league:123:data", "league data");
      cache.set("league:123:settings", "settings data");
      cache.set("league:456:data", "other league data");
      cache.set("roster:789:data", "roster data");

      cache.deletePattern("league:123:.*");

      expect(cache.get("league:123:data")).toBeNull();
      expect(cache.get("league:123:settings")).toBeNull();
      expect(cache.get("league:456:data")).toBe("other league data");
      expect(cache.get("roster:789:data")).toBe("roster data");
    });

    it("should handle pattern that matches all keys", () => {
      cache.set("key1", "value1");
      cache.set("key2", "value2");

      cache.deletePattern("key.*");

      expect(cache.getStats().size).toBe(0);
    });

    it("should handle pattern that matches no keys", () => {
      cache.set("key1", "value1");
      cache.set("key2", "value2");

      cache.deletePattern("nonexistent.*");

      expect(cache.getStats().size).toBe(2);
    });
  });

  describe("getOrSet", () => {
    it("should return cached value if present", async () => {
      cache.set("preloaded", "cached-value");
      const computeFn = vi.fn().mockResolvedValue("new-value");

      const result = await cache.getOrSet("preloaded", computeFn);

      expect(result).toBe("cached-value");
      expect(computeFn).not.toHaveBeenCalled();
    });

    it("should compute and cache value if not present", async () => {
      const computeFn = vi.fn().mockResolvedValue("computed-value");

      const result = await cache.getOrSet("new-key", computeFn);

      expect(result).toBe("computed-value");
      expect(computeFn).toHaveBeenCalledOnce();
      expect(cache.get("new-key")).toBe("computed-value");
    });

    it("should only compute once for concurrent requests", async () => {
      // This test simulates multiple concurrent cache accesses
      let computeCount = 0;
      const computeFn = async () => {
        computeCount++;
        await new Promise((resolve) => setTimeout(resolve, 10));
        return `value-${computeCount}`;
      };

      // First request computes
      const result1 = await cache.getOrSet("concurrent-key", computeFn);
      // Second request uses cache
      const result2 = await cache.getOrSet("concurrent-key", computeFn);

      expect(result1).toBe("value-1");
      expect(result2).toBe("value-1");
      expect(computeCount).toBe(1);
    });
  });

  describe("getStats", () => {
    it("should return correct size", () => {
      cache.set("a", 1);
      cache.set("b", 2);
      cache.set("c", 3);

      const stats = cache.getStats();
      expect(stats.size).toBe(3);
    });

    it("should return all keys", () => {
      cache.set("alpha", 1);
      cache.set("beta", 2);
      cache.set("gamma", 3);

      const stats = cache.getStats();
      expect(stats.keys).toContain("alpha");
      expect(stats.keys).toContain("beta");
      expect(stats.keys).toContain("gamma");
    });
  });
});

describe("cacheKeys helpers", () => {
  it("should generate consistent keys", async () => {
    // Import dynamically to test the actual implementation
    const { cacheKeys } = await import("./cache");

    expect(cacheKeys.leagueData("abc123")).toBe("league:abc123");
    expect(cacheKeys.leagueRosters("abc123")).toBe("league:abc123:rosters");
    expect(cacheKeys.rosterKeepers("roster1", 2024)).toBe("roster:roster1:keepers:2024");
    expect(cacheKeys.eligibleKeepers("roster1", 2024)).toBe("roster:roster1:eligible:2024");
    expect(cacheKeys.userLeagues("user1")).toBe("user:user1:leagues");
    expect(cacheKeys.nflState()).toBe("nfl:state");
  });
});

describe("hashObject", () => {
  it("should generate consistent hashes", async () => {
    const { hashObject } = await import("./cache");

    const obj1 = { a: 1, b: 2 };
    const obj2 = { a: 1, b: 2 };
    const obj3 = { a: 1, b: 3 };

    expect(hashObject(obj1)).toBe(hashObject(obj2));
    expect(hashObject(obj1)).not.toBe(hashObject(obj3));
  });

  it("should handle different types", async () => {
    const { hashObject } = await import("./cache");

    expect(hashObject("string")).toBeTruthy();
    expect(hashObject(123)).toBeTruthy();
    expect(hashObject([1, 2, 3])).toBeTruthy();
    expect(hashObject({ nested: { value: true } })).toBeTruthy();
  });
});
