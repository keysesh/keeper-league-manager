/**
 * Keeper Economics API Route
 * GET /api/leagues/[leagueId]/keeper-economics
 *
 * League-wide keeper value aggregates for the value screens:
 * - per-team keeper surplus (market pick value − cost pick value) and rank
 * - keeper pressure: share of slots filled, tags used, early rounds consumed
 *
 * Market rounds are VOR estimates from last-season scoring (see
 * lib/keeper/market.ts) — surfaces must present them as estimates.
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { estimateMarketRounds } from "@/lib/keeper/market";
import { getDraftPickValue } from "@/lib/constants/league-config";
import { getPlanningSeasonForLeague } from "@/lib/keeper/planning-season-db";

const EARLY_ROUNDS = 3;

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ leagueId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { leagueId } = await params;
    const season = await getPlanningSeasonForLeague(leagueId);

    const league = await prisma.league.findUnique({
      where: { id: leagueId },
      select: {
        totalRosters: true,
        draftRounds: true,
        keeperSettings: { select: { maxKeepers: true, maxFranchiseTags: true } },
        rosters: {
          select: {
            id: true,
            teamName: true,
            keepers: {
              where: { season },
              select: { playerId: true, finalCost: true, type: true },
            },
          },
        },
      },
    });
    if (!league) {
      return NextResponse.json({ error: "League not found" }, { status: 404 });
    }

    const marketMap = await estimateMarketRounds(
      league.totalRosters,
      league.draftRounds
    );

    const teams = league.rosters
      .map((r) => {
        let surplus = 0;
        let bargain = 0;
        let fair = 0;
        let overpay = 0;
        for (const k of r.keepers) {
          const market = marketMap.get(k.playerId);
          // Without a market estimate the keeper contributes no delta
          const delta =
            market !== undefined
              ? getDraftPickValue(market) - getDraftPickValue(k.finalCost)
              : 0;
          surplus += delta;
          if (delta > 2) bargain++;
          else if (delta < -2) overpay++;
          else fair++;
        }
        return {
          rosterId: r.id,
          teamName: r.teamName,
          keeperCount: r.keepers.length,
          tagCount: r.keepers.filter((k) => k.type === "FRANCHISE").length,
          surplus: Math.round(surplus),
          bargain,
          fair,
          overpay,
        };
      })
      .sort((a, b) => b.surplus - a.surplus)
      .map((t, i) => ({ ...t, rank: i + 1 }));

    const teamCount = league.rosters.length || 1;
    const maxKeepers = league.keeperSettings?.maxKeepers ?? 7;
    const maxTags = league.keeperSettings?.maxFranchiseTags ?? 2;
    const totalKeepers = teams.reduce((s, t) => s + t.keeperCount, 0);
    const totalTags = teams.reduce((s, t) => s + t.tagCount, 0);
    const earlyConsumed = league.rosters.reduce(
      (s, r) => s + r.keepers.filter((k) => k.finalCost <= EARLY_ROUNDS).length,
      0
    );
    const teamsLocked = teams.filter((t) => t.keeperCount >= maxKeepers).length;

    const response = NextResponse.json({
      season,
      teams,
      pressure: {
        teamCount,
        teamsLocked,
        maxKeepers,
        slotsFilledPct: Math.round((totalKeepers / (teamCount * maxKeepers)) * 100),
        tagsUsedPct: Math.round((totalTags / (teamCount * maxTags)) * 100),
        earlyRoundsGonePct: Math.round(
          (earlyConsumed / (teamCount * EARLY_ROUNDS)) * 100
        ),
      },
    });
    response.headers.set(
      "Cache-Control",
      "private, s-maxage=300, stale-while-revalidate=600"
    );
    return response;
  } catch (error) {
    logger.error("Error computing keeper economics", error);
    return NextResponse.json(
      { error: "Failed to compute keeper economics" },
      { status: 500 }
    );
  }
}
