"use client";

import { useState, useMemo } from "react";
import { useParams } from "next/navigation";
import useSWR from "swr";
import Link from "next/link";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { PremiumPlayerCard } from "@/components/players/PremiumPlayerCard";
import { KeeperHistoryModal } from "@/components/players/KeeperHistoryModal";
import { BackLink } from "@/components/ui/BackLink";
import { RefreshCw, Trophy, Star, Users, FileText, Sparkles, Eye } from "lucide-react";
import { DraftCapital } from "@/components/ui/DraftCapital";
import { AwardsSection, type TeamAward } from "@/components/ui/AwardBadge";
import { PositionBadge } from "@/components/ui/PositionBadge";
import {
  TeamTrophyCase,
  TeamHistoricalStats,
  TeamTradeHistory,
  PublicTeamProfile,
} from "@/components/team";

const fetcher = (url: string) => fetch(url).then(res => {
  if (!res.ok) throw new Error("Failed to fetch");
  return res.json();
});

// Types for team info endpoint
interface TeamInfo {
  rosterId: string;
  teamName: string;
  owners: string[];
  wins: number;
  losses: number;
  pointsFor: number;
  isUserRoster: boolean;
}

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
    franchise: {
      baseCost: number;
      finalCost: number;
      costBreakdown: string;
    } | null;
    regular: {
      baseCost: number;
      finalCost: number;
      costBreakdown: string;
    } | null;
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
  currentKeepers: {
    franchise: number;
    regular: number;
    total: number;
  };
  limits: {
    maxKeepers: number;
    maxFranchiseTags: number;
    maxRegularKeepers: number;
  };
  canAddMore: {
    franchise: boolean;
    regular: boolean;
    any: boolean;
  };
}

interface DraftPick {
  season: number;
  round: number;
  originalOwnerSleeperId: string;
  currentOwnerSleeperId: string;
  originalOwnerName: string;
  currentOwnerRosterId: string;
}

interface DraftPicksData {
  season: number;
  picks: DraftPick[];
  rosters: Array<{
    id: string;
    sleeperId: string | null;
    teamName: string | null;
  }>;
}

// Types for recent trades endpoint
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
  stats: {
    totalTrades: number;
    newTrades: number;
    playersTraded: number;
    picksTraded: number;
  };
}

