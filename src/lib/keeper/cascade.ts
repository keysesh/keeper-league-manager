import { prisma } from "@/lib/prisma";
import { DEFAULT_KEEPER_RULES } from "@/lib/constants/keeper-rules";
import { calculateBaseCost } from "./calculator";

// ============================================
// TYPES
// ============================================

export interface KeeperInput {
  playerId: string;
  rosterId: string;
  playerName: string;
  type: "FRANCHISE" | "REGULAR";
}

export interface CascadeKeeperResult {
  playerId: string;
  rosterId: string;
  playerName: string;
  baseCost: number;
  finalCost: number;
  cascadeSteps: number;
  conflictsWith: string[];
  isCascaded: boolean;
}

export interface CascadeConflict {
  round: number;
  players: string[];
}

export interface CascadeResult {
  keepers: CascadeKeeperResult[];
  conflicts: CascadeConflict[];
  hasErrors: boolean;
  errors: string[];
}

// ============================================
// CASCADE CALCULATION (FIXED)
// ============================================

/**
 * FIXED: Calculate cascade/slot assignments for keepers
 *
 * Key fixes:
 * 1. Properly handles traded picks - marks traded rounds as unavailable
 * 2. Respects draft pick ownership when assigning slots
 * 3. CASCADE DIRECTION: Goes UP toward BETTER rounds (lower numbers)
 *    - Round 5 + Round 5 → Round 5 and Round 4
 *    - Round 8 + Round 8 + Round 8 → Round 8, Round 7, Round 6
 *    - This REWARDS teams for finding late-round value
 *    - Cannot cascade to worse rounds (higher numbers)
 */
export async function calculateCascade(
  leagueId: string,
  keepers: KeeperInput[],
  season: number
): Promise<CascadeResult> {
  const league = await prisma.league.findUnique({
    where: { id: leagueId },
    include: {
      keeperSettings: true,
      tradedPicks: {
        where: { season },
      },
    },
  });

  if (!league) {
    return {
      keepers: [],
      conflicts: [],
      hasErrors: true,
      errors: ["League not found"],
    };
  }

  const settings = league.keeperSettings;
  const maxRounds = league.draftRounds || DEFAULT_KEEPER_RULES.MAX_DRAFT_ROUNDS;
  const minRound = DEFAULT_KEEPER_RULES.MINIMUM_ROUND; // Round 1

  // FIXED: Build map of which picks each roster actually owns
  const rosterOwnedPicks = await buildPickOwnershipMap(leagueId, season, league.tradedPicks);

  // Calculate base costs for all keepers
  const keepersWithCosts = await Promise.all(
    keepers.map(async (keeper) => {
      const baseCost = await calculateBaseCost(
        keeper.playerId,
        keeper.rosterId,
        season,
        settings
      );
      return { ...keeper, baseCost };
    })
  );

  // Sort by base cost ASCENDING (lowest/best cost first)
  // This ensures players with the best keeper value get priority for their preferred slots
  // Players with worse costs (higher round numbers) will cascade up if needed
  const sortedKeepers = [...keepersWithCosts].sort((a, b) => a.baseCost - b.baseCost);

  const result: CascadeResult = {
    keepers: [],
    conflicts: [],
    hasErrors: false,
    errors: [],
  };

  // Track used slots per roster
  const usedSlots = new Map<string, Set<number>>();

  // Process each keeper
  for (const keeper of sortedKeepers) {
    if (!usedSlots.has(keeper.rosterId)) {
      usedSlots.set(keeper.rosterId, new Set());
    }

    const rosterUsedSlots = usedSlots.get(keeper.rosterId)!;
    const ownedPicks = rosterOwnedPicks.get(keeper.rosterId) || new Set(
      Array.from({ length: maxRounds }, (_, i) => i + 1)
    );

    let finalCost = keeper.baseCost;
    let cascadeSteps = 0;
    const conflictsWith: string[] = [];

    // Helper to check if a slot is available (owned and not used)
    const isSlotAvailable = (round: number) =>
      ownedPicks.has(round) && !rosterUsedSlots.has(round);

    // First, try cascading DOWN toward better rounds (lower numbers)
    // This rewards teams for finding late-round value
    while (
      !isSlotAvailable(finalCost) &&
      finalCost > minRound
    ) {
      if (!ownedPicks.has(finalCost)) {
        conflictsWith.push(`Round ${finalCost} traded away`);
      } else if (rosterUsedSlots.has(finalCost)) {
        const conflictingKeeper = sortedKeepers.find(
          (k) =>
            k.rosterId === keeper.rosterId &&
            k !== keeper &&
            k.baseCost === finalCost
        );
        if (conflictingKeeper) {
          conflictsWith.push(conflictingKeeper.playerName);
        }
      }

      cascadeSteps++;
      finalCost--;
    }

    // If we couldn't find a slot going down, try going UP (higher round numbers)
    // This handles cases where better rounds are all taken or not owned
    if (!isSlotAvailable(finalCost)) {
      // Reset and try from baseCost going UP
      finalCost = keeper.baseCost;
      cascadeSteps = 0;
      conflictsWith.length = 0; // Clear previous conflicts

      while (
        !isSlotAvailable(finalCost) &&
        finalCost <= maxRounds
      ) {
        if (!ownedPicks.has(finalCost)) {
          conflictsWith.push(`Round ${finalCost} traded away`);
        } else if (rosterUsedSlots.has(finalCost)) {
          const conflictingKeeper = sortedKeepers.find(
            (k) =>
              k.rosterId === keeper.rosterId &&
              k !== keeper &&
              k.baseCost === finalCost
          );
          if (conflictingKeeper) {
            conflictsWith.push(conflictingKeeper.playerName);
          }
        }

        cascadeSteps++;
        finalCost++;
      }
    }

    // Check if we couldn't find any available slot
    if (!isSlotAvailable(finalCost)) {
      result.hasErrors = true;
      result.errors.push(
        `${keeper.playerName}: Cannot assign slot - no available rounds (base: R${keeper.baseCost})`
      );
      // Find any available slot as last resort
      for (let r = minRound; r <= maxRounds; r++) {
        if (isSlotAvailable(r)) {
          finalCost = r;
          break;
        }
      }
    }

    // Mark slot as used
    rosterUsedSlots.add(finalCost);

    result.keepers.push({
      playerId: keeper.playerId,
      rosterId: keeper.rosterId,
      playerName: keeper.playerName,
      baseCost: keeper.baseCost,
      finalCost,
      cascadeSteps,
      conflictsWith,
      isCascaded: cascadeSteps > 0,
    });

    // Track conflicts
    if (cascadeSteps > 0) {
      const existingConflict = result.conflicts.find(
        (c) => c.round === keeper.baseCost
      );
      if (existingConflict) {
        existingConflict.players.push(keeper.playerName);
      } else {
        result.conflicts.push({
          round: keeper.baseCost,
          players: [keeper.playerName],
        });
      }
    }
  }

  return result;
}

