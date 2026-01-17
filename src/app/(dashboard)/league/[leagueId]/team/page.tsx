"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import useSWR from "swr";
import { Skeleton } from "@/components/ui/Skeleton";
import { BackLink } from "@/components/ui/BackLink";
import {
  Users,
  Trophy,
  Star,
  Crown,
  Medal,
  ChevronDown,
  ChevronRight,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import { TournamentBracket } from "@/components/ui/TournamentBracket";

const fetcher = (url: string) => fetch(url).then(res => {
  if (!res.ok) throw new Error("Failed to fetch");
  return res.json();
});

interface Roster {
  id: string;
  teamName: string | null;
  owners?: { displayName: string }[];
  wins: number;
  losses: number;
  ties: number;
  pointsFor: number;
  pointsAgainst: number;
  keeperCount?: number;
}

interface SleeperSettings {
  playoff_teams?: number;
  playoff_week_start?: number;
  num_teams?: number;
  [key: string]: unknown;
}

interface LeagueData {
  id: string;
  name: string;
  season: number;
  settings?: SleeperSettings | null;
  rosters: Roster[];
}

interface HistoricalRecord {
  season: string;
  wins: number;
  losses: number;
  ties: number;
  pointsFor: number;
  pointsAgainst: number;
  playoffFinish?: string | null;
  standing?: number;
}

interface OwnerHistory {
  ownerId: string;
  displayName: string;
  avatar: string | null;
  currentTeamName: string | null;
  currentRosterId: string | null;
  seasons: HistoricalRecord[];
  totals: {
    wins: number;
    losses: number;
    ties: number;
    pointsFor: number;
    pointsAgainst: number;
    championships: number;
    playoffAppearances: number;
    seasonsPlayed: number;
  };
}

interface OwnerHistoryData {
  leagueId: string;
  currentSeason: string;
  availableSeasons: string[];
  owners: OwnerHistory[];
}

// Get initials from team name
function getInitials(name: string | null): string {
  if (!name) return "??";
  return name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
}

// Get rank styling based on position
function getRankStyle(rank: number): { bg: string; text: string; glow: string; icon?: React.ReactNode } {
  switch (rank) {
    case 1:
      return {
        bg: "bg-gradient-to-br from-amber-400 to-amber-600",
        text: "text-black",
        glow: "shadow-lg shadow-amber-500/30",
        icon: <Crown className="w-3.5 h-3.5" />
      };
    case 2:
      return {
        bg: "bg-gradient-to-br from-zinc-300 to-zinc-400",
        text: "text-black",
        glow: "shadow-lg shadow-zinc-400/30",
        icon: <Medal className="w-3.5 h-3.5" />
      };
    case 3:
      return {
        bg: "bg-gradient-to-br from-amber-600 to-amber-800",
        text: "text-white",
        glow: "shadow-lg shadow-amber-700/30",
        icon: <Medal className="w-3.5 h-3.5" />
      };
    default:
      return {
        bg: "bg-zinc-800/80",
        text: "text-zinc-400",
        glow: ""
      };
  }
}

interface BracketTeam {
  id: string;
  teamName: string | null;
  ownerName: string | null;
  sleeperRosterId?: number;
}

interface PlayoffData {
  winnersBracket: Array<{
    round: number;
    matchupId: number;
    team1: BracketTeam | null;
    team2: BracketTeam | null;
    winner: BracketTeam | null;
    loser: BracketTeam | null;
    placement?: number;
  }>;
  losersBracket: Array<{
    round: number;
    matchupId: number;
    team1: BracketTeam | null;
    team2: BracketTeam | null;
    winner: BracketTeam | null;
    loser: BracketTeam | null;
    placement?: number;
  }>;
  playoffTeams: number;
  rosterIdMapping?: Record<number, string>; // Sleeper roster_id -> DB roster UUID
}

export default function TeamsPage() {
  const params = useParams();
  const leagueId = params.leagueId as string;
  const [showBracket, setShowBracket] = useState(false);

  const { data: league, error, isLoading } = useSWR<LeagueData>(
    `/api/leagues/${leagueId}`,
    fetcher
  );

  // Fetch historical owner data
  const { data: ownerHistory } = useSWR<OwnerHistoryData>(
    `/api/leagues/${leagueId}/owner-history`,
    fetcher
  );

  // Always fetch playoffs to determine final standings
  const { data: playoffs } = useSWR<PlayoffData>(
    `/api/leagues/${leagueId}/playoffs`,
    fetcher
  );

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
        <div>
          <Skeleton className="h-4 w-24 mb-3" />
          <Skeleton className="h-10 w-48" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <Skeleton key={i} className="h-48 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !league) {
    return (
      <div className="max-w-7xl mx-auto p-4 md:p-6">
        <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-6">
          <p className="text-red-400 font-medium">Failed to load teams</p>
        </div>
      </div>
    );
  }

  const playoffSpots = league.settings?.playoff_teams ?? Math.min(6, Math.floor(league.rosters.length / 2));

  // Build playoff placement map from bracket data
  // Only use winners bracket for 1st-6th place
  // Losers bracket is for toilet bowl/consolation and doesn't affect draft order
  const playoffPlacements = new Map<string, number>();

  // Helper to resolve DB roster ID from bracket team
  const resolveRosterId = (team: BracketTeam | null): string | null => {
    if (!team) return null;
    // If we have a sleeperRosterId and mapping, use that
    if (team.sleeperRosterId && playoffs?.rosterIdMapping) {
      const mappedId = playoffs.rosterIdMapping[team.sleeperRosterId];
      if (mappedId) return mappedId;
    }
    // Otherwise use the id directly (might be a UUID or a string number)
    return team.id;
  };

  if (playoffs?.winnersBracket) {
    // Sort matchups by round descending to process finals first
    const sortedMatchups = [...playoffs.winnersBracket].sort((a, b) => b.round - a.round);

    sortedMatchups.forEach(matchup => {
      const winnerId = resolveRosterId(matchup.winner);
      const loserId = resolveRosterId(matchup.loser);

      // Championship game (placement 1)
      if (matchup.placement === 1) {
        if (winnerId && !playoffPlacements.has(winnerId)) {
          playoffPlacements.set(winnerId, 1); // Champion
        }
        if (loserId && !playoffPlacements.has(loserId)) {
          playoffPlacements.set(loserId, 2); // Runner-up
        }
      }
      // 3rd place game (placement 2 in Sleeper means 3rd place game)
      else if (matchup.placement === 2) {
        if (winnerId && !playoffPlacements.has(winnerId)) {
          playoffPlacements.set(winnerId, 3); // 3rd place
        }
        if (loserId && !playoffPlacements.has(loserId)) {
          playoffPlacements.set(loserId, 4); // 4th place
        }
      }
      // 5th place game (placement 3 in Sleeper)
      else if (matchup.placement === 3) {
        if (winnerId && !playoffPlacements.has(winnerId)) {
          playoffPlacements.set(winnerId, 5); // 5th place
        }
        if (loserId && !playoffPlacements.has(loserId)) {
          playoffPlacements.set(loserId, 6); // 6th place
        }
      }
    });
  }

  // Losers bracket handles 7th place and below (teams that didn't make playoffs)
  // These are toilet bowl/consolation matchups - we skip them for draft order
  // since non-playoff teams are ordered by regular season record

  // Sort by regular season: wins (desc), then points for (desc)
  const sortedRosters = [...league.rosters].sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    return b.pointsFor - a.pointsFor;
  });

  // Calculate draft order based on final standings
  // Non-playoff teams pick first (worst record first), then playoff teams in reverse finish order
  const calculateDraftPick = (rosterId: string): number | undefined => {
    const placement = playoffPlacements.get(rosterId);
    const totalTeams = league.rosters.length;

    if (placement !== undefined) {
      // Playoff teams: Champion picks last, runner-up second to last, etc.
      return totalTeams - placement + 1;
    }

    // Non-playoff teams: Sort by record (worst first)
    const nonPlayoffTeams = sortedRosters.filter(r => !playoffPlacements.has(r.id));
    const nonPlayoffRank = nonPlayoffTeams.findIndex(r => r.id === rosterId);
    if (nonPlayoffRank !== -1) {
      // Reverse order: worst record picks first
      return nonPlayoffTeams.length - nonPlayoffRank;
    }
    return undefined;
  };

  // Check if playoffs are complete
  const hasChampion = [...playoffPlacements.values()].includes(1);

  // Find top scorer for accolade
  const topScorerId = sortedRosters.reduce((maxId, roster) =>
    roster.pointsFor > (sortedRosters.find(r => r.id === maxId)?.pointsFor || 0) ? roster.id : maxId
  , sortedRosters[0]?.id);

  // Create a map from sleeper owner ID to historical data
  const ownerHistoryMap = new Map<string | undefined, OwnerHistory>();
  ownerHistory?.owners.forEach(owner => {
    if (owner.currentRosterId) {
      ownerHistoryMap.set(owner.currentRosterId, owner);
    }
  });

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
      {/* Header */}
      <div>
        <BackLink href={`/league/${leagueId}`} label="Back to League" />
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/20 to-amber-600/10 ring-1 ring-amber-500/20 flex items-center justify-center">
            <Users className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight">League Standings</h1>
            <p className="text-sm text-zinc-500">{league.name} • {league.season}</p>
          </div>
        </div>
      </div>

      {/* Compact Team Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {sortedRosters.map((roster, index) => {
          const rank = index + 1;
          const isPlayoff = rank <= playoffSpots;
          const rankStyle = getRankStyle(rank);
          const history = ownerHistoryMap.get(roster.id);
          const playoffPlacement = playoffPlacements.get(roster.id);
          const draftPick = hasChampion ? calculateDraftPick(roster.id) : undefined;
          const isTopScorer = roster.id === topScorerId;

          return (
            <TeamCard
              key={roster.id}
              roster={roster}
              rank={rank}
              isPlayoff={isPlayoff}
              rankStyle={rankStyle}
              leagueId={leagueId}
              history={history}
              playoffPlacement={playoffPlacement}
              draftPick={draftPick}
              isTopScorer={isTopScorer}
            />
          );
        })}
      </div>

      {/* Playoff Bracket Section */}
      <div className="bg-zinc-900/50 backdrop-blur-sm rounded-xl border border-white/[0.06] overflow-hidden">
        <button
          onClick={() => setShowBracket(!showBracket)}
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/[0.02] transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-amber-500/10 flex items-center justify-center">
              <Trophy className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-left">
              <h3 className="text-sm font-semibold text-white">Playoff Bracket</h3>
              <p className="text-xs text-zinc-500">{playoffSpots} teams • Championship</p>
            </div>
          </div>
          <ChevronDown
            className={`w-5 h-5 text-zinc-400 transition-transform ${showBracket ? "rotate-180" : ""}`}
          />
        </button>
        {showBracket && (
          <div className="border-t border-white/[0.04]">
            <div className="p-4">
              {playoffs ? (
                <TournamentBracket
                  winnersBracket={playoffs.winnersBracket}
                  losersBracket={playoffs.losersBracket}
                  playoffTeams={playoffs.playoffTeams}
                />
              ) : (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-2 border-amber-400 border-t-transparent"></div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {sortedRosters.length === 0 && (
        <div className="text-center py-16">
          <div className="w-16 h-16 rounded-2xl bg-zinc-800/50 flex items-center justify-center mx-auto mb-4">
            <Users className="w-8 h-8 text-zinc-600" />
          </div>
          <p className="text-zinc-400 font-medium">No teams found</p>
          <p className="text-sm text-zinc-600 mt-1">Teams will appear once the league syncs</p>
        </div>
      )}
    </div>
  );
}

