import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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

    const league = await prisma.league.findUnique({
      where: { id: leagueId },
      include: {
        rosters: {
          include: {
            teamMembers: {
              include: {
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
            rosterPlayers: {
              include: {
                player: true,
              },
            },
            keepers: {
              where: {
                season: { gte: new Date().getFullYear() - 2 },
              },
              include: {
                player: true,
              },
              orderBy: { season: "desc" },
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
          where: {
            season: { gte: new Date().getFullYear() },
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

    return NextResponse.json({
      id: league.id,
      sleeperId: league.sleeperId,
      name: league.name,
      season: league.season,
      status: league.status,
      totalRosters: league.totalRosters,
      draftRounds: league.draftRounds,
      lastSyncedAt: league.lastSyncedAt,
      keeperSettings: league.keeperSettings,
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
        currentKeepers: roster.keepers.filter(k => k.season === league.season),
      })),
      recentDrafts: league.drafts,
      tradedPicks: league.tradedPicks.map(pick => ({
        season: pick.season,
        round: pick.round,
        originalOwnerId: pick.originalOwnerId,
        currentOwnerId: pick.currentOwnerId,
      })),
      counts: league._count,
    });
  } catch (error) {
    console.error("Error fetching league:", error);
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

    // Verify user is an owner in this league
    const userRoster = await prisma.roster.findFirst({
      where: {
        leagueId,
        teamMembers: {
          some: {
            userId: session.user.id,
            role: "OWNER",
          },
        },
      },
    });

    if (!userRoster) {
      return NextResponse.json(
        { error: "Only league owners can update settings" },
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
    console.error("Error updating league:", error);
    return NextResponse.json(
      { error: "Failed to update league" },
      { status: 500 }
    );
  }
}
