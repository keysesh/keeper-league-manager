import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { syncLeague, syncUserLeagues, quickSyncLeague, populateKeepersFromDraftPicks, recalculateKeeperYears } from "@/lib/sleeper/sync";
import { prisma } from "@/lib/prisma";
import { getCurrentSeason } from "@/lib/constants/keeper-rules";

// Extend timeout for sync operations (requires Vercel Pro for >10s)
export const maxDuration = 60;

/**
 * POST /api/sleeper/sync
 * Sync league data from Sleeper
 *
 * Body options:
 * - { action: "league", leagueId: string } - Sync a specific league
 * - { action: "user-leagues" } - Sync all leagues for the authenticated user
 * - { action: "quick", leagueId: string } - Quick sync (rosters only)
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { action, leagueId, sleeperLeagueId } = body;

    switch (action) {
      case "league": {
        // Sync a specific league by Sleeper ID
        if (!sleeperLeagueId) {
          return NextResponse.json(
            { error: "sleeperLeagueId is required" },
            { status: 400 }
          );
        }

        const result = await syncLeague(sleeperLeagueId);
        return NextResponse.json({
          success: true,
          message: `Synced league: ${result.league.name}`,
          data: result,
        });
      }

      case "user-leagues": {
        // Sync all leagues for the current user
        const season = getCurrentSeason();
        const result = await syncUserLeagues(session.user.id, season);

        return NextResponse.json({
          success: true,
          message: `Synced ${result.leagues.length} leagues`,
          data: result,
        });
      }

      case "quick": {
        // Quick sync - just update rosters
        if (!leagueId) {
          return NextResponse.json(
            { error: "leagueId is required for quick sync" },
            { status: 400 }
          );
        }

        // Verify user has access to this league
        const roster = await prisma.roster.findFirst({
          where: {
            leagueId,
            teamMembers: {
              some: { userId: session.user.id },
            },
          },
        });

        if (!roster) {
          return NextResponse.json(
            { error: "You don't have access to this league" },
            { status: 403 }
          );
        }

        const result = await quickSyncLeague(leagueId);
        return NextResponse.json({
          success: true,
          message: "Quick sync complete",
          data: result,
        });
      }

      case "populate-keepers": {
        // Populate keeper records from historical draft picks with is_keeper=true
        if (!leagueId) {
          return NextResponse.json(
            { error: "leagueId is required for populate-keepers" },
            { status: 400 }
          );
        }

        // Verify user has access to this league
        const rosterAccess = await prisma.roster.findFirst({
          where: {
            leagueId,
            teamMembers: {
              some: { userId: session.user.id },
            },
          },
        });

        if (!rosterAccess) {
          return NextResponse.json(
            { error: "You don't have access to this league" },
            { status: 403 }
          );
        }

        const result = await populateKeepersFromDraftPicks(leagueId);
        return NextResponse.json({
          success: true,
          message: `Created ${result.created} keeper records, skipped ${result.skipped} (already exist)`,
          data: result,
        });
      }

      case "recalculate-keeper-years": {
        // Recalculate yearsKept for all keepers in a league
        if (!leagueId) {
          return NextResponse.json(
            { error: "leagueId is required for recalculate-keeper-years" },
            { status: 400 }
          );
        }

        // Verify user has access to this league
        const rosterCheck = await prisma.roster.findFirst({
          where: {
            leagueId,
            teamMembers: {
              some: { userId: session.user.id },
            },
          },
        });

        if (!rosterCheck) {
          return NextResponse.json(
            { error: "You don't have access to this league" },
            { status: 403 }
          );
        }

        const result = await recalculateKeeperYears(leagueId);
        return NextResponse.json({
          success: true,
          message: `Updated ${result.updated} of ${result.total} keeper records`,
          data: result,
        });
      }

      case "debug-keepers": {
        // Debug: Show all keeper records and draft picks with isKeeper flag
        if (!leagueId) {
          return NextResponse.json(
            { error: "leagueId is required" },
            { status: 400 }
          );
        }

        const keepers = await prisma.keeper.findMany({
          where: { roster: { leagueId } },
          include: { player: true, roster: true },
          orderBy: [{ season: "asc" }, { roster: { teamName: "asc" } }],
        });

        const keeperDraftPicks = await prisma.draftPick.findMany({
          where: {
            isKeeper: true,
            draft: { league: { id: leagueId } },
          },
          include: { player: true, roster: true, draft: true },
          orderBy: [{ draft: { season: "asc" } }],
        });

        return NextResponse.json({
          keeperRecords: keepers.map(k => ({
            id: k.id,
            playerName: k.player?.fullName,
            rosterId: k.rosterId,
            rosterName: k.roster?.teamName,
            season: k.season,
            yearsKept: k.yearsKept,
            baseCost: k.baseCost,
            finalCost: k.finalCost,
          })),
          draftPicksMarkedAsKeeper: keeperDraftPicks.map(p => ({
            playerName: p.player?.fullName,
            rosterId: p.rosterId,
            rosterName: p.roster?.teamName,
            season: p.draft.season,
            round: p.round,
            isKeeper: p.isKeeper,
          })),
          summary: {
            totalKeeperRecords: keepers.length,
            totalKeeperDraftPicks: keeperDraftPicks.length,
          },
        });
      }

      case "check-sleeper-keepers": {
        // Directly fetch from Sleeper API to see what keeper data they have
        const sleeperLeagueId = body.sleeperLeagueId;
        if (!sleeperLeagueId) {
          return NextResponse.json(
            { error: "sleeperLeagueId is required" },
            { status: 400 }
          );
        }

        const { SleeperClient } = await import("@/lib/sleeper/client");
        const sleeper = new SleeperClient();

        const drafts = await sleeper.getDrafts(sleeperLeagueId);
        const allKeeperPicks = [];

        for (const draft of drafts) {
          const picks = await sleeper.getDraftPicks(draft.draft_id);
          const keeperPicks = picks.filter(p => p.is_keeper === true);
          allKeeperPicks.push({
            draftId: draft.draft_id,
            season: draft.season,
            totalPicks: picks.length,
            keeperPicks: keeperPicks.map(p => ({
              player_id: p.player_id,
              round: p.round,
              pick_no: p.pick_no,
              is_keeper: p.is_keeper,
              metadata: p.metadata,
            })),
          });
        }

        return NextResponse.json({
          sleeperLeagueId,
          drafts: drafts.map(d => ({ id: d.draft_id, season: d.season, status: d.status })),
          keeperData: allKeeperPicks,
        });
      }

      case "sync-drafts-only": {
        // Lightweight sync that only syncs drafts (faster than full sync)
        if (!leagueId) {
          return NextResponse.json(
            { error: "leagueId is required" },
            { status: 400 }
          );
        }

        const league = await prisma.league.findUnique({
          where: { id: leagueId },
        });

        if (!league) {
          return NextResponse.json(
            { error: "League not found" },
            { status: 404 }
          );
        }

        const { SleeperClient } = await import("@/lib/sleeper/client");
        const { mapSleeperDraftStatus } = await import("@/lib/sleeper/mappers");
        const sleeper = new SleeperClient();

        const drafts = await sleeper.getDrafts(league.sleeperId);
        let totalPicks = 0;
        let keeperPicks = 0;

        for (const draftData of drafts) {
          const picks = await sleeper.getDraftPicks(draftData.draft_id);

          // Upsert draft
          const draft = await prisma.draft.upsert({
            where: { sleeperId: draftData.draft_id },
            update: {
              status: mapSleeperDraftStatus(draftData.status),
            },
            create: {
              sleeperId: draftData.draft_id,
              leagueId,
              season: parseInt(draftData.season),
              type: draftData.type === "auction" ? "AUCTION" : draftData.type === "linear" ? "LINEAR" : "SNAKE",
              status: mapSleeperDraftStatus(draftData.status),
              rounds: typeof draftData.settings?.rounds === 'number' ? draftData.settings.rounds : 16,
            },
          });

          // Get roster and player maps
          const rosters = await prisma.roster.findMany({
            where: { leagueId },
            select: { id: true, sleeperId: true },
          });
          const rosterMap = new Map(rosters.map(r => [r.sleeperId, r.id]));

          const playerSleeperIds = picks.filter(p => p.player_id).map(p => p.player_id!);
          const players = await prisma.player.findMany({
            where: { sleeperId: { in: playerSleeperIds } },
            select: { id: true, sleeperId: true },
          });
          const playerMap = new Map(players.map(p => [p.sleeperId, p.id]));

          // Sync picks
          for (const pick of picks) {
            const rosterId = rosterMap.get(String(pick.roster_id));
            if (!rosterId) continue;

            const playerId = pick.player_id ? playerMap.get(pick.player_id) || null : null;

            await prisma.draftPick.upsert({
              where: {
                draftId_round_draftSlot: {
                  draftId: draft.id,
                  round: pick.round,
                  draftSlot: pick.draft_slot,
                },
              },
              update: {
                rosterId,
                playerId,
                pickNumber: pick.pick_no,
                isKeeper: pick.is_keeper || false,
              },
              create: {
                draftId: draft.id,
                rosterId,
                playerId,
                round: pick.round,
                pickNumber: pick.pick_no,
                draftSlot: pick.draft_slot,
                isKeeper: pick.is_keeper || false,
              },
            });

            totalPicks++;
            if (pick.is_keeper) keeperPicks++;
          }
        }

        return NextResponse.json({
          success: true,
          message: `Synced ${drafts.length} drafts, ${totalPicks} picks (${keeperPicks} keepers)`,
          data: { drafts: drafts.length, picks: totalPicks, keepers: keeperPicks },
        });
      }

      case "sync-league-history": {
        // Automatically sync drafts from all historical seasons by following previous_league_id
        // This is the simplest approach - just provide your current Sleeper league ID
        if (!leagueId) {
          return NextResponse.json(
            { error: "leagueId is required" },
            { status: 400 }
          );
        }

        const league = await prisma.league.findUnique({
          where: { id: leagueId },
        });

        if (!league) {
          return NextResponse.json(
            { error: "League not found" },
            { status: 404 }
          );
        }

        const { SleeperClient } = await import("@/lib/sleeper/client");
        const { mapSleeperDraftStatus } = await import("@/lib/sleeper/mappers");
        const sleeper = new SleeperClient();

        // Get roster map from current league
        const rosters = await prisma.roster.findMany({
          where: { leagueId },
          select: { id: true, sleeperId: true },
        });
        const rosterMap = new Map(rosters.map(r => [r.sleeperId, r.id]));

        let totalDrafts = 0;
        let totalPicks = 0;
        let totalKeepers = 0;
        const results: { sleeperLeagueId: string; season: string; picks: number; keepers: number }[] = [];

        // Follow the previous_league_id chain
        let currentSleeperLeagueId: string | null = league.sleeperId;
        const maxSeasons = 5;
        let seasonsProcessed = 0;

        while (currentSleeperLeagueId && seasonsProcessed < maxSeasons) {
          try {
            const leagueData = await sleeper.getLeague(currentSleeperLeagueId);
            const drafts = await sleeper.getDrafts(currentSleeperLeagueId);

            for (const draftData of drafts) {
              const picks = await sleeper.getDraftPicks(draftData.draft_id);

              // Upsert draft
              const draft = await prisma.draft.upsert({
                where: { sleeperId: draftData.draft_id },
                update: {
                  status: mapSleeperDraftStatus(draftData.status),
                },
                create: {
                  sleeperId: draftData.draft_id,
                  leagueId,
                  season: parseInt(draftData.season),
                  type: draftData.type === "auction" ? "AUCTION" : draftData.type === "linear" ? "LINEAR" : "SNAKE",
                  status: mapSleeperDraftStatus(draftData.status),
                  rounds: typeof draftData.settings?.rounds === 'number' ? draftData.settings.rounds : 16,
                },
              });

              // Get all players we need
              const playerSleeperIds = picks.filter(p => p.player_id).map(p => p.player_id!);
              const players = await prisma.player.findMany({
                where: { sleeperId: { in: playerSleeperIds } },
                select: { id: true, sleeperId: true },
              });
              const playerMap = new Map(players.map(p => [p.sleeperId, p.id]));

              let draftPicks = 0;
              let draftKeepers = 0;

              for (const pick of picks) {
                const rosterId = rosterMap.get(String(pick.roster_id));
                if (!rosterId) continue;

                const playerId = pick.player_id ? playerMap.get(pick.player_id) || null : null;

                await prisma.draftPick.upsert({
                  where: {
                    draftId_round_draftSlot: {
                      draftId: draft.id,
                      round: pick.round,
                      draftSlot: pick.draft_slot,
                    },
                  },
                  update: {
                    rosterId,
                    playerId,
                    pickNumber: pick.pick_no,
                    isKeeper: pick.is_keeper || false,
                  },
                  create: {
                    draftId: draft.id,
                    rosterId,
                    playerId,
                    round: pick.round,
                    pickNumber: pick.pick_no,
                    draftSlot: pick.draft_slot,
                    isKeeper: pick.is_keeper || false,
                  },
                });

                draftPicks++;
                if (pick.is_keeper) draftKeepers++;
              }

              totalDrafts++;
              totalPicks += draftPicks;
              totalKeepers += draftKeepers;
              results.push({
                sleeperLeagueId: currentSleeperLeagueId,
                season: draftData.season,
                picks: draftPicks,
                keepers: draftKeepers,
              });
            }

            // Move to previous season
            currentSleeperLeagueId = leagueData.previous_league_id || null;
            seasonsProcessed++;
          } catch (err) {
            console.error(`Error syncing league ${currentSleeperLeagueId}:`, err);
            break;
          }
        }

        return NextResponse.json({
          success: true,
          message: `Synced ${totalDrafts} drafts from ${seasonsProcessed} seasons, ${totalPicks} picks (${totalKeepers} keepers)`,
          data: { drafts: totalDrafts, picks: totalPicks, keepers: totalKeepers, seasons: seasonsProcessed, results },
        });
      }

      case "sync-league-chain": {
        // Sync drafts from multiple Sleeper league IDs (historical league chain)
        // This handles Sleeper's annual league rollover where each year has a different league ID
        const sleeperLeagueIds: string[] = body.sleeperLeagueIds;
        if (!leagueId || !sleeperLeagueIds || !Array.isArray(sleeperLeagueIds)) {
          return NextResponse.json(
            { error: "leagueId and sleeperLeagueIds array are required" },
            { status: 400 }
          );
        }

        const league = await prisma.league.findUnique({
          where: { id: leagueId },
        });

        if (!league) {
          return NextResponse.json(
            { error: "League not found" },
            { status: 404 }
          );
        }

        const { SleeperClient } = await import("@/lib/sleeper/client");
        const { mapSleeperDraftStatus } = await import("@/lib/sleeper/mappers");
        const sleeper = new SleeperClient();

        // Get roster map from current league
        const rosters = await prisma.roster.findMany({
          where: { leagueId },
          select: { id: true, sleeperId: true },
        });
        const rosterMap = new Map(rosters.map(r => [r.sleeperId, r.id]));

        let totalDrafts = 0;
        let totalPicks = 0;
        let totalKeepers = 0;
        const results: { sleeperLeagueId: string; season: string; picks: number; keepers: number }[] = [];

        for (const sleeperLeagueId of sleeperLeagueIds) {
          try {
            const drafts = await sleeper.getDrafts(sleeperLeagueId);

            for (const draftData of drafts) {
              const picks = await sleeper.getDraftPicks(draftData.draft_id);

              // Upsert draft
              const draft = await prisma.draft.upsert({
                where: { sleeperId: draftData.draft_id },
                update: {
                  status: mapSleeperDraftStatus(draftData.status),
                },
                create: {
                  sleeperId: draftData.draft_id,
                  leagueId,
                  season: parseInt(draftData.season),
                  type: draftData.type === "auction" ? "AUCTION" : draftData.type === "linear" ? "LINEAR" : "SNAKE",
                  status: mapSleeperDraftStatus(draftData.status),
                  rounds: typeof draftData.settings?.rounds === 'number' ? draftData.settings.rounds : 16,
                },
              });

              // Get all players we need
              const playerSleeperIds = picks.filter(p => p.player_id).map(p => p.player_id!);
              const players = await prisma.player.findMany({
                where: { sleeperId: { in: playerSleeperIds } },
                select: { id: true, sleeperId: true },
              });
              const playerMap = new Map(players.map(p => [p.sleeperId, p.id]));

              let draftPicks = 0;
              let draftKeepers = 0;

              for (const pick of picks) {
                const rosterId = rosterMap.get(String(pick.roster_id));
                if (!rosterId) continue;

                const playerId = pick.player_id ? playerMap.get(pick.player_id) || null : null;

                await prisma.draftPick.upsert({
                  where: {
                    draftId_round_draftSlot: {
                      draftId: draft.id,
                      round: pick.round,
                      draftSlot: pick.draft_slot,
                    },
                  },
                  update: {
                    rosterId,
                    playerId,
                    pickNumber: pick.pick_no,
                    isKeeper: pick.is_keeper || false,
                  },
                  create: {
                    draftId: draft.id,
                    rosterId,
                    playerId,
                    round: pick.round,
                    pickNumber: pick.pick_no,
                    draftSlot: pick.draft_slot,
                    isKeeper: pick.is_keeper || false,
                  },
                });

                draftPicks++;
                if (pick.is_keeper) draftKeepers++;
              }

              totalDrafts++;
              totalPicks += draftPicks;
              totalKeepers += draftKeepers;
              results.push({
                sleeperLeagueId,
                season: draftData.season,
                picks: draftPicks,
                keepers: draftKeepers,
              });
            }
          } catch (err) {
            console.error(`Error syncing league ${sleeperLeagueId}:`, err);
            results.push({
              sleeperLeagueId,
              season: "error",
              picks: 0,
              keepers: 0,
            });
          }
        }

        return NextResponse.json({
          success: true,
          message: `Synced ${totalDrafts} drafts, ${totalPicks} picks (${totalKeepers} keepers)`,
          data: { drafts: totalDrafts, picks: totalPicks, keepers: totalKeepers, results },
        });
      }

      default:
        return NextResponse.json(
          { error: "Invalid action. Use 'league', 'user-leagues', 'quick', 'populate-keepers', 'recalculate-keeper-years', or 'debug-keepers'" },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("Sync error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Sync failed" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/sleeper/sync
 * Get sync status for a league
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const leagueId = searchParams.get("leagueId");

    if (!leagueId) {
      return NextResponse.json(
        { error: "leagueId is required" },
        { status: 400 }
      );
    }

    const league = await prisma.league.findUnique({
      where: { id: leagueId },
      select: {
        id: true,
        name: true,
        lastSyncedAt: true,
        rosters: {
          select: { id: true },
        },
      },
    });

    if (!league) {
      return NextResponse.json(
        { error: "League not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      leagueId: league.id,
      name: league.name,
      lastSyncedAt: league.lastSyncedAt,
      rosterCount: league.rosters.length,
      needsSync: !league.lastSyncedAt ||
        (new Date().getTime() - league.lastSyncedAt.getTime()) > 3600000, // 1 hour
    });
  } catch (error) {
    console.error("Error getting sync status:", error);
    return NextResponse.json(
      { error: "Failed to get sync status" },
      { status: 500 }
    );
  }
}
