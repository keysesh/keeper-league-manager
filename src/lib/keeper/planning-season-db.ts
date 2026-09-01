import { prisma } from "@/lib/prisma";
import { resolvePlanningSeason } from "./planning-season";

/**
 * Planning season for a league, derived from its synced draft state.
 * Falls back to the calendar rule when the league row is missing.
 */
export async function getPlanningSeasonForLeague(leagueId: string): Promise<number> {
  const league = await prisma.league.findUnique({
    where: { id: leagueId },
    select: { season: true, status: true },
  });
  return resolvePlanningSeason(league);
}
