/**
 * Head-to-Head Records API Route
 * GET /api/leagues/[leagueId]/head-to-head - Get head-to-head records between teams
 *
 * Note: This is a simulated calculation based on standings since we don't have
 * detailed matchup data. For accurate H2H records, matchup data would need to be synced.
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

interface HeadToHeadRecord {
  rosterId: string;
  opponentId: string;
  wins: number;
  losses: number;
  ties: number;
  pointsFor: number;
  pointsAgainst: number;
  streak: number; // Positive = winning streak, negative = losing streak
}

interface TeamH2HData {
  rosterId: string;
  teamName: string;
  owners: string[];
  overallRecord: { wins: number; losses: number; ties: number };
  records: HeadToHeadRecord[];
  dominates: string[]; // Teams this team has winning record against
  struggles: string[]; // Teams this team has losing record against
}

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

    // Fetch all rosters
    const rosters = await prisma.roster.findMany({
      where: { leagueId },
      include: {
        teamMembers: {
          include: {
            user: {
              select: {
                displayName: true,
                sleeperUsername: true,
              },
            },
          },
        },
      },
    });

    if (rosters.length === 0) {
      return NextResponse.json({ headToHead: [], error: "No rosters found" });
    }

    // Since we don't have matchup data, we'll estimate H2H based on points and standings
    // In a real implementation, this would query actual matchup results
    const totalTeams = rosters.length;

    // Calculate estimated H2H records
    // Simple estimation: teams with more points tend to beat teams with fewer points
    const headToHeadData: TeamH2HData[] = rosters.map((roster) => {
      const records: HeadToHeadRecord[] = [];
      const dominates: string[] = [];
      const struggles: string[] = [];

      for (const opponent of rosters) {
        if (opponent.id === roster.id) continue;

        // Estimate record based on relative strength
        // This is simplified - real H2H would require matchup data
        const pointsDiff = Number(roster.pointsFor) - Number(opponent.pointsFor);
        const gamesPlayed = Math.max(roster.wins + roster.losses, 1);
        const opponentGames = Math.max(opponent.wins + opponent.losses, 1);

        // Estimate expected games played against this opponent
        // In a typical fantasy league, you play each team once or twice
        const estimatedGames = Math.min(
          Math.ceil(gamesPlayed / (totalTeams - 1)),
          2
        );

        // Estimate wins based on points differential
        let estimatedWins = 0;
        let estimatedLosses = 0;

        if (pointsDiff > 100) {
          // Strong advantage
          estimatedWins = estimatedGames;
        } else if (pointsDiff > 50) {
          // Moderate advantage
          estimatedWins = Math.ceil(estimatedGames * 0.7);
          estimatedLosses = estimatedGames - estimatedWins;
        } else if (pointsDiff > -50) {
          // Even matchup - split or go by record
          const betterRecord =
            roster.wins / Math.max(gamesPlayed, 1) >
            opponent.wins / Math.max(opponentGames, 1);
          if (betterRecord) {
            estimatedWins = Math.ceil(estimatedGames * 0.55);
            estimatedLosses = estimatedGames - estimatedWins;
          } else {
            estimatedLosses = Math.ceil(estimatedGames * 0.55);
            estimatedWins = estimatedGames - estimatedLosses;
          }
        } else if (pointsDiff > -100) {
          // Moderate disadvantage
          estimatedLosses = Math.ceil(estimatedGames * 0.7);
          estimatedWins = estimatedGames - estimatedLosses;
        } else {
          // Strong disadvantage
          estimatedLosses = estimatedGames;
        }

        const record: HeadToHeadRecord = {
          rosterId: roster.id,
          opponentId: opponent.id,
          wins: estimatedWins,
          losses: estimatedLosses,
          ties: 0,
          pointsFor:
            (Number(roster.pointsFor) / gamesPlayed) * estimatedGames,
          pointsAgainst:
            (Number(opponent.pointsFor) / opponentGames) * estimatedGames,
          streak: estimatedWins > estimatedLosses ? 1 : -1,
        };

        records.push(record);

        if (estimatedWins > estimatedLosses) {
          dominates.push(opponent.id);
        } else if (estimatedLosses > estimatedWins) {
          struggles.push(opponent.id);
        }
      }

      return {
        rosterId: roster.id,
        teamName: roster.teamName || "Unnamed Team",
        owners: roster.teamMembers.map(
          (tm) => tm.user.displayName || tm.user.sleeperUsername
        ),
        overallRecord: {
          wins: roster.wins,
          losses: roster.losses,
          ties: roster.ties,
        },
        records,
        dominates,
        struggles,
      };
    });

    // Build matrix for easy access
    const matrix: Record<string, Record<string, HeadToHeadRecord>> = {};
    for (const team of headToHeadData) {
      matrix[team.rosterId] = {};
      for (const record of team.records) {
        matrix[team.rosterId][record.opponentId] = record;
      }
    }

    // Find rivalries (closest matchups)
    const rivalries: Array<{
      team1: { id: string; name: string };
      team2: { id: string; name: string };
      record: string;
      totalGames: number;
    }> = [];

    const processedPairs = new Set<string>();
    for (const team of headToHeadData) {
      for (const record of team.records) {
        const pairKey = [team.rosterId, record.opponentId].sort().join("-");
        if (processedPairs.has(pairKey)) continue;
        processedPairs.add(pairKey);

        const totalGames = record.wins + record.losses + record.ties;
        if (totalGames > 0 && Math.abs(record.wins - record.losses) <= 1) {
          const opponent = headToHeadData.find(
            (t) => t.rosterId === record.opponentId
          );
          if (opponent) {
            rivalries.push({
              team1: { id: team.rosterId, name: team.teamName },
              team2: { id: opponent.rosterId, name: opponent.teamName },
              record: `${record.wins}-${record.losses}`,
              totalGames,
            });
          }
        }
      }
    }

    return NextResponse.json({
      headToHead: headToHeadData,
      matrix,
      rivalries: rivalries.slice(0, 5),
      note: "Records are estimated based on points scored. Sync matchup data for accurate H2H records.",
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("Head-to-head fetch error", error);
    return NextResponse.json(
      {
        error: "Failed to calculate head-to-head records",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
