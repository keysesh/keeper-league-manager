import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock prisma before importing the module
vi.mock("@/lib/prisma", () => ({
  prisma: {
    league: {
      findUnique: vi.fn(),
    },
    roster: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    keeper: {
      findMany: vi.fn(),
      update: vi.fn(),
    },
    draftPick: {
      findFirst: vi.fn(),
    },
    transactionPlayer: {
      findFirst: vi.fn(),
    },
    player: {
      findUnique: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";
import {
  calculateCascade,
  recalculateAndApplyCascade,
  previewTeamCascade,
  KeeperInput,
} from "./cascade";

describe("Cascade Calculator", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("calculateCascade", () => {
    it("returns keepers without cascade when no conflicts", async () => {
      vi.mocked(prisma.league.findUnique).mockResolvedValue({
        id: "league-1",
        sleeperId: "sleeper-league-1",
        keeperSettings: {
          undraftedRound: 8,
          minimumRound: 1,
        },
        tradedPicks: [],
      } as any);

      vi.mocked(prisma.roster.findMany).mockResolvedValue([
        { id: "roster-1", sleeperId: "owner-1" },
      ] as any);

      // Mock calculateBaseCost dependencies
      vi.mocked(prisma.roster.findUnique).mockResolvedValue({
        id: "roster-1",
        sleeperId: "owner-1",
        leagueId: "league-1",
      } as any);

      vi.mocked(prisma.draftPick.findFirst).mockResolvedValue({
        playerId: "player-1",
        round: 5,
        draft: { season: 2025 },
      } as any);

      vi.mocked(prisma.transactionPlayer.findFirst).mockResolvedValue(null);

      vi.mocked(prisma.player.findUnique).mockResolvedValue({
        id: "player-1",
        sleeperId: "sleeper-player-1",
      } as any);

      const keepers: KeeperInput[] = [
        {
          playerId: "player-1",
          rosterId: "roster-1",
          playerName: "Player One",
          type: "REGULAR",
        },
      ];

      const result = await calculateCascade("league-1", keepers, 2026);

      expect(result.hasErrors).toBe(false);
      expect(result.keepers).toHaveLength(1);
      expect(result.keepers[0].isCascaded).toBe(false);
      expect(result.keepers[0].baseCost).toBe(result.keepers[0].finalCost);
    });

    it("cascades UP toward better rounds when there is a conflict", async () => {
      vi.mocked(prisma.league.findUnique).mockResolvedValue({
        id: "league-1",
        keeperSettings: {
          undraftedRound: 8,
          minimumRound: 1,
        },
        tradedPicks: [],
      } as any);

      vi.mocked(prisma.roster.findMany).mockResolvedValue([
        { id: "roster-1", sleeperId: "owner-1" },
      ] as any);

      vi.mocked(prisma.roster.findUnique).mockResolvedValue({
        id: "roster-1",
        sleeperId: "owner-1",
        leagueId: "league-1",
      } as any);

      // Both players have same base cost (round 5)
      vi.mocked(prisma.draftPick.findFirst).mockResolvedValue({
        round: 5,
        draft: { season: 2025 },
      } as any);

      vi.mocked(prisma.transactionPlayer.findFirst).mockResolvedValue(null);

      vi.mocked(prisma.player.findUnique).mockResolvedValue({
        id: "player-1",
        sleeperId: "sleeper-player-1",
      } as any);

      const keepers: KeeperInput[] = [
        {
          playerId: "player-1",
          rosterId: "roster-1",
          playerName: "Player One",
          type: "REGULAR",
        },
        {
          playerId: "player-2",
          rosterId: "roster-1",
          playerName: "Player Two",
          type: "REGULAR",
        },
      ];

      const result = await calculateCascade("league-1", keepers, 2026);

      expect(result.hasErrors).toBe(false);
      // One keeper should have cascaded UP (lower round number = better)
      const cascadedKeeper = result.keepers.find((k) => k.isCascaded);
      const nonCascadedKeeper = result.keepers.find((k) => !k.isCascaded);

      expect(cascadedKeeper).toBeDefined();
      expect(nonCascadedKeeper).toBeDefined();
      // Cascade goes UP: from round 5 to round 4
      expect(cascadedKeeper!.finalCost).toBeLessThan(cascadedKeeper!.baseCost);
    });

    it("tracks conflicts correctly", async () => {
      vi.mocked(prisma.league.findUnique).mockResolvedValue({
        id: "league-1",
        keeperSettings: {
          undraftedRound: 8,
          minimumRound: 1,
        },
        tradedPicks: [],
      } as any);

      vi.mocked(prisma.roster.findMany).mockResolvedValue([
        { id: "roster-1", sleeperId: "owner-1" },
      ] as any);

      vi.mocked(prisma.roster.findUnique).mockResolvedValue({
        id: "roster-1",
        sleeperId: "owner-1",
        leagueId: "league-1",
      } as any);

      // Three players all with round 8 cost
      vi.mocked(prisma.draftPick.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.transactionPlayer.findFirst).mockResolvedValue({
        transaction: { type: "WAIVER", createdAt: new Date("2025-10-01") },
      } as any);

      vi.mocked(prisma.player.findUnique).mockResolvedValue({
        id: "player-1",
        sleeperId: "sleeper-player-1",
      } as any);

      const keepers: KeeperInput[] = [
        { playerId: "player-1", rosterId: "roster-1", playerName: "Player One", type: "REGULAR" },
        { playerId: "player-2", rosterId: "roster-1", playerName: "Player Two", type: "REGULAR" },
        { playerId: "player-3", rosterId: "roster-1", playerName: "Player Three", type: "REGULAR" },
      ];

      const result = await calculateCascade("league-1", keepers, 2026);

      // Should have conflicts recorded
      expect(result.conflicts.length).toBeGreaterThan(0);
      // At least 2 keepers should be cascaded
      const cascadedCount = result.keepers.filter((k) => k.isCascaded).length;
      expect(cascadedCount).toBeGreaterThanOrEqual(2);
    });

    it("handles traded picks by marking rounds as unavailable", async () => {
      vi.mocked(prisma.league.findUnique).mockResolvedValue({
        id: "league-1",
        keeperSettings: {
          undraftedRound: 8,
          minimumRound: 1,
        },
        tradedPicks: [
          { round: 5, originalOwnerId: "owner-1", currentOwnerId: "owner-2" },
        ],
      } as any);

      vi.mocked(prisma.roster.findMany).mockResolvedValue([
        { id: "roster-1", sleeperId: "owner-1" },
        { id: "roster-2", sleeperId: "owner-2" },
      ] as any);

      vi.mocked(prisma.roster.findUnique).mockResolvedValue({
        id: "roster-1",
        sleeperId: "owner-1",
        leagueId: "league-1",
      } as any);

      // Player drafted in round 5
      vi.mocked(prisma.draftPick.findFirst).mockResolvedValue({
        round: 5,
        draft: { season: 2025 },
      } as any);

      vi.mocked(prisma.transactionPlayer.findFirst).mockResolvedValue(null);

      vi.mocked(prisma.player.findUnique).mockResolvedValue({
        id: "player-1",
        sleeperId: "sleeper-player-1",
      } as any);

      const keepers: KeeperInput[] = [
        { playerId: "player-1", rosterId: "roster-1", playerName: "Player One", type: "REGULAR" },
      ];

      const result = await calculateCascade("league-1", keepers, 2026);

      // Should cascade because round 5 was traded away
      const keeper = result.keepers[0];
      expect(keeper.baseCost).toBe(5);
      expect(keeper.finalCost).not.toBe(5); // Must cascade away from traded round
      expect(keeper.conflictsWith).toContain("Round 5 traded away");
    });

    it("returns error when league not found", async () => {
      vi.mocked(prisma.league.findUnique).mockResolvedValue(null);

      const result = await calculateCascade("nonexistent", [], 2026);

      expect(result.hasErrors).toBe(true);
      expect(result.errors).toContain("League not found");
    });
  });

  describe("recalculateAndApplyCascade", () => {
    it("updates keeper finalCost when cascade changes", async () => {
      vi.mocked(prisma.keeper.findMany).mockResolvedValue([
        {
          id: "keeper-1",
          playerId: "player-1",
          rosterId: "roster-1",
          finalCost: 5,
          type: "REGULAR",
          player: { fullName: "Player One" },
        },
      ] as any);

      vi.mocked(prisma.league.findUnique).mockResolvedValue({
        id: "league-1",
        keeperSettings: { undraftedRound: 8, minimumRound: 1 },
        tradedPicks: [],
      } as any);

      vi.mocked(prisma.roster.findMany).mockResolvedValue([
        { id: "roster-1", sleeperId: "owner-1" },
      ] as any);

      vi.mocked(prisma.roster.findUnique).mockResolvedValue({
        id: "roster-1",
        sleeperId: "owner-1",
        leagueId: "league-1",
      } as any);

      vi.mocked(prisma.draftPick.findFirst).mockResolvedValue({
        round: 5,
        draft: { season: 2025 },
      } as any);

      vi.mocked(prisma.transactionPlayer.findFirst).mockResolvedValue(null);

      vi.mocked(prisma.player.findUnique).mockResolvedValue({
        id: "player-1",
        sleeperId: "sleeper-player-1",
      } as any);

      vi.mocked(prisma.keeper.update).mockResolvedValue({} as any);

      const result = await recalculateAndApplyCascade("league-1", 2026);

      expect(result.success).toBe(true);
    });

    it("returns empty result when no keepers exist", async () => {
      vi.mocked(prisma.keeper.findMany).mockResolvedValue([]);

      const result = await recalculateAndApplyCascade("league-1", 2026);

      expect(result.success).toBe(true);
      expect(result.updatedCount).toBe(0);
    });
  });

  describe("previewTeamCascade", () => {
    it("previews cascade for a single team", async () => {
      vi.mocked(prisma.roster.findUnique).mockResolvedValue({
        id: "roster-1",
        sleeperId: "owner-1",
        leagueId: "league-1",
        league: {
          keeperSettings: { undraftedRound: 8, minimumRound: 1 },
        },
        keepers: [
          {
            playerId: "player-1",
            rosterId: "roster-1",
            type: "REGULAR",
            player: { fullName: "Player One" },
          },
        ],
      } as any);

      vi.mocked(prisma.league.findUnique).mockResolvedValue({
        id: "league-1",
        keeperSettings: { undraftedRound: 8, minimumRound: 1 },
        tradedPicks: [],
      } as any);

      vi.mocked(prisma.roster.findMany).mockResolvedValue([
        { id: "roster-1", sleeperId: "owner-1" },
      ] as any);

      vi.mocked(prisma.draftPick.findFirst).mockResolvedValue({
        round: 3,
        draft: { season: 2025 },
      } as any);

      vi.mocked(prisma.transactionPlayer.findFirst).mockResolvedValue(null);

      vi.mocked(prisma.player.findUnique).mockResolvedValue({
        id: "player-1",
        sleeperId: "sleeper-player-1",
      } as any);

      const result = await previewTeamCascade("roster-1", 2026);

      expect(result.hasErrors).toBe(false);
      expect(result.keepers).toHaveLength(1);
    });

    it("returns error when roster not found", async () => {
      vi.mocked(prisma.roster.findUnique).mockResolvedValue(null);

      const result = await previewTeamCascade("nonexistent", 2026);

      expect(result.hasErrors).toBe(true);
      expect(result.errors).toContain("Roster not found");
    });
  });
});
