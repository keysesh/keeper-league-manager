"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import useSWR from "swr";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { PremiumPlayerCard } from "@/components/players/PremiumPlayerCard";
import { KeeperHistoryModal } from "@/components/players/KeeperHistoryModal";
import { BackLink } from "@/components/ui/BackLink";
import { RefreshCw } from "lucide-react";
import {
  TrophyIcon,
  StarIcon,
  UsersIcon,
  IconGradientDefs,
} from "@/components/ui/PremiumIcons";

// SWR fetcher
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
  // Fantasy stats from NFLverse
  fantasyPointsPpr: number | null;
  fantasyPointsHalfPpr: number | null;
  gamesPlayed: number | null;
  pointsPerGame: number | null;
  // Season-specific PPG
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

export default function TeamRosterPage() {
  const params = useParams();
  const leagueId = params.leagueId as string;
  const rosterId = params.rosterId as string;
  const { success, error: showError } = useToast();
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [syncingKeepers, setSyncingKeepers] = useState(false);
  const [historyPlayerId, setHistoryPlayerId] = useState<string | null>(null);

  // Use SWR for data loading - no caching since keeper data changes frequently
  const { data, error, mutate, isLoading } = useSWR<RosterData>(
    `/api/leagues/${leagueId}/rosters/${rosterId}/eligible-keepers`,
    fetcher,
    {
      revalidateOnFocus: true,
      revalidateIfStale: true,
      dedupingInterval: 0, // No deduping - always fetch fresh data after mutations
    }
  );

  const addKeeper = async (
    playerId: string,
    type: "FRANCHISE" | "REGULAR",
    playerName: string,
    costData?: { baseCost: number; finalCost: number; yearsKept: number }
  ) => {
    setActionLoading(playerId);
    try {
      const res = await fetch(`/api/leagues/${leagueId}/keepers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rosterId,
          playerId,
          type,
          // Pass pre-calculated cost data to avoid server-side recalculation
          baseCost: costData?.baseCost,
          finalCost: costData?.finalCost,
          yearsKept: costData?.yearsKept,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to add keeper");
      }

      success(`${playerName} added as ${type === "FRANCHISE" ? "FT" : "Keeper"}`);
      mutate();
    } catch (err) {
      showError(err instanceof Error ? err.message : "Failed to add keeper");
    } finally {
      setActionLoading(null);
    }
  };

  const removeKeeper = async (keeperId: string, playerName: string) => {
    setActionLoading(keeperId);
    try {
      const res = await fetch(
        `/api/leagues/${leagueId}/keepers?keeperId=${keeperId}`,
        { method: "DELETE" }
      );

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to remove keeper");
      }

      success(`${playerName} removed`);
      mutate();
    } catch (err) {
      showError(err instanceof Error ? err.message : "Failed to remove keeper");
    } finally {
      setActionLoading(null);
    }
  };

  const syncKeepers = async () => {
    setSyncingKeepers(true);
    try {
      // Step 1: Populate keepers from draft picks
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

      // Step 2: Recalculate keeper years to fix any incorrect values
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
        <div className="card-premium rounded-2xl p-6">
          <Skeleton className="h-6 w-32 mb-4" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-56 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-7xl mx-auto p-4 md:p-6">
        <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-6">
          <p className="text-red-400 font-medium">Failed to load roster data</p>
          <button
            onClick={() => mutate()}
            className="mt-4 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-xl text-sm font-medium transition-colors"
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
      {/* Premium Icon Gradient Definitions */}
      <IconGradientDefs />

      {/* Header */}
      <div className="flex flex-col gap-3 sm:gap-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <BackLink href={`/league/${leagueId}`} label="Back to League" />
            <div className="flex items-center gap-2 sm:gap-3 mt-1">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-amber-500/20 to-amber-600/10 ring-1 ring-amber-500/20 flex items-center justify-center flex-shrink-0">
                <TrophyIcon size={24} />
              </div>
              <div className="min-w-0">
                <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-white tracking-tight truncate">Manage Keepers</h1>
                <p className="text-zinc-500 text-sm sm:text-base mt-0.5">{data.season} Season</p>
              </div>
            </div>
          </div>
          <button
            onClick={syncKeepers}
            disabled={syncingKeepers}
            className="flex-shrink-0 inline-flex items-center justify-center gap-1.5 sm:gap-2 min-h-[44px] min-w-[44px] sm:min-w-0 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl bg-white/[0.03] text-zinc-300 hover:text-white active:bg-white/[0.06] border border-white/[0.06] hover:border-white/[0.12] text-xs sm:text-sm font-medium transition-all disabled:opacity-50"
          >
            <RefreshCw size={16} className={syncingKeepers ? "animate-spin" : ""} />
            <span className="hidden sm:inline">{syncingKeepers ? "Syncing..." : "Sync Keepers"}</span>
          </button>
        </div>
      </div>

      {/* Keeper Summary Stats - Stack on mobile */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        <div className="card-premium rounded-xl p-2.5 sm:p-4">
          <div className="flex flex-col sm:flex-row items-center sm:items-center gap-1.5 sm:gap-3 text-center sm:text-left">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-amber-500/20 flex items-center justify-center flex-shrink-0">
              <UsersIcon size={16} />
            </div>
            <div>
              <p className="text-lg sm:text-2xl font-bold text-white">{data.currentKeepers.total}<span className="text-[10px] sm:text-sm text-zinc-500">/{data.limits.maxKeepers}</span></p>
              <p className="text-[9px] sm:text-xs text-zinc-500 uppercase tracking-wide">Total</p>
            </div>
          </div>
        </div>
        <div className="card-premium rounded-xl p-2.5 sm:p-4">
          <div className="flex flex-col sm:flex-row items-center sm:items-center gap-1.5 sm:gap-3 text-center sm:text-left">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-amber-500/20 flex items-center justify-center flex-shrink-0">
              <StarIcon size={16} />
            </div>
            <div>
              <p className="text-lg sm:text-2xl font-bold text-amber-400">{data.currentKeepers.franchise}<span className="text-[10px] sm:text-sm text-zinc-500">/{data.limits.maxFranchiseTags}</span></p>
              <p className="text-[9px] sm:text-xs text-zinc-500 uppercase tracking-wide">Franchise</p>
            </div>
          </div>
        </div>
        <div className="card-premium rounded-xl p-2.5 sm:p-4">
          <div className="flex flex-col sm:flex-row items-center sm:items-center gap-1.5 sm:gap-3 text-center sm:text-left">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
              <TrophyIcon size={16} />
            </div>
            <div>
              <p className="text-lg sm:text-2xl font-bold text-emerald-400">{data.currentKeepers.regular}<span className="text-[10px] sm:text-sm text-zinc-500">/{data.limits.maxRegularKeepers}</span></p>
              <p className="text-[9px] sm:text-xs text-zinc-500 uppercase tracking-wide">Regular</p>
            </div>
          </div>
        </div>
      </div>

      {/* Current Keepers */}
      <div className="card-premium rounded-xl sm:rounded-2xl overflow-hidden">
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-amber-500/20 bg-gradient-to-r from-amber-500/10 to-transparent">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-amber-500/20 flex items-center justify-center">
              <StarIcon size={14} />
            </div>
            <h2 className="text-base sm:text-lg font-semibold text-white">Current Keepers</h2>
            <span className="px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-lg bg-amber-500/20 text-amber-400 text-[10px] sm:text-xs font-bold">
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
                  isLoading={actionLoading === p.existingKeeper?.id}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-6 sm:py-8">
              <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl bg-zinc-800/50 flex items-center justify-center mx-auto mb-3 sm:mb-4">
                <TrophyIcon size={28} className="opacity-50" />
              </div>
              <p className="text-zinc-400 font-medium text-sm sm:text-base">No keepers selected yet</p>
              <p className="text-xs sm:text-sm text-zinc-600 mt-1">Add players from the eligible list below</p>
            </div>
          )}
        </div>
      </div>

      {/* Eligible Players */}
      <div className="card-premium rounded-xl sm:rounded-2xl overflow-hidden">
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-white/[0.06]">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                <UsersIcon size={14} />
              </div>
              <h2 className="text-base sm:text-lg font-semibold text-white">Eligible Players</h2>
              <span className="px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-lg bg-emerald-500/20 text-emerald-400 text-[10px] sm:text-xs font-bold">
                {eligiblePlayers.length}
              </span>
            </div>
            <div className="flex gap-3 sm:gap-4 text-[10px] sm:text-xs text-zinc-500 ml-9 sm:ml-0">
              <span className="flex items-center gap-1 sm:gap-1.5">
                <span className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-amber-600"></span>
                Keep
              </span>
              <span className="flex items-center gap-1 sm:gap-1.5">
                <span className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-amber-400"></span>
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
                  isLoading={actionLoading === p.player.id}
                  canAddFranchise={data.canAddMore.any && data.canAddMore.franchise}
                  canAddRegular={data.canAddMore.any && data.canAddMore.regular}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-6 sm:py-8">
              <p className="text-zinc-500 text-sm sm:text-base">No eligible players available</p>
            </div>
          )}
        </div>
      </div>

      {/* Ineligible Players */}
      {ineligiblePlayers.length > 0 && (
        <details className="group">
          <summary className="flex items-center gap-2 sm:gap-3 cursor-pointer hover:text-zinc-300 active:text-zinc-200 transition-colors text-zinc-500 py-2 min-h-[44px]">
            <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wide">
              Ineligible Players ({ineligiblePlayers.length})
            </span>
            <span className="text-[10px] sm:text-xs text-zinc-600 group-open:hidden">Tap to expand</span>
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