/**
 * FIXED: Build a map of which draft picks each roster actually owns
 *
 * This accounts for traded picks - a roster may not own their original picks
 * and may own picks originally belonging to other rosters
 */
async function buildPickOwnershipMap(
  leagueId: string,
  season: number,
  tradedPicks: Array<{
    round: number;
    originalOwnerId: string;
    currentOwnerId: string;
  }>
): Promise<Map<string, Set<number>>> {
  const rosters = await prisma.roster.findMany({
    where: { leagueId },
    select: { id: true, sleeperId: true },
  });

  const maxRounds = DEFAULT_KEEPER_RULES.MAX_DRAFT_ROUNDS;

  // Initialize: each roster owns all their original picks
  const ownershipMap = new Map<string, Set<number>>();

  for (const roster of rosters) {
    const picks = new Set<number>();
    for (let round = 1; round <= maxRounds; round++) {
      picks.add(round);
    }
    ownershipMap.set(roster.id, picks);
  }

  // Process traded picks
  for (const trade of tradedPicks) {
    // Find roster by sleeper ID
    const originalRoster = rosters.find((r) => r.sleeperId === trade.originalOwnerId);
    const currentRoster = rosters.find((r) => r.sleeperId === trade.currentOwnerId);

    if (originalRoster && currentRoster && originalRoster.id !== currentRoster.id) {
      // Remove pick from original owner
      ownershipMap.get(originalRoster.id)?.delete(trade.round);

      // Add pick to current owner
      ownershipMap.get(currentRoster.id)?.add(trade.round);
    }
  }

  return ownershipMap;
}

/**
 * Recalculate and apply cascade for all keepers in a league
 * Call this after adding/removing keepers to update all finalCost values
 */
