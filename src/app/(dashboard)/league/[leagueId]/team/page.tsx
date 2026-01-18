"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import useSWR from "swr";
import { Skeleton } from "@/components/ui/Skeleton";
import { BackLink } from "@/components/ui/BackLink";
import {
  ChevronDown,
  ChevronRight,
  Trophy,
  Medal,
} from "lucide-react";
import {
  UsersIcon,
  TrophyIcon,
  StarIcon,
  CrownIcon,
  IconGradientDefs,
} from "@/components/ui/PremiumIcons";
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
  rosterIdMapping?: Record<number, string>;
}

// Get initials from team name
function getInitials(name: string | null): string {
  if (!name) return "??";
  return name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
}

// Playoff finish labels
function getPlayoffLabel(placement: number): string {
  switch (placement) {
    case 1: return "Champion";
    case 2: return "Runner-Up";
    case 3: return "3rd Place";
    case 4: return "4th Place";
    case 5: return "5th Place";
    case 6: return "6th Place";
    default: return `${placement}th`;
  }
}

export default function TeamsPage() {
  const params = useParams();
  const leagueId = params.leagueId as string;
  const [showBracket, setShowBracket] = useState(false);

  const { data: league, error, isLoading } = useSWR<LeagueData>(
    `/api/leagues/${leagueId}`,
    fetcher
  );

  const { data: ownerHistory } = useSWR<OwnerHistoryData>(
    `/api/leagues/${leagueId}/owner-history`,
    fetcher
  );

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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-40 rounded-xl" />
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
  const playoffPlacements = new Map<string, number>();

  const resolveRosterId = (team: BracketTeam | null): string | null => {
    if (!team) return null;
    if (team.sleeperRosterId && playoffs?.rosterIdMapping) {
      const mappedId = playoffs.rosterIdMapping[team.sleeperRosterId];
      if (mappedId) return mappedId;
    }
    return team.id;
  };

  if (playoffs?.winnersBracket) {
    const sortedMatchups = [...playoffs.winnersBracket].sort((a, b) => b.round - a.round);

    sortedMatchups.forEach(matchup => {
      const winnerId = resolveRosterId(matchup.winner);
      const loserId = resolveRosterId(matchup.loser);

      if (matchup.placement === 1) {
        if (winnerId && !playoffPlacements.has(winnerId)) {
          playoffPlacements.set(winnerId, 1);
        }
        if (loserId && !playoffPlacements.has(loserId)) {
          playoffPlacements.set(loserId, 2);
        }
      } else if (matchup.placement === 2) {
        if (winnerId && !playoffPlacements.has(winnerId)) {
          playoffPlacements.set(winnerId, 3);
        }
        if (loserId && !playoffPlacements.has(loserId)) {
          playoffPlacements.set(loserId, 4);
        }
      } else if (matchup.placement === 3) {
        if (winnerId && !playoffPlacements.has(winnerId)) {
          playoffPlacements.set(winnerId, 5);
        }
        if (loserId && !playoffPlacements.has(loserId)) {
          playoffPlacements.set(loserId, 6);
        }
      }
    });
  }

  // Sort by wins (desc), then points for (desc)
  const sortedRosters = [...league.rosters].sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    return b.pointsFor - a.pointsFor;
  });

  // Calculate draft pick: worst record picks FIRST (pick 1), champion picks LAST
  const calculateDraftPick = (rosterId: string): number | undefined => {
    const placement = playoffPlacements.get(rosterId);
    const totalTeams = league.rosters.length;

    if (placement !== undefined) {
      // Playoff teams pick based on finish: Champion = last pick, Runner-up = second to last
      // placement 1 (champion) → pick totalTeams
      // placement 2 (runner-up) → pick totalTeams - 1
      return totalTeams - placement + 1;
    }

    // Non-playoff teams: sorted by record (worst first gets pick 1)
    const nonPlayoffTeams = sortedRosters
      .filter(r => !playoffPlacements.has(r.id))
      .sort((a, b) => {
        // Sort worst to best (ascending by wins, then points)
        if (a.wins !== b.wins) return a.wins - b.wins;
        return a.pointsFor - b.pointsFor;
      });

    const pickIndex = nonPlayoffTeams.findIndex(r => r.id === rosterId);
    if (pickIndex !== -1) {
      // pickIndex 0 = worst record = pick 1
      return pickIndex + 1;
    }
    return undefined;
  };

  const hasChampion = [...playoffPlacements.values()].includes(1);

  // Find top scorer
  const topScorerId = sortedRosters.reduce((maxId, roster) =>
    roster.pointsFor > (sortedRosters.find(r => r.id === maxId)?.pointsFor || 0) ? roster.id : maxId
  , sortedRosters[0]?.id);

  // Map roster ID to owner history
  const ownerHistoryMap = new Map<string, OwnerHistory>();
  ownerHistory?.owners.forEach(owner => {
    if (owner.currentRosterId) {
      ownerHistoryMap.set(owner.currentRosterId, owner);
    }
  });

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
      <IconGradientDefs />

      {/* Header */}
      <div>
        <BackLink href={`/league/${leagueId}`} label="Back to League" />
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500/20 to-violet-600/10 ring-1 ring-violet-500/20 flex items-center justify-center">
            <UsersIcon size={20} />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight">League Standings</h1>
            <p className="text-sm text-zinc-400">{league.name} • {league.season} Season</p>
          </div>
        </div>
      </div>

      {/* Team Cards Grid - responsive with larger cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {sortedRosters.map((roster, index) => {
          const rank = index + 1;
          const isPlayoff = rank <= playoffSpots;
          const history = ownerHistoryMap.get(roster.id);
          const placement = playoffPlacements.get(roster.id);
          const draftPick = hasChampion ? calculateDraftPick(roster.id) : undefined;
          const isTopScorer = roster.id === topScorerId;
          const isChampion = placement === 1;

          return (
            <TeamCard
              key={roster.id}
              roster={roster}
              rank={rank}
              isPlayoff={isPlayoff}
              leagueId={leagueId}
              history={history}
              placement={placement}
              draftPick={draftPick}
              isTopScorer={isTopScorer}
              isChampion={isChampion}
            />
          );
        })}
      </div>

      {/* Playoff Bracket Section */}
      <div className="card-glass rounded-xl overflow-hidden">
        <button
          onClick={() => setShowBracket(!showBracket)}
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/[0.02] transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-violet-500/10 flex items-center justify-center">
              <TrophyIcon size={16} />
            </div>
            <div className="text-left">
              <h3 className="text-sm font-semibold text-white">Playoff Bracket</h3>
              <p className="text-xs text-zinc-400">{playoffSpots} teams • Championship</p>
            </div>
          </div>
          <ChevronDown
            className={`w-5 h-5 text-zinc-400 transition-transform ${showBracket ? "rotate-180" : ""}`}
          />
        </button>
        {showBracket && (
          <div className="border-t border-white/[0.06]">
            <div className="p-4">
              {playoffs ? (
                <TournamentBracket
                  winnersBracket={playoffs.winnersBracket}
                  losersBracket={playoffs.losersBracket}
                  playoffTeams={playoffs.playoffTeams}
                />
              ) : (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-2 border-violet-400 border-t-transparent"></div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {sortedRosters.length === 0 && (
        <div className="text-center py-16">
          <div className="w-16 h-16 rounded-2xl bg-zinc-800/50 flex items-center justify-center mx-auto mb-4">
            <UsersIcon size={32} className="opacity-60" />
          </div>
          <p className="text-zinc-400 font-medium">No teams found</p>
          <p className="text-sm text-zinc-500 mt-1">Teams will appear once the league syncs</p>
        </div>
      )}
    </div>
  );
}

