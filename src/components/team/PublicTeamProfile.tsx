"use client";

import { useMemo } from "react";
import useSWR from "swr";
import { Eye } from "lucide-react";
import { UsersTeam } from "@/components/ui/CustomIcons";
import { PositionBadge } from "@/components/ui/PositionBadge";
import { AwardsSection, type TeamAward } from "@/components/ui/AwardBadge";
import { TeamTrophyCase } from "./TeamTrophyCase";
import { TeamHistoricalStats } from "./TeamHistoricalStats";
import { TeamTradeHistory } from "./TeamTradeHistory";
import { SuperlativesCard, type Superlative, getSuperlativeIcon } from "./SuperlativesCard";
import { cn } from "@/lib/design-tokens";

const fetcher = (url: string) => fetch(url).then(res => {
  if (!res.ok) throw new Error("Failed to fetch");
  return res.json();
});

interface Player {
  id: string;
  fullName: string;
  position: string | null;
  team: string | null;
}

interface EligiblePlayer {
  player: Player;
  existingKeeper: {
    id: string;
    type: string;
    finalCost: number;
  } | null;
}

interface Championship {
  season: number;
}

interface Trade {
  id: string;
  date: string;
  season: number;
  parties: Array<{
    rosterId: string;
    rosterName: string | null;
    playersGiven: Array<{ playerId: string; sleeperId: string; playerName: string; position: string | null }>;
    playersReceived: Array<{ playerId: string; sleeperId: string; playerName: string; position: string | null }>;
    picksGiven: Array<{ season: number; round: number }>;
    picksReceived: Array<{ season: number; round: number }>;
  }>;
}

interface SuperlativesData {
  teamSuperlatives: Record<string, {
    totalTrades: number;
    bestSeason: { season: number; wins: number; losses: number; points: number } | null;
    totalPoints: number;
    playoffAppearances: number;
    championships: number;
    isTradeMaster: boolean;
    isWaiverHawk: boolean;
  }>;
  leagueSuperlatives: {
    mostTrades: { rosterId: string; value: number } | null;
    bestRecord: { rosterId: string; value: number } | null;
    mostPoints: { rosterId: string; value: number } | null;
  };
}

interface PublicTeamProfileProps {
  leagueId: string;
  rosterId: string;
  teamName: string;
  teamOwners: string;
  season: number;
  players: EligiblePlayer[];
  teamAwards: TeamAward[];
  championships: Championship[];
  runnerUps: Championship[];
  historicalStats: {
    allTimeRecord: { wins: number; losses: number };
    totalPoints: number;
    bestSeason: { season: number; wins: number; losses: number; points: number } | null;
    seasonsPlayed: number;
    playoffAppearances: number;
  } | null;
  trades: Trade[];
}

/**
 * Public Team Profile - Bento Grid Layout
 * Modern asymmetric card layout for viewing other teams' profiles
 */
