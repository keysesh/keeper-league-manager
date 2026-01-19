"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import useSWR from "swr";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { PremiumPlayerCard } from "@/components/players/PremiumPlayerCard";
import { KeeperHistoryModal } from "@/components/players/KeeperHistoryModal";
import { BackLink } from "@/components/ui/BackLink";
import { RefreshCw, Trophy, Star, Users, FileText } from "lucide-react";
import { DraftCapital } from "@/components/ui/DraftCapital";

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

export default function TeamRosterPage() {
  const params = useParams();
  const leagueId = params.leagueId as string;
  const rosterId = params.rosterId as string;
  const { success, error: showError } = useToast();
  const [syncingKeepers, setSyncingKeepers] = useState(false);
  const [historyPlayerId, setHistoryPlayerId] = useState<string | null>(null);

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
          <Skeleton className="h-4 w-24 mb-3" />
          <Skeleton className="h-10 w-64 mb-2" />
          <Skeleton className="h-5 w-48" />
        </div>
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-md p-6">
          <Skeleton className="h-6 w-32 mb-4" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-56 rounded-md" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-7xl mx-auto p-4 md:p-6">
        <div className="bg-red-500/10 border border-red-500/30 rounded-md p-6">
          <p className="text-red-500 font-medium">Failed to load roster data</p>
          <button
            onClick={() => mutate()}
            className="mt-4 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-500 rounded-md text-sm font-medium transition-colors"
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
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-md bg-[#1a1a1a] border border-[#2a2a2a] flex items-center justify-center flex-shrink-0">
                <Trophy className="w-5 h-5 sm:w-6 sm:h-6 text-blue-500" />
              </div>
              <div className="min-w-0">
                <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-white tracking-tight truncate">Manage Keepers</h1>
                <p className="text-gray-500 text-sm sm:text-base mt-0.5">{data.season} Season</p>
              </div>
            </div>
          </div>
          <button
            onClick={syncKeepers}
            disabled={syncingKeepers}
            className="flex-shrink-0 inline-flex items-center justify-center gap-1.5 sm:gap-2 min-h-[44px] min-w-[44px] sm:min-w-0 px-3 sm:px-4 py-2 sm:py-2.5 rounded-md bg-[#1a1a1a] text-gray-400 hover:text-white active:bg-[#222222] border border-[#2a2a2a] hover:border-[#333333] text-xs sm:text-sm font-medium transition-colors disabled:opacity-50"
          >
            <RefreshCw size={16} className={syncingKeepers ? "animate-spin" : ""} />
            <span className="hidden sm:inline">{syncingKeepers ? "Syncing..." : "Sync Keepers"}</span>
          </button>
        </div>
      </div>

      {/* Keeper Summary Stats */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-md p-2.5 sm:p-4">
          <div className="flex flex-col sm:flex-row items-center sm:items-center gap-1.5 sm:gap-3 text-center sm:text-left">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-md bg-[#222222] border border-[#2a2a2a] flex items-center justify-center flex-shrink-0">
              <Users className="w-4 h-4 text-blue-500" />
            </div>
            <div>
              <p className="text-lg sm:text-2xl font-bold text-white">{data.currentKeepers.total}<span className="text-[10px] sm:text-sm text-gray-500">/{data.limits.maxKeepers}</span></p>
              <p className="text-[9px] sm:text-xs text-gray-500 uppercase tracking-wide">Total</p>
            </div>
          </div>
        </div>
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-md p-2.5 sm:p-4">
          <div className="flex flex-col sm:flex-row items-center sm:items-center gap-1.5 sm:gap-3 text-center sm:text-left">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-md bg-[#222222] border border-[#2a2a2a] flex items-center justify-center flex-shrink-0">
              <Star className="w-4 h-4 text-yellow-500" />
            </div>
            <div>
              <p className="text-lg sm:text-2xl font-bold text-yellow-500">{data.currentKeepers.franchise}<span className="text-[10px] sm:text-sm text-gray-500">/{data.limits.maxFranchiseTags}</span></p>
              <p className="text-[9px] sm:text-xs text-gray-500 uppercase tracking-wide">Franchise</p>
            </div>
          </div>
        </div>
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-md p-2.5 sm:p-4">
          <div className="flex flex-col sm:flex-row items-center sm:items-center gap-1.5 sm:gap-3 text-center sm:text-left">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-md bg-[#222222] border border-[#2a2a2a] flex items-center justify-center flex-shrink-0">
              <Trophy className="w-4 h-4 text-blue-500" />
            </div>
            <div>
              <p className="text-lg sm:text-2xl font-bold text-blue-400">{data.currentKeepers.regular}<span className="text-[10px] sm:text-sm text-gray-500">/{data.limits.maxRegularKeepers}</span></p>
              <p className="text-[9px] sm:text-xs text-gray-500 uppercase tracking-wide">Regular</p>
            </div>
          </div>
        </div>
      </div>

      {/* Draft Capital - only shows if there's notable activity (trades) */}
      {draftPicksData && (() => {
        // Find this roster's sleeperId
        const thisRoster = draftPicksData.rosters.find(r => r.id === rosterId);
        if (!thisRoster?.sleeperId) return null;

        // Check if there's any notable draft capital activity
        const teamPicks = draftPicksData.picks.filter(
          p => p.currentOwnerSleeperId === thisRoster.sleeperId
        );
        const acquiredPicks = teamPicks.filter(
          p => p.originalOwnerSleeperId !== thisRoster.sleeperId
        );
        const tradedAwayPicks = draftPicksData.picks.filter(
          p => p.originalOwnerSleeperId === thisRoster.sleeperId &&
               p.currentOwnerSleeperId !== thisRoster.sleeperId
        );

        // Hide section if nothing notable (all own picks, no trades)
        if (acquiredPicks.length === 0 && tradedAwayPicks.length === 0) {
          return null;
        }

        return (
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-md overflow-hidden">
            <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-[#2a2a2a]">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-md bg-[#222222] border border-[#2a2a2a] flex items-center justify-center">
                  <FileText className="w-3.5 h-3.5 text-emerald-500" />
                </div>
                <h2 className="text-base sm:text-lg font-semibold text-white">Draft Capital</h2>
                {acquiredPicks.length > 0 && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400">
                    +{acquiredPicks.length} acquired
                  </span>
                )}
                {tradedAwayPicks.length > 0 && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-400">
                    -{tradedAwayPicks.length} traded
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
              />
            </div>
          </div>
        );
      })()}

      {/* Current Keepers */}
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-md overflow-hidden">
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-[#2a2a2a]">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-md bg-[#222222] border border-[#2a2a2a] flex items-center justify-center">
              <Star className="w-3.5 h-3.5 text-yellow-500" />
            </div>
            <h2 className="text-base sm:text-lg font-semibold text-white">Current Keepers</h2>
            <span className="px-2 sm:px-2.5 py-0.5 sm:py-1 rounded bg-yellow-500/20 text-yellow-500 text-[10px] sm:text-xs font-bold">
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
              <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-md bg-[#222222] border border-[#2a2a2a] flex items-center justify-center mx-auto mb-3 sm:mb-4">
                <Trophy className="w-6 h-6 sm:w-7 sm:h-7 text-gray-600" />
              </div>
              <p className="text-gray-400 font-medium text-sm sm:text-base">No keepers selected yet</p>
              <p className="text-xs sm:text-sm text-gray-600 mt-1">Add players from the eligible list below</p>
            </div>
          )}
        </div>
      </div>

      {/* Eligible Players */}
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-md overflow-hidden">
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-[#2a2a2a]">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-md bg-[#222222] border border-[#2a2a2a] flex items-center justify-center">
                <Users className="w-3.5 h-3.5 text-blue-500" />
              </div>
              <h2 className="text-base sm:text-lg font-semibold text-white">Eligible Players</h2>
              <span className="px-2 sm:px-2.5 py-0.5 sm:py-1 rounded bg-blue-500/10 text-blue-400 text-[10px] sm:text-xs font-medium">
                {eligiblePlayers.length}
              </span>
            </div>
            <div className="flex gap-3 sm:gap-4 text-[10px] sm:text-xs text-gray-500 ml-9 sm:ml-0">
              <span className="flex items-center gap-1 sm:gap-1.5">
                <span className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-blue-600"></span>
                Keep
              </span>
              <span className="flex items-center gap-1 sm:gap-1.5">
                <span className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-blue-500"></span>
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
              <p className="text-gray-500 text-sm sm:text-base">No eligible players available</p>
            </div>
          )}
        </div>
      </div>

      {/* Ineligible Players */}
      {ineligiblePlayers.length > 0 && (
        <details className="group">
          <summary className="flex items-center gap-2 sm:gap-3 cursor-pointer hover:text-gray-300 active:text-gray-200 transition-colors text-gray-500 py-2 min-h-[44px]">
            <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wide">
              Ineligible Players ({ineligiblePlayers.length})
            </span>
            <span className="text-[10px] sm:text-xs text-gray-600 group-open:hidden">Tap to expand</span>
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
