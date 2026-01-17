import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canManageLeague } from "@/lib/permissions";
import { getKeeperPlanningSeason } from "@/lib/constants/keeper-rules";
import { logger } from "@/lib/logger";

interface RouteParams {
  params: Promise<{ leagueId: string }>;
}

/**
 * GET /api/leagues/[leagueId]
 * Get a single league with full details
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    const { leagueId } = await params;

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const currentYear = getKeeperPlanningSeason();

    const league = await prisma.league.findUnique({
      where: { id: leagueId },
      include: {
        commissioner: {
          select: {
            id: true,
            displayName: true,
            sleeperUsername: true,
            avatar: true,
          },
        },
        rosters: {
          select: {
            id: true,
            sleeperId: true,
            teamName: true,
            wins: true,
            losses: true,
            ties: true,
            pointsFor: true,
            pointsAgainst: true,
            teamMembers: {
              select: {
                userId: true,
                role: true,
                user: {
                  select: {
                    id: true,
                    displayName: true,
                    sleeperUsername: true,
                    avatar: true,
                  },
                },
              },
            },
            // Only fetch current season keepers with minimal player data
            keepers: {
              where: { season: currentYear },
              select: {
                id: true,
                season: true,
                type: true,
                finalCost: true,
                player: {
                  select: {
                    fullName: true,
                    position: true,
                    team: true,
                  },
                },
              },
            },
            _count: {
              select: {
                rosterPlayers: true,
                keepers: true,
              },
            },
          },
          orderBy: [
            { wins: "desc" },
            { pointsFor: "desc" },
          ],
        },
        keeperSettings: true,
        drafts: {
          orderBy: { season: "desc" },
          take: 3,
          select: {
            id: true,
            season: true,
            type: true,
            status: true,
            rounds: true,
          },
        },
        tradedPicks: {
          where: { season: currentYear },
          select: {
            season: true,
            round: true,
            originalOwnerId: true,
            currentOwnerId: true,
          },
        },
        _count: {
          select: {
            rosters: true,
            drafts: true,
            transactions: true,
          },
        },
      },
    });

    if (!league) {
      return NextResponse.json(
        { error: "League not found" },
        { status: 404 }
      );
    }

    // Check if user has access to this league
    const userHasAccess = league.rosters.some(roster =>
      roster.teamMembers.some(member => member.userId === session.user.id)
    );

    if (!userHasAccess) {
      return NextResponse.json(
        { error: "You don't have access to this league" },
        { status: 403 }
      );
    }

    // Find the user's roster in this league
    const userRoster = league.rosters.find(roster =>
      roster.teamMembers.some(member => member.userId === session.user.id)
    );

    const isCommissioner = league.commissionerId === session.user.id;

    // Add cache headers for faster subsequent loads
    const response = NextResponse.json({
      id: league.id,
      sleeperId: league.sleeperId,
      name: league.name,
      season: league.season,
      status: league.status,
      totalRosters: league.totalRosters,
      draftRounds: league.draftRounds,
      lastSyncedAt: league.lastSyncedAt,
      settings: league.settings, // Sleeper league settings (playoff_teams, etc.)
      keeperSettings: league.keeperSettings,
      commissioner: league.commissioner ? {
        id: league.commissioner.id,
        displayName: league.commissioner.displayName || league.commissioner.sleeperUsername,
        avatar: league.commissioner.avatar,
      } : null,
      isCommissioner,
      rosters: league.rosters.map(roster => ({
        id: roster.id,
        sleeperId: roster.sleeperId,
        teamName: roster.teamName,
        wins: roster.wins,
        losses: roster.losses,
        ties: roster.ties,
        pointsFor: Number(roster.pointsFor),
        pointsAgainst: Number(roster.pointsAgainst),
        isUserRoster: roster.id === userRoster?.id,
        owners: roster.teamMembers.map(tm => ({
          id: tm.user.id,
          displayName: tm.user.displayName || tm.user.sleeperUsername,
          avatar: tm.user.avatar,
          role: tm.role,
        })),
        playerCount: roster._count.rosterPlayers,
        keeperCount: roster._count.keepers,
        currentKeepers: roster.keepers,
      })),
      recentDrafts: league.drafts,
      tradedPicks: league.tradedPicks,
      counts: league._count,
    });

    // Cache for 30 seconds, stale-while-revalidate for 60 seconds
    response.headers.set('Cache-Control', 'private, s-maxage=30, stale-while-revalidate=60');
    return response;
  } catch (error) {
    logger.error("Error fetching league", error);
    return NextResponse.json(
      { error: "Failed to fetch league" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/leagues/[leagueId]
 * Update league settings (keeper settings)
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    const { leagueId } = await params;

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { keeperSettings } = body;

    // Verify user is the commissioner or app admin
    const hasPermission = await canManageLeague(session.user.id, leagueId);

    if (!hasPermission) {
      return NextResponse.json(
        { error: "Only the commissioner can update league settings" },
        { status: 403 }
      );
    }

    // Update keeper settings
    if (keeperSettings) {
      await prisma.keeperSettings.upsert({
        where: { leagueId },
        update: {
          maxKeepers: keeperSettings.maxKeepers,
          maxFranchiseTags: keeperSettings.maxFranchiseTags,
          maxRegularKeepers: keeperSettings.maxRegularKeepers,
          regularKeeperMaxYears: keeperSettings.regularKeeperMaxYears,
          undraftedRound: keeperSettings.undraftedRound,
          minimumRound: keeperSettings.minimumRound,
          costReductionPerYear: keeperSettings.costReductionPerYear,
        },
        create: {
          leagueId,
          maxKeepers: keeperSettings.maxKeepers ?? 7,
          maxFranchiseTags: keeperSettings.maxFranchiseTags ?? 2,
          maxRegularKeepers: keeperSettings.maxRegularKeepers ?? 5,
          regularKeeperMaxYears: keeperSettings.regularKeeperMaxYears ?? 2,
          undraftedRound: keeperSettings.undraftedRound ?? 8,
          minimumRound: keeperSettings.minimumRound ?? 1,
          costReductionPerYear: keeperSettings.costReductionPerYear ?? 1,
        },
      });
    }

    return NextResponse.json({
      success: true,
      message: "League settings updated",
    });
  } catch (error) {
    logger.error("Error updating league", error);
    return NextResponse.json(
      { error: "Failed to update league" },
      { status: 500 }
    );
  }
}
