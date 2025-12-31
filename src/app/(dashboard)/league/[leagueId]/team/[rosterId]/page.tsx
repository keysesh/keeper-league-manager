"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import useSWR from "swr";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { PremiumPlayerCard } from "@/components/players/PremiumPlayerCard";
import { KeeperHistoryModal } from "@/components/players/KeeperHistoryModal";
import { BackLink } from "@/components/ui/BackLink";
import { Trophy, Star, Users, RefreshCw } from "lucide-react";

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

  // Use SWR for faster data loading with caching
  const { data, error, mutate, isLoading } = useSWR<RosterData>(
    `/api/leagues/${leagueId}/rosters/${rosterId}/eligible-keepers`,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 5000,
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
    <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <BackLink href={`/league/${leagueId}`} label="Back to League" />
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500/20 to-purple-600/10 ring-1 ring-purple-500/20 flex items-center justify-center">
              <Trophy className="w-6 h-6 text-purple-400" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">Manage Keepers</h1>
              <p className="text-gray-500 mt-0.5">{data.season} Season</p>
            </div>
          </div>
        </div>
        <button
          onClick={syncKeepers}
          disabled={syncingKeepers}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gray-800/50 text-gray-300 hover:text-white border border-gray-700/50 hover:border-gray-600 text-sm font-medium transition-all disabled:opacity-50"
        >
          <RefreshCw size={16} className={syncingKeepers ? "animate-spin" : ""} />
          {syncingKeepers ? "Syncing..." : "Sync Keepers"}
        </button>
      </div>

      {/* Keeper Summary Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card-premium rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
              <Users size={18} className="text-purple-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{data.currentKeepers.total}<span className="text-sm text-gray-500">/{data.limits.maxKeepers}</span></p>
              <p className="text-xs text-gray-500 uppercase tracking-wide">Total Keepers</p>
            </div>
          </div>
        </div>
        <div className="card-premium rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
              <Star size={18} className="text-amber-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-amber-400">{data.currentKeepers.franchise}<span className="text-sm text-gray-500">/{data.limits.maxFranchiseTags}</span></p>
              <p className="text-xs text-gray-500 uppercase tracking-wide">Franchise Tags</p>
            </div>
          </div>
        </div>
        <div className="card-premium rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
              <Trophy size={18} className="text-emerald-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-emerald-400">{data.currentKeepers.regular}<span className="text-sm text-gray-500">/{data.limits.maxRegularKeepers}</span></p>
              <p className="text-xs text-gray-500 uppercase tracking-wide">Regular Keepers</p>
            </div>
          </div>
        </div>
      </div>

      {/* Current Keepers */}
      <div className="card-premium rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-amber-500/20 bg-gradient-to-r from-amber-500/10 to-transparent">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center">
              <Star size={16} className="text-amber-400" />
            </div>
            <h2 className="text-lg font-semibold text-white">Current Keepers</h2>
            <span className="px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-400 text-xs font-bold">
              {currentKeepers.length}
            </span>
          </div>
        </div>
        <div className="p-5">
          {currentKeepers.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
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
            <div className="text-center py-8">
              <div className="w-16 h-16 rounded-2xl bg-gray-800/50 flex items-center justify-center mx-auto mb-4">
                <Trophy className="w-8 h-8 text-gray-600" />
              </div>
              <p className="text-gray-400 font-medium">No keepers selected yet</p>
              <p className="text-sm text-gray-600 mt-1">Add players from the eligible list below</p>
            </div>
          )}
        </div>
      </div>

      {/* Eligible Players */}
      <div className="card-premium rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-700/40">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                <Users size={16} className="text-emerald-400" />
              </div>
              <h2 className="text-lg font-semibold text-white">Eligible Players</h2>
              <span className="px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-400 text-xs font-bold">
                {eligiblePlayers.length}
              </span>
            </div>
            <div className="flex gap-4 text-xs text-gray-500">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-600"></span>
                Keep
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400"></span>
                Franchise Tag
              </span>
            </div>
          </div>
        </div>
        <div className="p-5">
          {eligiblePlayers.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
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
            <div className="text-center py-8">
              <p className="text-gray-500">No eligible players available</p>
            </div>
          )}
        </div>
      </div>

      {/* Ineligible Players */}
      {ineligiblePlayers.length > 0 && (
        <details className="group">
          <summary className="flex items-center gap-3 cursor-pointer hover:text-gray-300 transition-colors text-gray-500">
            <span className="text-xs font-semibold uppercase tracking-wide">
              Ineligible Players ({ineligiblePlayers.length})
            </span>
            <span className="text-xs text-gray-600 group-open:hidden">Click to expand</span>
          </summary>
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
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