export function PublicTeamProfile({
  leagueId,
  rosterId,
  teamName,
  teamOwners,
  season,
  players,
  teamAwards,
  championships,
  runnerUps,
  historicalStats,
  trades,
}: PublicTeamProfileProps) {
  // Fetch superlatives data
  const { data: superlativesData } = useSWR<SuperlativesData>(
    `/api/leagues/${leagueId}/superlatives?rosterId=${rosterId}`,
    fetcher,
    { revalidateOnFocus: false }
  );

  // Build superlatives for this team
  const teamSuperlatives = useMemo(() => {
    const superlatives: Superlative[] = [];
    const teamData = superlativesData?.teamSuperlatives?.[rosterId];
    const leagueData = superlativesData?.leagueSuperlatives;

    if (!teamData) return superlatives;

    // Most trades
    if (teamData.totalTrades > 0) {
      superlatives.push({
        icon: getSuperlativeIcon("most_trades"),
        label: "Total Trades",
        value: teamData.totalTrades.toString(),
        isLeagueBest: leagueData?.mostTrades?.rosterId === rosterId,
      });
    }

    // Best season
    if (teamData.bestSeason) {
      superlatives.push({
        icon: getSuperlativeIcon("best_record"),
        label: "Best Season",
        value: `${teamData.bestSeason.wins}-${teamData.bestSeason.losses}`,
        season: teamData.bestSeason.season,
        isLeagueBest: false,
      });
    }

    // Playoff appearances
    if (teamData.playoffAppearances > 0) {
      superlatives.push({
        icon: getSuperlativeIcon("playoff_appearances"),
        label: "Playoff Apps",
        value: teamData.playoffAppearances.toString(),
      });
    }

    // Trade Master badge
    if (teamData.isTradeMaster) {
      superlatives.push({
        icon: getSuperlativeIcon("trade_master"),
        label: "Trade Master",
        value: "Top 3 Trader",
        isLeagueBest: true,
      });
    }

    return superlatives;
  }, [superlativesData, rosterId]);

  // Get keepers and regular players
  const keepers = players.filter(p => p.existingKeeper);
  const topPlayers = players.slice(0, 12); // Top 12 for roster preview

  // Group players by position for roster preview
  const playersByPosition = useMemo(() => {
    const grouped: Record<string, typeof topPlayers> = { QB: [], RB: [], WR: [], TE: [] };
    for (const p of topPlayers) {
      const pos = p.player.position || "FLEX";
      if (grouped[pos]) {
        grouped[pos].push(p);
      }
    }
    return grouped;
  }, [topPlayers]);

  return (
    <div className="space-y-4">
      {/* Header Card - Team name with inline trophies */}
      <div className="bg-[#0d1420] border border-white/[0.06] rounded-xl p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-slate-500/20 to-slate-600/20 border border-slate-500/25 flex items-center justify-center flex-shrink-0">
              <Eye className="w-5 h-5 sm:w-6 sm:h-6 text-slate-400" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                {teamName}
              </h1>
              <p className="text-sm text-slate-500">
                {teamOwners ? `${teamOwners} · ${season}` : `${season} Season`}
              </p>
            </div>
          </div>

          {/* Inline trophies for header */}
          {(championships.length > 0 || runnerUps.length > 0) && (
            <TeamTrophyCase
              championships={championships}
              runnerUps={runnerUps}
              variant="horizontal"
            />
          )}
        </div>
      </div>

      {/* Team Awards */}
      {teamAwards.length > 0 && (
        <AwardsSection awards={teamAwards} className="mt-0" />
      )}

      {/* Bento Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        {/* All-Time Stats - Large card spanning 1 column */}
        {historicalStats && (
          <TeamHistoricalStats
            {...historicalStats}
            variant="compact"
            className="md:row-span-1"
          />
        )}

        {/* Trophy Case - Compact (only if has achievements) */}
        {(championships.length > 0 || runnerUps.length > 0) && (
          <TeamTrophyCase
            championships={championships}
            runnerUps={runnerUps}
            variant="compact"
          />
        )}

        {/* Superlatives - 2x2 grid of achievements */}
        {teamSuperlatives.length > 0 && (
          <SuperlativesCard
            superlatives={teamSuperlatives}
            className="md:col-span-1"
          />
        )}

        {/* Trade Activity - Compact */}
        {trades && trades.length > 0 && (
          <TeamTradeHistory
            trades={trades}
            teamName={teamName}
            rosterId={rosterId}
            variant="compact"
          />
        )}

        {/* Roster Preview - Spans 2 columns on larger screens */}
        <div className="bg-[#0d1420] border border-white/[0.06] rounded-xl p-4 md:col-span-2 lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-slate-500/15 border border-slate-500/25 flex items-center justify-center">
                <UsersTeam className="w-3.5 h-3.5 text-slate-400" />
              </div>
              <h3 className="text-sm font-semibold text-white">Roster Preview</h3>
              <span className="px-1.5 py-0.5 rounded bg-slate-500/15 text-slate-400 text-[10px] font-medium">
                {players.length}
              </span>
              {keepers.length > 0 && (
                <span className="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 text-[10px] font-medium">
                  {keepers.length} keepers
                </span>
              )}
            </div>
          </div>

          {/* Position-grouped roster grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {(["QB", "RB", "WR", "TE"] as const).map((pos) => (
              <div key={pos} className="space-y-1.5">
                <div className="flex items-center gap-1.5 mb-2">
                  <PositionBadge position={pos} size="xs" />
                  <span className="text-[10px] text-slate-500 font-medium">
                    {playersByPosition[pos]?.length || 0}
                  </span>
                </div>
                {playersByPosition[pos]?.slice(0, 3).map((p) => (
                  <div
                    key={p.player.id}
                    className={cn(
                      "px-2 py-1.5 rounded-md text-xs border transition-colors",
                      p.existingKeeper
                        ? "bg-amber-500/10 border-amber-500/20 text-amber-200"
                        : "bg-[#131a28] border-white/[0.04] text-slate-300"
                    )}
                  >
                    <div className="font-medium truncate">{p.player.fullName}</div>
                    {p.player.team && (
                      <div className="text-[9px] text-slate-500">{p.player.team}</div>
                    )}
                  </div>
                ))}
                {(playersByPosition[pos]?.length || 0) > 3 && (
                  <div className="text-[10px] text-slate-500 text-center">
                    +{playersByPosition[pos].length - 3} more
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Full Trade History (collapsible, shown below bento grid) */}
      {trades && trades.length > 0 && (
        <TeamTradeHistory
          trades={trades}
          teamName={teamName}
          rosterId={rosterId}
          defaultLimit={3}
        />
      )}
    </div>
  );
}
