import { prisma } from "@/lib/prisma";
import { AcquisitionType, KeeperSettings, KeeperType } from "@prisma/client";
import { DEFAULT_KEEPER_RULES } from "@/lib/constants/keeper-rules";

// ============================================
// TYPES
// ============================================

export interface KeeperCostResult {
  baseCost: number; // Original draft round (or R8 for undrafted)
  effectiveCost: number; // After years-kept reduction: max(1, baseCost - (yearsKept - 1))
  yearsKept: number; // Display value (1-indexed): how many times kept including this one
  originalDraftRound: number | null;
  originalDraftSeason: number | null;
  acquisitionType: AcquisitionType;
  isPostDeadlineTrade: boolean;
  costBreakdown: string; // Human-readable explanation
}

export interface KeeperEligibilityResult {
  isEligible: boolean;
  canBeRegularKeeper: boolean;
  mustBeFranchise: boolean;
  reason?: string;
  cost: KeeperCostResult;
}

interface AcquisitionRecord {
  acquisitionType: AcquisitionType;
  originalDraftRound: number | null;
  originalDraftSeason: number | null;
  isPreDeadline: boolean | null;
  baseCostOverride: number | null;
}

// ============================================
// SINGLE PLAYER COST CALCULATION
// ============================================

/**
 * Compute keeper cost for a single player from the PlayerAcquisition table.
 *
 * This is the SINGLE SOURCE OF TRUTH for keeper cost calculation.
 * Both calculator.ts and the eligible-keepers route delegate here.
 */
export async function computeKeeperCost(
  playerId: string,
  ownerSleeperId: string,
  targetSeason: number,
  settings?: KeeperSettings | null
): Promise<KeeperCostResult> {
  const undraftedRound =
    settings?.undraftedRound ?? DEFAULT_KEEPER_RULES.UNDRAFTED_ROUND;
  const minRound =
    settings?.minimumRound ?? DEFAULT_KEEPER_RULES.MINIMUM_ROUND;

  // Find the most recent open (or latest) acquisition for this player+owner
  const acquisition = await prisma.playerAcquisition.findFirst({
    where: {
      playerId,
      ownerSleeperId,
    },
    orderBy: { acquisitionDate: "desc" },
  });

  if (!acquisition) {
    // No acquisition record — treat as waiver pickup
    return buildCostResult(
      { acquisitionType: AcquisitionType.WAIVER, originalDraftRound: null, originalDraftSeason: null, isPreDeadline: null, baseCostOverride: null },
      1,
      undraftedRound,
      minRound
    );
  }

  // Count keeper years: how many times this player has been kept before targetSeason
  const pastKeeperCount = await countKeeperYears(
    playerId,
    ownerSleeperId,
    targetSeason,
    acquisition
  );
  const yearsKept = pastKeeperCount + 1; // Display as Year 1, Year 2, etc.

  return buildCostResult(
    {
      acquisitionType: acquisition.acquisitionType,
      originalDraftRound: acquisition.originalDraftRound,
      originalDraftSeason: acquisition.originalDraftSeason,
      isPreDeadline: acquisition.isPreDeadline,
      baseCostOverride: acquisition.baseCostOverride,
    },
    yearsKept,
    undraftedRound,
    minRound
  );
}

// ============================================
// BATCH COST CALCULATION (for eligible-keepers route)
// ============================================

/**
 * Batch compute keeper costs for all players on a roster.
 * Fetches all acquisitions in a single query for performance.
 */
export async function batchComputeKeeperCosts(
  playerIds: string[],
  ownerSleeperId: string,
  targetSeason: number,
  settings?: KeeperSettings | null
): Promise<Map<string, KeeperCostResult>> {
  const undraftedRound =
    settings?.undraftedRound ?? DEFAULT_KEEPER_RULES.UNDRAFTED_ROUND;
  const minRound =
    settings?.minimumRound ?? DEFAULT_KEEPER_RULES.MINIMUM_ROUND;

  // Batch fetch all acquisitions for these players by this owner
  const acquisitions = await prisma.playerAcquisition.findMany({
    where: {
      playerId: { in: playerIds },
      ownerSleeperId,
    },
    orderBy: { acquisitionDate: "desc" },
  });

  // Build lookup: playerId -> most recent acquisition
  const acqByPlayer = new Map<string, typeof acquisitions[0]>();
  for (const acq of acquisitions) {
    if (!acqByPlayer.has(acq.playerId)) {
      acqByPlayer.set(acq.playerId, acq);
    }
  }

  // Batch fetch keeper year counts
  const keeperCounts = await prisma.keeper.groupBy({
    by: ["playerId"],
    where: {
      playerId: { in: playerIds },
      season: { lt: targetSeason },
    },
    _count: { id: true },
  });
  const keeperCountMap = new Map<string, number>();
  for (const kc of keeperCounts) {
    keeperCountMap.set(kc.playerId, kc._count.id);
  }

  // Compute costs for each player
  const results = new Map<string, KeeperCostResult>();
  for (const playerId of playerIds) {
    const acq = acqByPlayer.get(playerId);

    if (!acq) {
      results.set(
        playerId,
        buildCostResult(
          { acquisitionType: AcquisitionType.WAIVER, originalDraftRound: null, originalDraftSeason: null, isPreDeadline: null, baseCostOverride: null },
          1,
          undraftedRound,
          minRound
        )
      );
      continue;
    }

    // For post-deadline trades, only count keeper years AFTER the trade
    let pastKeeperCount = keeperCountMap.get(playerId) || 0;
    const isPostDeadline =
      acq.acquisitionType === AcquisitionType.TRADE &&
      acq.isPreDeadline === false;

    if (isPostDeadline && acq.acquisitionDate) {
      const tradeSeason = getSeasonFromDate(acq.acquisitionDate);
      // Recount: only keeper records after the trade season
      const postTradeCount = await prisma.keeper.count({
        where: {
          playerId,
          season: { gte: tradeSeason + 1, lt: targetSeason },
        },
      });
      pastKeeperCount = postTradeCount;
    }

    const yearsKept = pastKeeperCount + 1;

    results.set(
      playerId,
      buildCostResult(
        {
          acquisitionType: acq.acquisitionType,
          originalDraftRound: acq.originalDraftRound,
          originalDraftSeason: acq.originalDraftSeason,
          isPreDeadline: acq.isPreDeadline,
          baseCostOverride: acq.baseCostOverride,
        },
        yearsKept,
        undraftedRound,
        minRound
      )
    );
  }

  return results;
}