// Clean, simplified Team Card Component
function TeamCard({
  roster,
  rank,
  isPlayoff,
  leagueId,
  history,
  placement,
  draftPick,
  isTopScorer,
  isChampion,
}: {
  roster: Roster;
  rank: number;
  isPlayoff: boolean;
  leagueId: string;
  history?: OwnerHistory;
  placement?: number;
  draftPick?: number;
  isTopScorer?: boolean;
  isChampion?: boolean;
}) {
  const totalGames = roster.wins + roster.losses + roster.ties;
  const winPct = totalGames > 0 ? roster.wins / totalGames : 0;

  return (
    <Link
      href={`/league/${leagueId}/team/${roster.id}`}
      className={`
        group relative rounded-xl p-4 transition-all duration-200
        card-glass overflow-hidden
        ${isChampion ? "ring-2 ring-violet-500/50" : ""}
        hover:border-violet-500/30 hover:shadow-lg hover:shadow-violet-500/10
      `}
    >
      {/* Champion Banner */}
      {isChampion && (
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-violet-500 via-violet-400 to-violet-500" />
      )}

      {/* Top Row: Avatar + Name + Badges */}
      <div className="flex items-start gap-3 mb-3">
        {/* Avatar */}
        {history?.avatar ? (
          <img
            src={history.avatar}
            alt=""
            className="w-12 h-12 rounded-xl ring-2 ring-white/10 flex-shrink-0"
          />
        ) : (
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500/40 to-violet-600/30 flex items-center justify-center text-white text-sm font-bold ring-2 ring-white/10 flex-shrink-0">
            {getInitials(roster.teamName)}
          </div>
        )}

        {/* Name + Owner */}
        <div className="flex-1 min-w-0">
          <p className="text-base font-bold text-white truncate group-hover:text-violet-200 transition-colors">
            {roster.teamName || "Unnamed Team"}
          </p>
          <p className="text-sm text-zinc-400 truncate">
            {history?.displayName || roster.owners?.[0]?.displayName || "Unknown"}
          </p>
        </div>

        {/* Rank Badge */}
        <div className={`
          w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold flex-shrink-0
          ${rank === 1 ? "bg-gradient-to-br from-violet-400 to-violet-600 text-white" : ""}
          ${rank === 2 ? "bg-gradient-to-br from-zinc-300 to-zinc-400 text-black" : ""}
          ${rank === 3 ? "bg-gradient-to-br from-amber-600 to-amber-800 text-white" : ""}
          ${rank > 3 ? "bg-zinc-800 text-zinc-400" : ""}
        `}>
          {rank <= 3 ? (rank === 1 ? <CrownIcon size={16} /> : <Medal className="w-4 h-4" />) : rank}
        </div>
      </div>

      {/* Status Badges Row */}
      <div className="flex flex-wrap gap-2 mb-3">
        {/* Playoff Finish Badge - only show for completed playoffs */}
        {placement && (
          <span className={`
            inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-semibold
            ${placement === 1 ? "bg-violet-500/20 text-violet-300 ring-1 ring-violet-500/30" : ""}
            ${placement === 2 ? "bg-zinc-500/20 text-zinc-300 ring-1 ring-zinc-500/30" : ""}
            ${placement >= 3 ? "bg-zinc-700/50 text-zinc-400" : ""}
          `}>
            {placement === 1 && <Trophy className="w-3 h-3" />}
            {getPlayoffLabel(placement)}
          </span>
        )}

        {/* Draft Pick Badge */}
        {draftPick !== undefined && (
          <span className={`
            inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-semibold
            ${draftPick <= 3 ? "bg-emerald-500/20 text-emerald-300" : ""}
            ${draftPick > 3 && draftPick < 8 ? "bg-zinc-600/30 text-zinc-300" : ""}
            ${draftPick >= 8 ? "bg-red-500/20 text-red-300" : ""}
          `}>
            Pick #{draftPick}
          </span>
        )}

        {/* Top Scorer */}
        {isTopScorer && (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-semibold bg-amber-500/20 text-amber-300">
            Top Scorer
          </span>
        )}

        {/* Playoff Bound */}
        {isPlayoff && !placement && (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-semibold bg-emerald-500/10 text-emerald-400">
            Playoff Bound
          </span>
        )}
      </div>

      {/* Stats Row */}
      <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-black/20">
        <div>
          <span className={`text-2xl font-black ${winPct >= 0.5 ? "text-emerald-400" : winPct < 0.4 ? "text-red-400" : "text-white"}`}>
            {roster.wins}-{roster.losses}
          </span>
          {roster.ties > 0 && <span className="text-lg text-zinc-400">-{roster.ties}</span>}
        </div>
        <div className="text-right">
          <div className="text-lg font-bold text-zinc-200">{roster.pointsFor.toFixed(0)}</div>
          <div className="text-xs text-zinc-500">Points</div>
        </div>
      </div>

      {/* Historical Summary (compact) */}
      {history && history.totals.seasonsPlayed > 1 && (
        <div className="mt-3 pt-3 border-t border-white/[0.06] flex items-center justify-between text-sm">
          <span className="text-zinc-400">All-Time</span>
          <span className="font-semibold text-white">
            {history.totals.wins}-{history.totals.losses}
            <span className="text-zinc-500 ml-1">
              ({((history.totals.wins / (history.totals.wins + history.totals.losses)) * 100).toFixed(0)}%)
            </span>
          </span>
        </div>
      )}

      {/* Championships */}
      {history && history.totals.championships > 0 && (
        <div className="flex items-center gap-2 mt-2 px-2 py-1.5 rounded-lg bg-violet-500/10 border border-violet-500/20">
          <CrownIcon size={14} />
          <span className="text-xs text-violet-300 font-semibold">
            {history.totals.championships}x Champion
          </span>
        </div>
      )}

      {/* Keepers Badge */}
      {roster.keeperCount !== undefined && roster.keeperCount > 0 && (
        <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-white/[0.06]">
          <StarIcon size={14} />
          <span className="text-xs text-violet-300 font-semibold">{roster.keeperCount} Keepers Locked</span>
        </div>
      )}

      {/* Hover Arrow */}
      <ChevronRight className="absolute bottom-4 right-3 w-5 h-5 text-zinc-600 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
    </Link>
  );
}