// Helper to get playoff finish label
function getPlayoffLabel(placement: number): { label: string; short: string } {
  switch (placement) {
    case 1: return { label: "Champion", short: "1st" };
    case 2: return { label: "Runner-Up", short: "2nd" };
    case 3: return { label: "3rd Place", short: "3rd" };
    case 4: return { label: "4th Place", short: "4th" };
    case 5: return { label: "5th Place", short: "5th" };
    case 6: return { label: "6th Place", short: "6th" };
    default: return { label: `${placement}th Place`, short: `${placement}th` };
  }
}

// Compact Team Card Component with Historical Data and Fun Badges
function TeamCard({
  roster,
  rank,
  isPlayoff,
  rankStyle,
  leagueId,
  history,
  playoffPlacement,
  draftPick,
  isTopScorer,
  winPct: passedWinPct,
}: {
  roster: Roster;
  rank: number;
  isPlayoff: boolean;
  rankStyle: { bg: string; text: string; glow: string; icon?: React.ReactNode };
  leagueId: string;
  history?: OwnerHistory;
  playoffPlacement?: number;
  draftPick?: number;
  isTopScorer?: boolean;
  winPct?: number;
}) {
  const totalGames = roster.wins + roster.losses + roster.ties;
  const winPct = passedWinPct ?? (totalGames > 0 ? roster.wins / totalGames : 0);

  // Calculate trend
  const lastSeasonRecord = history?.seasons[1];
  const currentSeasonRecord = history?.seasons[0];
  let trend: "up" | "down" | "same" = "same";
  if (lastSeasonRecord && currentSeasonRecord) {
    const lastWinPct = lastSeasonRecord.wins / (lastSeasonRecord.wins + lastSeasonRecord.losses) || 0;
    const currWinPct = currentSeasonRecord.wins / (currentSeasonRecord.wins + currentSeasonRecord.losses) || 0;
    if (currWinPct > lastWinPct + 0.05) trend = "up";
    else if (currWinPct < lastWinPct - 0.05) trend = "down";
  }

  const isChampion = playoffPlacement === 1;
  const isRunnerUp = playoffPlacement === 2;
  const isTopFinisher = playoffPlacement !== undefined && playoffPlacement <= 3;

  // Fun accolades
  const accolades: string[] = [];
  if (isTopScorer) accolades.push("Scoring Leader");
  if (winPct >= 0.75 && totalGames >= 5) accolades.push("Dominant");
  if (history?.totals.championships && history.totals.championships >= 2) accolades.push("Dynasty");
  if (history?.totals.playoffAppearances === history?.totals.seasonsPlayed &&
      history?.totals.seasonsPlayed && history.totals.seasonsPlayed >= 2) accolades.push("Perennial Contender");
  if (winPct <= 0.3 && totalGames >= 5) accolades.push("Rebuilding");

  return (
    <Link
      href={`/league/${leagueId}/team/${roster.id}`}
      className={`
        group relative rounded-xl p-3 transition-all duration-200
        bg-zinc-900/60 backdrop-blur-sm overflow-visible
        ${isChampion ? "ring-2 ring-amber-500/50 bg-gradient-to-br from-amber-500/10 via-transparent to-transparent" : ""}
        ${isRunnerUp ? "ring-1 ring-zinc-400/40" : ""}
        border ${isPlayoff ? "border-emerald-500/20" : "border-white/[0.04]"}
        hover:border-amber-500/30 hover:bg-zinc-900/80
        hover:shadow-lg hover:shadow-amber-500/5
      `}
    >
      {/* Rank Badge - Top Left */}
      <div className={`
        absolute -top-2.5 -left-2.5 w-8 h-8 rounded-xl flex items-center justify-center
        text-sm font-bold ${rankStyle.bg} ${rankStyle.text} ${rankStyle.glow}
      `}>
        {rankStyle.icon || rank}
      </div>

      {/* Draft Pick Badge - Top Right (Big & Prominent) */}
      {draftPick !== undefined && (
        <div className={`
          absolute -top-3 -right-3 w-12 h-12 rounded-xl flex flex-col items-center justify-center shadow-lg
          ${draftPick <= 3 ? "bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-emerald-500/40" : ""}
          ${draftPick >= 10 ? "bg-gradient-to-br from-red-500 to-red-600 shadow-red-500/40" : ""}
          ${draftPick > 3 && draftPick < 10 ? "bg-gradient-to-br from-zinc-500 to-zinc-600 shadow-zinc-500/30" : ""}
        `}>
          <span className="text-[8px] font-semibold text-white/80 uppercase">Pick</span>
          <span className="text-xl font-black text-white leading-none">{draftPick}</span>
        </div>
      )}

      {/* Champion Banner - Centered Top */}
      {isChampion && (
        <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 shadow-lg shadow-amber-500/40">
          <div className="flex items-center gap-1.5">
            <Crown className="w-4 h-4 text-amber-900" />
            <span className="text-xs font-black text-amber-900 uppercase tracking-wide">Champion</span>
            <Crown className="w-4 h-4 text-amber-900" />
          </div>
        </div>
      )}

      {/* Runner-Up Banner */}
      {isRunnerUp && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-gradient-to-r from-zinc-300 to-zinc-400 shadow-lg">
          <span className="text-[10px] font-bold text-zinc-800 uppercase tracking-wide">Runner-Up</span>
        </div>
      )}

      {/* 3rd-6th Place Badge */}
      {playoffPlacement && playoffPlacement >= 3 && playoffPlacement <= 6 && (
        <div className="absolute -top-2 left-10 px-2 py-0.5 rounded-full bg-zinc-700/90 shadow">
          <span className="text-[9px] font-bold text-zinc-200">{getPlayoffLabel(playoffPlacement).label}</span>
        </div>
      )}

      {/* Team Info */}
      <div className={`${isChampion ? "pt-5" : isRunnerUp || isTopFinisher ? "pt-3" : "pt-3"}`}>
        {/* Avatar + Name Row */}
        <div className="flex items-center gap-2.5 mb-3">
          {history?.avatar ? (
            <img
              src={history.avatar}
              alt=""
              className={`w-11 h-11 rounded-xl ring-2 ${isChampion ? "ring-amber-500/60" : "ring-white/10"}`}
            />
          ) : (
            <div className={`w-11 h-11 rounded-xl bg-gradient-to-br from-amber-500/40 to-amber-600/30 flex items-center justify-center text-white text-sm font-bold ring-2 ${isChampion ? "ring-amber-500/60" : "ring-white/10"}`}>
              {getInitials(roster.teamName)}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-white truncate group-hover:text-amber-200 transition-colors">
              {roster.teamName || "Unnamed Team"}
            </p>
            <p className="text-[11px] text-zinc-400 truncate">
              {history?.displayName || roster.owners?.[0]?.displayName || "Unknown"}
            </p>
          </div>
        </div>

        {/* Accolades */}
        {accolades.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {accolades.slice(0, 2).map(accolade => (
              <span key={accolade} className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/20">
                {accolade}
              </span>
            ))}
          </div>
        )}

        {/* Current Season Stats - Bigger */}
        <div className="flex items-center justify-between mb-3 px-2 py-2 rounded-lg bg-black/20">
          <div className="flex items-center gap-2">
            <span className={`text-2xl font-black ${winPct >= 0.5 ? "text-emerald-400" : winPct < 0.4 ? "text-red-400" : "text-white"}`}>
              {roster.wins}-{roster.losses}
            </span>
            {trend !== "same" && (
              trend === "up" ? (
                <div className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-emerald-500/20">
                  <TrendingUp className="w-3 h-3 text-emerald-400" />
                  <span className="text-[9px] font-bold text-emerald-400">UP</span>
                </div>
              ) : (
                <div className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-red-500/20">
                  <TrendingDown className="w-3 h-3 text-red-400" />
                  <span className="text-[9px] font-bold text-red-400">DOWN</span>
                </div>
              )
            )}
          </div>
          <div className="text-right">
            <div className="text-lg font-bold text-zinc-200">{roster.pointsFor.toFixed(0)}</div>
            <div className="text-[9px] text-zinc-500 uppercase tracking-wide">Points</div>
          </div>
        </div>

        {/* Historical Records */}
        {history && history.seasons.length > 1 && (
          <div className="border-t border-white/[0.06] pt-2">
            <div className="flex items-center justify-between text-[11px] text-zinc-400 mb-2">
              <span className="font-semibold">All-Time</span>
              <span className="font-bold text-white">
                {history.totals.wins}-{history.totals.losses}
                <span className="text-zinc-500 font-normal ml-1">
                  ({((history.totals.wins / (history.totals.wins + history.totals.losses)) * 100).toFixed(0)}%)
                </span>
              </span>
            </div>
            <div className="flex gap-1">
              {history.seasons.slice(0, 3).map((season, i) => (
                <div
                  key={season.season}
                  className={`
                    flex-1 text-center py-1.5 rounded-lg
                    ${i === 0 ? "bg-amber-500/20 ring-1 ring-amber-500/30" : "bg-zinc-800/60"}
                  `}
                >
                  <div className={`text-sm font-bold ${i === 0 ? "text-amber-300" : "text-zinc-400"}`}>
                    {season.wins}-{season.losses}
                  </div>
                  <div className="text-[9px] text-zinc-500">&apos;{season.season.slice(-2)}</div>
                </div>
              ))}
            </div>

            {/* Past Championships */}
            {history.totals.championships > 0 && (
              <div className="flex items-center gap-2 mt-2 px-2 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <Crown className="w-4 h-4 text-amber-400" />
                <span className="text-[11px] text-amber-300 font-bold">
                  {history.totals.championships}x League Champion
                </span>
              </div>
            )}
          </div>
        )}

        {/* Keepers Badge */}
        {roster.keeperCount !== undefined && roster.keeperCount > 0 && (
          <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-white/[0.06]">
            <Star className="w-4 h-4 text-amber-400" />
            <span className="text-[11px] text-amber-300 font-semibold">{roster.keeperCount} Keepers Locked</span>
          </div>
        )}
      </div>

      {/* Hover Arrow */}
      <ChevronRight className="absolute bottom-3 right-2 w-5 h-5 text-zinc-600 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
    </Link>
  );
}
