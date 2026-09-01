import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    keeper: { findMany: vi.fn(), deleteMany: vi.fn() },
    auditLog: { createMany: vi.fn() },
    $transaction: vi.fn(async (ops: Promise<unknown>[]) => Promise.all(ops)),
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { prisma } from "@/lib/prisma";
import {
  KEEPER_PRUNE_AUDIT_ACTION,
  prunableKeeperSeason,
  pruneKeepersForDepartedPlayers,
} from "./keeper-prune";

function mockFn<T>(fn: T): ReturnType<typeof vi.fn> {
  return fn as ReturnType<typeof vi.fn>;
}

const STALE_KEEPER = {
  id: "k-harrison",
  rosterId: "r-keysesh",
  playerId: "p-harrison",
  season: 2026,
  type: "REGULAR",
  baseCost: 2,
  finalCost: 2,
  yearsKept: 2,
  acquisitionType: "DRAFTED",
  isLocked: false,
  notes: null,
  player: { sleeperId: "11628", fullName: "Marvin Harrison" },
  roster: { teamName: "Jackson Off My DK" },
};

beforeEach(() => {
  vi.clearAllMocks();
  mockFn(prisma.keeper.findMany).mockResolvedValue([]);
  mockFn(prisma.keeper.deleteMany).mockResolvedValue({ count: 0 });
  mockFn(prisma.auditLog.createMany).mockResolvedValue({ count: 0 });
});

describe("prunableKeeperSeason", () => {
  it("targets this season's plans while the draft is pending", () => {
    expect(prunableKeeperSeason({ season: 2026, status: "PRE_DRAFT" })).toBe(2026);
  });

  it("targets next season's plans during the season", () => {
    expect(prunableKeeperSeason({ season: 2026, status: "IN_SEASON" })).toBe(2027);
  });

  it("never touches a league that is drafting or complete (history is frozen)", () => {
    expect(prunableKeeperSeason({ season: 2026, status: "DRAFTING" })).toBeNull();
    expect(prunableKeeperSeason({ season: 2025, status: "COMPLETE" })).toBeNull();
    expect(prunableKeeperSeason({ season: 2025, status: null })).toBeNull();
  });
});

describe("pruneKeepersForDepartedPlayers", () => {
  it("removes and audit-logs plans for players who left the roster", async () => {
    mockFn(prisma.keeper.findMany).mockResolvedValue([STALE_KEEPER]);

    const result = await pruneKeepersForDepartedPlayers({
      rosterId: "r-keysesh",
      league: { season: 2026, status: "PRE_DRAFT" },
      currentPlayerIds: ["p-pickens", "p-lamar"],
    });

    expect(result.removed).toBe(1);
    expect(prisma.keeper.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          rosterId: "r-keysesh",
          season: 2026,
          playerId: { notIn: ["p-pickens", "p-lamar"] },
        },
      })
    );
    expect(prisma.keeper.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ["k-harrison"] } },
    });

    const audit = mockFn(prisma.auditLog.createMany).mock.calls[0][0];
    expect(audit.data).toHaveLength(1);
    expect(audit.data[0]).toMatchObject({
      userId: null,
      action: KEEPER_PRUNE_AUDIT_ACTION,
      entity: "Keeper",
      entityId: "k-harrison",
      oldValue: expect.objectContaining({
        playerName: "Marvin Harrison",
        rosterName: "Jackson Off My DK",
        type: "REGULAR",
        season: 2026,
      }),
    });
    // Audit + delete run atomically
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it("is a no-op when every planned player is still rostered", async () => {
    const result = await pruneKeepersForDepartedPlayers({
      rosterId: "r-1",
      league: { season: 2026, status: "PRE_DRAFT" },
      currentPlayerIds: ["p-1"],
    });
    expect(result.removed).toBe(0);
    expect(prisma.keeper.deleteMany).not.toHaveBeenCalled();
    expect(prisma.auditLog.createMany).not.toHaveBeenCalled();
  });

  it("FAIL-SAFE: never prunes off an empty roster read", async () => {
    const result = await pruneKeepersForDepartedPlayers({
      rosterId: "r-1",
      league: { season: 2026, status: "PRE_DRAFT" },
      currentPlayerIds: [],
    });
    expect(result.removed).toBe(0);
    expect(prisma.keeper.findMany).not.toHaveBeenCalled();
  });

  it("never touches keeper history on a completed or drafting league", async () => {
    for (const status of ["COMPLETE", "DRAFTING"]) {
      const result = await pruneKeepersForDepartedPlayers({
        rosterId: "r-1",
        league: { season: 2025, status },
        currentPlayerIds: ["p-1"],
      });
      expect(result.removed).toBe(0);
    }
    expect(prisma.keeper.findMany).not.toHaveBeenCalled();
  });
});
