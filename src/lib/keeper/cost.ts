import { prisma } from "@/lib/prisma";
import { AcquisitionType, KeeperSettings, KeeperType } from "@prisma/client";
import { DEFAULT_KEEPER_RULES } from "@/lib/constants/keeper-rules";

// ============================================
// TYPES
// ============================================

export interface KeeperCostResult {
  baseCost: number; // Original draft round (or R8 for undrafted)
  effectiveCost: number; // What he costs THIS draft: max(1, baseCost - seasons held)
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
      minRound,
      0
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
    minRound,
    Math.max(0, targetSeason - keeperClockSeason(acquisition))
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

  // Batch fetch prior keeper seasons in one query; countKeeperYearsFrom applies
  // the reset rule in memory, so this path matches computeKeeperCost exactly.
  const priorKeeperRows = await prisma.keeper.findMany({
    where: { playerId: { in: playerIds }, season: { lt: targetSeason } },
    select: { playerId: true, season: true, roster: { select: { sleeperId: true } } },
  });
  const priorByPlayer = new Map<string, PriorKeeperSeason[]>();
  for (const row of priorKeeperRows) {
    const entry = { season: row.season, ownerSleeperId: row.roster.sleeperId };
    const list = priorByPlayer.get(row.playerId);
    if (list) list.push(entry);
    else priorByPlayer.set(row.playerId, [entry]);
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
          minRound,
          0
        )
      );
      continue;
    }

    // For post-deadline trades, only count keeper years AFTER the trade
    const yearsKept =
      countKeeperYearsFrom(
        priorByPlayer.get(playerId) ?? [],
        acq,
        ownerSleeperId,
        targetSeason
      ) + 1;

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
        minRound,
        Math.max(0, targetSeason - keeperClockSeason(acq))
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
/**
 * Which season does a keeper's price clock start from?
 *
 * The escalation runs from when the player last entered the league through a
 * draft, and a TRADE carries that clock with the contract: George Pickens was
 * drafted in round 6 in 2023, traded away and traded back in August 2024, and
 * still cost a round 4 in 2025 (6 minus the two seasons since 2023). Restarting
 * at the trade would have made him a 5, and would let anyone wipe out an
 * expensive keeper's accumulated cost simply by trading for him.
 *
 * A waiver or free-agent claim is different: the player cleared back into the
 * pool, so the clock restarts at the claim.
 */
export function keeperClockSeason(acq: {
  acquisitionType: AcquisitionType;
  season: number;
  originalDraftSeason: number | null;
  isPreDeadline: boolean | null;
}): number {
  // A post-deadline trade already resets the keeper YEAR count, so it resets
  // the price clock too: it is treated as a fresh acquisition.
  const postDeadlineTrade =
    acq.acquisitionType === AcquisitionType.TRADE && acq.isPreDeadline === false;
  const carriesTheClock =
    !postDeadlineTrade &&
    (acq.acquisitionType === AcquisitionType.DRAFTED ||
      acq.acquisitionType === AcquisitionType.TRADE);
  return carriesTheClock && acq.originalDraftSeason != null
    ? Math.min(acq.originalDraftSeason, acq.season)
    : acq.season;
}

/** A season in which some owner kept this player, as the year count needs it. */
export interface PriorKeeperSeason {
  season: number;
  ownerSleeperId: string;
}

/**
 * How many seasons has this owner already kept the player, for cost purposes?
 *
 * League rule: a keeper's clock restarts whenever the player goes back into the
 * pool and is re-acquired, by draft pick or by waiver/free agency. Only a trade
 * carries the contract, and its accumulated years, across owners.
 *
 * Before 2026-09-01 every pre-deadline acquisition inherited EVERY prior
 * owner's keeper years, so drafting a player a stranger had once kept silently
 * cost a round more: DeVonta Smith was priced R3 instead of R5, Nico Collins
 * R13 instead of R14.
 *
 * Pure, so the single-player and batch paths cannot drift apart.
 */
export function countKeeperYearsFrom(
  priorSeasons: PriorKeeperSeason[],
  acquisition: { acquisitionType: AcquisitionType; isPreDeadline: boolean | null; season: number },
  ownerSleeperId: string,
  targetSeason: number
): number {
  // A pre-deadline trade transfers the keeper contract intact, years included.
  if (
    acquisition.acquisitionType === AcquisitionType.TRADE &&
    acquisition.isPreDeadline !== false
  ) {
    return priorSeasons.filter((k) => k.season < targetSeason).length;
  }

  // Everything else restarts the clock at the acquisition: a post-deadline
  // trade, a draft pick, a waiver claim, a free-agent add.
  return priorSeasons.filter(
    (k) =>
      k.ownerSleeperId === ownerSleeperId &&
      k.season > acquisition.season &&
      k.season < targetSeason
  ).length;
}

async function countKeeperYears(
  playerId: string,
  ownerSleeperId: string,
  targetSeason: number,
  acquisition: { acquisitionType: AcquisitionType; isPreDeadline: boolean | null; season: number }
): Promise<number> {
  const rows = await prisma.keeper.findMany({
    where: { playerId, season: { lt: targetSeason } },
    select: { season: true, roster: { select: { sleeperId: true } } },
  });
  return countKeeperYearsFrom(
    rows.map((r) => ({ season: r.season, ownerSleeperId: r.roster.sleeperId })),
    acquisition,
    ownerSleeperId,
    targetSeason
  );
}

/**
 * Build a KeeperCostResult from an acquisition record.
 */
function buildCostResult(
  acq: AcquisitionRecord,
  yearsKept: number,
  undraftedRound: number,
  minRound: number,
  /**
   * Seasons elapsed since this owner acquired the player. THIS is what moves
   * the price, not the number of prior keeps: a player drafted in round 14 in
   * 2025 costs a 13th to keep for the 2026 draft, his first time kept.
   * Verified against the commissioner's own 2026 keeper slots in Sleeper
   * (Skattebo R9->8, Hurts R13->12, Irving R14->13, McBride R15->14,
   * Marks R16->15, Javonte traded in R10->9, Chase Brown R7->6).
   */
  seasonsHeld: number
): KeeperCostResult {
  // Commissioner override takes priority
  if (acq.baseCostOverride != null) {
    const effectiveCost = Math.max(minRound, acq.baseCostOverride - seasonsHeld);
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
      costBreakdown: `R${acq.baseCostOverride} (override) - ${seasonsHeld}yr = R${effectiveCost}`,
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

  const yearsImprovement = seasonsHeld;
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
