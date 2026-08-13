import { describe, it, expect, vi, beforeEach } from "vitest";
import { getKeeperPlanningSeason } from "@/lib/constants/keeper-rules";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    league: { findUnique: vi.fn(), findFirst: vi.fn() },
    roster: { findMany: vi.fn() },
    keeper: { createMany: vi.fn() },
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { prisma } from "@/lib/prisma";
import { carryOverKeeperPlans } from "./sync";

const PLANNING = getKeeperPlanningSeason();

const PLAN_FIELDS = {
  season: PLANNING,
  type: "REGULAR",
  baseCost: 5,
  finalCost: 5,
  yearsKept: 1,
  acquisitionType: "DRAFT",
  acquisitionDate: null,
  originalDraftRound: 5,
  baseCostOverride: null,
  acquisitionId: null,
  isLocked: false,
  notes: null,
};

function mockFn<T>(fn: T): ReturnType<typeof vi.fn> {
  return fn as ReturnType<typeof vi.fn>;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockFn(prisma.league.findUnique).mockResolvedValue({
    id: "new-league",
    previousLeagueId: "sleeper-prev",
  });
  mockFn(prisma.league.findFirst).mockResolvedValue({ id: "prev-league" });
  mockFn(prisma.keeper.createMany).mockResolvedValue({ count: 0 });
});

describe("carryOverKeeperPlans", () => {
  it("copies plans to the matching new roster with duplicate-safe writes", async () => {
    mockFn(prisma.roster.findMany).mockImplementation(
      async (args: { where: { leagueId: string } }) =>
        args.where.leagueId === "new-league"
          ? [{ id: "new-r1", sleeperId: "owner-1", _count: { keepers: 0 } }]
          : [
              {
                id: "prev-r1",
                sleeperId: "owner-1",
                keepers: [{ playerId: "p1", ...PLAN_FIELDS }],
              },
            ]
    );

    const result = await carryOverKeeperPlans("new-league");

    expect(result.carried).toBe(1);
    expect(prisma.keeper.createMany).toHaveBeenCalledTimes(1);
    const call = mockFn(prisma.keeper.createMany).mock.calls[0][0];
    expect(call.skipDuplicates).toBe(true);
    expect(call.data[0]).toMatchObject({ rosterId: "new-r1", playerId: "p1" });
  });

  it("never overwrites plans already made on the new league's roster", async () => {
    mockFn(prisma.roster.findMany).mockImplementation(
      async (args: { where: { leagueId: string } }) =>
        args.where.leagueId === "new-league"
          ? [{ id: "new-r1", sleeperId: "owner-1", _count: { keepers: 2 } }]
          : [
              {
                id: "prev-r1",
                sleeperId: "owner-1",
                keepers: [{ playerId: "p1", ...PLAN_FIELDS }],
              },
            ]
    );

    const result = await carryOverKeeperPlans("new-league");

    expect(result.carried).toBe(0);
    expect(prisma.keeper.createMany).not.toHaveBeenCalled();
  });

  it("is a no-op when the league has no previous season", async () => {
    mockFn(prisma.league.findUnique).mockResolvedValue({
      id: "new-league",
      previousLeagueId: null,
    });

    const result = await carryOverKeeperPlans("new-league");
    expect(result.carried).toBe(0);
    expect(prisma.roster.findMany).not.toHaveBeenCalled();
  });

  it("is a no-op when the previous league is not in the database", async () => {
    mockFn(prisma.league.findFirst).mockResolvedValue(null);

    const result = await carryOverKeeperPlans("new-league");
    expect(result.carried).toBe(0);
    expect(prisma.keeper.createMany).not.toHaveBeenCalled();
  });
});
