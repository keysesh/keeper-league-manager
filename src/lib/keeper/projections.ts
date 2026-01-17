/**
 * Keeper Projections Module
 *
 * Calculates multi-year keeper cost projections and eligibility forecasts
 */

import { prisma } from "@/lib/prisma";
import { KeeperType } from "@prisma/client";
import { DEFAULT_KEEPER_RULES } from "@/lib/constants/keeper-rules";

export interface YearProjection {
  season: number;
  cost: number;
  isEligible: boolean;
  type: "REGULAR" | "FRANCHISE_ONLY" | "INELIGIBLE";
  yearsKept: number;
  reason: string;
}

export interface KeeperProjection {
  playerId: string;
  playerName: string;
  position: string | null;
  team: string | null;
  currentCost: number;
  currentYearsKept: number;
  maxYearsRemaining: number;
  projections: YearProjection[];
  valueTrajectory: "IMPROVING" | "STABLE" | "EXPIRING";
}

/**
 * Calculate multi-year keeper projections for a player
 */
export async function calculateKeeperProjections(
  playerId: string,
  rosterId: string,
  leagueId: string,
  currentSeason: number,
  yearsToProject: number = 3
): Promise<KeeperProjection> {
  // Get league settings
  const league = await prisma.league.findUnique({
    where: { id: leagueId },
    include: { keeperSettings: true },
  });

  const settings = league?.keeperSettings;
  const maxYears = settings?.regularKeeperMaxYears ?? DEFAULT_KEEPER_RULES.REGULAR_KEEPER_MAX_YEARS;
  const minRound = settings?.minimumRound ?? DEFAULT_KEEPER_RULES.MINIMUM_ROUND;
  const costReduction = settings?.costReductionPerYear ?? DEFAULT_KEEPER_RULES.COST_REDUCTION_PER_YEAR;

  // Get player info
  const player = await prisma.player.findUnique({
    where: { id: playerId },
  });

  // Get current keeper status
  const currentKeeper = await prisma.keeper.findFirst({
    where: {
      playerId,
      rosterId,
      season: currentSeason,
    },
  });

  // Get keeper history
  const keeperHistory = await prisma.keeper.findMany({
    where: {
      playerId,
      rosterId,
      season: { lt: currentSeason },
    },
    orderBy: { season: "desc" },
  });

  // Count consecutive years
  let consecutiveYears = currentKeeper ? 1 : 0;
  let checkSeason = currentSeason - 1;

  for (const keeper of keeperHistory) {
    if (keeper.season === checkSeason) {
      consecutiveYears++;
      checkSeason--;
    } else {
      break;
    }
  }

  const currentCost = currentKeeper?.finalCost ?? (settings?.undraftedRound ?? DEFAULT_KEEPER_RULES.UNDRAFTED_ROUND);
  const currentYearsKept = consecutiveYears;
  const maxYearsRemaining = Math.max(0, maxYears - currentYearsKept + 1);

  // Calculate projections for future years
  const projections: YearProjection[] = [];

  for (let i = 0; i < yearsToProject; i++) {
    const futureSeason = currentSeason + i;
    const futureYearsKept = currentYearsKept + i;
    const futureCost = Math.max(minRound, currentCost - (i * costReduction));

    let isEligible = true;
    let type: "REGULAR" | "FRANCHISE_ONLY" | "INELIGIBLE" = "REGULAR";
    let reason = `Round ${futureCost} (Year ${futureYearsKept} of ${maxYears})`;

    if (futureYearsKept > maxYears) {
      isEligible = false;
      type = "INELIGIBLE";
      reason = `Exceeded max years (${futureYearsKept} > ${maxYears})`;
    } else if (futureYearsKept === maxYears) {
      type = "FRANCHISE_ONLY";
      reason = `Final year - Franchise Tag only after this season`;
    }

    projections.push({
      season: futureSeason,
      cost: futureCost,
      isEligible,
      type,
      yearsKept: futureYearsKept,
      reason,
    });
  }

  // Determine value trajectory
  let valueTrajectory: "IMPROVING" | "STABLE" | "EXPIRING" = "STABLE";
  if (currentYearsKept >= maxYears - 1) {
    valueTrajectory = "EXPIRING";
  } else if (currentCost > minRound) {
    valueTrajectory = "IMPROVING";
  }

  return {
    playerId,
    playerName: player?.fullName ?? "Unknown Player",
    position: player?.position ?? null,
    team: player?.team ?? null,
    currentCost,
    currentYearsKept,
    maxYearsRemaining,
    projections,
    valueTrajectory,
  };
}

/**
 * Calculate projections for all keepers on a roster
 */
export async function calculateRosterProjections(
  rosterId: string,
  leagueId: string,
  currentSeason: number,
  yearsToProject: number = 3
): Promise<KeeperProjection[]> {
  const keepers = await prisma.keeper.findMany({
    where: {
      rosterId,
      season: currentSeason,
    },
    include: { player: true },
  });

  const projections = await Promise.all(
    keepers.map((keeper) =>
      calculateKeeperProjections(
        keeper.playerId,
        rosterId,
        leagueId,
        currentSeason,
        yearsToProject
      )
    )
  );

  return projections;
}

/**
 * Calculate league-wide keeper projections summary
 */
export async function calculateLeagueProjectionsSummary(
  leagueId: string,
  currentSeason: number
): Promise<{
  totalKeepers: number;
  expiringThisSeason: number;
  expiringNextSeason: number;
  franchiseTagsUsed: number;
  averageKeeperCost: number;
  keepersByPosition: Record<string, number>;
}> {
  const keepers = await prisma.keeper.findMany({
    where: {
      roster: { leagueId },
      season: currentSeason,
    },
    include: { player: true },
  });

  const league = await prisma.league.findUnique({
    where: { id: leagueId },
    include: { keeperSettings: true },
  });

  const maxYears = league?.keeperSettings?.regularKeeperMaxYears ?? DEFAULT_KEEPER_RULES.REGULAR_KEEPER_MAX_YEARS;

  let expiringThisSeason = 0;
  let expiringNextSeason = 0;
  let franchiseTagsUsed = 0;
  let totalCost = 0;
  const keepersByPosition: Record<string, number> = {};

  for (const keeper of keepers) {
    if (keeper.type === KeeperType.FRANCHISE) {
      franchiseTagsUsed++;
    }

    if (keeper.yearsKept >= maxYears) {
      expiringThisSeason++;
    } else if (keeper.yearsKept === maxYears - 1) {
      expiringNextSeason++;
    }

    totalCost += keeper.finalCost;

    const pos = keeper.player.position ?? "UNKNOWN";
    keepersByPosition[pos] = (keepersByPosition[pos] ?? 0) + 1;
  }

  return {
    totalKeepers: keepers.length,
    expiringThisSeason,
    expiringNextSeason,
    franchiseTagsUsed,
    averageKeeperCost: keepers.length > 0 ? totalCost / keepers.length : 0,
    keepersByPosition,
  };
}
