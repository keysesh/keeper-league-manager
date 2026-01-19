import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { AcquisitionType, KeeperType } from "@prisma/client";

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
    player: {
      findUnique: vi.fn(),
    },
    keeper: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      count: vi.fn(),
    },
    draftPick: {
      findFirst: vi.fn(),
    },
    transactionPlayer: {
      findFirst: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";
import {
  calculateKeeperEligibility,
  calculateBaseCost,
  calculateKeeperCost,
  validateKeeperSelections,
} from "./calculator";

describe("Keeper Calculator", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default mock for keeper count - returns 0 (new keeper)
    vi.mocked(prisma.keeper.count).mockResolvedValue(0);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("calculateKeeperEligibility", () => {
    it("returns eligible for a first-year drafted player", async () => {
      // Mock league with settings
      vi.mocked(prisma.league.findUnique).mockResolvedValue({
        id: "league-1",
        sleeperId: "sleeper-league-1",
        name: "Test League",
        keeperSettings: {
          id: "settings-1",
          leagueId: "league-1",
          regularKeeperMaxYears: 2,
          undraftedRound: 8,
          minimumRound: 1,
          maxKeepers: 7,
          maxFranchiseTags: 1,
          maxRegularKeepers: 6,
          costReductionPerYear: 1,
        },
      } as any);

      // Mock roster lookup
      vi.mocked(prisma.roster.findUnique).mockResolvedValue({
        id: "roster-1",
        sleeperId: "sleeper-roster-1",
        leagueId: "league-1",
      } as any);

      // Mock roster list for mapping
      vi.mocked(prisma.roster.findMany).mockResolvedValue([
        { id: "roster-1", sleeperId: "sleeper-roster-1" },
      ] as any);

      // Mock player was drafted by this owner
      vi.mocked(prisma.draftPick.findFirst).mockResolvedValue({
        playerId: "player-1",
        rosterId: "roster-1",
        round: 3,
        draft: { season: 2025 },
        pickedAt: new Date("2025-08-15"),
      } as any);

      // Mock no transaction for this player
      vi.mocked(prisma.transactionPlayer.findFirst).mockResolvedValue(null);

      // Mock player record
      vi.mocked(prisma.player.findUnique).mockResolvedValue({
        id: "player-1",
        sleeperId: "sleeper-player-1",
        fullName: "Test Player",
      } as any);

      const result = await calculateKeeperEligibility(
        "player-1",
        "roster-1",
        "league-1",
        2026
      );

      expect(result.isEligible).toBe(true);
      expect(result.acquisitionType).toBe(AcquisitionType.DRAFTED);
      expect(result.atMaxYears).toBe(false);
    });

    it("marks player as atMaxYears when at max keeper years", async () => {
      // Mock league with maxYears = 2
      vi.mocked(prisma.league.findUnique).mockResolvedValue({
        id: "league-1",
        keeperSettings: {
          regularKeeperMaxYears: 2,
          undraftedRound: 8,
          minimumRound: 1,
        },
      } as any);

      vi.mocked(prisma.roster.findUnique).mockResolvedValue({
        id: "roster-1",
        sleeperId: "sleeper-roster-1",
        leagueId: "league-1",
      } as any);

      vi.mocked(prisma.roster.findMany).mockResolvedValue([
        { id: "roster-1", sleeperId: "sleeper-roster-1" },
      ] as any);

      // Player was drafted in 2023 (3 years ago for 2026 target)
      vi.mocked(prisma.draftPick.findFirst).mockResolvedValue({
        playerId: "player-1",
        rosterId: "roster-1",
        round: 5,
        draft: { season: 2023 },
      } as any);

      vi.mocked(prisma.transactionPlayer.findFirst).mockResolvedValue(null);

      vi.mocked(prisma.player.findUnique).mockResolvedValue({
        id: "player-1",
        sleeperId: "sleeper-player-1",
      } as any);

      const result = await calculateKeeperEligibility(
        "player-1",
        "roster-1",
        "league-1",
        2026
      );

      expect(result.atMaxYears).toBe(true);
      expect(result.reason).toContain("Franchise Tag only");
    });
  });

  describe("calculateBaseCost", () => {
    it("returns draft round for drafted players in year 1", async () => {
      vi.mocked(prisma.roster.findUnique).mockResolvedValue({
        id: "roster-1",
        sleeperId: "sleeper-roster-1",
        leagueId: "league-1",
      } as any);

      vi.mocked(prisma.roster.findMany).mockResolvedValue([
        { id: "roster-1", sleeperId: "sleeper-roster-1" },
      ] as any);

      // Drafted in round 3, season 2025
      vi.mocked(prisma.draftPick.findFirst).mockResolvedValue({
        playerId: "player-1",
        rosterId: "roster-1",
        round: 3,
        draft: { season: 2025 },
        pickedAt: new Date("2025-08-15"),
      } as any);

      vi.mocked(prisma.transactionPlayer.findFirst).mockResolvedValue(null);

      vi.mocked(prisma.player.findUnique).mockResolvedValue({
        id: "player-1",
        sleeperId: "sleeper-player-1",
      } as any);

      const cost = await calculateBaseCost(
        "player-1",
        "roster-1",
        2026, // Year 1 (0 years on roster)
        {
          undraftedRound: 8,
          minimumRound: 1,
          costReductionPerYear: 1,
        } as any
      );

      // Year 1: baseCost = draftRound (3), yearsOnRoster = 0, effectiveCost = 3 - 0 = 3
      expect(cost).toBe(3);
    });

    it("improves cost by 1 round for each year after year 1", async () => {
      vi.mocked(prisma.roster.findUnique).mockResolvedValue({
        id: "roster-1",
        sleeperId: "sleeper-roster-1",
        leagueId: "league-1",
      } as any);

      vi.mocked(prisma.roster.findMany).mockResolvedValue([
        { id: "roster-1", sleeperId: "sleeper-roster-1" },
      ] as any);

      // Drafted in round 5, season 2024
      vi.mocked(prisma.draftPick.findFirst).mockResolvedValue({
        playerId: "player-1",
        rosterId: "roster-1",
        round: 5,
        draft: { season: 2024 },
      } as any);

      vi.mocked(prisma.transactionPlayer.findFirst).mockResolvedValue(null);

      vi.mocked(prisma.player.findUnique).mockResolvedValue({
        id: "player-1",
        sleeperId: "sleeper-player-1",
      } as any);

      // Player was kept 1 time before (in 2025)
      vi.mocked(prisma.keeper.count).mockResolvedValue(1);

      const cost = await calculateBaseCost(
        "player-1",
        "roster-1",
        2026, // Year 2 (1 year on roster)
        {
          undraftedRound: 8,
          minimumRound: 1,
          costReductionPerYear: 1,
        } as any
      );

      // Year 2: baseCost = 5, totalKeeperYears = 1, effectiveCost = 5 - 1 = 4
      expect(cost).toBe(4);
    });

    it("returns undrafted round for waiver pickups", async () => {
      vi.mocked(prisma.roster.findUnique).mockResolvedValue({
        id: "roster-1",
        sleeperId: "sleeper-roster-1",
        leagueId: "league-1",
      } as any);

      vi.mocked(prisma.roster.findMany).mockResolvedValue([
        { id: "roster-1", sleeperId: "sleeper-roster-1" },
      ] as any);

      // No draft pick
      vi.mocked(prisma.draftPick.findFirst).mockResolvedValue(null);

      // Waiver pickup transaction
      vi.mocked(prisma.transactionPlayer.findFirst).mockResolvedValue({
        playerId: "player-1",
        toRosterId: "roster-1",
        transaction: {
          type: "WAIVER",
          createdAt: new Date("2025-10-01"),
        },
      } as any);

      vi.mocked(prisma.player.findUnique).mockResolvedValue({
        id: "player-1",
        sleeperId: "sleeper-player-1",
      } as any);

      const cost = await calculateBaseCost(
        "player-1",
        "roster-1",
        2026,
        {
          undraftedRound: 8,
          minimumRound: 1,
          costReductionPerYear: 1,
        } as any
      );

      expect(cost).toBe(8);
    });

    it("respects minimum round floor", async () => {
      vi.mocked(prisma.roster.findUnique).mockResolvedValue({
        id: "roster-1",
        sleeperId: "sleeper-roster-1",
        leagueId: "league-1",
      } as any);

      vi.mocked(prisma.roster.findMany).mockResolvedValue([
        { id: "roster-1", sleeperId: "sleeper-roster-1" },
      ] as any);

      // Drafted in round 2, season 2022 (4 years ago)
      vi.mocked(prisma.draftPick.findFirst).mockResolvedValue({
        playerId: "player-1",
        rosterId: "roster-1",
        round: 2,
        draft: { season: 2022 },
      } as any);

      vi.mocked(prisma.transactionPlayer.findFirst).mockResolvedValue(null);

      vi.mocked(prisma.player.findUnique).mockResolvedValue({
        id: "player-1",
        sleeperId: "sleeper-player-1",
      } as any);

      // Player was kept 3 times before (in 2023, 2024, 2025)
      vi.mocked(prisma.keeper.count).mockResolvedValue(3);

      const cost = await calculateBaseCost(
        "player-1",
        "roster-1",
        2026, // 3 years on roster
        {
          undraftedRound: 8,
          minimumRound: 1,
          costReductionPerYear: 1,
        } as any
      );

      // baseCost = 2, totalKeeperYears = 3, effectiveCost = max(1, 2 - 3) = 1
      expect(cost).toBe(1);
    });

    it("resets cost reduction for post-deadline (offseason) trades", async () => {
      vi.mocked(prisma.roster.findUnique).mockResolvedValue({
        id: "roster-2",
        sleeperId: "sleeper-roster-2",
        leagueId: "league-1",
      } as any);

      vi.mocked(prisma.roster.findMany).mockResolvedValue([
        { id: "roster-1", sleeperId: "sleeper-roster-1" },
        { id: "roster-2", sleeperId: "sleeper-roster-2" },
      ] as any);

      // Player was traded to roster-2 in December 2025 (post-deadline)
      vi.mocked(prisma.transactionPlayer.findFirst).mockResolvedValue({
        playerId: "player-1",
        toRosterId: "roster-2",
        fromRosterId: "roster-1",
        transaction: {
          type: "TRADE",
          createdAt: new Date("2025-12-15"), // December = post-deadline
        },
      } as any);

      // Player was originally drafted in round 5
      vi.mocked(prisma.draftPick.findFirst).mockResolvedValue({
        playerId: "player-1",
        rosterId: "roster-1", // Original owner
        round: 5,
        draft: { season: 2023 },
      } as any);

      vi.mocked(prisma.player.findUnique).mockResolvedValue({
        id: "player-1",
        sleeperId: "sleeper-player-1",
      } as any);

      // Player was kept 2 times before trade (2024, 2025) - but this shouldn't count for new owner
      vi.mocked(prisma.keeper.count).mockResolvedValue(0); // Post-deadline resets to 0

      const cost = await calculateBaseCost(
        "player-1",
        "roster-2", // NEW owner after post-deadline trade
        2026,
        {
          undraftedRound: 8,
          minimumRound: 1,
          costReductionPerYear: 1,
        } as any
      );

      // Post-deadline trade = cost resets: baseCost = 5, keeperYears = 0, cost = 5
      // NOT baseCost = 5, keeperYears = 2, cost = 3
      expect(cost).toBe(5);
    });

    it("continues cost reduction for pre-deadline (in-season) trades", async () => {
      vi.mocked(prisma.roster.findUnique).mockResolvedValue({
        id: "roster-2",
        sleeperId: "sleeper-roster-2",
        leagueId: "league-1",
      } as any);

      vi.mocked(prisma.roster.findMany).mockResolvedValue([
        { id: "roster-1", sleeperId: "sleeper-roster-1" },
        { id: "roster-2", sleeperId: "sleeper-roster-2" },
      ] as any);

      // Player was traded to roster-2 in October 2025 (pre-deadline, week 5ish)
      vi.mocked(prisma.transactionPlayer.findFirst).mockResolvedValue({
        playerId: "player-1",
        toRosterId: "roster-2",
        fromRosterId: "roster-1",
        transaction: {
          type: "TRADE",
          createdAt: new Date("2025-10-15"), // October = pre-deadline
        },
      } as any);

      // Player was originally drafted in round 5
      vi.mocked(prisma.draftPick.findFirst).mockResolvedValue({
        playerId: "player-1",
        rosterId: "roster-1", // Original owner
        round: 5,
        draft: { season: 2023 },
      } as any);

      vi.mocked(prisma.player.findUnique).mockResolvedValue({
        id: "player-1",
        sleeperId: "sleeper-player-1",
      } as any);

      // Player was kept 2 times before (2024, 2025) - this DOES count for pre-deadline trade
      vi.mocked(prisma.keeper.count).mockResolvedValue(2);

      const cost = await calculateBaseCost(
        "player-1",
        "roster-2", // NEW owner after pre-deadline trade
        2026,
        {
          undraftedRound: 8,
          minimumRound: 1,
          costReductionPerYear: 1,
        } as any
      );

      // Pre-deadline trade = cost continues: baseCost = 5, keeperYears = 2, cost = 3
      expect(cost).toBe(3);
    });
  });

  describe("calculateKeeperCost", () => {
    it("calculates cost for regular keeper", async () => {
      vi.mocked(prisma.league.findUnique).mockResolvedValue({
        id: "league-1",
        keeperSettings: {
          undraftedRound: 8,
          minimumRound: 1,
          costReductionPerYear: 1,
        },
      } as any);

      vi.mocked(prisma.roster.findUnique).mockResolvedValue({
        id: "roster-1",
        sleeperId: "sleeper-roster-1",
        leagueId: "league-1",
      } as any);

      vi.mocked(prisma.roster.findMany).mockResolvedValue([
        { id: "roster-1", sleeperId: "sleeper-roster-1" },
      ] as any);

      vi.mocked(prisma.draftPick.findFirst).mockResolvedValue({
        playerId: "player-1",
        rosterId: "roster-1",
        round: 4,
        draft: { season: 2025 },
      } as any);

      vi.mocked(prisma.transactionPlayer.findFirst).mockResolvedValue(null);

      vi.mocked(prisma.player.findUnique).mockResolvedValue({
        id: "player-1",
        sleeperId: "sleeper-player-1",
      } as any);

      const result = await calculateKeeperCost(
        "player-1",
        "roster-1",
        "league-1",
        2026,
        KeeperType.REGULAR
      );

      expect(result.baseCost).toBe(4);
      expect(result.finalCost).toBe(4);
    });

    it("calculates cost for franchise tag", async () => {
      vi.mocked(prisma.league.findUnique).mockResolvedValue({
        id: "league-1",
        keeperSettings: {
          undraftedRound: 8,
          minimumRound: 1,
          costReductionPerYear: 1,
        },
      } as any);

      vi.mocked(prisma.roster.findUnique).mockResolvedValue({
        id: "roster-1",
        sleeperId: "sleeper-roster-1",
        leagueId: "league-1",
      } as any);

      vi.mocked(prisma.roster.findMany).mockResolvedValue([
        { id: "roster-1", sleeperId: "sleeper-roster-1" },
      ] as any);

      vi.mocked(prisma.draftPick.findFirst).mockResolvedValue({
        playerId: "player-1",
        rosterId: "roster-1",
        round: 2,
        draft: { season: 2024 },
      } as any);

      vi.mocked(prisma.transactionPlayer.findFirst).mockResolvedValue(null);

      vi.mocked(prisma.player.findUnique).mockResolvedValue({
        id: "player-1",
        sleeperId: "sleeper-player-1",
      } as any);

      const result = await calculateKeeperCost(
        "player-1",
        "roster-1",
        "league-1",
        2026,
        KeeperType.FRANCHISE
      );

      expect(result.costBreakdown).toContain("Franchise Tag");
    });
  });

  describe("validateKeeperSelections", () => {
    it("validates keeper selections within limits", async () => {
      vi.mocked(prisma.league.findUnique).mockResolvedValue({
        id: "league-1",
        keeperSettings: {
          maxKeepers: 7,
          maxFranchiseTags: 1,
          maxRegularKeepers: 6,
          regularKeeperMaxYears: 2,
          undraftedRound: 8,
          minimumRound: 1,
        },
      } as any);

      vi.mocked(prisma.keeper.findMany).mockResolvedValue([
        {
          id: "keeper-1",
          playerId: "player-1",
          rosterId: "roster-1",
          type: "REGULAR",
          player: { sleeperId: "sleeper-player-1", fullName: "Player 1" },
        },
      ] as any);

      vi.mocked(prisma.roster.findUnique).mockResolvedValue({
        id: "roster-1",
        sleeperId: "sleeper-roster-1",
        leagueId: "league-1",
      } as any);

      vi.mocked(prisma.roster.findMany).mockResolvedValue([
        { id: "roster-1", sleeperId: "sleeper-roster-1" },
      ] as any);

      vi.mocked(prisma.draftPick.findFirst).mockResolvedValue({
        playerId: "player-1",
        rosterId: "roster-1",
        round: 3,
        draft: { season: 2025 },
      } as any);

      vi.mocked(prisma.transactionPlayer.findFirst).mockResolvedValue(null);

      const result = await validateKeeperSelections(
        "roster-1",
        "league-1",
        2026
      );

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("detects too many keepers", async () => {
      vi.mocked(prisma.league.findUnique).mockResolvedValue({
        id: "league-1",
        keeperSettings: {
          maxKeepers: 2,
          maxFranchiseTags: 1,
          maxRegularKeepers: 2,
          regularKeeperMaxYears: 2,
        },
      } as any);

      // 3 keepers when max is 2
      vi.mocked(prisma.keeper.findMany).mockResolvedValue([
        { type: "REGULAR", player: { sleeperId: "p1", fullName: "Player 1" } },
        { type: "REGULAR", player: { sleeperId: "p2", fullName: "Player 2" } },
        { type: "REGULAR", player: { sleeperId: "p3", fullName: "Player 3" } },
      ] as any);

      const result = await validateKeeperSelections(
        "roster-1",
        "league-1",
        2026
      );

      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes("Too many keepers"))).toBe(true);
    });

    it("detects too many franchise tags", async () => {
      vi.mocked(prisma.league.findUnique).mockResolvedValue({
        id: "league-1",
        keeperSettings: {
          maxKeepers: 7,
          maxFranchiseTags: 1,
          maxRegularKeepers: 6,
          regularKeeperMaxYears: 2,
        },
      } as any);

      // 2 franchise tags when max is 1
      vi.mocked(prisma.keeper.findMany).mockResolvedValue([
        { type: "FRANCHISE", player: { sleeperId: "p1", fullName: "Player 1" } },
        { type: "FRANCHISE", player: { sleeperId: "p2", fullName: "Player 2" } },
      ] as any);

      const result = await validateKeeperSelections(
        "roster-1",
        "league-1",
        2026
      );

      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes("Too many franchise tags"))).toBe(true);
    });
  });
});
