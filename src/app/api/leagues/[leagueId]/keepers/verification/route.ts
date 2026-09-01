/**
 * GET /api/leagues/[leagueId]/keepers/verification?rosterId=...
 *
 * Round-trip verification: compares the keeper plan saved here against what
 * Sleeper's draft board actually shows (synced draft picks with is_keeper).
 *
 * Comparison logic lives in lib/keeper/verification.ts (pure, unit-tested).
 * When the planning season's draft has no keeper picks synced yet, the
 * answer is "not verifiable yet" — entry is never inferred as successful
 * without evidence.
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { getPlanningSeasonForLeague } from "@/lib/keeper/planning-season-db";
import { computeKeeperVerification } from "@/lib/keeper/verification";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ leagueId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { leagueId } = await params;
    const { searchParams } = new URL(request.url);
    const rosterId = searchParams.get("rosterId");

    if (!rosterId) {
      return NextResponse.json({ error: "rosterId is required" }, { status: 400 });
    }

    // League members only — keeper plans are roster-specific information
    const membership = await prisma.roster.findFirst({
      where: {
        leagueId,
        teamMembers: { some: { userId: session.user.id } },
      },
      select: { id: true },
    });

    if (!membership) {
      return NextResponse.json(
        { error: "You don't have access to this league" },
        { status: 403 }
      );
    }

    // The target roster must belong to this league (prevents cross-league
    // probing via arbitrary rosterId)
    const targetRoster = await prisma.roster.findFirst({
      where: { id: rosterId, leagueId },
      select: { id: true },
    });

    if (!targetRoster) {
      return NextResponse.json({ error: "Roster not found" }, { status: 404 });
    }

    const planningSeason = await getPlanningSeasonForLeague(leagueId);

    const [draft, plannedKeepers] = await Promise.all([
      prisma.draft.findFirst({
        where: { leagueId, season: planningSeason },
        select: {
          status: true,
          picks: {
            where: { rosterId, isKeeper: true },
            select: { playerId: true, round: true },
          },
        },
      }),
      prisma.keeper.findMany({
        where: { rosterId, season: planningSeason },
        select: {
          playerId: true,
          finalCost: true,
          player: {
            select: { sleeperId: true, fullName: true, position: true },
          },
        },
      }),
    ]);

    const result = computeKeeperVerification(
      plannedKeepers.map((k) => ({
        playerId: k.playerId,
        playerSleeperId: k.player.sleeperId,
        playerName: k.player.fullName,
        plannedRound: k.finalCost,
      })),
      draft?.picks ?? [],
      draft !== null
    );

    // Resolve names for unexpected keeper picks
    const unexpectedPlayers = result.unexpectedPlayerIds.length
      ? await prisma.player.findMany({
          where: { id: { in: result.unexpectedPlayerIds } },
          select: { id: true, fullName: true },
        })
      : [];

    const unexpected = result.unexpectedPlayerIds.map((id) => {
      const pick = (draft?.picks ?? []).find((p) => p.playerId === id);
      return {
        playerId: id,
        playerName: unexpectedPlayers.find((p) => p.id === id)?.fullName ?? "Unknown player",
        sleeperRound: pick?.round ?? null,
      };
    });

    return NextResponse.json({
      planningSeason,
      draftStatus: draft?.status ?? null,
      verifiable: result.verifiable,
      entries: result.entries,
      unexpected,
      summary: result.summary,
    });
  } catch (error) {
    logger.error("Error verifying keepers against Sleeper", error);
    return NextResponse.json(
      { error: "Failed to verify keepers" },
      { status: 500 }
    );
  }
}
