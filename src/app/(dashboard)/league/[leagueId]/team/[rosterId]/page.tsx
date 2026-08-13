"use client";

import { useMemo } from "react";
import { useParams } from "next/navigation";
import useSWR from "swr";
import Link from "next/link";
import { Skeleton } from "@/components/ui/Skeleton";
import { BackLink } from "@/components/ui/BackLink";
import { Trophy, Eye, Crown, ArrowRight } from "lucide-react";
import { type TeamAward } from "@/components/ui/AwardBadge";
import { PublicTeamProfile } from "@/components/team";

const fetcher = (url: string) => fetch(url).then(res => {
  if (!res.ok) throw new Error("Failed to fetch");
  return res.json();
});

interface Player {
  id: string;
  sleeperId: string;
  fullName: string;
  firstName: string | null;
  lastName: string | null;
  position: string | null;
  team: string | null;
  age: number | null;
  yearsExp: number | null;
  injuryStatus: string | null;
  fantasyPointsPpr: number | null;
  fantasyPointsHalfPpr: number | null;
  gamesPlayed: number | null;
  pointsPerGame: number | null;
  lastSeasonPpg: number | null;
  lastSeasonGames: number | null;
  prevSeasonPpg: number | null;
  prevSeasonGames: number | null;
  lastSeason: number;
  prevSeason: number;
}

interface EligiblePlayer {
  player: Player;
  isStarter: boolean;
  eligibility: {
    isEligible: boolean;
    reason: string | null;
    yearsKept: number;
    consecutiveYears: number;
    acquisitionType: string;
    originalDraft: {
      draftYear: number;
      draftRound: number;
    } | null;
  };
  costs: {
    franchise: { baseCost: number; finalCost: number; costBreakdown: string } | null;
    regular: { baseCost: number; finalCost: number; costBreakdown: string } | null;
  };
  existingKeeper: {
    id: string;
    type: string;
    finalCost: number;
    isLocked: boolean;
  } | null;
}

interface RosterData {
  rosterId: string;
  season: number;
  players: EligiblePlayer[];
}

interface TradedPlayer {
  playerId: string;
  sleeperId: string;
  playerName: string;
  position: string | null;
}

interface TradeParty {
  rosterId: string;
  rosterName: string | null;
  playersGiven: TradedPlayer[];
  playersReceived: TradedPlayer[];
  picksGiven: Array<{ season: number; round: number }>;
  picksReceived: Array<{ season: number; round: number }>;
}

interface Trade {
  id: string;
  date: string;
  season: number;
  isNew: boolean;
  parties: TradeParty[];
}

interface RecentTradesData {
  trades: Trade[];
}

/**
 * Team profile — view any team's roster, keepers, awards and trades.
 *
 * Keeper MANAGEMENT no longer lives here: owners manage their keepers in
 * the My Keepers workspace (/league/[id]/keepers). Viewing your own team
 * here shows the same profile everyone else sees, plus a link to manage.
 */
