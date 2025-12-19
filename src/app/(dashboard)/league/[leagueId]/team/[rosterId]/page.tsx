"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { PositionBadge, RookieBadge } from "@/components/ui/PositionBadge";
import { PlayerAvatar } from "@/components/players/PlayerAvatar";
import { Skeleton, SkeletonAvatar } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";

// Years kept badge with color coding
function YearsKeptBadge({ years, maxYears = 2 }: { years: number; maxYears?: number }) {
  const isFirstYear = years === 0;
  const isFinalYear = years === maxYears - 1;
  const isMaxed = years >= maxYears;

  let bgColor = "bg-green-500/20";
  let textColor = "text-green-400";
  let label = `Year ${years + 1}`;

  if (isFirstYear) {
    bgColor = "bg-cyan-500/20";
    textColor = "text-cyan-400";
    label = "New";
  } else if (isMaxed) {
    bgColor = "bg-red-500/20";
    textColor = "text-red-400";
    label = "Max";
  } else if (isFinalYear) {
    bgColor = "bg-yellow-500/20";
    textColor = "text-yellow-400";
    label = `Year ${years + 1} (Final)`;
  }

  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${bgColor} ${textColor}`}>
      {label}
    </span>
  );
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

  const [data, setData] = useState<RosterData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, [leagueId, rosterId]);

  const fetchData = async () => {
    try {
      const res = await fetch(
        `/api/leagues/${leagueId}/rosters/${rosterId}/eligible-keepers`
      );
      if (!res.ok) throw new Error("Failed to fetch data");
      const result = await res.json();
      setData(result);
    } catch {
      setError("Failed to load roster data");
    } finally {
      setLoading(false);
    }
  };

  const addKeeper = async (playerId: string, type: "FRANCHISE" | "REGULAR", playerName: string) => {
    setActionLoading(playerId);
    try {
      const res = await fetch(`/api/leagues/${leagueId}/keepers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rosterId,
          playerId,
          type,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to add keeper");
      }

      success(`${playerName} added as ${type === "FRANCHISE" ? "Franchise Tag" : "Regular Keeper"}`);
      await fetchData();
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

      success(`${playerName} removed from keepers`);
      await fetchData();
    } catch (err) {
      showError(err instanceof Error ? err.message : "Failed to remove keeper");
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div>
          <Skeleton className="h-4 w-24 mb-2" />
          <Skeleton className="h-8 w-48 mb-1" />
          <Skeleton className="h-4 w-32" />
        </div>
        <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700">
          <Skeleton className="h-6 w-32 mb-4" />
          <div className="grid grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="text-center">
                <Skeleton className="h-10 w-16 mx-auto mb-2" />
                <Skeleton className="h-4 w-20 mx-auto" />
              </div>
            ))}
          </div>
        </div>
        <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700">
          <Skeleton className="h-6 w-40 mb-4" />
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-4 bg-gray-700/50 rounded-lg px-4 py-3">
                <SkeletonAvatar size="sm" />
                <div className="flex-1">
                  <Skeleton className="h-4 w-32 mb-1" />
                  <Skeleton className="h-3 w-48" />
                </div>
                <Skeleton className="h-8 w-20" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6">
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
          <p className="text-red-400">{error || "Failed to load data"}</p>
          <button
            onClick={() => {
              setError("");
              setLoading(true);
              fetchData();
            }}
            className="mt-2 text-sm text-purple-400 hover:text-purple-300"
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
      {/* Header - Compact */}
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

      {/* Keeper Summary - Compact Row */}
      <div className="flex gap-2">
        <div className="stat-card flex-1">
          <p className="text-xl font-bold text-white">{data.currentKeepers.total}<span className="text-xs text-gray-500">/{data.limits.maxKeepers}</span></p>
          <p className="text-[10px] text-gray-500 uppercase">Total</p>
        </div>
        <div className="stat-card flex-1">
          <p className="text-xl font-bold text-amber-400">{data.currentKeepers.franchise}<span className="text-xs text-gray-500">/{data.limits.maxFranchiseTags}</span></p>
          <p className="text-[10px] text-gray-500 uppercase">FT</p>
        </div>
        <div className="stat-card flex-1">
          <p className="text-xl font-bold text-purple-400">{data.currentKeepers.regular}<span className="text-xs text-gray-500">/{data.limits.maxRegularKeepers}</span></p>
          <p className="text-[10px] text-gray-500 uppercase">Reg</p>
        </div>
      </div>

      {/* Current Keepers - Compact */}
      <div className="card-compact rounded-xl p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-gray-400 uppercase">Current Keepers ({currentKeepers.length})</span>
        </div>
        {currentKeepers.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {currentKeepers.map((p) => (
              <div
                key={p.player.id}
                className={`player-card flex items-center gap-2 border-l-2 ${
                  p.player.position === "QB" ? "border-l-red-500" :
                  p.player.position === "RB" ? "border-l-green-500" :
                  p.player.position === "WR" ? "border-l-blue-500" :
                  p.player.position === "TE" ? "border-l-orange-500" : "border-l-gray-500"
                }`}
              >
                <span className={`text-[10px] font-bold px-1 rounded ${p.existingKeeper?.type === "FRANCHISE" ? "bg-amber-500 text-black" : "bg-purple-600 text-white"}`}>
                  {p.existingKeeper?.type === "FRANCHISE" ? "FT" : "K"}
                </span>
                <PositionBadge position={p.player.position} size="xs" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-white font-medium truncate">{p.player.fullName}</p>
                  <p className="text-[10px] text-gray-500">{p.player.team || "FA"}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-white">R{p.existingKeeper?.finalCost}</p>
                  {!p.existingKeeper?.isLocked && (
                    <button
                      onClick={() => removeKeeper(p.existingKeeper!.id, p.player.fullName)}
                      disabled={actionLoading === p.existingKeeper?.id}
                      className="text-[10px] text-red-400 hover:text-red-300"
                    >
                      {actionLoading === p.existingKeeper?.id ? "..." : "×"}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-gray-500 py-2">No keepers selected</p>
        )}
      </div>

      {/* Available Players - Compact Grid */}
      <div className="card-compact rounded-xl p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-gray-400 uppercase">Eligible ({eligiblePlayers.length})</span>
          <div className="flex gap-2 text-[10px] text-gray-500">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-purple-600"></span>Reg</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-amber-500"></span>FT</span>
          </div>
        </div>

        {eligiblePlayers.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {eligiblePlayers.map((p) => {
              const regularCost = p.costs.regular;
              const franchiseCost = p.costs.franchise;
              const canAddRegular = data.canAddMore.any && data.canAddMore.regular;
              const canAddFranchise = data.canAddMore.any && data.canAddMore.franchise;
              const isLoading = actionLoading === p.player.id;

              return (
                <div
                  key={p.player.id}
                  className={`player-card flex items-center gap-2 border-l-2 ${
                    p.player.position === "QB" ? "border-l-red-500" :
                    p.player.position === "RB" ? "border-l-green-500" :
                    p.player.position === "WR" ? "border-l-blue-500" :
                    p.player.position === "TE" ? "border-l-orange-500" : "border-l-gray-500"
                  }`}
                >
                  <PositionBadge position={p.player.position} size="xs" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-white font-medium truncate">{p.player.fullName}</p>
                    <p className="text-[10px] text-gray-500">{p.player.team || "FA"}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    {regularCost && (
                      <button
                        onClick={() => addKeeper(p.player.id, "REGULAR", p.player.fullName)}
                        disabled={!canAddRegular || isLoading}
                        className="px-2 py-1 rounded text-[10px] font-bold bg-purple-600 hover:bg-purple-500 text-white disabled:opacity-40"
                      >
                        {isLoading ? "..." : `R${regularCost.finalCost}`}
                      </button>
                    )}
                    {franchiseCost && (
                      <button
                        onClick={() => addKeeper(p.player.id, "FRANCHISE", p.player.fullName)}
                        disabled={!canAddFranchise || isLoading}
                        className="px-2 py-1 rounded text-[10px] font-bold bg-amber-500 text-black disabled:opacity-40"
                      >
                        {isLoading ? "..." : "FT"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-xs text-gray-500 py-2">No eligible players</p>
        )}
      </div>

      {/* Ineligible Players - Compact */}
      {ineligiblePlayers.length > 0 && (
        <details className="card-compact rounded-xl p-3">
          <summary className="text-xs font-semibold text-gray-500 uppercase cursor-pointer hover:text-gray-400">
            Ineligible ({ineligiblePlayers.length})
          </summary>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2">
            {ineligiblePlayers.map((p) => (
              <div key={p.player.id} className="player-card opacity-50 flex items-center gap-2">
                <PositionBadge position={p.player.position} size="xs" />
                <span className="text-xs text-gray-400 truncate flex-1">{p.player.fullName}</span>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