// ============================================
// ELIGIBILITY CALCULATION
// ============================================

/**
 * Compute keeper eligibility based on cost result and settings.
 */
export function computeKeeperEligibility(
  cost: KeeperCostResult,
  settings?: KeeperSettings | null
): KeeperEligibilityResult {
  const maxYears =
    settings?.regularKeeperMaxYears ??
    DEFAULT_KEEPER_RULES.REGULAR_KEEPER_MAX_YEARS;

  const canBeRegularKeeper = cost.yearsKept <= maxYears;
  const mustBeFranchise = cost.yearsKept > maxYears;

  let reason: string | undefined;
  if (mustBeFranchise) {
    reason = `Year ${cost.yearsKept} - Franchise Tag required`;
  } else if (cost.yearsKept === maxYears) {
    reason = `Final regular keeper year (Year ${cost.yearsKept} of ${maxYears})`;
  } else if (cost.yearsKept === 1) {
    reason = "First time keeping";
  }

  return {
    isEligible: true, // Players are always eligible (via FT if needed)
    canBeRegularKeeper,
    mustBeFranchise,
    reason,
    cost,
  };
}

// ============================================
// INTERNAL HELPERS
// ============================================

function getSeasonFromDate(date: Date): number {
  const month = date.getMonth();
  return month < 2 ? date.getFullYear() - 1 : date.getFullYear();
}

/**
 * Count how many times a player has been kept before the target season.
 * For post-deadline trades, only counts keeper records AFTER the trade.
 */
async function countKeeperYears(
  playerId: string,
  ownerSleeperId: string,
  targetSeason: number,
  acquisition: { acquisitionType: AcquisitionType; isPreDeadline: boolean | null; acquisitionDate: Date }
): Promise<number> {
  const isPostDeadline =
    acquisition.acquisitionType === AcquisitionType.TRADE &&
    acquisition.isPreDeadline === false;

  if (isPostDeadline) {
    const tradeSeason = getSeasonFromDate(acquisition.acquisitionDate);
    return prisma.keeper.count({
      where: {
        playerId,
        season: { gte: tradeSeason + 1, lt: targetSeason },
      },
    });
  }

  return prisma.keeper.count({
    where: {
      playerId,
      season: { lt: targetSeason },
    },
  });
}

/**
 * Build a KeeperCostResult from an acquisition record.
 */
function buildCostResult(
  acq: AcquisitionRecord,
  yearsKept: number,
  undraftedRound: number,
  minRound: number
): KeeperCostResult {
  // Commissioner override takes priority
  if (acq.baseCostOverride != null) {
    const effectiveCost = Math.max(
      minRound,
      acq.baseCostOverride - (yearsKept - 1)
    );
    return {
      baseCost: acq.baseCostOverride,
      effectiveCost,
      yearsKept,
      originalDraftRound: acq.originalDraftRound,
      originalDraftSeason: acq.originalDraftSeason,
      acquisitionType: acq.acquisitionType,
      isPostDeadlineTrade:
        acq.acquisitionType === AcquisitionType.TRADE &&
        acq.isPreDeadline === false,
      costBreakdown: `R${acq.baseCostOverride} (override) - ${yearsKept - 1}yr = R${effectiveCost}`,
    };
  }

  // Determine starting cost from acquisition
  let startingCost: number;
  let costSource: string;

  if (acq.originalDraftRound != null) {
    startingCost = acq.originalDraftRound;
    costSource =
      acq.acquisitionType === AcquisitionType.DRAFTED
        ? `Drafted R${startingCost}`
        : acq.acquisitionType === AcquisitionType.TRADE
          ? `Trade (inherited R${startingCost})`
          : `Waiver (inherited R${startingCost})`;
  } else {
    // No original draft round — waiver/FA pickup
    startingCost = undraftedRound;
    costSource = `Waiver/FA R${undraftedRound}`;
  }

  const yearsImprovement = yearsKept - 1;
  const effectiveCost = Math.max(minRound, startingCost - yearsImprovement);

  let costBreakdown: string;
  if (yearsImprovement > 0) {
    costBreakdown = `${costSource} - ${yearsImprovement}yr = R${effectiveCost}`;
  } else {
    costBreakdown = `${costSource} = R${effectiveCost}`;
  }

  return {
    baseCost: startingCost,
    effectiveCost,
    yearsKept,
    originalDraftRound: acq.originalDraftRound,
    originalDraftSeason: acq.originalDraftSeason,
    acquisitionType: acq.acquisitionType,
    isPostDeadlineTrade:
      acq.acquisitionType === AcquisitionType.TRADE &&
      acq.isPreDeadline === false,
    costBreakdown,
  };
}
