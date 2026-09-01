import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: { league: { findUnique: vi.fn() } },
}));

import { prisma } from "@/lib/prisma";
import { getPlanningSeasonForLeague } from "./planning-season-db";
import { getKeeperPlanningSeason } from "@/lib/constants/keeper-rules";

const findUnique = prisma.league.findUnique as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => vi.clearAllMocks());

describe("getPlanningSeasonForLeague", () => {
  it("reads season + status for the league and resolves from them", async () => {
    findUnique.mockResolvedValue({ season: 2026, status: "PRE_DRAFT" });
    await expect(getPlanningSeasonForLeague("league-1")).resolves.toBe(2026);
    expect(findUnique).toHaveBeenCalledWith({
      where: { id: "league-1" },
      select: { season: true, status: true },
    });
  });

  it("falls back to the calendar rule for an unknown league", async () => {
    findUnique.mockResolvedValue(null);
    await expect(getPlanningSeasonForLeague("missing")).resolves.toBe(getKeeperPlanningSeason());
  });
});
