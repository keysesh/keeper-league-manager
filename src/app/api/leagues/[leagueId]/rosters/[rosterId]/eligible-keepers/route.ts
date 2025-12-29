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
    const draftPicks = await prisma.draftPick.findMany({
      where: {
        playerId: { in: playerIds },
      },
      include: { draft: true },
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

    /**
     * NEW: Get Origin Season for a player on the current roster
     *
     * Origin Season is the "keeper start season" for eligibility calculation.
     * - Drafted by this roster → origin = draft season
     * - In-season trade → origin = inherited from previous owner
     * - Offseason trade → origin = RESETS to trade season (next season)
     * - Waiver/FA → origin = pickup season
     */
    function getOriginSeason(
      playerId: string,
      targetRosterId: string,
      visited: Set<string> = new Set()
    ): { originSeason: number; acquisitionType: AcquisitionType; draftRound?: number } {
      // Prevent infinite loops in trade chains
      const key = `${playerId}-${targetRosterId}`;
      if (visited.has(key)) {
        return { originSeason: season, acquisitionType: AcquisitionType.WAIVER };
      }
      visited.add(key);

      // 1. Check if player was drafted by this roster
      const draftPick = draftPicks.find(
        (p) => p.playerId === playerId && p.rosterId === targetRosterId
      );

      if (draftPick) {
        // Player was drafted by this roster - origin is draft season
        return {
          originSeason: draftPick.draft.season,
          acquisitionType: AcquisitionType.DRAFTED,
          draftRound: draftPick.round,
        };
      }

      // 2. Find the most recent acquisition transaction for this roster
      const acquisition = transactions.find(
        (tx) => tx.playerId === playerId && tx.toRosterId === targetRosterId
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
        const previousOrigin = getOriginSeason(playerId, acquisition.fromRosterId, visited);
        return {
          originSeason: previousOrigin.originSeason,
          acquisitionType: AcquisitionType.TRADE,
          draftRound: previousOrigin.draftRound, // Inherit draft round for cost calculation
        };
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
      const origin = getOriginSeason(playerId, rosterId);
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
     * NEW: Calculate eligibility using Origin Season approach
     *
     * Core rule: Player may be kept for max 2 seasons total
     * - years_kept = current_season - origin_season
     * - 0 = draft year (eligible)
     * - 1 = final keeper year (eligible)
     * - 2+ = ineligible
     */
    function calculateEligibility(playerId: string) {
      const origin = getOriginSeason(playerId, rosterId);
      const yearsKept = season - origin.originSeason;
      const originalDraft = getOriginalDraft(playerId);
      const costResult = calculateBaseCost(playerId);

      // Max years from settings (default 2 means: draft year + 1 keeper year)
      // yearsKept: 0 = draft year, 1 = first keeper year, 2+ = ineligible
      const isEligible = yearsKept < maxYears;
      const atMaxYears = yearsKept >= maxYears - 1; // Final keeper year

      // Build reason string
      let reason: string | undefined;
      if (!isEligible) {
        reason = `Ineligible: Year ${yearsKept + 1} (max ${maxYears})`;
      } else if (atMaxYears) {
        reason = `Final year (Year ${yearsKept + 1} of ${maxYears})`;
      } else if (yearsKept === 0) {
        reason = "Draft year";
      }

      // Cost calculation: base cost improves by 1 for each year kept
      const baseCost = costResult.baseCost;
      const escalatedCost = Math.max(minRound, baseCost - yearsKept);

      return {
        isEligible,
        yearsKept: yearsKept + 1, // Display as "Year 1", "Year 2" (1-indexed for UI)
        consecutiveYears: yearsKept, // Keep for backwards compatibility
        originSeason: origin.originSeason,
        acquisitionType: origin.acquisitionType,
        atMaxYears,
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

      if (eligibility.isEligible) {
        // Franchise tag is always Round 1
        franchiseCost = {
          baseCost: 1,
          finalCost: 1,
          costBreakdown: "Franchise Tag = Round 1",
        };

        if (!eligibility.atMaxYears) {
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
        } else {
          // At max years - check if FT is available
          if (!canAddFranchise) {
            effectivelyEligible = false;
            reason = "At max years and no Franchise Tags available";
          }
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
