import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  governingSeasonForTrade,
  DEFAULT_KEEPER_RULES,
  getCurrentSeason,
  getSeasonOptions,
  isOffseason,
  isDraftSeason,
  isTradeAfterDeadline,
  isCurrentlyAfterTradeDeadline,
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

  it("answers about the season it is asked about, not the one it guesses", () => {
    // Sept 2025 is ten months past the November 2024 deadline, so measured
    // against 2024 the answer is plainly true. This used to return false on
    // the theory that a September trade "belongs to" the new season — mixing
    // the deadline test with season attribution, and hiding a real bug: with
    // the caller passing a stale season, an offseason trade came back
    // pre-deadline and kept keeper years it should have reset.
    const tradeDate = new Date("2025-09-15");
    expect(isTradeAfterDeadline(tradeDate, 2024)).toBe(true);

    // Attribution is governingSeasonForTrade's job, and the two composed give
    // the right real-world answer: the 2025 draft ran on 16 Aug, so this trade
    // is an in-season 2025 one, before that November's deadline.
    const drafts = [{ season: 2025, startTime: new Date("2025-08-16T19:19:00Z") }];
    const season = governingSeasonForTrade(tradeDate, drafts);
    expect(season).toBe(2025);
    expect(isTradeAfterDeadline(tradeDate, season)).toBe(false);
  });

  it("should return false for trade in late November before deadline", () => {
    // Trade on November 10 2024 for 2024 season (before deadline ~Nov 16)
    const tradeDate = new Date("2024-11-10");
    expect(isTradeAfterDeadline(tradeDate, 2024)).toBe(false);
  });
});

describe("isCurrentlyAfterTradeDeadline", () => {
  it("returns false in October (in-season, before deadline)", () => {
    expect(isCurrentlyAfterTradeDeadline(new Date("2026-10-15"))).toBe(false);
  });

  it("returns true in December (in-season, after deadline)", () => {
    expect(isCurrentlyAfterTradeDeadline(new Date("2026-12-10"))).toBe(true);
  });

  it("returns true in January (offseason vs previous season)", () => {
    expect(isCurrentlyAfterTradeDeadline(new Date("2027-01-15"))).toBe(true);
  });

  it("returns true in March (offseason)", () => {
    expect(isCurrentlyAfterTradeDeadline(new Date("2027-03-20"))).toBe(true);
  });

  it("returns true in August (offseason, pre-draft)", () => {
    expect(isCurrentlyAfterTradeDeadline(new Date("2026-08-13"))).toBe(true);
  });

  it("returns false in early September (new season, pre-deadline)", () => {
    expect(isCurrentlyAfterTradeDeadline(new Date("2026-09-20"))).toBe(false);
  });

  it("returns false in early November right before the deadline", () => {
    expect(isCurrentlyAfterTradeDeadline(new Date("2026-11-01"))).toBe(false);
  });
});

describe("governingSeasonForTrade", () => {
  const drafts = [
    { season: 2024, startTime: new Date("2024-08-30T01:30:00Z") },
    { season: 2025, startTime: new Date("2025-08-16T19:19:00Z") },
    { season: 2026, startTime: new Date("2026-09-04T00:30:00Z") },
  ];

  it("files an August trade under the season just played", () => {
    // Justin Jefferson, traded 28 Aug 2026 — after the 2025 deadline and
    // before the 2026 draft, so an offseason trade. getSeasonFromDate called
    // it 2026 and asked whether it beat the November 2026 deadline, which no
    // August date can, so his keeper years carried and forced a franchise tag.
    const t = new Date("2026-08-28T22:21:47Z");
    expect(governingSeasonForTrade(t, drafts)).toBe(2025);
    expect(isTradeAfterDeadline(t, governingSeasonForTrade(t, drafts))).toBe(true);
  });

  it("still calls it offseason two days before a September draft", () => {
    // The reason this cannot be a calendar rule: the 2026 draft is 4 Sep, so
    // "September means the new season" would file a 2 Sep trade as in-season
    // and preserve years that should have reset.
    const t = new Date("2026-09-02T12:00:00Z");
    expect(governingSeasonForTrade(t, drafts)).toBe(2025);
    expect(isTradeAfterDeadline(t, governingSeasonForTrade(t, drafts))).toBe(true);
  });

  it("switches to the new season once its draft has actually started", () => {
    const t = new Date("2026-10-05T12:00:00Z");
    expect(governingSeasonForTrade(t, drafts)).toBe(2026);
    // October is before the November deadline, so this one preserves.
    expect(isTradeAfterDeadline(t, governingSeasonForTrade(t, drafts))).toBe(false);
  });

  it("resets again once that season's deadline passes", () => {
    const t = new Date("2026-12-10T12:00:00Z");
    expect(governingSeasonForTrade(t, drafts)).toBe(2026);
    expect(isTradeAfterDeadline(t, governingSeasonForTrade(t, drafts))).toBe(true);
  });

  it("ignores drafts with no start time and falls back to the month rule", () => {
    expect(governingSeasonForTrade(new Date("2026-08-28T00:00:00Z"), [])).toBe(2025);
    expect(governingSeasonForTrade(new Date("2026-10-01T00:00:00Z"), [])).toBe(2026);
    expect(
      governingSeasonForTrade(new Date("2026-08-28T00:00:00Z"), [
        { season: 2026, startTime: null },
      ])
    ).toBe(2025);
  });
});
