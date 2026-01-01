import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface RouteParams {
  params: Promise<{ playerId: string }>;
}

/**
 * Get the NFL season for a given date
 */
function getSeasonFromDate(date: Date): number {
  const month = date.getMonth();
  const year = date.getFullYear();
  if (month < 2) return year - 1;
  return year;
}

/**
 * Filter out "glitch fix" transactions where a player was dropped to draft pool
 * and immediately re-drafted (within 1 day). These are draft day corrections only.
 *
 * Pattern to filter:
 * 1. DROPPED event (player dropped to draft pool)
 * 2. Followed by DRAFTED event within 1 day in the same league
 *
 * Only filters DROP → DRAFTED pairs, not regular waiver/FA activity.
 */
function filterGlitchTransactions<T extends {
  event: string;
  date?: string;
  season: number;
  leagueId: string;
}>(timeline: T[]): T[] {
  const indicesToRemove = new Set<number>();

  for (let i = 0; i < timeline.length; i++) {
    const current = timeline[i];

    // Only look at DROPPED events with dates
    if (current.event !== "DROPPED") continue;
    if (!current.date) continue;

    const dropDate = new Date(current.date).getTime();

    // Look for a subsequent DRAFTED event within 1 day in the same league
    for (let j = i + 1; j < timeline.length; j++) {
      const next = timeline[j];

      // Must be same league
      if (next.leagueId !== current.leagueId) continue;

      // Only filter DROP → DRAFTED pairs (draft day fixes)
      if (next.event !== "DRAFTED") continue;

      // Check time difference if next has a date
      if (next.date) {
        const draftDate = new Date(next.date).getTime();
        const daysDiff = Math.abs(draftDate - dropDate) / (1000 * 60 * 60 * 24);

        if (daysDiff <= 1) {
          // Draft day glitch fix - remove both
          indicesToRemove.add(i);
          indicesToRemove.add(j);
          break;
        }
      }

      // Only check the next few events
      if (j - i > 3) break;
    }
  }

  return timeline.filter((_, index) => !indicesToRemove.has(index));
}

