import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    playerAcquisition: { upsert: vi.fn(), findFirst: vi.fn(), update: vi.fn(), create: vi.fn() },
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { prisma } from "@/lib/prisma";
import { upsertAcquisition } from "./sync";

const upsert = prisma.playerAcquisition.upsert as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  upsert.mockResolvedValue({});
});

const BASE = {
  playerId: "p-penix",
  ownerSleeperId: "337664",
  leagueId: "league-2024",
  season: 2024,
  acquisitionType: "WAIVER",
  acquisitionDate: new Date("2024-12-18T15:00:00Z"),
  sleeperTransactionId: "tx-1",
};

describe("upsertAcquisition", () => {
  it("REGRESSION: keys on the full unique tuple, including acquisitionDate", async () => {
    // Production has 161 (player, owner, season) groups with 2+ acquisitions
    // (draft → drop → re-claim, etc). Matching on the season alone and moving
    // the date collided with the sibling row and aborted the chain rebuild.
    await upsertAcquisition(BASE);

    expect(upsert).toHaveBeenCalledTimes(1);
    const args = upsert.mock.calls[0][0];
    expect(args.where).toEqual({
      playerId_ownerSleeperId_season_acquisitionDate: {
        playerId: "p-penix",
        ownerSleeperId: "337664",
        season: 2024,
        acquisitionDate: new Date("2024-12-18T15:00:00Z"),
      },
    });
    // No pre-lookup by the partial key, no bare update
    expect(prisma.playerAcquisition.findFirst).not.toHaveBeenCalled();
    expect(prisma.playerAcquisition.update).not.toHaveBeenCalled();
  });

  it("never overwrites baseCostOverride, and re-opens the row for the replay to close", async () => {
    await upsertAcquisition({ ...BASE, notes: "re-claimed" });

    const { update, create } = upsert.mock.calls[0][0];
    expect(update).not.toHaveProperty("baseCostOverride");
    expect(create).not.toHaveProperty("baseCostOverride");
    // Dispositions are derived by the chronological replay, never carried over
    expect(update).toMatchObject({ dispositionType: null, dispositionDate: null });
    expect(create).not.toHaveProperty("dispositionType");
    expect(update).toMatchObject({ acquisitionType: "WAIVER", notes: "re-claimed", leagueId: "league-2024" });
  });

  it("leaves unspecified optional fields alone on update but null on create", async () => {
    await upsertAcquisition(BASE);

    const { update, create } = upsert.mock.calls[0][0];
    expect(update.originalDraftRound).toBeUndefined();
    expect(update.fromOwnerSleeperId).toBeUndefined();
    expect(create).toMatchObject({
      playerId: "p-penix",
      ownerSleeperId: "337664",
      season: 2024,
      acquisitionType: "WAIVER",
      sleeperTransactionId: "tx-1",
    });
    expect(create.originalDraftRound).toBeUndefined();
  });

  it("treats a second acquisition of the same player by the same owner as its own row", async () => {
    await upsertAcquisition({ ...BASE, acquisitionType: "FREE_AGENT", acquisitionDate: new Date("2024-12-18T20:00:00Z") });
    await upsertAcquisition(BASE);

    const keys = upsert.mock.calls.map((c) => c[0].where.playerId_ownerSleeperId_season_acquisitionDate.acquisitionDate.toISOString());
    expect(keys).toEqual(["2024-12-18T20:00:00.000Z", "2024-12-18T15:00:00.000Z"]);
  });
});
