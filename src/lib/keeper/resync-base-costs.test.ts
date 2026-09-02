import { describe, it, expect, vi, beforeEach } from "vitest";
import { AcquisitionType } from "@prisma/client";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    draft: { findFirst: vi.fn() },
    keeper: { findMany: vi.fn(), update: vi.fn() },
    keeperSettings: { findFirst: vi.fn() },
    playerAcquisition: { findMany: vi.fn() },
  },
}));

vi.mock("./cascade", () => ({
  recalculateAndApplyCascade: vi.fn(async () => ({
    success: true,
    updatedCount: 0,
    errors: [],
  })),
}));

import { prisma } from "@/lib/prisma";
import { recalculateAndApplyCascade } from "./cascade";
import { resyncKeeperBaseCosts } from "./resync-base-costs";

/** One saved keeper priced R7, whom the engine now prices R8. */
function seedOneStaleKeeper() {
  vi.mocked(prisma.keeper.findMany).mockResolvedValue([
    {
      id: "keeper-1",
      playerId: "player-1",
      baseCost: 7,
      player: { fullName: "Kyle Monangai" },
      roster: { sleeperId: "owner-1", teamName: "Jackson Off My DK" },
    },
  ] as never);

  vi.mocked(prisma.keeperSettings.findFirst).mockResolvedValue({
    undraftedRound: 8,
    minimumRound: 1,
    costReductionPerYear: 1,
  } as never);

  // Undrafted claim made in 2025 → flat R8 the first time he is kept.
  vi.mocked(prisma.playerAcquisition.findMany).mockResolvedValue([
    {
      playerId: "player-1",
      ownerSleeperId: "owner-1",
      acquisitionType: AcquisitionType.WAIVER,
      acquisitionDate: new Date("2025-12-02"),
      season: 2025,
      originalDraftRound: null,
      originalDraftSeason: null,
      isPreDeadline: false,
      baseCostOverride: null,
    },
  ] as never);
}

describe("resyncKeeperBaseCosts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    seedOneStaleKeeper();
  });

  it("writes the corrected price and re-runs the cascade", async () => {
    vi.mocked(prisma.draft.findFirst).mockResolvedValue(null as never);

    const result = await resyncKeeperBaseCosts("league-1", 2026, { apply: true });

    expect(result.changes).toHaveLength(1);
    expect(result.changes[0]).toMatchObject({ from: 7, to: 8 });
    expect(result.written).toBe(1);
    expect(prisma.keeper.update).toHaveBeenCalledWith({
      where: { id: "keeper-1" },
      data: { baseCost: 8 },
    });
    expect(recalculateAndApplyCascade).toHaveBeenCalledWith("league-1", 2026);
  });

  it("reports without writing in dry-run mode", async () => {
    vi.mocked(prisma.draft.findFirst).mockResolvedValue(null as never);

    const result = await resyncKeeperBaseCosts("league-1", 2026, { apply: false });

    expect(result.changes).toHaveLength(1);
    expect(result.written).toBe(0);
    expect(prisma.keeper.update).not.toHaveBeenCalled();
    expect(recalculateAndApplyCascade).not.toHaveBeenCalled();
  });

  // The guard that matters: a completed season's rows record what was actually
  // drafted. An earlier version of this ran the write inside the compute loop
  // and only checked the draft afterwards, so it printed "refusing to write"
  // having already overwritten five rows of the 2025 season.
  it("refuses to write a season whose draft is already complete", async () => {
    vi.mocked(prisma.draft.findFirst).mockResolvedValue({ id: "draft-2025" } as never);

    const result = await resyncKeeperBaseCosts("league-1", 2025, { apply: true });

    expect(result.skipped).toBe("draft-complete");
    expect(result.written).toBe(0);
    expect(prisma.keeper.update).not.toHaveBeenCalled();
    expect(recalculateAndApplyCascade).not.toHaveBeenCalled();
  });

  it("still reports the differences it refused to write, as a diagnostic", async () => {
    vi.mocked(prisma.draft.findFirst).mockResolvedValue({ id: "draft-2025" } as never);

    const result = await resyncKeeperBaseCosts("league-1", 2025, { apply: true });

    expect(result.changes).toHaveLength(1);
    expect(result.changes[0]).toMatchObject({ from: 7, to: 8 });
  });

  it("writes a completed season only when explicitly allowed", async () => {
    vi.mocked(prisma.draft.findFirst).mockResolvedValue({ id: "draft-2025" } as never);

    const result = await resyncKeeperBaseCosts("league-1", 2025, {
      apply: true,
      allowCompletedDraft: true,
    });

    expect(result.skipped).toBeUndefined();
    expect(result.written).toBe(1);
    expect(prisma.keeper.update).toHaveBeenCalledTimes(1);
  });

  it("does nothing when there are no keepers", async () => {
    vi.mocked(prisma.draft.findFirst).mockResolvedValue(null as never);
    vi.mocked(prisma.keeper.findMany).mockResolvedValue([] as never);

    const result = await resyncKeeperBaseCosts("league-1", 2026, { apply: true });

    expect(result.skipped).toBe("no-keepers");
    expect(prisma.keeper.update).not.toHaveBeenCalled();
  });
});