/**
 * GET /api/players/[playerId]/keeper-history
 *
 * Returns the complete timeline for a player including:
 * - Draft history
 * - Keeper history
 * - Trade transactions
 * - Waiver/FA pickups
 * - Drops
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    const { playerId } = await params;

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get player info - try database ID first, then Sleeper ID
    let player = await prisma.player.findUnique({
      where: { id: playerId },
      select: {
        id: true,
        sleeperId: true,
        fullName: true,
        firstName: true,
        lastName: true,
        position: true,
        team: true,
        age: true,
        yearsExp: true,
        status: true,
        injuryStatus: true,
        fantasyPointsPpr: true,
        gamesPlayed: true,
        pointsPerGame: true,
        metadata: true,
      },
    });

    // If not found by database ID, try Sleeper ID
    if (!player) {
      player = await prisma.player.findUnique({
        where: { sleeperId: playerId },
        select: {
          id: true,
          sleeperId: true,
          fullName: true,
          firstName: true,
          lastName: true,
          position: true,
          team: true,
          age: true,
          yearsExp: true,
          status: true,
          injuryStatus: true,
          fantasyPointsPpr: true,
          gamesPlayed: true,
          pointsPerGame: true,
          metadata: true,
        },
      });
    }

    if (!player) {
      return NextResponse.json({ error: "Player not found" }, { status: 404 });
    }

    // Get all keeper records for this player
    const keepers = await prisma.keeper.findMany({
      where: { playerId: player.id },
      include: {
        roster: {
          select: {
            id: true,
            teamName: true,
            sleeperId: true,
            league: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: { season: "asc" },
    });

    // Get all draft picks for this player
    const draftPicks = await prisma.draftPick.findMany({
      where: { playerId: player.id },
      include: {
        draft: {
          select: {
            season: true,
            league: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        roster: {
          select: {
            id: true,
            teamName: true,
            sleeperId: true,
          },
        },
      },
      orderBy: { draft: { season: "asc" } },
    });

    // Get all transactions for this player (via TransactionPlayer)
    const transactionPlayers = await prisma.transactionPlayer.findMany({
      where: { playerId: player.id },
      include: {
        transaction: {
          select: {
            id: true,
            type: true,
            createdAt: true,
            leagueId: true,
          },
        },
      },
      orderBy: { transaction: { createdAt: "asc" } },
    });

    // Get all unique roster IDs from transactions
    const rosterIds = new Set<string>();
    for (const tp of transactionPlayers) {
      if (tp.fromRosterId) rosterIds.add(tp.fromRosterId);
      if (tp.toRosterId) rosterIds.add(tp.toRosterId);
    }

    // Batch fetch all rosters
    const rosters = await prisma.roster.findMany({
      where: { id: { in: [...rosterIds] } },
      select: {
        id: true,
        teamName: true,
        sleeperId: true,
        leagueId: true,
        league: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    const rosterMap = new Map(rosters.map(r => [r.id, r]));

    // Build timeline data
    type TimelineEvent = {
      season: number;
      date?: string;
      event: "DRAFTED" | "KEPT_REGULAR" | "KEPT_FRANCHISE" | "TRADED" | "WAIVER" | "FREE_AGENT" | "DROPPED";
      teamName: string;
      sleeperId: string | null;
      leagueName: string;
      leagueId: string;
      details?: {
        round?: number;
        pick?: number;
        cost?: number;
        fromTeam?: string;
        toTeam?: string;
      };
    };

    const timeline: TimelineEvent[] = [];

    // Add draft events and infer drops when re-drafted
    // Use league NAME as key since dynasty leagues have different IDs each season
    let lastDraftByLeagueName: Record<string, { season: number; teamName: string; sleeperId: string | null; leagueId: string }> = {};

    for (const pick of draftPicks) {
      const leagueName = pick.draft.league.name;
      const lastDraft = lastDraftByLeagueName[leagueName];

      // If player was drafted before by a different team, infer they were dropped
      if (lastDraft && lastDraft.teamName !== pick.roster?.teamName) {
        timeline.push({
          season: lastDraft.season,
          event: "DROPPED",
          teamName: lastDraft.teamName,
          sleeperId: lastDraft.sleeperId,
          leagueName: leagueName,
          leagueId: lastDraft.leagueId,
        });
      }

      timeline.push({
        season: pick.draft.season,
        event: "DRAFTED",
        teamName: pick.roster?.teamName || "Unknown",
        sleeperId: pick.roster?.sleeperId || null,
        leagueName: pick.draft.league.name,
        leagueId: pick.draft.league.id,
        details: {
          round: pick.round,
        },
      });

      // Track last draft for this league (by name)
      lastDraftByLeagueName[leagueName] = {
        season: pick.draft.season,
        teamName: pick.roster?.teamName || "Unknown",
        sleeperId: pick.roster?.sleeperId || null,
        leagueId: pick.draft.league.id,
      };
    }

    // Add keeper events
    for (const keeper of keepers) {
      timeline.push({
        season: keeper.season,
        event: keeper.type === "FRANCHISE" ? "KEPT_FRANCHISE" : "KEPT_REGULAR",
        teamName: keeper.roster.teamName || "Unknown",
        sleeperId: keeper.roster.sleeperId,
        leagueName: keeper.roster.league.name,
        leagueId: keeper.roster.league.id,
        details: {
          cost: keeper.finalCost,
        },
      });
    }

    // Add transaction events
    for (const tp of transactionPlayers) {
      const txSeason = getSeasonFromDate(tp.transaction.createdAt);
      const txDate = tp.transaction.createdAt.toISOString();

      const fromRoster = tp.fromRosterId ? rosterMap.get(tp.fromRosterId) : null;
      const toRoster = tp.toRosterId ? rosterMap.get(tp.toRosterId) : null;

      // Get league info
      const leagueId = toRoster?.league?.id || fromRoster?.league?.id || "";
      const leagueName = toRoster?.league?.name || fromRoster?.league?.name || "Unknown";

      // Check if this is a drop (fromRoster exists, toRoster doesn't)
      if (fromRoster && !toRoster) {
        timeline.push({
          season: txSeason,
          date: txDate,
          event: "DROPPED",
          teamName: fromRoster.teamName || "Unknown",
          sleeperId: fromRoster.sleeperId,
          leagueName,
          leagueId,
        });
        continue;
      }

      switch (tp.transaction.type) {
        case "TRADE":
          if (toRoster) {
            timeline.push({
              season: txSeason,
              date: txDate,
              event: "TRADED",
              teamName: toRoster.teamName || "Unknown",
              sleeperId: toRoster.sleeperId,
              leagueName,
              leagueId,
              details: {
                fromTeam: fromRoster?.teamName || "Unknown",
                toTeam: toRoster.teamName || "Unknown",
              },
            });
          }
          break;

        case "WAIVER":
          if (toRoster) {
            timeline.push({
              season: txSeason,
              date: txDate,
              event: "WAIVER",
              teamName: toRoster.teamName || "Unknown",
              sleeperId: toRoster.sleeperId,
              leagueName,
              leagueId,
              details: fromRoster ? { fromTeam: fromRoster.teamName || "Waivers" } : undefined,
            });
          }
          break;

        case "FREE_AGENT":
          if (toRoster) {
            timeline.push({
              season: txSeason,
              date: txDate,
              event: "FREE_AGENT",
              teamName: toRoster.teamName || "Unknown",
              sleeperId: toRoster.sleeperId,
              leagueName,
              leagueId,
            });
          }
          break;
      }
    }

    // Sort by date (if available) or season, then by event priority
    const eventPriority: Record<string, number> = {
      DRAFTED: 1,
      TRADED: 2,
      WAIVER: 3,
      FREE_AGENT: 4,
      DROPPED: 5,
      KEPT_REGULAR: 6,
      KEPT_FRANCHISE: 7,
    };

    timeline.sort((a, b) => {
      // First sort by date if both have dates
      if (a.date && b.date) {
        const dateCompare = new Date(a.date).getTime() - new Date(b.date).getTime();
        if (dateCompare !== 0) return dateCompare;
      }
      // Then by season
      if (a.season !== b.season) return a.season - b.season;
      // Then by event priority
      return (eventPriority[a.event] || 99) - (eventPriority[b.event] || 99);
    });

    // Filter out "glitch fix" patterns: DROP followed by DRAFT/ADD within 1 day
    // These are corrections where a player was dropped to draft pool then immediately re-drafted
    const filteredTimeline = filterGlitchTransactions(timeline);

    // Group by league for multi-league support
    const leagueIds = [...new Set(filteredTimeline.map((t) => t.leagueId).filter(Boolean))];
    const byLeague = leagueIds.map((leagueId) => {
      const leagueEvents = filteredTimeline.filter((t) => t.leagueId === leagueId);
      return {
        leagueId,
        leagueName: leagueEvents[0]?.leagueName || "Unknown",
        events: leagueEvents,
      };
    });

    // Get all seasons that have data
    const seasons = [...new Set(filteredTimeline.map((t) => t.season))].sort();

    // Calculate summary stats
    const tradeCount = filteredTimeline.filter((t) => t.event === "TRADED").length;
    const waiverCount = filteredTimeline.filter((t) => t.event === "WAIVER").length;
    const faCount = filteredTimeline.filter((t) => t.event === "FREE_AGENT").length;
    const dropCount = filteredTimeline.filter((t) => t.event === "DROPPED").length;

    return NextResponse.json({
      player,
      timeline: filteredTimeline,
      byLeague,
      seasons,
      summary: {
        totalTimesDrafted: draftPicks.length,
        totalTimesKept: keepers.length,
        franchiseTags: keepers.filter((k) => k.type === "FRANCHISE").length,
        regularKeeps: keepers.filter((k) => k.type === "REGULAR").length,
        trades: tradeCount,
        waiverPickups: waiverCount,
        faPickups: faCount,
        drops: dropCount,
      },
    });
  } catch (error) {
    console.error("Error fetching keeper history:", error);
    return NextResponse.json(
      { error: "Failed to fetch keeper history" },
      { status: 500 }
    );
  }
}
