import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getCurrentSeason, isTradeAfterDeadline } from "@/lib/constants/keeper-rules";
import { DEFAULT_KEEPER_RULES } from "@/lib/constants/keeper-rules";
import { AcquisitionType, KeeperType } from "@prisma/client";
import { cache, cacheKeys, cacheTTL } from "@/lib/cache";

/**
 * Get the NFL season for a given date
 * NFL season runs Sept-Feb: 2024 season = Sept 2024 - Feb 2025
 */
function getSeasonFromDate(date: Date): number {
  const month = date.getMonth(); // 0-indexed
  const year = date.getFullYear();

  // January/February = still previous season
  if (month < 2) {
    return year - 1;
  }
  // March-August = preparing for current year's season
  // September+ = current year's season
  return year;
}

interface RouteParams {
  params: Promise<{ leagueId: string; rosterId: string }>;
}

/**
 * GET /api/leagues/[leagueId]/rosters/[rosterId]/eligible-keepers
 *
 * OPTIMIZED: Fetches all data in batch queries instead of per-player queries
 * Reduced from 100+ queries to ~5 queries
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    const { leagueId, rosterId } = await params;

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const season = getCurrentSeason();

    // BATCH QUERY 1: Get roster with players, keepers, and league settings in ONE query
    const roster = await prisma.roster.findUnique({
      where: { id: rosterId },
      include: {
        league: {
          include: { keeperSettings: true },
        },
        rosterPlayers: {
          include: { player: true },
        },
        keepers: {
          where: { season: { lte: season } },
          orderBy: { season: "desc" },
        },
      },
    });

    if (!roster || roster.leagueId !== leagueId) {
      return NextResponse.json({ error: "Roster not found" }, { status: 404 });
    }

    const league = roster.league;
    if (!league?.keeperSettings) {
      return NextResponse.json({ error: "League keeper settings not found" }, { status: 400 });
    }

    const settings = league.keeperSettings;
    const maxYears = settings.regularKeeperMaxYears ?? DEFAULT_KEEPER_RULES.REGULAR_KEEPER_MAX_YEARS;
    const undraftedRound = settings.undraftedRound ?? DEFAULT_KEEPER_RULES.UNDRAFTED_ROUND;
    const minRound = settings.minimumRound ?? DEFAULT_KEEPER_RULES.MINIMUM_ROUND;
    const costReduction = settings.costReductionPerYear ?? DEFAULT_KEEPER_RULES.COST_REDUCTION_PER_YEAR;

    // Get all player IDs on this roster
    const playerIds = roster.rosterPlayers.map(rp => rp.playerId);

    // BATCH QUERY 2: Get all draft picks for all players (including historical for original draft info)
    // Include roster to get sleeperId for matching across seasons
    const draftPicks = await prisma.draftPick.findMany({
      where: {
        playerId: { in: playerIds },
      },
      include: {
        draft: true,
        roster: { select: { sleeperId: true } },
      },
      orderBy: { draft: { season: "asc" } }, // Oldest first to get original draft
    });

    // BATCH QUERY 3: Get ALL transactions for all players (to follow trade chains)
    // We need transactions to/from any roster to trace origin back through trades
    const transactions = await prisma.transactionPlayer.findMany({
      where: {
        playerId: { in: playerIds },
      },
      include: { transaction: true },
      orderBy: { transaction: { createdAt: "desc" } },
    });

    // BATCH QUERY 4: Get all rosters for this league (all seasons) to build rosterId -> sleeperId map
    // This allows us to match transactions across seasons (roster IDs change each year)
    const allRosters = await prisma.roster.findMany({
      where: { leagueId },
      select: { id: true, sleeperId: true },
    });

    // Build rosterId -> sleeperId map for transaction matching
    const rosterToSleeperMap = new Map<string, string>();
    for (const r of allRosters) {
      if (r.sleeperId) {
        rosterToSleeperMap.set(r.id, r.sleeperId);
      }
    }

    // Build lookup maps for O(1) access
    // Store the ORIGINAL (oldest) draft pick for each player
    const originalDraftMap = new Map<string, typeof draftPicks[0]>();
    // Store the MOST RECENT draft pick (for current roster check)
    const recentDraftMap = new Map<string, typeof draftPicks[0]>();
    for (const pick of draftPicks) {
      if (pick.playerId) {
        // First occurrence is the original (oldest due to asc order)
        if (!originalDraftMap.has(pick.playerId)) {
          originalDraftMap.set(pick.playerId, pick);
        }
        // Always update recent to get the latest
        recentDraftMap.set(pick.playerId, pick);
      }
    }

    const transactionMap = new Map<string, typeof transactions[0]>();
    for (const tx of transactions) {
      if (tx.playerId && !transactionMap.has(tx.playerId)) {
        transactionMap.set(tx.playerId, tx);
      }
    }

    // Build keeper history map (player -> keepers)
    const keepersByPlayer = new Map<string, typeof roster.keepers>();
    for (const keeper of roster.keepers) {
      const existing = keepersByPlayer.get(keeper.playerId) || [];
      existing.push(keeper);
      keepersByPlayer.set(keeper.playerId, existing);
    }

    // Current season keepers
    const currentSeasonKeepers = roster.keepers.filter(k => k.season === season);
    const franchiseCount = currentSeasonKeepers.filter(k => k.type === KeeperType.FRANCHISE).length;
    const regularCount = currentSeasonKeepers.filter(k => k.type === KeeperType.REGULAR).length;
    const canAddFranchise = franchiseCount < settings.maxFranchiseTags;

    // Helper: Get original draft info for a player
    function getOriginalDraft(playerId: string): { draftYear: number; draftRound: number } | null {
      const originalPick = originalDraftMap.get(playerId);
      if (originalPick) {
        return {
          draftYear: originalPick.draft.season,
          draftRound: originalPick.round,
        };
      }
      return null;
    }

    // Get current roster's sleeperId for matching across seasons
    const currentSleeperId = roster.sleeperId;

    /**
     * Get Origin Season for a player on the current roster
     *
     * Origin Season is the "keeper start season" for eligibility calculation.
     * - Drafted by this owner (matching sleeperId) → origin = draft season
     * - In-season trade → origin = inherited from previous owner
     * - Offseason trade → origin = RESETS to trade season (next season)
     * - Waiver/FA → origin = pickup season
     */
    function getOriginSeason(
      playerId: string,
      targetSleeperId: string,
      visited: Set<string> = new Set()
    ): { originSeason: number; acquisitionType: AcquisitionType; draftRound?: number } {
      // Prevent infinite loops in trade chains
      const key = `${playerId}-${targetSleeperId}`;
      if (visited.has(key)) {
        return { originSeason: season, acquisitionType: AcquisitionType.WAIVER };
      }
      visited.add(key);

      // 1. Check if player was drafted by this owner (matching sleeperId across seasons)
      const draftPick = draftPicks.find(
        (p) => p.playerId === playerId && p.roster?.sleeperId === targetSleeperId
      );

      if (draftPick) {
        // Player was drafted by this owner - origin is draft season
        return {
          originSeason: draftPick.draft.season,
          acquisitionType: AcquisitionType.DRAFTED,
          draftRound: draftPick.round,
        };
      }

      // 2. Find the most recent acquisition transaction for this owner (by sleeperId)
      // Transactions use rosterId, so we convert to sleeperId for matching across seasons
      const acquisition = transactions.find(
        (tx) => tx.playerId === playerId &&
                tx.toRosterId &&
                rosterToSleeperMap.get(tx.toRosterId) === targetSleeperId
      );

      if (!acquisition) {
        // No transaction found - treat as current season (waiver pickup)
        return { originSeason: season, acquisitionType: AcquisitionType.WAIVER };
      }

      const txDate = acquisition.transaction.createdAt;
      const txType = acquisition.transaction.type;
      const txSeason = getSeasonFromDate(txDate);

      // 3. Handle non-trade acquisitions (waiver, FA)
      if (txType !== "TRADE") {
        const acqType = txType === "WAIVER" ? AcquisitionType.WAIVER : AcquisitionType.FREE_AGENT;

        // Check if player was dropped in the same season
        // If dropped and picked up same season, preserve eligibility from previous owner
        if (acquisition.fromRosterId) {
          const fromSleeperId = rosterToSleeperMap.get(acquisition.fromRosterId);
          if (fromSleeperId) {
            // Player was dropped - check the drop season
            const dropTx = transactions.find(
              (tx) => tx.playerId === playerId && tx.fromRosterId === acquisition.fromRosterId
            );

            if (dropTx) {
              const dropSeason = getSeasonFromDate(dropTx.transaction.createdAt);

              // Same season pickup - follow chain to get origin from previous owner
              if (dropSeason === txSeason) {
                const previousOrigin = getOriginSeason(playerId, fromSleeperId, visited);
                return {
                  originSeason: previousOrigin.originSeason,
                  acquisitionType: acqType,
                  draftRound: previousOrigin.draftRound,
                };
              }
            }
          }
        }

        // Different season or no previous owner - origin resets to pickup season
        return { originSeason: txSeason, acquisitionType: acqType };
      }

      // 4. Handle trades - check if in-season or offseason
      const isOffseasonTrade = isTradeAfterDeadline(txDate, txSeason);

      if (isOffseasonTrade) {
        // Offseason trade - origin RESETS to the next season
        // Player is treated as a fresh acquisition for the new owner
        return {
          originSeason: txSeason + 1,
          acquisitionType: AcquisitionType.TRADE,
        };
      }

      // 5. In-season trade - follow chain to get origin from previous owner
      if (acquisition.fromRosterId) {
        const fromSleeperId = rosterToSleeperMap.get(acquisition.fromRosterId);
        if (fromSleeperId) {
          const previousOrigin = getOriginSeason(playerId, fromSleeperId, visited);
          return {
            originSeason: previousOrigin.originSeason,
            acquisitionType: AcquisitionType.TRADE,
            draftRound: previousOrigin.draftRound, // Inherit draft round for cost calculation
          };
        }
      }

      // Fallback: treat as current season
      return { originSeason: season, acquisitionType: AcquisitionType.TRADE };
    }

    // Legacy helper for acquisition type (for cost calculation)
    function getAcquisition(playerId: string): {
      type: AcquisitionType;
      draftRound?: number;
      isPostDeadlineTrade: boolean;
      tradeDate?: Date;
    } {
      const origin = getOriginSeason(playerId, currentSleeperId);
      const transaction = transactionMap.get(playerId);

      return {
        type: origin.acquisitionType,
        draftRound: origin.draftRound,
        isPostDeadlineTrade: origin.originSeason === season && origin.acquisitionType === AcquisitionType.TRADE,
        tradeDate: transaction?.transaction.createdAt,
      };
    }

    // Helper: Calculate base cost (pure function, no DB calls)
    // Post-deadline trades reset to undrafted round
    // Before-deadline trades preserve original draft value
    function calculateBaseCost(playerId: string): { baseCost: number; isPostDeadlineTrade: boolean } {
      const acquisition = getAcquisition(playerId);

      // Post-deadline trades ALWAYS reset to undrafted round
      if (acquisition.isPostDeadlineTrade) {
        return { baseCost: undraftedRound, isPostDeadlineTrade: true };
      }

      let baseCost: number;
      switch (acquisition.type) {
        case AcquisitionType.DRAFTED:
          const draftRound = acquisition.draftRound || undraftedRound;
          baseCost = Math.max(minRound, draftRound - costReduction);
          break;
        case AcquisitionType.TRADE:
          // Before-deadline trade: preserve original draft value
          const originalDraft = getOriginalDraft(playerId);
          if (originalDraft) {
            baseCost = Math.max(minRound, originalDraft.draftRound - costReduction);
          } else {
            baseCost = undraftedRound;
          }
          break;
        case AcquisitionType.WAIVER:
        case AcquisitionType.FREE_AGENT:
        default:
          baseCost = undraftedRound;
      }

      return { baseCost: Math.max(minRound, baseCost), isPostDeadlineTrade: false };
    }

    /**
     * Calculate eligibility using Origin Season approach
     *
     * Core rules:
     * - Regular keeper: can be kept for up to `regularKeeperMaxYears` (default 2)
     * - Years 1-2 (yearsKept 0-1): Regular OR Franchise
     * - Year 3+ (yearsKept 2+): Must be Franchise tagged (no regular keeper option)
     * - Franchise tag has no year limit (can be used indefinitely)
     */
    function calculateEligibility(playerId: string) {
      const origin = getOriginSeason(playerId, currentSleeperId);
      const yearsKept = season - origin.originSeason;
      const originalDraft = getOriginalDraft(playerId);
      const costResult = calculateBaseCost(playerId);

      // A player can always be kept via Franchise Tag (no year limit)
      // But regular keeper is limited to maxYears (default 2)
      // yearsKept: 0 = year 1, 1 = year 2, 2 = year 3, etc.
      const canBeRegularKeeper = yearsKept < maxYears; // Years 1-2 can be regular
      const mustBeFranchise = yearsKept >= maxYears;   // Year 3+ must use franchise tag
      const isEligible = true; // Players are always eligible (via FT if needed)
      const atMaxYears = mustBeFranchise; // Franchise tag required starting year 3

      // Build reason string
      let reason: string | undefined;
      if (mustBeFranchise) {
        reason = `Year ${yearsKept + 1} - Franchise Tag required`;
      } else if (yearsKept === maxYears - 1) {
        reason = `Final regular keeper year (Year ${yearsKept + 1} of ${maxYears})`;
      } else if (yearsKept === 0) {
        reason = "Draft year";
      }

      // Cost calculation: base cost improves by 1 for each year kept
      const baseCost = costResult.baseCost;
      const escalatedCost = Math.max(minRound, baseCost - yearsKept);

      return {
        isEligible,
        canBeRegularKeeper,
        mustBeFranchise,
        yearsKept: yearsKept + 1, // Display as "Year 1", "Year 2" (1-indexed for UI)
        consecutiveYears: yearsKept, // Keep for backwards compatibility
        originSeason: origin.originSeason,
        acquisitionType: origin.acquisitionType,
        atMaxYears, // Backwards compatibility
        reason,
        baseCost,
        escalatedCost,
        originalDraft,
        isPostDeadlineTrade: origin.originSeason === season && origin.acquisitionType === AcquisitionType.TRADE,
      };
    }

    // Process all players (no DB calls - all in memory)
    const eligiblePlayers = roster.rosterPlayers.map((rp) => {
      const eligibility = calculateEligibility(rp.playerId);
      const existingKeeper = currentSeasonKeepers.find(k => k.playerId === rp.playerId);

      let franchiseCost = null;
      let regularCost = null;
      let effectivelyEligible = eligibility.isEligible;
      let reason = eligibility.reason;

      // Franchise tag is always available (Round 1 cost)
      franchiseCost = {
        baseCost: 1,
        finalCost: 1,
        costBreakdown: "Franchise Tag = Round 1",
      };

      if (eligibility.canBeRegularKeeper) {
        // Regular keeper cost with escalation (cost improves each year)
        const baseCost = eligibility.baseCost;
        const finalCost = eligibility.escalatedCost;
        const yearsKept = eligibility.consecutiveYears;

        let costBreakdown = `R${baseCost}`;
        if (eligibility.isPostDeadlineTrade) {
          costBreakdown = `R${baseCost} (offseason trade - reset)`;
        } else if (yearsKept > 0) {
          costBreakdown = `R${baseCost} - ${yearsKept}yr = R${finalCost}`;
        }

        regularCost = {
          baseCost,
          finalCost,
          costBreakdown,
        };
      } else if (eligibility.mustBeFranchise) {
        // Year 3+ - must use franchise tag, no regular keeper option
        if (!canAddFranchise) {
          effectivelyEligible = false;
          reason = `Year ${eligibility.yearsKept} - Franchise Tag required but none available`;
        }
      }

      return {
        player: {
          id: rp.player.id,
          sleeperId: rp.player.sleeperId,
          fullName: rp.player.fullName,
          firstName: rp.player.firstName,
          lastName: rp.player.lastName,
          position: rp.player.position,
          team: rp.player.team,
          age: rp.player.age,
          yearsExp: rp.player.yearsExp,
          injuryStatus: rp.player.injuryStatus,
        },
        isStarter: rp.isStarter,
        eligibility: {
          isEligible: effectivelyEligible,
          canBeRegularKeeper: eligibility.canBeRegularKeeper,
          mustBeFranchise: eligibility.mustBeFranchise,
          reason,
          yearsKept: eligibility.yearsKept,
          consecutiveYears: eligibility.consecutiveYears,
          originSeason: eligibility.originSeason,
          acquisitionType: eligibility.acquisitionType,
          originalDraft: eligibility.originalDraft,
        },
        costs: {
          franchise: franchiseCost,
          regular: regularCost,
        },
        existingKeeper: existingKeeper
          ? {
              id: existingKeeper.id,
              type: existingKeeper.type,
              finalCost: existingKeeper.finalCost,
              isLocked: existingKeeper.isLocked,
            }
          : null,
      };
    });

    // Sort: eligible first, then by position, then by name
    const positionOrder: Record<string, number> = { QB: 1, RB: 2, WR: 3, TE: 4, K: 5, DEF: 6 };
    eligiblePlayers.sort((a, b) => {
      if (a.eligibility.isEligible !== b.eligibility.isEligible) {
        return a.eligibility.isEligible ? -1 : 1;
      }
      const posA = positionOrder[a.player.position || ""] || 99;
      const posB = positionOrder[b.player.position || ""] || 99;
      if (posA !== posB) return posA - posB;
      return (a.player.fullName || "").localeCompare(b.player.fullName || "");
    });

    const response = NextResponse.json({
      rosterId,
      season,
      players: eligiblePlayers,
      currentKeepers: {
        franchise: franchiseCount,
        regular: regularCount,
        total: currentSeasonKeepers.length,
      },
      limits: {
        maxKeepers: settings.maxKeepers,
        maxFranchiseTags: settings.maxFranchiseTags,
        maxRegularKeepers: settings.maxRegularKeepers,
      },
      canAddMore: {
        franchise: canAddFranchise,
        regular: regularCount < settings.maxRegularKeepers,
        any: currentSeasonKeepers.length < settings.maxKeepers,
      },
    });

    // Cache for 30 seconds, stale-while-revalidate for 60 seconds
    response.headers.set('Cache-Control', 'private, s-maxage=30, stale-while-revalidate=60');
    return response;
  } catch (error) {
    console.error("Error fetching eligible keepers:", error);
    return NextResponse.json({ error: "Failed to fetch eligible keepers" }, { status: 500 });
  }
}