export default function TeamRosterPage() {
  const params = useParams();
  const leagueId = params.leagueId as string;
  const rosterId = params.rosterId as string;

  // League info: team name, owners, standings context
  const { data: leagueData } = useSWR<{
    rosters: Array<{
      id: string;
      teamName: string | null;
      isUserRoster: boolean;
      owners: Array<{ displayName: string }>;
      wins: number;
      losses: number;
      pointsFor: number;
    }>;
  }>(`/api/leagues/${leagueId}`, fetcher);

  const currentRosterInfo = leagueData?.rosters.find(r => r.id === rosterId);
  const isOwnTeam = currentRosterInfo?.isUserRoster ?? false;
  const teamName = currentRosterInfo?.teamName || "Team";
  const teamOwners = currentRosterInfo?.owners?.map(o => o.displayName).join(", ") || "";

  const { data, error, mutate, isLoading } = useSWR<RosterData>(
    `/api/leagues/${leagueId}/rosters/${rosterId}/eligible-keepers`,
    fetcher,
    { revalidateOnFocus: false }
  );

  const { data: championshipData } = useSWR<{
    championships: Array<{
      season: number;
      champion: { rosterId: string; teamName: string | null };
      runnerUp: { rosterId: string; teamName: string | null } | null;
    }>;
  }>(`/api/leagues/${leagueId}/history/championships`, fetcher, {
    revalidateOnFocus: false,
  });

  const { data: tradesData } = useSWR<RecentTradesData>(
    `/api/leagues/${leagueId}/recent-trades?limit=100`,
    fetcher,
    { revalidateOnFocus: false }
  );

  // Awards from championship + standings data
  const teamAwards: TeamAward[] = useMemo(() => {
    const awards: TeamAward[] = [];

    if (championshipData?.championships && leagueData?.rosters) {
      const championshipsWon = championshipData.championships.filter(
        c => c.champion?.rosterId === rosterId
      ).length;
      const runnerUpFinishes = championshipData.championships.filter(
        c => c.runnerUp?.rosterId === rosterId
      ).length;

      if (championshipsWon >= 2) {
        awards.push({ type: "dynasty", count: championshipsWon });
      } else if (championshipsWon > 0) {
        awards.push({ type: "champion", count: championshipsWon });
      }

      if (runnerUpFinishes > 0) {
        awards.push({ type: "runner_up", count: runnerUpFinishes });
      }

      const currentRoster = leagueData.rosters.find(r => r.id === rosterId);
      const sortedByWins = [...leagueData.rosters].sort((a, b) => b.wins - a.wins);
      if (currentRoster && sortedByWins[0]?.id === rosterId && currentRoster.wins > 0) {
        awards.push({ type: "best_record", season: data?.season });
      }

      const sortedByPoints = [...leagueData.rosters].sort((a, b) => b.pointsFor - a.pointsFor);
      if (currentRoster && sortedByPoints[0]?.id === rosterId && currentRoster.pointsFor > 0) {
        awards.push({ type: "points_leader", season: data?.season });
      }
    }

    return awards;
  }, [championshipData, leagueData, rosterId, data?.season]);

  const teamChampionships = useMemo(() => {
    if (!championshipData?.championships) return [];
    return championshipData.championships
      .filter(c => c.champion?.rosterId === rosterId)
      .map(c => ({ season: c.season }));
  }, [championshipData, rosterId]);

  const teamRunnerUps = useMemo(() => {
    if (!championshipData?.championships) return [];
    return championshipData.championships
      .filter(c => c.runnerUp?.rosterId === rosterId)
      .map(c => ({ season: c.season }));
  }, [championshipData, rosterId]);

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
        <div>
          <Skeleton className="h-4 w-24 mb-3 bg-white/[0.05]" />
          <Skeleton className="h-10 w-64 mb-2 bg-white/[0.05]" />
          <Skeleton className="h-5 w-48 bg-white/[0.05]" />
        </div>
        <Skeleton className="h-96 rounded-xl bg-white/[0.03]" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-7xl mx-auto p-4 md:p-6">
        <div className="bg-[#0c1219] border border-rose-500/20 rounded-xl p-8 text-center">
          <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mx-auto mb-4">
            <Trophy className="w-8 h-8 text-rose-400" />
          </div>
          <p className="text-rose-400 font-medium text-lg">Failed to load roster data</p>
          <p className="text-slate-500 text-sm mt-1">There was an error loading this team</p>
          <button
            onClick={() => mutate()}
            className="mt-6 px-5 py-2.5 bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 rounded-lg text-sm font-medium transition-colors border border-rose-500/25 min-h-[44px]"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto px-3 py-4 sm:p-4 md:p-6 space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <BackLink href={`/league/${leagueId}/team`} label="All Teams" />
          <div className="flex items-center gap-2 sm:gap-3 mt-1">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-slate-500/20 to-slate-600/20 border border-slate-500/25 flex items-center justify-center flex-shrink-0">
              <Eye className="w-5 h-5 sm:w-6 sm:h-6 text-slate-400" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-white tracking-tight truncate">
                {teamName}
              </h1>
              <p className="text-slate-500 text-sm sm:text-base mt-0.5">
                {teamOwners ? `${teamOwners} · ${data.season}` : `${data.season} Season`}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Own-team banner — management lives in My Keepers */}
      {isOwnTeam && (
        <Link
          href={`/league/${leagueId}/keepers`}
          className="flex items-center gap-3 px-4 py-3 min-h-[52px] rounded-xl bg-blue-500/10 border border-blue-500/25 hover:bg-blue-500/15 transition-colors"
        >
          <Crown className="w-5 h-5 text-blue-400 flex-shrink-0" />
          <span className="flex-1 text-sm text-blue-300 font-medium">
            This is your team — manage keepers in My Keepers
          </span>
          <ArrowRight className="w-4 h-4 text-blue-400 flex-shrink-0" />
        </Link>
      )}

      {/* Team profile */}
      <PublicTeamProfile
        leagueId={leagueId}
        rosterId={rosterId}
        teamName={teamName}
        teamOwners={teamOwners}
        season={data.season}
        players={data.players}
        teamAwards={teamAwards}
        championships={teamChampionships}
        runnerUps={teamRunnerUps}
        trades={tradesData?.trades || []}
      />
    </div>
  );
}
