import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  DEFAULT_KEEPER_RULES,
  getCurrentSeason,
  getSeasonOptions,
  isOffseason,
  isDraftSeason,
  isTradeAfterDeadline,
} from "./keeper-rules";

describe("DEFAULT_KEEPER_RULES", () => {
  it("should have correct default values", () => {
    expect(DEFAULT_KEEPER_RULES.MAX_KEEPERS).toBe(7);
    expect(DEFAULT_KEEPER_RULES.MAX_FRANCHISE_TAGS).toBe(2);
    expect(DEFAULT_KEEPER_RULES.MAX_REGULAR_KEEPERS).toBe(5);
    expect(DEFAULT_KEEPER_RULES.REGULAR_KEEPER_MAX_YEARS).toBe(2);
    expect(DEFAULT_KEEPER_RULES.MINIMUM_ROUND).toBe(1);
    expect(DEFAULT_KEEPER_RULES.MAX_DRAFT_ROUNDS).toBe(16);
  });
});

describe("getCurrentSeason", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should return previous year in January", () => {
    vi.setSystemTime(new Date("2025-01-15"));
    expect(getCurrentSeason()).toBe(2024);
  });

  it("should return previous year in February", () => {
    vi.setSystemTime(new Date("2025-02-01"));
    expect(getCurrentSeason()).toBe(2024);
  });

  it("should return current year in March", () => {
    vi.setSystemTime(new Date("2025-03-15"));
    expect(getCurrentSeason()).toBe(2025);
  });

  it("should return current year in September", () => {
    vi.setSystemTime(new Date("2025-09-15"));
    expect(getCurrentSeason()).toBe(2025);
  });

  it("should return current year in December", () => {
    vi.setSystemTime(new Date("2025-12-15"));
    expect(getCurrentSeason()).toBe(2025);
  });
});

describe("getSeasonOptions", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-06-15"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should return 5 season options", () => {
    const options = getSeasonOptions();
    expect(options).toHaveLength(5);
  });

  it("should include 3 years back and 1 year forward", () => {
    const options = getSeasonOptions();
    expect(options).toEqual([2022, 2023, 2024, 2025, 2026]);
  });
});

describe("isOffseason", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should return true in February", () => {
    vi.setSystemTime(new Date("2025-02-15"));
    expect(isOffseason()).toBe(true);
  });

  it("should return true in August", () => {
    vi.setSystemTime(new Date("2025-08-15"));
    expect(isOffseason()).toBe(true);
  });

  it("should return false in September", () => {
    vi.setSystemTime(new Date("2025-09-15"));
    expect(isOffseason()).toBe(false);
  });

  it("should return false in January", () => {
    vi.setSystemTime(new Date("2025-01-15"));
    expect(isOffseason()).toBe(false);
  });
});

describe("isDraftSeason", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should return true in August", () => {
    vi.setSystemTime(new Date("2025-08-15"));
    expect(isDraftSeason()).toBe(true);
  });

  it("should return true in September", () => {
    vi.setSystemTime(new Date("2025-09-05"));
    expect(isDraftSeason()).toBe(true);
  });

  it("should return false in October", () => {
    vi.setSystemTime(new Date("2025-10-15"));
    expect(isDraftSeason()).toBe(false);
  });

  it("should return false in July", () => {
    vi.setSystemTime(new Date("2025-07-15"));
    expect(isDraftSeason()).toBe(false);
  });
});

describe("isTradeAfterDeadline", () => {
  it("should return false for trade before deadline in same season", () => {
    // Trade in October 2024 for 2024 season (deadline is ~mid-November)
    const tradeDate = new Date("2024-10-15");
    expect(isTradeAfterDeadline(tradeDate, 2024)).toBe(false);
  });

  it("should return true for trade in December of season year", () => {
    // Trade in December 2024 for 2024 season (after deadline)
    const tradeDate = new Date("2024-12-15");
    expect(isTradeAfterDeadline(tradeDate, 2024)).toBe(true);
  });

  it("should return true for offseason trade in January", () => {
    // Trade in January 2025 for 2024 season (offseason)
    const tradeDate = new Date("2025-01-15");
    expect(isTradeAfterDeadline(tradeDate, 2024)).toBe(true);
  });

  it("should return true for offseason trade in August", () => {
    // Trade in August 2025 for 2024 season (offseason)
    const tradeDate = new Date("2025-08-01");
    expect(isTradeAfterDeadline(tradeDate, 2024)).toBe(true);
  });

  it("should return false for trade in September of next year (new season)", () => {
    // Trade in September 2025 is for 2025 season, not 2024
    const tradeDate = new Date("2025-09-15");
    expect(isTradeAfterDeadline(tradeDate, 2024)).toBe(false);
  });

  it("should return false for trade in late November before deadline", () => {
    // Trade on November 10 2024 for 2024 season (before deadline ~Nov 16)
    const tradeDate = new Date("2024-11-10");
    expect(isTradeAfterDeadline(tradeDate, 2024)).toBe(false);
  });
});
