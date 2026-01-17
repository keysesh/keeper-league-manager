import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { KeeperType } from "@prisma/client";

// Mock prisma before importing the module
vi.mock("@/lib/prisma", () => ({
  prisma: {
    league: {
      findUnique: vi.fn(),
    },
    player: {
      findUnique: vi.fn(),
    },
    keeper: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";
import {
  calculateKeeperProjections,
  calculateRosterProjections,
  calculateLeagueProjectionsSummary,
} from "./projections";

describe("Keeper Projections", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("calculateKeeperProjections", () => {
    it("calculates projections for a player with multi-year trajectory", async () => {
      vi.mocked(prisma.league.findUnique).mockResolvedValue({
        id: "league-1",
        keeperSettings: {
          regularKeeperMaxYears: 2,
          minimumRound: 1,
          costReductionPerYear: 1,
          undraftedRound: 8,
        },
      } as any);

      vi.mocked(prisma.player.findUnique).mockResolvedValue({
        id: "player-1",
        fullName: "Test Player",
        position: "WR",
        team: "LAR",
      } as any);

      // Current keeper at round 5
      vi.mocked(prisma.keeper.findFirst).mockResolvedValue({
        id: "keeper-1",
        playerId: "player-1",
        rosterId: "roster-1",
        season: 2026,
        finalCost: 5,
      } as any);

      // No previous keeper history (year 1)
      vi.mocked(prisma.keeper.findMany).mockResolvedValue([]);

      const result = await calculateKeeperProjections(
        "player-1",
        "roster-1",
        "league-1",
        2026,
        3 // project 3 years
      );

      expect(result.playerId).toBe("player-1");
      expect(result.playerName).toBe("Test Player");
      expect(result.position).toBe("WR");
      expect(result.team).toBe("LAR");
      expect(result.currentCost).toBe(5);
      expect(result.projections).toHaveLength(3);

      // Year 1: Round 5
      expect(result.projections[0].season).toBe(2026);
      expect(result.projections[0].cost).toBe(5);
      expect(result.projections[0].type).toBe("REGULAR");

      // Year 2: Round 4 (cost improves)
      expect(result.projections[1].season).toBe(2027);
      expect(result.projections[1].cost).toBe(4);

      // Year 3: Round 3 (cost improves again)
      expect(result.projections[2].season).toBe(2028);
      expect(result.projections[2].cost).toBe(3);
    });

    it("marks player as FRANCHISE_ONLY when at max years", async () => {
      vi.mocked(prisma.league.findUnique).mockResolvedValue({
        id: "league-1",
        keeperSettings: {
          regularKeeperMaxYears: 2,
          minimumRound: 1,
          costReductionPerYear: 1,
          undraftedRound: 8,
        },
      } as any);

      vi.mocked(prisma.player.findUnique).mockResolvedValue({
        id: "player-1",
        fullName: "Test Player",
        position: "RB",
        team: "NYG",
      } as any);

      vi.mocked(prisma.keeper.findFirst).mockResolvedValue({
        id: "keeper-1",
        finalCost: 3,
      } as any);

      // Player has been kept 1 year already
      vi.mocked(prisma.keeper.findMany).mockResolvedValue([
        { season: 2025 },
      ] as any);

      const result = await calculateKeeperProjections(
        "player-1",
        "roster-1",
        "league-1",
        2026,
        3
      );

      // Year 2 of 2: regular keeper, final year
      expect(result.projections[0].type).toBe("FRANCHISE_ONLY");
      expect(result.projections[0].reason).toContain("Final year");

      // Year 3+: INELIGIBLE (past max years)
      expect(result.projections[1].type).toBe("INELIGIBLE");
      expect(result.projections[2].type).toBe("INELIGIBLE");
    });

    it("respects minimum round floor in projections", async () => {
      vi.mocked(prisma.league.findUnique).mockResolvedValue({
        id: "league-1",
        keeperSettings: {
          regularKeeperMaxYears: 5,
          minimumRound: 1,
          costReductionPerYear: 1,
          undraftedRound: 8,
        },
      } as any);

      vi.mocked(prisma.player.findUnique).mockResolvedValue({
        id: "player-1",
        fullName: "Test Player",
        position: "QB",
        team: "BUF",
      } as any);

      vi.mocked(prisma.keeper.findFirst).mockResolvedValue({
        id: "keeper-1",
        finalCost: 2, // Already at round 2
      } as any);

      // Player in year 2
      vi.mocked(prisma.keeper.findMany).mockResolvedValue([
        { season: 2025 },
      ] as any);

      const result = await calculateKeeperProjections(
        "player-1",
        "roster-1",
        "league-1",
        2026,
        3
      );

      // Year 2: Round 2
      expect(result.projections[0].cost).toBe(2);

      // Year 3: Round 1 (can't go lower)
      expect(result.projections[1].cost).toBe(1);

      // Year 4: Still Round 1 (minimum floor)
      expect(result.projections[2].cost).toBe(1);
    });

    it("determines value trajectory correctly", async () => {
      vi.mocked(prisma.league.findUnique).mockResolvedValue({
        id: "league-1",
        keeperSettings: {
          regularKeeperMaxYears: 3,
          minimumRound: 1,
          costReductionPerYear: 1,
          undraftedRound: 8,
        },
      } as any);

      vi.mocked(prisma.player.findUnique).mockResolvedValue({
        id: "player-1",
        fullName: "Test Player",
        position: "TE",
        team: "KC",
      } as any);

      vi.mocked(prisma.keeper.findFirst).mockResolvedValue({
        finalCost: 6,
      } as any);

      // Year 1
      vi.mocked(prisma.keeper.findMany).mockResolvedValue([]);

      const result = await calculateKeeperProjections(
        "player-1",
        "roster-1",
        "league-1",
        2026,
        3
      );

      // Cost > minimumRound = IMPROVING trajectory
      expect(result.valueTrajectory).toBe("IMPROVING");
    });

    it("marks trajectory as EXPIRING when near max years", async () => {
      vi.mocked(prisma.league.findUnique).mockResolvedValue({
        id: "league-1",
        keeperSettings: {
          regularKeeperMaxYears: 2,
          minimumRound: 1,
          costReductionPerYear: 1,
          undraftedRound: 8,
        },
      } as any);

      vi.mocked(prisma.player.findUnique).mockResolvedValue({
        id: "player-1",
        fullName: "Test Player",
        position: "WR",
        team: "SF",
      } as any);

      vi.mocked(prisma.keeper.findFirst).mockResolvedValue({
        finalCost: 1,
      } as any);

      // Year 2 of 2
      vi.mocked(prisma.keeper.findMany).mockResolvedValue([
        { season: 2025 },
      ] as any);

      const result = await calculateKeeperProjections(
        "player-1",
        "roster-1",
        "league-1",
        2026,
        3
      );

      expect(result.valueTrajectory).toBe("EXPIRING");
    });
  });

  describe("calculateRosterProjections", () => {
    it("calculates projections for all keepers on a roster", async () => {
      vi.mocked(prisma.keeper.findMany)
        .mockResolvedValueOnce([
          { playerId: "player-1", player: { fullName: "Player 1" } },
          { playerId: "player-2", player: { fullName: "Player 2" } },
        ] as any)
        .mockResolvedValue([] as any); // For subsequent calls

      vi.mocked(prisma.league.findUnique).mockResolvedValue({
        id: "league-1",
        keeperSettings: {
          regularKeeperMaxYears: 2,
          minimumRound: 1,
          costReductionPerYear: 1,
          undraftedRound: 8,
        },
      } as any);

      vi.mocked(prisma.player.findUnique).mockResolvedValue({
        id: "player-1",
        fullName: "Test Player",
        position: "RB",
        team: "DAL",
      } as any);

      vi.mocked(prisma.keeper.findFirst).mockResolvedValue({
        finalCost: 4,
      } as any);

      const result = await calculateRosterProjections(
        "roster-1",
        "league-1",
        2026,
        2
      );

      expect(result).toHaveLength(2);
      expect(result[0].projections).toHaveLength(2);
      expect(result[1].projections).toHaveLength(2);
    });
  });

  describe("calculateLeagueProjectionsSummary", () => {
    it("calculates league-wide summary statistics", async () => {
      // With maxYears = 2:
      // - yearsKept: 0 - not expiring
      // - yearsKept: 1 - expiring next season (maxYears - 1)
      // - yearsKept: 2 - expiring this season (>= maxYears)
      // - yearsKept: 3 - expiring this season (>= maxYears)
      vi.mocked(prisma.keeper.findMany).mockResolvedValue([
        {
          type: KeeperType.REGULAR,
          yearsKept: 0, // Not expiring
          finalCost: 3,
          player: { position: "WR" },
        },
        {
          type: KeeperType.REGULAR,
          yearsKept: 2, // At max years = expiring this season
          finalCost: 5,
          player: { position: "RB" },
        },
        {
          type: KeeperType.FRANCHISE,
          yearsKept: 3, // Past max years = expiring this season
          finalCost: 1,
          player: { position: "QB" },
        },
        {
          type: KeeperType.REGULAR,
          yearsKept: 1, // 1 = maxYears - 1 = expiring next season
          finalCost: 7,
          player: { position: "WR" },
        },
      ] as any);

      vi.mocked(prisma.league.findUnique).mockResolvedValue({
        id: "league-1",
        keeperSettings: {
          regularKeeperMaxYears: 2,
        },
      } as any);

      const result = await calculateLeagueProjectionsSummary("league-1", 2026);

      expect(result.totalKeepers).toBe(4);
      expect(result.franchiseTagsUsed).toBe(1);
      expect(result.expiringThisSeason).toBe(2); // yearsKept >= maxYears (2 and 3)
      expect(result.expiringNextSeason).toBe(1); // yearsKept === maxYears - 1 (only 1)
      expect(result.averageKeeperCost).toBe((3 + 5 + 1 + 7) / 4);
      expect(result.keepersByPosition["WR"]).toBe(2);
      expect(result.keepersByPosition["RB"]).toBe(1);
      expect(result.keepersByPosition["QB"]).toBe(1);
    });

    it("handles empty keeper list", async () => {
      vi.mocked(prisma.keeper.findMany).mockResolvedValue([]);

      vi.mocked(prisma.league.findUnique).mockResolvedValue({
        id: "league-1",
        keeperSettings: { regularKeeperMaxYears: 2 },
      } as any);

      const result = await calculateLeagueProjectionsSummary("league-1", 2026);

      expect(result.totalKeepers).toBe(0);
      expect(result.averageKeeperCost).toBe(0);
      expect(result.franchiseTagsUsed).toBe(0);
    });

    it("handles missing position gracefully", async () => {
      vi.mocked(prisma.keeper.findMany).mockResolvedValue([
        {
          type: KeeperType.REGULAR,
          yearsKept: 1,
          finalCost: 4,
          player: { position: null }, // No position
        },
      ] as any);

      vi.mocked(prisma.league.findUnique).mockResolvedValue({
        id: "league-1",
        keeperSettings: { regularKeeperMaxYears: 2 },
      } as any);

      const result = await calculateLeagueProjectionsSummary("league-1", 2026);

      expect(result.keepersByPosition["UNKNOWN"]).toBe(1);
    });
  });
});
