/**
 * LeagueChainService
 *
 * Consolidated service for traversing league chains (current + historical seasons).
 * Replaces 5+ duplicate implementations across the codebase.
 *
 * League chains work by following the `previousLeagueId` field, which stores
 * the Sleeper ID of the previous season's league.
 */

import { prisma } from "@/lib/prisma";

const MAX_CHAIN_DEPTH = 10;

export interface LeagueChainItem {
  id: string; // Database ID
  sleeperId: string;
  season: number;
  previousLeagueId: string | null;
}

/**
 * Get all leagues in the historical chain starting from a database league ID.
 * Returns array ordered from current season to oldest (most recent first).
 *
 * @param startLeagueId - Database ID of the starting league
 * @param maxDepth - Maximum number of seasons to traverse (default: 10)
 * @returns Array of database league IDs in the chain
 */
export async function getLeagueChain(
  startLeagueId: string,
  maxDepth = MAX_CHAIN_DEPTH
): Promise<string[]> {
  const leagueIds: string[] = [];

  async function addToChain(leagueId: string, depth: number): Promise<void> {
    if (depth >= maxDepth) return;

    leagueIds.push(leagueId);

    const leagueData = await prisma.league.findUnique({
      where: { id: leagueId },
      select: { previousLeagueId: true },
    });

    if (!leagueData?.previousLeagueId) return;

    // Find the previous league by its Sleeper ID
    const prevLeague = await prisma.league.findUnique({
      where: { sleeperId: leagueData.previousLeagueId },
      select: { id: true },
    });

    if (prevLeague?.id) {
      await addToChain(prevLeague.id, depth + 1);
    }
  }

  await addToChain(startLeagueId, 0);
  return leagueIds;
}

/**
 * Get detailed league chain with full metadata.
 * Useful when you need season numbers and Sleeper IDs for each league.
 *
 * @param startLeagueId - Database ID of the starting league
 * @param maxDepth - Maximum number of seasons to traverse (default: 10)
 * @returns Array of LeagueChainItem objects
 */
export async function getLeagueChainWithDetails(
  startLeagueId: string,
  maxDepth = MAX_CHAIN_DEPTH
): Promise<LeagueChainItem[]> {
  const chain: LeagueChainItem[] = [];

  async function addToChain(leagueId: string, depth: number): Promise<void> {
    if (depth >= maxDepth) return;

    const leagueData = await prisma.league.findUnique({
      where: { id: leagueId },
      select: {
        id: true,
        sleeperId: true,
        season: true,
        previousLeagueId: true,
      },
    });

    if (!leagueData) return;

    chain.push({
      id: leagueData.id,
      sleeperId: leagueData.sleeperId,
      season: leagueData.season,
      previousLeagueId: leagueData.previousLeagueId,
    });

    if (!leagueData.previousLeagueId) return;

    // Find the previous league by its Sleeper ID
    const prevLeague = await prisma.league.findUnique({
      where: { sleeperId: leagueData.previousLeagueId },
      select: { id: true },
    });

    if (prevLeague?.id) {
      await addToChain(prevLeague.id, depth + 1);
    }
  }

  await addToChain(startLeagueId, 0);
  return chain;
}

/**
 * Get Sleeper league IDs in the chain by following the Sleeper API's
 * previous_league_id field. This is used during initial sync when
 * leagues may not exist in the database yet.
 *
 * @param startSleeperLeagueId - Sleeper ID of the starting league
 * @param getLeagueFromSleeper - Function to fetch league data from Sleeper API
 * @param maxDepth - Maximum number of seasons to traverse (default: 5)
 * @returns Array of Sleeper league IDs
 */
export async function getSleeperLeagueChain(
  startSleeperLeagueId: string,
  getLeagueFromSleeper: (sleeperLeagueId: string) => Promise<{
    league_id: string;
    previous_league_id: string | null;
  }>,
  maxDepth = 5
): Promise<string[]> {
  const sleeperIds: string[] = [];
  let currentId: string | null = startSleeperLeagueId;
  let depth = 0;

  while (currentId && depth < maxDepth) {
    sleeperIds.push(currentId);

    try {
      const leagueData = await getLeagueFromSleeper(currentId);
      currentId = leagueData.previous_league_id || null;
      depth++;
    } catch {
      // If we can't fetch the league, stop traversing
      break;
    }
  }

  return sleeperIds;
}

/**
 * Get all rosters across the league chain, mapped by their Sleeper ID.
 * This is useful for tracking the same team across multiple seasons.
 *
 * @param leagueChain - Array of database league IDs
 * @returns Map of roster Sleeper ID to array of database roster IDs
 */
export async function getRosterChainMap(
  leagueChain: string[]
): Promise<Map<string, string[]>> {
  const allRosters = await prisma.roster.findMany({
    where: { leagueId: { in: leagueChain } },
    select: { id: true, sleeperId: true, leagueId: true },
  });

  const rosterChainMap = new Map<string, string[]>();
  for (const roster of allRosters) {
    if (!rosterChainMap.has(roster.sleeperId)) {
      rosterChainMap.set(roster.sleeperId, []);
    }
    rosterChainMap.get(roster.sleeperId)!.push(roster.id);
  }

  return rosterChainMap;
}
