import { prisma } from "@/lib/prisma";
import { AcquisitionType, KeeperSettings, KeeperType } from "@prisma/client";
import { DEFAULT_KEEPER_RULES, isTradeAfterDeadline } from "@/lib/constants/keeper-rules";

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
 * Uses years on ROSTER (not Keeper records) to determine eligibility.
 * Years on roster = targetSeason - originSeason
 *
 * Example with maxYears = 2:
 * - Year 1 (yearsOnRoster=0): eligible for regular keeper
 * - Year 2 (yearsOnRoster=1): eligible for regular keeper
 * - Year 3+ (yearsOnRoster>=2): must use Franchise Tag
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

  // FIXED: Use years on roster instead of Keeper records
  const yearsOnRoster = await getYearsOnRoster(playerId, rosterId, targetSeason);
  const yearsKept = yearsOnRoster + 1; // Display as Year 1, Year 2, etc.

  // Check if at max years for regular keeper
  // yearsOnRoster >= maxYears means they need Franchise Tag
  // yearsOnRoster: 0 = Year 1, 1 = Year 2, 2 = Year 3
  const atMaxYears = yearsOnRoster >= maxYears;

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

  // FIXED: Get years on roster (not keeper records) and apply cost improvement
  // Cost IMPROVES (lower round = better) by 1 for each year on roster AFTER the first
  // Year 1 (yearsOnRoster=0): baseCost
  // Year 2 (yearsOnRoster=1): baseCost - 1
  // Year 3 (yearsOnRoster=2): baseCost - 2
  const yearsOnRoster = await getYearsOnRoster(playerId, rosterId, targetSeason);
  const effectiveCost = Math.max(minRound, baseCost - yearsOnRoster);

  return effectiveCost;
}

/**
 * FIXED: Get the number of years a player has been on this roster
 *
 * Years on roster = targetSeason - originSeason
 * Where originSeason is when they joined this owner's roster:
 * - Drafted by this owner → draft season
 * - In-season trade → inherited from previous owner
 * - Offseason trade → resets to trade season (Year 1)
 * - Waiver/FA same season as drop → inherited from previous owner
 * - Waiver/FA different season → pickup season
 */
async function getYearsOnRoster(
  playerId: string,
  rosterId: string,
  targetSeason: number
): Promise<number> {
  // Get roster's sleeper ID for matching across seasons
  const roster = await prisma.roster.findUnique({
    where: { id: rosterId },
    select: { sleeperId: true, leagueId: true },
  });

  if (!roster?.sleeperId) {
    return 0;
  }

  // Get all rosters in the league for sleeperId mapping
  const allRosters = await prisma.roster.findMany({
    where: { leagueId: roster.leagueId },
    select: { id: true, sleeperId: true },
  });

  const rosterToSleeperMap = new Map<string, string>();
  for (const r of allRosters) {
    if (r.sleeperId) {
      rosterToSleeperMap.set(r.id, r.sleeperId);
    }
  }

  // Get origin season for this player on this owner
  const originSeason = await getOriginSeasonForOwner(
    playerId,
    roster.sleeperId,
    targetSeason,
    rosterToSleeperMap,
    new Set()
  );

  // Years on roster = target season - origin season
  return Math.max(0, targetSeason - originSeason);
}

/**
 * Recursively determine when a player joined an owner's roster (by sleeperId)
 */
async function getOriginSeasonForOwner(
  playerId: string,
  targetSleeperId: string,
  targetSeason: number,
  rosterToSleeperMap: Map<string, string>,
  visited: Set<string>
): Promise<number> {
  // Prevent infinite loops
  const key = `${playerId}-${targetSleeperId}`;
  if (visited.has(key)) {
    return targetSeason;
  }
  visited.add(key);

  // 1. Check if player was drafted by this owner
  const draftPick = await prisma.draftPick.findFirst({
    where: {
      playerId,
      roster: { sleeperId: targetSleeperId },
    },
    include: { draft: true },
    orderBy: { draft: { season: "asc" } },
  });

  if (draftPick) {
    return draftPick.draft.season;
  }

  // 2. Find acquisition transaction for this owner
  // First get all roster IDs for this sleeper ID
  const targetRosters = await prisma.roster.findMany({
    where: { sleeperId: targetSleeperId },
    select: { id: true },
  });
  const targetRosterIds = targetRosters.map(r => r.id);

  const transaction = await prisma.transactionPlayer.findFirst({
    where: {
      playerId,
      toRosterId: { in: targetRosterIds },
    },
    include: { transaction: true },
    orderBy: { transaction: { createdAt: "desc" } },
  });

  if (!transaction) {
    // No transaction found - treat as current season
    return targetSeason;
  }

  const txDate = transaction.transaction.createdAt;
  const txType = transaction.transaction.type;
  const txSeason = getSeasonFromDate(txDate);

  // 3. Handle trades - check trade deadline
  if (txType === "TRADE" && transaction.fromRosterId) {
    const fromSleeperId = rosterToSleeperMap.get(transaction.fromRosterId);
    if (fromSleeperId) {
      // Get previous owner's origin
      const previousOrigin = await getOriginSeasonForOwner(
        playerId,
        fromSleeperId,
        targetSeason,
        rosterToSleeperMap,
        visited
      );

      // Check if trade was after deadline (offseason)
      const isOffseasonTrade = isTradeAfterDeadline(txDate, txSeason);

      if (isOffseasonTrade) {
        // Offseason trade: years reset (origin = next season)
        return txSeason >= 8 ? txSeason + 1 : txSeason;
      } else {
        // Mid-season trade: inherit origin from previous owner
        return previousOrigin;
      }
    }
  }

  // 4. Handle waiver/FA
  if (txType !== "TRADE") {
    // Check if player was dropped in the same season
    if (transaction.fromRosterId) {
      const fromSleeperId = rosterToSleeperMap.get(transaction.fromRosterId);
      if (fromSleeperId) {
        const dropTx = await prisma.transactionPlayer.findFirst({
          where: {
            playerId,
            fromRosterId: transaction.fromRosterId,
          },
          include: { transaction: true },
        });

        if (dropTx) {
          const dropSeason = getSeasonFromDate(dropTx.transaction.createdAt);

          // Same season pickup - inherit from previous owner
          if (dropSeason === txSeason) {
            return await getOriginSeasonForOwner(
              playerId,
              fromSleeperId,
              targetSeason,
              rosterToSleeperMap,
              visited
            );
          }
        }
      }
    }

    // Different season or no previous owner - origin is pickup season
    return txSeason;
  }

  // Fallback to transaction season
  return txSeason;
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

  // FIXED: Franchise tags use the SAME cost formula as regular keepers
  // The only difference is FT is required after Year 2, and has no year limit
  if (keeperType === KeeperType.FRANCHISE) {
    return {
      baseCost: costDetails.baseCost,
      finalCost: costDetails.baseCost,
      costBreakdown: `Franchise Tag: ${costDetails.reason}`,
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

  // Find all draft picks for this player (get the ORIGINAL/EARLIEST one)
  const draftPick = await prisma.draftPick.findFirst({
    where: {
      playerId: player.id,
    },
    include: { draft: true },
    orderBy: { draft: { season: "asc" } },
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