export async function recalculateAndApplyCascade(
  leagueId: string,
  season: number
): Promise<{
  success: boolean;
  updatedCount: number;
  errors: string[];
}> {
  try {
    // Get all keepers for this season
    const keepers = await prisma.keeper.findMany({
      where: {
        roster: { leagueId },
        season,
      },
      include: {
        player: true,
      },
    });

    if (keepers.length === 0) {
      return { success: true, updatedCount: 0, errors: [] };
    }

    // Prepare keeper inputs (use database playerId for consistency)
    // Filter out any keepers with null player (shouldn't happen but be safe)
    const keeperInputs: KeeperInput[] = keepers
      .filter((k) => k.player !== null)
      .map((k) => ({
        playerId: k.playerId,
        rosterId: k.rosterId,
        playerName: k.player.fullName,
        type: k.type as "FRANCHISE" | "REGULAR",
      }));

    if (keeperInputs.length === 0) {
      return { success: true, updatedCount: 0, errors: [] };
    }

    // Calculate cascade
    const cascadeResult = await calculateCascade(leagueId, keeperInputs, season);

    if (cascadeResult.hasErrors) {
      return {
        success: false,
        updatedCount: 0,
        errors: cascadeResult.errors,
      };
    }

    // Update all keeper final costs
    // IMPORTANT: Only finalCost is updated, NOT baseCost!
    // - baseCost = player's TRUE keeper value (original draft round - years kept)
    // - finalCost = draft SLOT this year (may be bumped up due to same-round conflicts)
    // Cascade is a ONE-TIME draft penalty, not a permanent cost change.
    // Next year's calculations use baseCost, so cascade doesn't carry forward.
    // If player is traded, new owner gets baseCost, not cascaded finalCost.
    let updatedCount = 0;
    for (const result of cascadeResult.keepers) {
      const keeper = keepers.find(
        (k) => k.playerId === result.playerId && k.rosterId === result.rosterId
      );

      if (keeper && keeper.finalCost !== result.finalCost) {
        await prisma.keeper.update({
          where: { id: keeper.id },
          data: { finalCost: result.finalCost }, // Only finalCost, never baseCost
        });
        updatedCount++;
      }
    }

    return {
      success: true,
      updatedCount,
      errors: [],
    };
  } catch (error) {
    // Log the actual error for debugging
    console.error("Cascade calculation error:", error);
    return {
      success: false,
      updatedCount: 0,
      errors: [error instanceof Error ? error.message : "Unknown cascade error"],
    };
  }
}

/**
 * Preview cascade for a single team
 */
export async function previewTeamCascade(
  rosterId: string,
  season: number
): Promise<CascadeResult> {
  const roster = await prisma.roster.findUnique({
    where: { id: rosterId },
    include: {
      league: { include: { keeperSettings: true } },
      keepers: {
        where: { season },
        include: { player: true },
      },
    },
  });

  if (!roster) {
    return {
      keepers: [],
      conflicts: [],
      hasErrors: true,
      errors: ["Roster not found"],
    };
  }

  const keeperInputs: KeeperInput[] = roster.keepers.map((k) => ({
    playerId: k.playerId,
    rosterId: k.rosterId,
    playerName: k.player.fullName,
    type: k.type,
  }));

  return calculateCascade(roster.leagueId, keeperInputs, season);
}

/**
 * Get draft board with keeper assignments
 */
export async function getDraftBoardWithKeepers(
  leagueId: string,
  season: number
): Promise<{
  rounds: number;
  rosters: Array<{
    rosterId: string;
    teamName: string;
    slots: Array<{
      round: number;
      keeper: CascadeKeeperResult | null;
      isOwned: boolean;
      tradedTo?: string;
    }>;
  }>;
}> {
  const league = await prisma.league.findUnique({
    where: { id: leagueId },
    include: {
      keeperSettings: true,
      rosters: {
        include: {
          keepers: {
            where: { season },
            include: { player: true },
          },
          teamMembers: {
            include: { user: true },
          },
        },
      },
      tradedPicks: {
        where: { season },
      },
    },
  });

  if (!league) {
    throw new Error("League not found");
  }

  const maxRounds = league.draftRounds || DEFAULT_KEEPER_RULES.MAX_DRAFT_ROUNDS;

  // Calculate cascade for all keepers
  const allKeepers: KeeperInput[] = [];
  for (const roster of league.rosters) {
    for (const keeper of roster.keepers) {
      allKeepers.push({
        playerId: keeper.playerId,
        rosterId: roster.id,
        playerName: keeper.player.fullName,
        type: keeper.type,
      });
    }
  }

  const cascadeResult = await calculateCascade(leagueId, allKeepers, season);

  // Build ownership map
  const ownershipMap = await buildPickOwnershipMap(
    leagueId,
    season,
    league.tradedPicks
  );

  // Build draft board
  const draftBoard = league.rosters.map((roster) => {
    const teamName =
      roster.teamName ||
      roster.teamMembers[0]?.user.displayName ||
      `Team ${roster.sleeperId}`;

    const ownedPicks = ownershipMap.get(roster.id) || new Set<number>();

    const slots = Array.from({ length: maxRounds }, (_, i) => {
      const round = i + 1;
      const keeper = cascadeResult.keepers.find(
        (k) => k.rosterId === roster.id && k.finalCost === round
      );

      // Check if this pick was traded
      const tradedPick = league.tradedPicks.find(
        (tp) => tp.originalOwnerId === roster.sleeperId && tp.round === round
      );

      const newOwner = tradedPick
        ? league.rosters.find((r) => r.sleeperId === tradedPick.currentOwnerId)
        : null;

      return {
        round,
        keeper: keeper || null,
        isOwned: ownedPicks.has(round),
        tradedTo: newOwner?.teamName || undefined,
      };
    });

    return {
      rosterId: roster.id,
      teamName,
      slots,
    };
  });

  return {
    rounds: maxRounds,
    rosters: draftBoard,
  };
}
