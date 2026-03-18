import { prisma } from "@/lib/prisma";
import { AcquisitionType, KeeperSettings, KeeperType } from "@prisma/client";
import { DEFAULT_KEEPER_RULES } from "@/lib/constants/keeper-rules";
import {
  computeKeeperCost,
  computeKeeperEligibility,
  type KeeperCostResult as CostResult,
} from "./cost";

// ============================================
// TYPES (preserved for backward compatibility)
// ============================================

export interface EligibilityResult {
  isEligible: boolean;
  reason?: string;
  yearsKept: number;
  acquisitionType: AcquisitionType;
  acquisitionDate?: Date;
  originalDraftRound?: number;
  atMaxYears?: boolean;
}

export interface KeeperCostResult {
  baseCost: number;
  reason: string;
}

export interface FullKeeperCostResult {
  baseCost: number;
  finalCost: number;
  costBreakdown: string;
}

export interface PlayerAcquisition {
  type: AcquisitionType;
  date?: Date;
  draftRound?: number;
}

// ============================================
// ELIGIBILITY CALCULATION
// ============================================

/**
 * Calculate keeper eligibility for a player.
 * Delegates to the unified cost module (cost.ts) which reads from PlayerAcquisition table.
 */
export async function calculateKeeperEligibility(
  playerId: string,
  rosterId: string,
  leagueId: string,
  targetSeason: number
): Promise<EligibilityResult> {
  const league = await prisma.league.findUnique({
    where: { id: leagueId },
    include: { keeperSettings: true },
  });
  const settings = league?.keeperSettings;

  // Get the roster's sleeperId for PlayerAcquisition lookup
  const roster = await prisma.roster.findUnique({
    where: { id: rosterId },
    select: { sleeperId: true },
  });

  if (!roster?.sleeperId) {
    return {
      isEligible: true,
      yearsKept: 1,
      acquisitionType: AcquisitionType.WAIVER,
      atMaxYears: false,
    };
  }

  const costResult = await computeKeeperCost(
    playerId,
    roster.sleeperId,
    targetSeason,
    settings
  );

  const eligibility = computeKeeperEligibility(costResult, settings);

  return {
    isEligible: eligibility.isEligible,
    yearsKept: costResult.yearsKept,
    acquisitionType: costResult.acquisitionType,
    originalDraftRound: costResult.originalDraftRound ?? undefined,
    atMaxYears: eligibility.mustBeFranchise,
    reason: eligibility.reason,
  };
}

// ============================================
// BASE COST CALCULATION
// ============================================

/**
 * Calculate the base keeper cost for a player.
 * Delegates to the unified cost module (cost.ts) which reads from PlayerAcquisition table.
 */
export async function calculateBaseCost(
  playerId: string,
  rosterId: string,
  targetSeason: number,
  settings?: KeeperSettings | null
): Promise<number> {
  const roster = await prisma.roster.findUnique({
    where: { id: rosterId },
    select: { sleeperId: true },
  });

  if (!roster?.sleeperId) {
    return settings?.undraftedRound ?? DEFAULT_KEEPER_RULES.UNDRAFTED_ROUND;
  }

  const costResult = await computeKeeperCost(
    playerId,
    roster.sleeperId,
    targetSeason,
    settings
  );

  return costResult.effectiveCost;
}

/**
 * Get detailed keeper cost calculation with explanation.
 */
export async function getKeeperCostDetails(
  playerId: string,
  rosterId: string,
  targetSeason: number,
  settings?: KeeperSettings | null
): Promise<KeeperCostResult> {
  const roster = await prisma.roster.findUnique({
    where: { id: rosterId },
    select: { sleeperId: true },
  });

  if (!roster?.sleeperId) {
    const undraftedRound = settings?.undraftedRound ?? DEFAULT_KEEPER_RULES.UNDRAFTED_ROUND;
    return { baseCost: undraftedRound, reason: `Waiver/FA = R${undraftedRound}` };
  }

  const costResult = await computeKeeperCost(
    playerId,
    roster.sleeperId,
    targetSeason,
    settings
  );

  return {
    baseCost: costResult.effectiveCost,
    reason: costResult.costBreakdown,
  };
}

/**
 * Calculate the full keeper cost for a player.
 * Returns both base cost and final cost (which may be same or cascaded).
 */
export async function calculateKeeperCost(
  playerId: string,
  rosterId: string,
  leagueId: string,
  targetSeason: number,
  keeperType: KeeperType
): Promise<FullKeeperCostResult> {
  const league = await prisma.league.findUnique({
    where: { id: leagueId },
    include: { keeperSettings: true },
  });

  const settings = league?.keeperSettings;
  const costDetails = await getKeeperCostDetails(playerId, rosterId, targetSeason, settings);

  if (keeperType === KeeperType.FRANCHISE) {
    return {
      baseCost: costDetails.baseCost,
      finalCost: costDetails.baseCost,
      costBreakdown: `Franchise Tag: ${costDetails.reason}`,
    };
  }

  return {
    baseCost: costDetails.baseCost,
    finalCost: costDetails.baseCost, // Will be updated by cascade calculation
    costBreakdown: costDetails.reason,
  };
}

// ============================================
// VALIDATION
// ============================================

/**
 * Validate keeper selections for a team.
 */
export async function validateKeeperSelections(
  rosterId: string,
  leagueId: string,
  season: number
): Promise<{
  isValid: boolean;
  errors: string[];
  warnings: string[];
}> {
  const league = await prisma.league.findUnique({
    where: { id: leagueId },
    include: { keeperSettings: true },
  });
  const settings = league?.keeperSettings;

  const maxKeepers = settings?.maxKeepers ?? DEFAULT_KEEPER_RULES.MAX_KEEPERS;
  const maxFranchise = settings?.maxFranchiseTags ?? DEFAULT_KEEPER_RULES.MAX_FRANCHISE_TAGS;
  const maxRegular = settings?.maxRegularKeepers ?? DEFAULT_KEEPER_RULES.MAX_REGULAR_KEEPERS;

  const keepers = await prisma.keeper.findMany({
    where: { rosterId, season },
    include: { player: true },
  });

  const errors: string[] = [];
  const warnings: string[] = [];

  const franchiseCount = keepers.filter((k) => k.type === "FRANCHISE").length;
  const regularCount = keepers.filter((k) => k.type === "REGULAR").length;
  const totalCount = keepers.length;

  if (totalCount > maxKeepers) {
    errors.push(`Too many keepers selected (${totalCount}/${maxKeepers})`);
  }
  if (franchiseCount > maxFranchise) {
    errors.push(`Too many franchise tags (${franchiseCount}/${maxFranchise})`);
  }
  if (regularCount > maxRegular) {
    errors.push(`Too many regular keepers (${regularCount}/${maxRegular})`);
  }

  const eligibilityChecks = await Promise.all(
    keepers.map(async (keeper) => {
      const eligibility = await calculateKeeperEligibility(
        keeper.playerId,
        rosterId,
        leagueId,
        season
      );
      return { keeper, eligibility };
    })
  );

  for (const { keeper, eligibility } of eligibilityChecks) {
    if (!eligibility.isEligible && keeper.type !== "FRANCHISE") {
      errors.push(`${keeper.player.fullName}: ${eligibility.reason}`);
    }
    if (
      keeper.type === "REGULAR" &&
      eligibility.yearsKept === (settings?.regularKeeperMaxYears ?? 2)
    ) {
      warnings.push(
        `${keeper.player.fullName} is in their final year of keeper eligibility`
      );
    }
  }

  return { isValid: errors.length === 0, errors, warnings };
}
