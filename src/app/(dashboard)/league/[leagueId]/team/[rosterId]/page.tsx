"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import useSWR from "swr";
import { Skeleton, SkeletonAvatar } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { PremiumPlayerCard } from "@/components/players/PremiumPlayerCard";

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
    acquisitionType: string;
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

  // Use SWR for faster data loading with caching
  const { data, error, mutate, isLoading } = useSWR<RosterData>(
    `/api/leagues/${leagueId}/rosters/${rosterId}/eligible-keepers`,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 5000,
    }
  );

  const addKeeper = async (playerId: string, type: "FRANCHISE" | "REGULAR", playerName: string) => {
    setActionLoading(playerId);
    try {
      const res = await fetch(`/api/leagues/${leagueId}/keepers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rosterId, playerId, type }),
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

  if (isLoading) {
    return (
      <div className="p-4 space-y-4">
        <div>
          <Skeleton className="h-4 w-24 mb-2" />
          <Skeleton className="h-8 w-48 mb-1" />
        </div>
        <div className="bg-gray-800/50 rounded-xl p-4">
          <Skeleton className="h-6 w-32 mb-4" />
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-48 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-4">
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
          <p className="text-red-400 text-sm">Failed to load data</p>
          <button
            onClick={() => mutate()}
            className="mt-2 text-xs text-purple-400 hover:text-purple-300"
          >
            Try again
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
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link
            href={`/league/${leagueId}`}
            className="text-gray-500 hover:text-white text-xs mb-1 inline-flex items-center gap-1"
          >
            &larr; Back
          </Link>
          <h1 className="text-xl font-bold text-white">Manage Keepers</h1>
        </div>
        <span className="text-xs px-2 py-1 bg-purple-500/20 text-purple-400 rounded">{data.season}</span>
      </div>

      {/* Keeper Summary */}
      <div className="flex items-center gap-4 px-3 py-2 rounded-lg bg-gray-800/40">
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold text-white">{data.currentKeepers.total}<span className="text-xs text-gray-500">/{data.limits.maxKeepers}</span></span>
          <span className="text-[10px] text-gray-500 uppercase">Total</span>
        </div>
        <div className="w-px h-4 bg-gray-700" />
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold text-amber-400">{data.currentKeepers.franchise}<span className="text-xs text-gray-500">/{data.limits.maxFranchiseTags}</span></span>
          <span className="text-[10px] text-gray-500 uppercase">FT</span>
        </div>
        <div className="w-px h-4 bg-gray-700" />
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold text-purple-400">{data.currentKeepers.regular}<span className="text-xs text-gray-500">/{data.limits.maxRegularKeepers}</span></span>
          <span className="text-[10px] text-gray-500 uppercase">Reg</span>
        </div>
      </div>

      {/* Current Keepers */}
      <div className="bg-purple-500/10 rounded-xl p-4 border border-purple-500/20">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold text-purple-400 uppercase">Current Keepers ({currentKeepers.length})</span>
        </div>
        {currentKeepers.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {currentKeepers.map((p) => (
              <PremiumPlayerCard
                key={p.player.id}
                player={p.player}
                eligibility={p.eligibility}
                existingKeeper={p.existingKeeper}
                onRemoveKeeper={(keeperId) => removeKeeper(keeperId, p.player.fullName)}
                isLoading={actionLoading === p.existingKeeper?.id}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-4">
            <p className="text-sm text-gray-500">No keepers selected yet</p>
            <p className="text-xs text-gray-600 mt-1">Add players from the eligible list below</p>
          </div>
        )}
      </div>

      {/* Eligible Players */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold text-gray-400 uppercase">Eligible ({eligiblePlayers.length})</span>
          <div className="flex gap-3 text-[10px] text-gray-500">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-purple-600"></span>Keep</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-amber-500"></span>FT</span>
          </div>
        </div>

        {eligiblePlayers.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {eligiblePlayers.map((p) => (
              <PremiumPlayerCard
                key={p.player.id}
                player={p.player}
                eligibility={p.eligibility}
                costs={p.costs}
                onAddKeeper={(playerId, type) => addKeeper(playerId, type, p.player.fullName)}
                isLoading={actionLoading === p.player.id}
                canAddFranchise={data.canAddMore.any && data.canAddMore.franchise}
                canAddRegular={data.canAddMore.any && data.canAddMore.regular}
              />
            ))}
          </div>
        ) : (
          <div className="card-compact rounded-xl p-4 text-center">
            <p className="text-sm text-gray-500">No eligible players</p>
          </div>
        )}
      </div>

      {/* Ineligible Players */}
      {ineligiblePlayers.length > 0 && (
        <details>
          <summary className="text-xs font-semibold text-gray-500 uppercase cursor-pointer hover:text-gray-400 mb-3">
            Ineligible ({ineligiblePlayers.length})
          </summary>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {ineligiblePlayers.map((p) => (
              <PremiumPlayerCard
                key={p.player.id}
                player={p.player}
                eligibility={p.eligibility}
              />
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
