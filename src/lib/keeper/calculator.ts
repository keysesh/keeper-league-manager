import { prisma } from "@/lib/prisma";
import { AcquisitionType, KeeperSettings, KeeperType } from "@prisma/client";
import { DEFAULT_KEEPER_RULES } from "@/lib/constants/keeper-rules";

// ============================================
// TYPES
// ============================================

export interface EligibilityResult {
  isEligible: boolean;
  reason?: string;
  yearsKept: number;
  acquisitionType: AcquisitionType;
  acquisitionDate?: Date;
  originalDraftRound?: number;
  atMaxYears?: boolean; // True if player has hit max regular keeper years
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
// ELIGIBILITY CALCULATION (FIXED)
// ============================================

/**
 * FIXED: Calculate keeper eligibility for a player
 *
 * Key fix: Uses > instead of >= for year comparison
 * A player is ineligible only when yearsKept > maxYears (not >=)
 *
 * Example with maxYears = 2:
 * - Year 1: eligible (1 <= 2)
 * - Year 2: eligible (2 <= 2)
 * - Year 3: NOT eligible (3 > 2)
 */
export async function calculateKeeperEligibility(
  playerId: string,
  rosterId: string,
  leagueId: string,
  targetSeason: number
): Promise<EligibilityResult> {
  // Fetch league settings
  const league = await prisma.league.findUnique({
    where: { id: leagueId },
    include: { keeperSettings: true },
  });
  const settings = league?.keeperSettings;
  const maxYears = settings?.regularKeeperMaxYears ?? DEFAULT_KEEPER_RULES.REGULAR_KEEPER_MAX_YEARS;

  // Get keeper history for this player on this roster
  const previousKeepers = await prisma.keeper.findMany({
    where: {
      playerId,
      rosterId,
      season: { lt: targetSeason },
    },
    orderBy: { season: "desc" },
  });

  // Count consecutive years kept (must be consecutive seasons)
  let consecutiveYears = 0;
  let checkSeason = targetSeason - 1;

  for (const keeper of previousKeepers) {
    if (keeper.season === checkSeason) {
      consecutiveYears++;
      checkSeason--;
    } else {
      break; // Not consecutive - stop counting
    }
  }

  const yearsKept = consecutiveYears + 1; // +1 for current season if kept

  // Check if at max years for regular keeper
  // Instead of marking as ineligible, we flag atMaxYears so the API can determine
  // if they're still eligible for Franchise Tag
  const atMaxYears = consecutiveYears >= maxYears;

  // Get acquisition details
  const acquisition = await getPlayerAcquisition(playerId, rosterId, targetSeason);

  // Check if cost would exceed max rounds
  const baseCost = await calculateBaseCost(playerId, rosterId, targetSeason, settings);
  const maxRounds = settings?.undraftedRound ?? DEFAULT_KEEPER_RULES.MAX_DRAFT_ROUNDS;

  // If cost exceeds max rounds AND at max years, they're truly ineligible (even for FT)
  // If cost exceeds max rounds but NOT at max years, still allow FT
  if (baseCost > maxRounds && !atMaxYears) {
    return {
      isEligible: false,
      reason: `Keeper cost (Round ${baseCost}) exceeds maximum draft round (${maxRounds})`,
      yearsKept,
      acquisitionType: acquisition.type,
      atMaxYears: false,
    };
  }

  // Player is eligible (possibly FT-only if atMaxYears)
  return {
    isEligible: true,
    yearsKept,
    acquisitionType: acquisition.type,
    acquisitionDate: acquisition.date,
    originalDraftRound: acquisition.draftRound,
    atMaxYears,
    reason: atMaxYears ? `At max years - Franchise Tag only` : undefined,
  };
}

// ============================================
// BASE COST CALCULATION (FIXED)
// ============================================

/**
 * FIXED: Calculate the base keeper cost for a player
 *
 * Rules:
 * - Drafted players: Draft Round (Year 1 = draft round)
 * - Undrafted/Waiver/FA: Round 8 (configurable)
 * - Traded players: Inherit original cost from previous owner
 * - Cost IMPROVES by 1 round for each consecutive year kept AFTER the first year
 *   Year 1: Draft round
 *   Year 2: Draft round - 1
 *   Year 3: Draft round - 2
 */
export async function calculateBaseCost(
  playerId: string,
  rosterId: string,
  targetSeason: number,
  settings?: KeeperSettings | null
): Promise<number> {
  const undraftedRound = settings?.undraftedRound ?? DEFAULT_KEEPER_RULES.UNDRAFTED_ROUND;
  const minRound = settings?.minimumRound ?? DEFAULT_KEEPER_RULES.MINIMUM_ROUND;

  const acquisition = await getPlayerAcquisition(playerId, rosterId, targetSeason);

  let baseCost: number;

  switch (acquisition.type) {
    case AcquisitionType.DRAFTED:
      // Base cost = Draft Round (no initial reduction)
      baseCost = acquisition.draftRound || undraftedRound;
      break;

    case AcquisitionType.WAIVER:
    case AcquisitionType.FREE_AGENT:
      // Undrafted players cost the undrafted round
      baseCost = undraftedRound;
      break;

    case AcquisitionType.TRADE:
      // Trades inherit the original acquisition cost
      baseCost = await getTradeInheritedCost(playerId, rosterId, targetSeason, settings);
      break;

    default:
      baseCost = undraftedRound;
  }

  // Get consecutive years kept and apply cost improvement
  // Cost IMPROVES (lower round = better) by 1 for each year AFTER the first
  // Year 1 (consecutiveYears=0): baseCost
  // Year 2 (consecutiveYears=1): baseCost - 1
  // Year 3 (consecutiveYears=2): baseCost - 2
  const consecutiveYears = await getConsecutiveYearsKept(playerId, rosterId, targetSeason);
  const effectiveCost = Math.max(minRound, baseCost - consecutiveYears);

  return effectiveCost;
}

/**
 * Get the number of consecutive years a player has been kept by this roster
 */
async function getConsecutiveYearsKept(
  playerId: string,
  rosterId: string,
  targetSeason: number
): Promise<number> {
  const previousKeepers = await prisma.keeper.findMany({
    where: {
      playerId,
      rosterId,
      season: { lt: targetSeason },
    },
    orderBy: { season: "desc" },
  });

  // Count consecutive years (must be consecutive seasons)
  let consecutiveYears = 0;
  let checkSeason = targetSeason - 1;

  for (const keeper of previousKeepers) {
    if (keeper.season === checkSeason) {
      consecutiveYears++;
      checkSeason--;
    } else {
      break; // Not consecutive - stop counting
    }
  }

  return consecutiveYears;
}

/**
 * Get detailed keeper cost calculation with explanation
 */
export async function getKeeperCostDetails(
  playerId: string,
  rosterId: string,
  targetSeason: number,
  settings?: KeeperSettings | null
): Promise<KeeperCostResult> {
  const undraftedRound = settings?.undraftedRound ?? DEFAULT_KEEPER_RULES.UNDRAFTED_ROUND;
  const costReduction = settings?.costReductionPerYear ?? DEFAULT_KEEPER_RULES.COST_REDUCTION_PER_YEAR;

  const acquisition = await getPlayerAcquisition(playerId, rosterId, targetSeason);
  const baseCost = await calculateBaseCost(playerId, rosterId, targetSeason, settings);

  let reason: string;

  switch (acquisition.type) {
    case AcquisitionType.DRAFTED:
      const draftRound = acquisition.draftRound || undraftedRound;
      reason = `Drafted in Round ${draftRound} - ${costReduction} = Round ${baseCost}`;
      break;

    case AcquisitionType.WAIVER:
      reason = `Waiver pickup = Round ${undraftedRound}`;
      break;

    case AcquisitionType.FREE_AGENT:
      reason = `Free agent pickup = Round ${undraftedRound}`;
      break;

    case AcquisitionType.TRADE:
      reason = `Traded - inherits original cost = Round ${baseCost}`;
      break;

    default:
      reason = `Unknown acquisition = Round ${undraftedRound}`;
  }

  return { baseCost, reason };
}

/**
 * Calculate the full keeper cost for a player
 * Returns both base cost and final cost (which may be same or cascaded)
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

  // For franchise tags, cost is always Round 1
  if (keeperType === KeeperType.FRANCHISE) {
    return {
      baseCost: 1,
      finalCost: 1,
      costBreakdown: "Franchise Tag = Round 1",
    };
  }

  // For regular keepers, base cost equals final cost (before cascade)
  // The cascade calculation happens separately in the cascade module
  return {
    baseCost: costDetails.baseCost,
    finalCost: costDetails.baseCost, // Will be updated by cascade calculation
    costBreakdown: costDetails.reason,
  };
}

// ============================================
// ACQUISITION TRACKING
// ============================================

/**
 * Get the NFL season for a given date
 * NFL season runs Sept-Feb: 2024 season = Sept 2024 - Feb 2025
 */
function getSeasonFromDate(date: Date): number {
  const month = date.getMonth(); // 0-indexed
  const year = date.getFullYear();

  // January/February = still previous season (playoffs)
  if (month < 2) {
    return year - 1;
  }
  // March-August = offseason, preparing for current year's season
  // September+ = current year's season
  return year;
}

/**
 * Get how a player was acquired by a roster
 *
 * FIXED: Per league rules:
 * - If a player was drafted THIS season, they cost their draft round
 * - If a player was drafted, dropped, and picked up in the SAME season,
 *   they RETAIN their draft round cost
 * - If a player was drafted, dropped, and picked up in a DIFFERENT season,
 *   they get waiver cost (undrafted round)
 * - Players never drafted get waiver cost
 */
async function getPlayerAcquisition(
  playerId: string,
  rosterId: string,
  targetSeason: number
): Promise<PlayerAcquisition> {
  // First, get the player record (playerId is the database ID)
  const player = await prisma.player.findUnique({
    where: { id: playerId },
  });

  if (!player) {
    return { type: AcquisitionType.WAIVER };
  }

  // Find all draft picks for this player (get the most relevant one)
  const draftPick = await prisma.draftPick.findFirst({
    where: {
      playerId: player.id,
    },
    include: { draft: true },
    orderBy: { draft: { season: "desc" } },
  });

  if (draftPick) {
    const draftSeason = draftPick.draft.season;

    // Get when the player joined the current roster
    const rosterTransaction = await prisma.transactionPlayer.findFirst({
      where: {
        playerId: player.id,
        toRosterId: rosterId,
      },
      include: { transaction: true },
      orderBy: { transaction: { createdAt: "desc" } },
    });

    // Case 1: Player was drafted by current roster - use draft round
    if (draftPick.rosterId === rosterId) {
      return {
        type: AcquisitionType.DRAFTED,
        date: draftPick.pickedAt || undefined,
        draftRound: draftPick.round,
      };
    }

    // Case 2: Player was drafted by another team, then acquired
    if (rosterTransaction) {
      const pickupSeason = getSeasonFromDate(rosterTransaction.transaction.createdAt);

      // If picked up in the SAME season as drafted → retain draft value
      // Example: Drafted Aug 2024 (season 2024), dropped Oct 2024, picked up Nov 2024 (season 2024)
      if (pickupSeason === draftSeason) {
        return {
          type: AcquisitionType.DRAFTED,
          date: rosterTransaction.transaction.createdAt,
          draftRound: draftPick.round,
        };
      }

      // If picked up in a DIFFERENT season → lose draft value, get waiver cost
      // Example: Drafted Aug 2024 (season 2024), dropped Oct 2024, picked up Aug 2025 (season 2025)
      // Fall through to waiver logic below
    }

    // Player was drafted but picked up in a different season - they lose draft value
  }

  // Check transactions for how player joined roster (waiver, FA, trade)
  const transaction = await prisma.transactionPlayer.findFirst({
    where: {
      playerId: player.id,
      toRosterId: rosterId,
    },
    include: {
      transaction: true,
    },
    orderBy: { transaction: { createdAt: "desc" } },
  });

  if (transaction) {
    return {
      type: mapTransactionType(transaction.transaction.type),
      date: transaction.transaction.createdAt,
    };
  }

  // Default to waiver if no record found (undrafted player)
  return { type: AcquisitionType.WAIVER };
}

/**
 * Get inherited cost from trade chain
 */
async function getTradeInheritedCost(
  playerId: string,
  rosterId: string,
  targetSeason: number,
  settings?: KeeperSettings | null
): Promise<number> {
  const undraftedRound = settings?.undraftedRound ?? DEFAULT_KEEPER_RULES.UNDRAFTED_ROUND;

  // Find the trade transaction (playerId is the database ID)
  const player = await prisma.player.findUnique({
    where: { id: playerId },
  });

  if (!player) {
    return undraftedRound;
  }

  const tradeTransaction = await prisma.transactionPlayer.findFirst({
    where: {
      playerId: player.id,
      toRosterId: rosterId,
      transaction: { type: "TRADE" },
    },
    include: { transaction: true },
  });

  if (!tradeTransaction?.fromRosterId) {
    return undraftedRound;
  }

  // Recursively find original cost from previous owner
  const previousRosterId = tradeTransaction.fromRosterId;
  const previousAcquisition = await getPlayerAcquisition(
    playerId,
    previousRosterId,
    targetSeason
  );

  if (previousAcquisition.type === AcquisitionType.DRAFTED && previousAcquisition.draftRound) {
    // Trade inherits the original draft round (no initial reduction)
    return previousAcquisition.draftRound;
  }

  if (previousAcquisition.type === AcquisitionType.TRADE) {
    // Follow the trade chain
    return getTradeInheritedCost(playerId, previousRosterId, targetSeason, settings);
  }

  // Waiver/FA acquisitions cost undrafted round
  return undraftedRound;
}

/**
 * Map Prisma TransactionType to AcquisitionType
 */
function mapTransactionType(type: string): AcquisitionType {
  switch (type) {
    case "TRADE":
      return AcquisitionType.TRADE;
    case "WAIVER":
      return AcquisitionType.WAIVER;
    case "FREE_AGENT":
      return AcquisitionType.FREE_AGENT;
    default:
      return AcquisitionType.WAIVER;
  }
}

// ============================================
// VALIDATION
// ============================================

/**
 * Validate keeper selections for a team
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
  // Fetch league settings
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

  // Count by type
  const franchiseCount = keepers.filter((k) => k.type === "FRANCHISE").length;
  const regularCount = keepers.filter((k) => k.type === "REGULAR").length;
  const totalCount = keepers.length;

  // Validate limits
  if (totalCount > maxKeepers) {
    errors.push(`Too many keepers selected (${totalCount}/${maxKeepers})`);
  }

  if (franchiseCount > maxFranchise) {
    errors.push(`Too many franchise tags (${franchiseCount}/${maxFranchise})`);
  }

  if (regularCount > maxRegular) {
    errors.push(`Too many regular keepers (${regularCount}/${maxRegular})`);
  }

  // Check individual eligibility
  for (const keeper of keepers) {
    const eligibility = await calculateKeeperEligibility(
      keeper.player.sleeperId,
      rosterId,
      leagueId,
      season
    );

    if (!eligibility.isEligible && keeper.type !== "FRANCHISE") {
      errors.push(`${keeper.player.fullName}: ${eligibility.reason}`);
    }

    // Warn about players in their final eligible year
    if (
      keeper.type === "REGULAR" &&
      eligibility.yearsKept === (settings?.regularKeeperMaxYears ?? 2)
    ) {
      warnings.push(
        `${keeper.player.fullName} is in their final year of keeper eligibility`
      );
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}