export default function TeamRosterPage() {
  const params = useParams();
  const leagueId = params.leagueId as string;
  const rosterId = params.rosterId as string;
  const { success, error: showError } = useToast();
  const [syncingKeepers, setSyncingKeepers] = useState(false);
  const [historyPlayerId, setHistoryPlayerId] = useState<string | null>(null);

  // Fetch league info to check if this is user's own team
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

  // Find if the current roster is the user's own roster
  const currentRosterInfo = leagueData?.rosters.find(r => r.id === rosterId);
  const isOwnTeam = currentRosterInfo?.isUserRoster ?? true; // Default to true while loading
  const teamName = currentRosterInfo?.teamName || "Team";
  const teamOwners = currentRosterInfo?.owners?.map(o => o.displayName).join(", ") || "";

  const { data, error, mutate, isLoading } = useSWR<RosterData>(
    `/api/leagues/${leagueId}/rosters/${rosterId}/eligible-keepers`,
    fetcher,
    {
      revalidateOnFocus: true,
      revalidateIfStale: true,
      dedupingInterval: 0,
    }
  );

  // Fetch draft picks for this league
  const { data: draftPicksData } = useSWR<DraftPicksData>(
    `/api/leagues/${leagueId}/draft-picks`,
    fetcher
  );

  // Fetch championship data for awards
  const { data: championshipData } = useSWR<{
    championships: Array<{
      season: number;
      winner: { rosterId: string; teamName: string | null };
      runnerUp: { rosterId: string; teamName: string | null };
    }>;
  }>(`/api/leagues/${leagueId}/championships`, fetcher, {
    revalidateOnFocus: false,
  });

  // Fetch recent trades for this team (only for non-owner view)
  const { data: tradesData } = useSWR<RecentTradesData>(
    !isOwnTeam ? `/api/leagues/${leagueId}/recent-trades?limit=20` : null,
    fetcher,
    { revalidateOnFocus: false }
  );

  // Compute awards based on championship data and roster info
  const teamAwards: TeamAward[] = (() => {
    const awards: TeamAward[] = [];

    if (championshipData?.championships && leagueData?.rosters) {
      // Count championships won
      const championshipsWon = championshipData.championships.filter(
        c => c.winner.rosterId === rosterId
      ).length;

      // Count runner-up finishes
      const runnerUpFinishes = championshipData.championships.filter(
        c => c.runnerUp.rosterId === rosterId
      ).length;

      // Dynasty award (2+ championships)
      if (championshipsWon >= 2) {
        awards.push({ type: "dynasty", count: championshipsWon });
      } else if (championshipsWon > 0) {
        awards.push({ type: "champion", count: championshipsWon });
      }

      if (runnerUpFinishes > 0) {
        awards.push({ type: "runner_up", count: runnerUpFinishes });
      }

      // Check for best record (most wins in current standings)
      const currentRoster = leagueData.rosters.find(r => r.id === rosterId);
      const sortedByWins = [...leagueData.rosters].sort((a, b) => b.wins - a.wins);
      if (currentRoster && sortedByWins[0]?.id === rosterId && currentRoster.wins > 0) {
        awards.push({ type: "best_record", season: data?.season });
      }

      // Points leader
      const sortedByPoints = [...leagueData.rosters].sort((a, b) => b.pointsFor - a.pointsFor);
      if (currentRoster && sortedByPoints[0]?.id === rosterId && currentRoster.pointsFor > 0) {
        awards.push({ type: "points_leader", season: data?.season });
      }
    }

    return awards;
  })();

  // Compute data for public profile sections (non-owner view only)
  const teamChampionships = useMemo(() => {
    if (!championshipData?.championships) return [];
    return championshipData.championships
      .filter(c => c.winner.rosterId === rosterId)
      .map(c => ({ season: c.season }));
  }, [championshipData, rosterId]);

  const teamRunnerUps = useMemo(() => {
    if (!championshipData?.championships) return [];
    return championshipData.championships
      .filter(c => c.runnerUp?.rosterId === rosterId)
      .map(c => ({ season: c.season }));
  }, [championshipData, rosterId]);

  const addKeeper = async (
    playerId: string,
    type: "FRANCHISE" | "REGULAR",
    playerName: string,
    costData?: { baseCost: number; finalCost: number; yearsKept: number }
  ) => {
    if (!data) return;

    const playerToAdd = data.players.find(p => p.player.id === playerId);
    if (!playerToAdd) return;

    const optimisticData: RosterData = {
      ...data,
      players: data.players.map(p =>
        p.player.id === playerId
          ? {
              ...p,
              existingKeeper: {
                id: `temp-${playerId}`,
                type,
                finalCost: costData?.finalCost || p.costs.regular?.finalCost || 1,
                isLocked: false,
              },
            }
          : p
      ),
      currentKeepers: {
        franchise: type === "FRANCHISE" ? data.currentKeepers.franchise + 1 : data.currentKeepers.franchise,
        regular: type === "REGULAR" ? data.currentKeepers.regular + 1 : data.currentKeepers.regular,
        total: data.currentKeepers.total + 1,
      },
    };

    mutate(optimisticData, { revalidate: false });
    success(`${playerName} added as ${type === "FRANCHISE" ? "FT" : "Keeper"}`);

    try {
      const res = await fetch(`/api/leagues/${leagueId}/keepers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rosterId,
          playerId,
          type,
          baseCost: costData?.baseCost,
          finalCost: costData?.finalCost,
          yearsKept: costData?.yearsKept,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to add keeper");
      }

      mutate();
    } catch (err) {
      mutate(data, { revalidate: false });
      showError(err instanceof Error ? err.message : "Failed to add keeper");
    }
  };

  const removeKeeper = async (keeperId: string, playerName: string) => {
    if (!data) return;

    const playerWithKeeper = data.players.find(p => p.existingKeeper?.id === keeperId);
    if (!playerWithKeeper) return;

    const keeperType = playerWithKeeper.existingKeeper?.type;

    const newFranchiseCount = keeperType === "FRANCHISE" ? data.currentKeepers.franchise - 1 : data.currentKeepers.franchise;
    const newRegularCount = keeperType === "REGULAR" ? data.currentKeepers.regular - 1 : data.currentKeepers.regular;
    const newTotalCount = data.currentKeepers.total - 1;

    const optimisticData: RosterData = {
      ...data,
      players: data.players.map(p =>
        p.existingKeeper?.id === keeperId
          ? { ...p, existingKeeper: null }
          : p
      ),
      currentKeepers: {
        franchise: newFranchiseCount,
        regular: newRegularCount,
        total: newTotalCount,
      },
      canAddMore: {
        franchise: newFranchiseCount < data.limits.maxFranchiseTags && newTotalCount < data.limits.maxKeepers,
        regular: newRegularCount < data.limits.maxRegularKeepers && newTotalCount < data.limits.maxKeepers,
        any: newTotalCount < data.limits.maxKeepers,
      },
    };

    mutate(optimisticData, { revalidate: false });
    success(`${playerName} removed`);

    try {
      const res = await fetch(
        `/api/leagues/${leagueId}/keepers?keeperId=${keeperId}`,
        { method: "DELETE" }
      );

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to remove keeper");
      }

      mutate();
    } catch (err) {
      mutate(data, { revalidate: false });
      showError(err instanceof Error ? err.message : "Failed to remove keeper");
    }
  };

  const syncKeepers = async () => {
    setSyncingKeepers(true);
    try {
      const populateRes = await fetch("/api/sleeper/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "populate-keepers", leagueId }),
      });

      if (!populateRes.ok) {
        const err = await populateRes.json();
        throw new Error(err.error || "Failed to populate keepers");
      }

      const populateResult = await populateRes.json();

      const recalcRes = await fetch("/api/sleeper/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "recalculate-keeper-years", leagueId }),
      });

      if (!recalcRes.ok) {
        const err = await recalcRes.json();
        throw new Error(err.error || "Failed to recalculate keeper years");
      }

      const recalcResult = await recalcRes.json();

      success(`Synced: ${populateResult.data?.created || 0} created, ${recalcResult.data?.updated || 0} years fixed`);
      mutate();
    } catch (err) {
      showError(err instanceof Error ? err.message : "Failed to sync keepers");
    } finally {
      setSyncingKeepers(false);
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
        <div>
          <Skeleton className="h-4 w-24 mb-3 bg-white/[0.05]" />
          <Skeleton className="h-10 w-64 mb-2 bg-white/[0.05]" />
          <Skeleton className="h-5 w-48 bg-white/[0.05]" />
        </div>
        <div className="bg-[#0d1420] border border-white/[0.06] rounded-xl p-6">
          <Skeleton className="h-6 w-32 mb-4 bg-white/[0.05]" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-56 rounded-xl bg-white/[0.03]" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-7xl mx-auto p-4 md:p-6">
        <div className="bg-[#0d1420] border border-rose-500/20 rounded-xl p-8 text-center">
          <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mx-auto mb-4">
            <Trophy className="w-8 h-8 text-rose-400" />
          </div>
          <p className="text-rose-400 font-medium text-lg">Failed to load roster data</p>
          <p className="text-slate-500 text-sm mt-1">There was an error loading your team information</p>
          <button
            onClick={() => mutate()}
            className="mt-6 px-5 py-2.5 bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 rounded-lg text-sm font-medium transition-colors border border-rose-500/25"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  const currentKeepers = data.players.filter((p) => p.existingKeeper);
  const eligiblePlayers = data.players.filter(
    (p) => p.eligibility.isEligible && !p.existingKeeper
  );
  const ineligiblePlayers = data.players.filter(
    (p) => !p.eligibility.isEligible && !p.existingKeeper
  );

  return (
    <div className="mx-auto px-3 py-4 sm:p-4 md:p-6 space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:gap-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <BackLink href={`/league/${leagueId}`} label="Back to League" />
            <div className="flex items-center gap-2 sm:gap-3 mt-1">
              <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br ${isOwnTeam ? "from-blue-500/20 to-purple-500/20 border-blue-500/25" : "from-slate-500/20 to-slate-600/20 border-slate-500/25"} border flex items-center justify-center flex-shrink-0`}>
                {isOwnTeam ? (
                  <Sparkles className="w-5 h-5 sm:w-6 sm:h-6 text-blue-400" />
                ) : (
                  <Eye className="w-5 h-5 sm:w-6 sm:h-6 text-slate-400" />
                )}
              </div>
              <div className="min-w-0">
                <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-white tracking-tight truncate">
                  {isOwnTeam ? "Manage Keepers" : teamName}
                </h1>
                <p className="text-slate-500 text-sm sm:text-base mt-0.5">
                  {isOwnTeam ? `${data.season} Season` : teamOwners ? `${teamOwners} · ${data.season}` : `${data.season} Season`}
                </p>
              </div>
            </div>
          </div>
          {isOwnTeam ? (
            <button
              onClick={syncKeepers}
              disabled={syncingKeepers}
              className="flex-shrink-0 inline-flex items-center justify-center gap-1.5 sm:gap-2 min-h-[44px] min-w-[44px] sm:min-w-0 px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg bg-[#131a28] text-slate-400 hover:text-white hover:bg-[#1a2435] border border-white/[0.08] hover:border-white/[0.12] text-xs sm:text-sm font-medium transition-all disabled:opacity-50"
            >
              <RefreshCw size={16} className={syncingKeepers ? "animate-spin" : ""} />
              <span className="hidden sm:inline">{syncingKeepers ? "Syncing..." : "Sync Keepers"}</span>
            </button>
          ) : (
            <div className="flex-shrink-0 px-3 py-2 rounded-lg bg-slate-500/10 border border-slate-500/20 text-slate-400 text-xs font-medium">
              <span className="flex items-center gap-1.5">
                <Eye size={14} />
                <span className="hidden sm:inline">Viewing</span>
              </span>
            </div>
          )}
        </div>
      </div>

      {/* PUBLIC VIEW - Bento Grid Layout */}
      {!isOwnTeam && (
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
      )}

      {/* OWNER VIEW - Team Awards */}
      {isOwnTeam && teamAwards.length > 0 && (
        <AwardsSection awards={teamAwards} className="mt-0" />
      )}

      {/* Keeper Summary Stats - Only show for own team */}
      {isOwnTeam && (
        <div className="grid grid-cols-3 gap-2 sm:gap-4">
          <div className="bg-[#0d1420] border border-white/[0.06] rounded-xl p-2.5 sm:p-4">
            <div className="flex flex-col sm:flex-row items-center sm:items-center gap-1.5 sm:gap-3 text-center sm:text-left">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-blue-500/15 border border-blue-500/25 flex items-center justify-center flex-shrink-0">
                <Users className="w-4 h-4 text-blue-400" />
              </div>
              <div>
                <p className="text-lg sm:text-2xl font-bold text-white tabular-nums">{data.currentKeepers.total}<span className="text-[10px] sm:text-sm text-slate-500">/{data.limits.maxKeepers}</span></p>
                <p className="text-[9px] sm:text-xs text-slate-500 uppercase tracking-wider">Total</p>
              </div>
            </div>
          </div>
          <div className="bg-[#0d1420] border border-white/[0.06] rounded-xl p-2.5 sm:p-4">
            <div className="flex flex-col sm:flex-row items-center sm:items-center gap-1.5 sm:gap-3 text-center sm:text-left">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-amber-500/15 border border-amber-500/25 flex items-center justify-center flex-shrink-0">
                <Star className="w-4 h-4 text-amber-400" />
              </div>
              <div>
                <p className="text-lg sm:text-2xl font-bold text-amber-400 tabular-nums">{data.currentKeepers.franchise}<span className="text-[10px] sm:text-sm text-slate-500">/{data.limits.maxFranchiseTags}</span></p>
                <p className="text-[9px] sm:text-xs text-slate-500 uppercase tracking-wider">Franchise</p>
              </div>
            </div>
          </div>
          <div className="bg-[#0d1420] border border-white/[0.06] rounded-xl p-2.5 sm:p-4">
            <div className="flex flex-col sm:flex-row items-center sm:items-center gap-1.5 sm:gap-3 text-center sm:text-left">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-blue-500/15 border border-blue-500/25 flex items-center justify-center flex-shrink-0">
                <Trophy className="w-4 h-4 text-blue-400" />
              </div>
              <div>
                <p className="text-lg sm:text-2xl font-bold text-blue-400 tabular-nums">{data.currentKeepers.regular}<span className="text-[10px] sm:text-sm text-slate-500">/{data.limits.maxRegularKeepers}</span></p>
                <p className="text-[9px] sm:text-xs text-slate-500 uppercase tracking-wider">Regular</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Draft Capital with Keeper Cards - Only show for owner */}
      {isOwnTeam && draftPicksData && (() => {
        // Find this roster's sleeperId
        const thisRoster = draftPicksData.rosters.find(r => r.id === rosterId);
        if (!thisRoster?.sleeperId) return null;

        // Prepare keepers data for DraftCapital
        const keepersForCapital = currentKeepers.map(p => ({
          id: p.existingKeeper?.id || p.player.id,
          sleeperId: p.player.sleeperId,
          player: {
            fullName: p.player.fullName,
            position: p.player.position,
            team: p.player.team,
            sleeperId: p.player.sleeperId,
          },
          finalCost: p.existingKeeper?.finalCost || 1,
          type: p.existingKeeper?.type || "REGULAR",
          yearsKept: p.eligibility.consecutiveYears || 1,
        }));

        // Calculate max rounds from actual draft picks (typically 16 for NFL leagues)
        const maxDraftRound = draftPicksData.picks.reduce((max, pick) => Math.max(max, pick.round), 0);
        const draftRounds = Math.max(maxDraftRound, 16); // Default to 16 if no picks found

        return (
          <div className="bg-[#0d1420] border border-white/[0.06] rounded-xl overflow-hidden">
            <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-white/[0.06]">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-purple-500/15 border border-purple-500/25 flex items-center justify-center">
                  <FileText className="w-3.5 h-3.5 text-purple-400" />
                </div>
                <h2 className="text-base sm:text-lg font-semibold text-white">Draft Capital & Keepers</h2>
                {currentKeepers.length > 0 && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-amber-500/15 text-amber-400 font-medium">
                    {currentKeepers.length} keeper{currentKeepers.length !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
            </div>
            <div className="p-3 sm:p-5">
              <DraftCapital
                picks={draftPicksData.picks}
                teamSleeperId={thisRoster.sleeperId}
                teamName={thisRoster.teamName || undefined}
                showSeasons={1}
                maxRounds={draftRounds}
                keepers={keepersForCapital}
              />
            </div>
          </div>
        );
      })()}

      {/* Current Keepers - Only show for owner */}
      {isOwnTeam && (
        <div className="bg-[#0d1420] border border-white/[0.06] rounded-xl overflow-hidden">
          <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-white/[0.06]">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-amber-500/15 border border-amber-500/25 flex items-center justify-center">
                <Star className="w-3.5 h-3.5 text-amber-400" />
              </div>
              <h2 className="text-base sm:text-lg font-semibold text-white">Current Keepers</h2>
              <span className="px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-md bg-amber-500/15 text-amber-400 text-[10px] sm:text-xs font-bold">
                {currentKeepers.length}
              </span>
            </div>
          </div>
          <div className="p-3 sm:p-5">
            {currentKeepers.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3 sm:gap-4">
                {currentKeepers.map((p) => (
                  <PremiumPlayerCard
                    key={p.player.id}
                    player={p.player}
                    eligibility={p.eligibility}
                    existingKeeper={p.existingKeeper}
                    onRemoveKeeper={(keeperId) => removeKeeper(keeperId, p.player.fullName)}
                    onShowHistory={setHistoryPlayerId}
                    isLoading={false}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-6 sm:py-8">
                <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-2xl bg-slate-500/10 border border-slate-500/20 flex items-center justify-center mx-auto mb-3 sm:mb-4">
                  <Trophy className="w-6 h-6 sm:w-7 sm:h-7 text-slate-500" />
                </div>
                <p className="text-slate-300 font-medium text-sm sm:text-base">No keepers selected yet</p>
                <p className="text-xs sm:text-sm text-slate-500 mt-1">Add players from the eligible list below</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Eligible Players - Only show for own team */}
      {isOwnTeam && (
      <div className="bg-[#0d1420] border border-white/[0.06] rounded-xl overflow-hidden">
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-white/[0.06]">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-blue-500/15 border border-blue-500/25 flex items-center justify-center">
                <Users className="w-3.5 h-3.5 text-blue-400" />
              </div>
              <h2 className="text-base sm:text-lg font-semibold text-white">Eligible Players</h2>
              <span className="px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-md bg-blue-500/15 text-blue-400 text-[10px] sm:text-xs font-medium">
                {eligiblePlayers.length}
              </span>
            </div>
            <div className="flex gap-3 sm:gap-4 text-[10px] sm:text-xs text-slate-500 ml-9 sm:ml-0">
              <span className="flex items-center gap-1 sm:gap-1.5">
                <span className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-blue-500"></span>
                Keep
              </span>
              <span className="flex items-center gap-1 sm:gap-1.5">
                <span className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-amber-500"></span>
                Franchise Tag
              </span>
            </div>
          </div>
        </div>
        <div className="p-3 sm:p-5">
          {eligiblePlayers.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3 sm:gap-4">
              {eligiblePlayers.map((p) => (
                <PremiumPlayerCard
                  key={p.player.id}
                  player={p.player}
                  eligibility={p.eligibility}
                  costs={p.costs}
                  onAddKeeper={(playerId, type) => {
                    const cost = type === "FRANCHISE" ? p.costs.franchise : p.costs.regular;
                    addKeeper(playerId, type, p.player.fullName, cost ? {
                      baseCost: cost.baseCost,
                      finalCost: cost.finalCost,
                      yearsKept: p.eligibility.yearsKept,
                    } : undefined);
                  }}
                  onShowHistory={setHistoryPlayerId}
                  isLoading={false}
                  canAddFranchise={data.canAddMore.any && data.canAddMore.franchise}
                  canAddRegular={data.canAddMore.any && data.canAddMore.regular}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-6 sm:py-8">
              <p className="text-slate-500 text-sm sm:text-base">No eligible players available</p>
            </div>
          )}
        </div>
      </div>
      )}

      {/* Ineligible Players - Only show for own team */}
      {isOwnTeam && ineligiblePlayers.length > 0 && (
        <details className="group">
          <summary className="flex items-center gap-2 sm:gap-3 cursor-pointer hover:text-slate-300 active:text-slate-200 transition-colors text-slate-500 py-2 min-h-[44px]">
            <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider">
              Ineligible Players ({ineligiblePlayers.length})
            </span>
            <span className="text-[10px] sm:text-xs text-slate-600 group-open:hidden">Tap to expand</span>
          </summary>
          <div className="mt-3 sm:mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
            {ineligiblePlayers.map((p) => (
              <PremiumPlayerCard
                key={p.player.id}
                player={p.player}
                eligibility={p.eligibility}
                onShowHistory={setHistoryPlayerId}
              />
            ))}
          </div>
        </details>
      )}

      {/* Keeper History Modal */}
      <KeeperHistoryModal
        playerId={historyPlayerId || ""}
        isOpen={!!historyPlayerId}
        onClose={() => setHistoryPlayerId(null)}
      />
    </div>
  );
}
