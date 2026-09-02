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
    playerAcquisition: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";

/** Prior keeper seasons in the shape cost.ts selects (season + roster.sleeperId). */
const keeps = (ownerSleeperId: string, ...seasons: number[]) =>
  seasons.map((season) => ({ season, roster: { sleeperId: ownerSleeperId } }));
import {
  calculateKeeperEligibility,
  calculateBaseCost,
  calculateKeeperCost,
  validateKeeperSelections,
} from "./calculator";

describe("Keeper Calculator", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: no prior keeper seasons (new keeper)
    vi.mocked(prisma.keeper.count).mockResolvedValue(0);
    vi.mocked(prisma.keeper.findMany).mockResolvedValue([] as never);
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

      // Mock acquisition record (cost.ts reads from PlayerAcquisition)
      vi.mocked(prisma.playerAcquisition.findFirst).mockResolvedValue({
        id: "acq-1",
        playerId: "player-1",
        ownerSleeperId: "sleeper-roster-1",
        acquisitionType: AcquisitionType.DRAFTED,
        acquisitionDate: new Date("2025-08-15"),
        season: 2025,
        originalDraftRound: 3,
        originalDraftSeason: 2025,
        isPreDeadline: null,
        baseCostOverride: null,
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

      // Mock acquisition record — drafted in 2023
      vi.mocked(prisma.playerAcquisition.findFirst).mockResolvedValue({
        id: "acq-1",
        playerId: "player-1",
        ownerSleeperId: "sleeper-roster-1",
        acquisitionType: AcquisitionType.DRAFTED,
        acquisitionDate: new Date("2023-08-15"),
        season: 2023,
        originalDraftRound: 5,
        originalDraftSeason: 2023,
        isPreDeadline: null,
        baseCostOverride: null,
      } as any);

      // Player kept 2 times before (2024, 2025) → yearsKept = 3 > maxYears(2)
      // Kept in 2024 and 2025 by this owner, after the 2023 draft
      vi.mocked(prisma.keeper.findMany).mockResolvedValue(
        keeps("sleeper-roster-1", 2024, 2025) as never
      );

      const result = await calculateKeeperEligibility(
        "player-1",
        "roster-1",
        "league-1",
        2026
      );

      expect(result.atMaxYears).toBe(true);
      expect(result.reason).toContain("Franchise Tag");
    });
  });

  describe("calculateBaseCost", () => {
    it("charges one round earlier than the draft round in the first keeper season", async () => {
      vi.mocked(prisma.roster.findUnique).mockResolvedValue({
        id: "roster-1",
        sleeperId: "sleeper-roster-1",
        leagueId: "league-1",
      } as any);

      // Mock acquisition record (cost.ts reads from PlayerAcquisition)
      vi.mocked(prisma.playerAcquisition.findFirst).mockResolvedValue({
        id: "acq-1",
        playerId: "player-1",
        ownerSleeperId: "sleeper-roster-1",
        acquisitionType: AcquisitionType.DRAFTED,
        acquisitionDate: new Date("2025-08-15"),
        season: 2025,
        originalDraftRound: 3,
        originalDraftSeason: 2025,
        isPreDeadline: null,
        baseCostOverride: null,
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
      // Drafted R3 in 2025, kept for the 2026 draft: one season held, so R2.
      // The old rule charged the full R3 until the SECOND keep, a round
      // cheaper than the commissioner's own Sleeper keeper slots.
      expect(cost).toBe(2);
    });

    it("improves cost by 1 round for each season held", async () => {
      vi.mocked(prisma.roster.findUnique).mockResolvedValue({
        id: "roster-1",
        sleeperId: "sleeper-roster-1",
        leagueId: "league-1",
      } as any);

      // Mock acquisition record — drafted in R5, season 2024
      vi.mocked(prisma.playerAcquisition.findFirst).mockResolvedValue({
        id: "acq-1",
        playerId: "player-1",
        ownerSleeperId: "sleeper-roster-1",
        acquisitionType: AcquisitionType.DRAFTED,
        acquisitionDate: new Date("2024-08-15"),
        season: 2024,
        originalDraftRound: 5,
        originalDraftSeason: 2024,
        isPreDeadline: null,
        baseCostOverride: null,
      } as any);

      // Player was kept 1 time before (in 2025), after the 2024 draft
      vi.mocked(prisma.keeper.findMany).mockResolvedValue(
        keeps("sleeper-roster-1", 2025) as never
      );

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
      // Drafted R5 in 2024, kept for the 2026 draft: two seasons held = R3.
      expect(cost).toBe(3);
    });

    const waiverSettings = {
      undraftedRound: 8,
      minimumRound: 1,
      costReductionPerYear: 1,
    } as any;

    /** Price an undrafted claim made in `season`, kept for `targetSeason`. */
    async function waiverCost(
      season: number,
      acquisitionDate: string,
      targetSeason: number
    ): Promise<number> {
      vi.mocked(prisma.roster.findUnique).mockResolvedValue({
        id: "roster-1",
        sleeperId: "sleeper-roster-1",
        leagueId: "league-1",
      } as any);

      // Mock acquisition record — waiver pickup, no draft round
      vi.mocked(prisma.playerAcquisition.findFirst).mockResolvedValue({
        id: "acq-1",
        playerId: "player-1",
        ownerSleeperId: "sleeper-roster-1",
        acquisitionType: AcquisitionType.WAIVER,
        acquisitionDate: new Date(acquisitionDate),
        season,
        originalDraftRound: null,
        originalDraftSeason: null,
        isPreDeadline: null,
        baseCostOverride: null,
      } as any);

      return calculateBaseCost("player-1", "roster-1", targetSeason, waiverSettings);
    }

    it("charges the flat undrafted round the first time a waiver pickup is kept", async () => {
      // Kyle Monangai: claimed off waivers during the 2025 season, kept for the
      // 2026 draft for the first time. undraftedRound IS that first-keep price,
      // so nothing has escalated yet.
      expect(await waiverCost(2025, "2025-10-01", 2026)).toBe(8);
    });

    it("prices a waiver pickup the same whether he was claimed in-season or in the offseason", async () => {
      // Same player, same first keeper draft, never kept before. Before the
      // fix the in-season claim was charged a season of escalation it had not
      // earned and came out a round more expensive than the offseason one.
      const inSeason = await waiverCost(2025, "2025-12-02", 2026);
      const offseason = await waiverCost(2026, "2026-03-15", 2026);
      expect(inSeason).toBe(offseason);
      expect(inSeason).toBe(8);
    });

    it("escalates a waiver pickup from the draft after his first keeper year", async () => {
      // Claimed 2025, kept at R8 in 2026, kept again for the 2027 draft = R7.
      expect(await waiverCost(2025, "2025-10-01", 2027)).toBe(7);
      expect(await waiverCost(2025, "2025-10-01", 2028)).toBe(6);
    });

    /** Price a claim that carries the previous owner's draft round. */
    async function claimWithInheritedRound(
      claimSeason: number,
      draftRound: number,
      draftSeason: number,
      targetSeason: number
    ): Promise<number> {
      vi.mocked(prisma.roster.findUnique).mockResolvedValue({
        id: "roster-1",
        sleeperId: "sleeper-roster-1",
        leagueId: "league-1",
      } as any);

      vi.mocked(prisma.playerAcquisition.findFirst).mockResolvedValue({
        id: "acq-1",
        playerId: "player-1",
        ownerSleeperId: "sleeper-roster-1",
        acquisitionType: AcquisitionType.FREE_AGENT,
        acquisitionDate: new Date(`${claimSeason}-09-16`),
        season: claimSeason,
        originalDraftRound: draftRound,
        originalDraftSeason: draftSeason,
        isPreDeadline: true,
        baseCostOverride: null,
      } as any);

      return calculateBaseCost("player-1", "roster-1", targetSeason, waiverSettings);
    }

    it("keeps the draft round when a player is dropped and re-added the same season", async () => {
      // Drafted R7 in 2025, dropped, claimed back that same season: the
      // contract survives the round trip, so he prices exactly like any other
      // R7 pick from 2025 — a 6th for the 2026 draft.
      expect(await claimWithInheritedRound(2025, 7, 2025, 2026)).toBe(6);
    });

    it("drops the draft round when a player is re-added in a later season", async () => {
      // Caleb Williams: drafted R7 by someone in 2024, claimed off free agency
      // in 2025. The season turned over, so he is back in the pool like anyone
      // else and costs the flat undrafted round the first time he is kept.
      expect(await claimWithInheritedRound(2025, 7, 2024, 2026)).toBe(8);
    });

    it("still carries a draft round across seasons through a trade", async () => {
      // Only a claim resets it. George Pickens: drafted R6 in 2023, traded in
      // 2024, still a 4th for the 2025 draft — two seasons off his 2023 clock.
      vi.mocked(prisma.roster.findUnique).mockResolvedValue({
        id: "roster-1",
        sleeperId: "sleeper-roster-1",
        leagueId: "league-1",
      } as any);
      vi.mocked(prisma.playerAcquisition.findFirst).mockResolvedValue({
        id: "acq-1",
        playerId: "player-1",
        ownerSleeperId: "sleeper-roster-1",
        acquisitionType: AcquisitionType.TRADE,
        acquisitionDate: new Date("2024-08-19"),
        season: 2024,
        originalDraftRound: 6,
        originalDraftSeason: 2023,
        isPreDeadline: true,
        baseCostOverride: null,
      } as any);

      expect(
        await calculateBaseCost("player-1", "roster-1", 2025, waiverSettings)
      ).toBe(4);
    });

    it("respects minimum round floor", async () => {
      vi.mocked(prisma.roster.findUnique).mockResolvedValue({
        id: "roster-1",
        sleeperId: "sleeper-roster-1",
        leagueId: "league-1",
      } as any);

      // Mock acquisition record — drafted R2 in 2022
      vi.mocked(prisma.playerAcquisition.findFirst).mockResolvedValue({
        id: "acq-1",
        playerId: "player-1",
        ownerSleeperId: "sleeper-roster-1",
        acquisitionType: AcquisitionType.DRAFTED,
        acquisitionDate: new Date("2022-08-15"),
        season: 2022,
        originalDraftRound: 2,
        originalDraftSeason: 2022,
        isPreDeadline: null,
        baseCostOverride: null,
      } as any);

      // Player was kept 3 times before (2023, 2024, 2025), after the 2022 draft
      vi.mocked(prisma.keeper.findMany).mockResolvedValue(
        keeps("sleeper-roster-1", 2023, 2024, 2025) as never
      );

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

    it("does not re-price a player on an offseason trade", async () => {
      vi.mocked(prisma.roster.findUnique).mockResolvedValue({
        id: "roster-2",
        sleeperId: "sleeper-roster-2",
        leagueId: "league-1",
      } as any);

      // Mock acquisition record — post-deadline trade (isPreDeadline = false)
      vi.mocked(prisma.playerAcquisition.findFirst).mockResolvedValue({
        id: "acq-1",
        playerId: "player-1",
        ownerSleeperId: "sleeper-roster-2",
        acquisitionType: AcquisitionType.TRADE,
        acquisitionDate: new Date("2025-12-15"),
        season: 2025, // December = post-deadline
        originalDraftRound: 5,
        originalDraftSeason: 2023,
        isPreDeadline: false, // Post-deadline trade
        baseCostOverride: null,
      } as any);

      // Post-deadline resets keeper years — no keeper records for new owner after trade
      // The previous owner's keeps must NOT transfer across a post-deadline trade
      vi.mocked(prisma.keeper.findMany).mockResolvedValue(
        keeps("sleeper-roster-1", 2024, 2025) as never
      );

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

      // An offseason trade does NOT re-price the player. He was taken in R5 in
      // 2023; by the 2026 draft three seasons have come off, so he costs a
      // 2nd whoever holds him. What the trade resets is his YEAR count, which
      // is eligibility, not price. Restarting the clock here instead made the
      // new owner pay a 4th for a player the rules price at a 2nd.
      expect(cost).toBe(2);
    });

    it("carries both the round and the escalation clock through a pre-deadline trade", async () => {
      vi.mocked(prisma.roster.findUnique).mockResolvedValue({
        id: "roster-2",
        sleeperId: "sleeper-roster-2",
        leagueId: "league-1",
      } as any);

      // Mock acquisition record — pre-deadline trade (isPreDeadline = true)
      vi.mocked(prisma.playerAcquisition.findFirst).mockResolvedValue({
        id: "acq-1",
        playerId: "player-1",
        ownerSleeperId: "sleeper-roster-2",
        acquisitionType: AcquisitionType.TRADE,
        acquisitionDate: new Date("2025-10-15"),
        season: 2025, // October = pre-deadline
        originalDraftRound: 5,
        originalDraftSeason: 2023,
        isPreDeadline: true, // Pre-deadline trade
        baseCostOverride: null,
      } as any);

      // Kept twice under the PREVIOUS owner; a pre-deadline trade carries them over
      vi.mocked(prisma.keeper.findMany).mockResolvedValue(
        keeps("sleeper-roster-1", 2024, 2025) as never
      );

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
      // A pre-deadline trade carries the contract whole: the R5 round AND the
      // clock, which started at the 2023 draft. Three seasons on, that is R2.
      expect(cost).toBe(2);
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

      // Mock acquisition record — drafted R4, season 2025
      vi.mocked(prisma.playerAcquisition.findFirst).mockResolvedValue({
        id: "acq-1",
        playerId: "player-1",
        ownerSleeperId: "sleeper-roster-1",
        acquisitionType: AcquisitionType.DRAFTED,
        acquisitionDate: new Date("2025-08-15"),
        season: 2025,
        originalDraftRound: 4,
        originalDraftSeason: 2025,
        isPreDeadline: null,
        baseCostOverride: null,
      } as any);

      const result = await calculateKeeperCost(
        "player-1",
        "roster-1",
        "league-1",
        2026,
        KeeperType.REGULAR
      );

      // Drafted R5 in 2024, kept for the 2026 draft: two seasons held.
      expect(result.baseCost).toBe(3);
      expect(result.finalCost).toBe(3);
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

      // Mock acquisition record — drafted R2, season 2024
      vi.mocked(prisma.playerAcquisition.findFirst).mockResolvedValue({
        id: "acq-1",
        playerId: "player-1",
        ownerSleeperId: "sleeper-roster-1",
        acquisitionType: AcquisitionType.DRAFTED,
        acquisitionDate: new Date("2024-08-15"),
        season: 2024,
        originalDraftRound: 2,
        originalDraftSeason: 2024,
        isPreDeadline: null,
        baseCostOverride: null,
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
          season: 2026,
          type: "REGULAR",
          player: { sleeperId: "sleeper-player-1", fullName: "Player 1" },
          // cost.ts reads prior keeper seasons off the same model
          roster: { sleeperId: "sleeper-roster-1" },
        },
      ] as any);

      vi.mocked(prisma.roster.findUnique).mockResolvedValue({
        id: "roster-1",
        sleeperId: "sleeper-roster-1",
        leagueId: "league-1",
      } as any);

      // Mock acquisition for validation
      vi.mocked(prisma.playerAcquisition.findFirst).mockResolvedValue({
        id: "acq-1",
        playerId: "player-1",
        ownerSleeperId: "sleeper-roster-1",
        acquisitionType: AcquisitionType.DRAFTED,
        acquisitionDate: new Date("2025-08-15"),
        season: 2025,
        originalDraftRound: 3,
        originalDraftSeason: 2025,
        isPreDeadline: null,
        baseCostOverride: null,
      } as any);

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
