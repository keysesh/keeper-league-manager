import { describe, it, expect, vi, beforeEach } from "vitest";
import { getCurrentSeason } from "@/lib/constants/keeper-rules";

const mocks = vi.hoisted(() => ({
  getUserLeagues: vi.fn(),
  syncLeagueFast: vi.fn(),
  carryOverKeeperPlans: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    roster: { findMany: vi.fn() },
    teamMember: { createMany: vi.fn() },
    league: { findFirst: vi.fn() },
  },
}));

vi.mock("@/lib/sleeper/client", () => ({
  SleeperClient: class {
    getUserLeagues = mocks.getUserLeagues;
  },
}));

vi.mock("@/lib/sleeper/sync", () => ({
  syncLeagueFast: mocks.syncLeagueFast,
  carryOverKeeperPlans: mocks.carryOverKeeperPlans,
  TARGET_LEAGUE_NAME: "E Pluribus",
}));

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { prisma } from "@/lib/prisma";
import { ensureLeagueMembership } from "./membership";

const USER = {
  id: "user-1",
  sleeperId: "sleeper-100",
  sleeperUsername: "testuser",
};
const CURRENT = getCurrentSeason();
const E_PLURIBUS = { league_id: "sl-2026", name: "E Pluribus Gridiron Dynasty" };
const OTHER_LEAGUE = { league_id: "sl-other", name: "Some Other League" };
const VISIBLE_LEAGUE = {
  id: "db-league-2026",
  name: "E Pluribus Gridiron Dynasty",
  season: CURRENT,
};

function mockFn<T>(fn: T): ReturnType<typeof vi.fn> {
  return fn as ReturnType<typeof vi.fn>;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockFn(prisma.user.findUnique).mockResolvedValue(USER);
  mockFn(prisma.roster.findMany).mockResolvedValue([]);
  mockFn(prisma.teamMember.createMany).mockResolvedValue({ count: 0 });
  mockFn(prisma.league.findFirst).mockResolvedValue(VISIBLE_LEAGUE);
  mocks.getUserLeagues.mockResolvedValue([]);
  mocks.syncLeagueFast.mockResolvedValue({
    league: { id: "db-league-2026", name: "E Pluribus Gridiron Dynasty" },
    rosters: 10,
    players: 170,
  });
  mocks.carryOverKeeperPlans.mockResolvedValue({ carried: 0 });
});

describe("ensureLeagueMembership", () => {
  it("links a brand-new registrant whose league exists on Sleeper", async () => {
    mocks.getUserLeagues.mockImplementation(async (_id: string, year: number) =>
      year === CURRENT ? [OTHER_LEAGUE, E_PLURIBUS] : []
    );

    const result = await ensureLeagueMembership("user-1");

    expect(mocks.syncLeagueFast).toHaveBeenCalledWith("sl-2026");
    expect(mocks.carryOverKeeperPlans).toHaveBeenCalledWith("db-league-2026");
    expect(result).toEqual({
      status: "linked",
      leagueId: "db-league-2026",
      leagueName: "E Pluribus Gridiron Dynasty",
      season: CURRENT,
    });
  });

  it("heals a user whose account exists but membership links are missing (DB-only)", async () => {
    // Their rosters were synced before they registered — no Sleeper call needed
    // to link them.
    mockFn(prisma.roster.findMany).mockResolvedValue([
      { id: "roster-a" },
      { id: "roster-b" },
    ]);
    mocks.getUserLeagues.mockResolvedValue([]);

    const result = await ensureLeagueMembership("user-1");

    expect(prisma.teamMember.createMany).toHaveBeenCalledWith({
      data: [
        { userId: "user-1", rosterId: "roster-a", role: "OWNER" },
        { userId: "user-1", rosterId: "roster-b", role: "OWNER" },
      ],
      skipDuplicates: true,
    });
    expect(result.status).toBe("linked");
  });

  it("always re-syncs the current league from Sleeper (stale partial snapshot heals regardless of cron timing)", async () => {
    // The DB may hold a mid-renewal snapshot without this user's roster; the
    // guarantee is that discovery of a current league ALWAYS triggers a fresh
    // roster sync rather than trusting the local rows.
    mockFn(prisma.roster.findMany).mockResolvedValue([{ id: "roster-old" }]);
    mocks.getUserLeagues.mockImplementation(async (_id: string, year: number) =>
      year === CURRENT ? [E_PLURIBUS] : []
    );

    await ensureLeagueMembership("user-1");

    expect(mocks.syncLeagueFast).toHaveBeenCalledTimes(1);
    expect(mocks.syncLeagueFast).toHaveBeenCalledWith("sl-2026");
  });

  it("is idempotent — rerunning produces the same result with duplicate-safe writes", async () => {
    mockFn(prisma.roster.findMany).mockResolvedValue([{ id: "roster-a" }]);
    mocks.getUserLeagues.mockImplementation(async (_id: string, year: number) =>
      year === CURRENT ? [E_PLURIBUS] : []
    );

    const first = await ensureLeagueMembership("user-1");
    const second = await ensureLeagueMembership("user-1");

    expect(first).toEqual(second);
    for (const call of mockFn(prisma.teamMember.createMany).mock.calls) {
      expect(call[0].skipDuplicates).toBe(true);
    }
  });

  it("reports not_in_league only when Sleeper answered and no E Pluribus league exists", async () => {
    mockFn(prisma.league.findFirst).mockResolvedValue(null);
    mocks.getUserLeagues.mockResolvedValue([OTHER_LEAGUE]);

    const result = await ensureLeagueMembership("user-1");
    expect(result).toEqual({ status: "not_in_league" });
  });

  it("throws (retryable) when Sleeper is down and no league could be made visible", async () => {
    mockFn(prisma.league.findFirst).mockResolvedValue(null);
    mocks.getUserLeagues.mockRejectedValue(new Error("Sleeper API error: 503"));

    await expect(ensureLeagueMembership("user-1")).rejects.toThrow(
      "Sleeper API error: 503"
    );
  });

  it("throws (retryable) when the league sync itself fails and nothing is visible", async () => {
    mockFn(prisma.league.findFirst).mockResolvedValue(null);
    mocks.getUserLeagues.mockImplementation(async (_id: string, year: number) =>
      year === CURRENT ? [E_PLURIBUS] : []
    );
    mocks.syncLeagueFast.mockRejectedValue(new Error("sync exploded"));

    await expect(ensureLeagueMembership("user-1")).rejects.toThrow(
      "sync exploded"
    );
  });

  it("still links from the DB when Sleeper is down but historical membership exists", async () => {
    // Sleeper outage must not mask a league the user can already see.
    mocks.getUserLeagues.mockRejectedValue(new Error("timeout"));
    mockFn(prisma.roster.findMany).mockResolvedValue([{ id: "roster-a" }]);

    const result = await ensureLeagueMembership("user-1");
    expect(result.status).toBe("linked");
  });

  it("does not fail membership when only the keeper-plan carryover fails", async () => {
    mocks.getUserLeagues.mockImplementation(async (_id: string, year: number) =>
      year === CURRENT ? [E_PLURIBUS] : []
    );
    mocks.carryOverKeeperPlans.mockRejectedValue(new Error("carryover failed"));

    const result = await ensureLeagueMembership("user-1");
    expect(result.status).toBe("linked");
  });

  it("throws when the user does not exist", async () => {
    mockFn(prisma.user.findUnique).mockResolvedValue(null);
    await expect(ensureLeagueMembership("ghost")).rejects.toThrow(
      "User not found"
    );
  });
});
