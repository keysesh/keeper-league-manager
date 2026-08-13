import { prisma } from "@/lib/prisma";
import { SleeperClient } from "@/lib/sleeper/client";
import {
  syncLeagueFast,
  carryOverKeeperPlans,
  TARGET_LEAGUE_NAME,
} from "@/lib/sleeper/sync";
import { getCurrentSeason } from "@/lib/constants/keeper-rules";
import { logger } from "@/lib/logger";

const sleeper = new SleeperClient();

export type MembershipResult =
  | { status: "linked"; leagueId: string; leagueName: string; season: number }
  | { status: "not_in_league" };

/**
 * Guarantee a user's league membership is resolved right now, without a cron.
 *
 * TeamMember rows are what make leagues visible — they normally appear as a
 * side effect of league syncs, which is why a new registrant could see
 * "No leagues found" until the next cron. This is the bounded, registration-
 * safe alternative to syncUserLeagues (which crawls every season back to 2023
 * and re-syncs the full history chain):
 *
 * 1. Link the user to rosters already in our DB (pure DB, no Sleeper call).
 * 2. Discover their current E Pluribus league on Sleeper — only the seasons
 *    that can matter (next, current, previous) — and fast-sync that ONE
 *    league. This re-reads Sleeper's roster list, so a stale partial snapshot
 *    of a mid-renewal league (members still accepting) heals regardless of
 *    when the last cron ran relative to the user joining.
 * 3. Carry keeper plans across the season rollover (idempotent, never
 *    overwrites plans made on the new league).
 *
 * Throws only when Sleeper was unreachable AND the user ended up without a
 * visible league — callers should treat that as retryable, not as
 * "not in the league". Safe to re-run: every write is an upsert or a
 * createMany(skipDuplicates).
 */
export async function ensureLeagueMembership(
  userId: string
): Promise<MembershipResult> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, sleeperId: true, sleeperUsername: true },
  });
  if (!user) {
    throw new Error("User not found");
  }

  // Step 1 — heal from what we already know: any roster row whose owner is
  // this Sleeper account gets a TeamMember link (covers historical seasons
  // synced before the user registered).
  const ownedRosters = await prisma.roster.findMany({
    where: { ownerId: user.sleeperId },
    select: { id: true },
  });
  if (ownedRosters.length > 0) {
    await prisma.teamMember.createMany({
      data: ownedRosters.map((r) => ({
        userId: user.id,
        rosterId: r.id,
        role: "OWNER" as const,
      })),
      skipDuplicates: true,
    });
  }

  // Step 2 — refresh current Sleeper truth for the one league that matters.
  const currentSeason = getCurrentSeason();
  const candidateYears = [currentSeason + 1, currentSeason, currentSeason - 1];
  let sleeperError: unknown = null;
  let discoveryFailures = 0;

  let currentLeagueId: string | null = null;
  for (const year of candidateYears) {
    try {
      const leagues = await sleeper.getUserLeagues(user.sleeperId, year);
      const target = leagues.find((l) => l.name?.includes(TARGET_LEAGUE_NAME));
      if (target) {
        currentLeagueId = target.league_id;
        break;
      }
    } catch (err) {
      discoveryFailures++;
      sleeperError = err;
    }
  }
  if (discoveryFailures < candidateYears.length) {
    // At least one season answered, so "no league found" is a real answer,
    // not an outage artifact.
    sleeperError = null;
  }

  if (currentLeagueId) {
    try {
      const synced = await syncLeagueFast(currentLeagueId);
      try {
        await carryOverKeeperPlans(synced.league.id);
      } catch (err) {
        // Plans can still be carried by the next sync — membership is intact.
        logger.warn("Keeper plan carryover failed during membership sync", {
          userId,
          leagueId: synced.league.id,
          error: err instanceof Error ? err.message : err,
        });
      }
    } catch (err) {
      sleeperError = err;
    }
  }

  // Step 3 — report what the dashboard will actually show (it filters to
  // season >= current - 1).
  const visibleLeague = await prisma.league.findFirst({
    where: {
      season: { gte: currentSeason - 1 },
      rosters: {
        some: { teamMembers: { some: { userId: user.id } } },
      },
    },
    orderBy: { season: "desc" },
    select: { id: true, name: true, season: true },
  });

  if (visibleLeague) {
    return {
      status: "linked",
      leagueId: visibleLeague.id,
      leagueName: visibleLeague.name,
      season: visibleLeague.season,
    };
  }

  if (sleeperError) {
    // Sleeper failed and we could not make a league visible — surface it as
    // retryable instead of falsely reporting "not in the league".
    throw sleeperError instanceof Error
      ? sleeperError
      : new Error(String(sleeperError));
  }

  logger.warn("User has no current E Pluribus membership", {
    userId,
    sleeperUsername: user.sleeperUsername,
  });
  return { status: "not_in_league" };
}
