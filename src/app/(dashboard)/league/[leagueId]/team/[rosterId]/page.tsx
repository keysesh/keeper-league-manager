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
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <Link
            href={`/league/${leagueId}`}
            className="text-gray-500 hover:text-white text-sm mb-2 inline-flex items-center gap-1 transition-colors"
          >
            <span>&larr;</span> Back to League
          </Link>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">Manage Keepers</h1>
          <p className="text-gray-500 mt-1 flex items-center gap-2">
            <span className="px-2 py-0.5 bg-purple-500/20 text-purple-400 text-sm font-semibold rounded-full">
              {data.season}
            </span>
            Season
          </p>
        </div>
      </div>

      {/* Keeper Summary - Square Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="stat-card aspect-square flex flex-col items-center justify-center text-center border-purple-500/30 hover:border-purple-500/50">
          <p className="text-5xl font-extrabold text-white tracking-tight">
            {data.currentKeepers.total}
          </p>
          <p className="text-lg text-gray-500 font-medium">/{data.limits.maxKeepers}</p>
          <p className="text-xs text-gray-500 mt-2 uppercase tracking-wide">Total Keepers</p>
        </div>
        <div className="stat-card aspect-square flex flex-col items-center justify-center text-center border-amber-500/30 hover:border-amber-500/50">
          <p className="text-5xl font-extrabold text-amber-400 tracking-tight">
            {data.currentKeepers.franchise}
          </p>
          <p className="text-lg text-gray-500 font-medium">/{data.limits.maxFranchiseTags}</p>
          <p className="text-xs text-gray-500 mt-2 uppercase tracking-wide">Franchise Tags</p>
        </div>
        <div className="stat-card aspect-square flex flex-col items-center justify-center text-center border-blue-500/30 hover:border-blue-500/50">
          <p className="text-5xl font-extrabold text-blue-400 tracking-tight">
            {data.currentKeepers.regular}
          </p>
          <p className="text-lg text-gray-500 font-medium">/{data.limits.maxRegularKeepers}</p>
          <p className="text-xs text-gray-500 mt-2 uppercase tracking-wide">Regular Keepers</p>
        </div>
      </div>

      {/* Current Keepers */}
      <div className="card-premium rounded-2xl p-6">
        <h2 className="text-lg font-bold text-white mb-5 flex items-center gap-2">
          <span className="w-1 h-5 bg-green-500 rounded-full"></span>
          Current Keepers
          <span className="text-gray-500 font-normal">({currentKeepers.length})</span>
        </h2>
        {currentKeepers.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {currentKeepers.map((p) => (
              <div
                key={p.player.id}
                className={`flex items-center gap-4 rounded-xl px-4 py-4 bg-gray-800/60 border-l-4 transition-all hover:bg-gray-800/80 ${
                  p.player.position === "QB" ? "border-l-red-500" :
                  p.player.position === "RB" ? "border-l-green-500" :
                  p.player.position === "WR" ? "border-l-blue-500" :
                  p.player.position === "TE" ? "border-l-orange-500" : "border-l-gray-500"
                }`}
              >
                <PlayerAvatar sleeperId={p.player.sleeperId} name={p.player.fullName} size="sm" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                        p.existingKeeper?.type === "FRANCHISE"
                          ? "badge-franchise"
                          : "badge-keeper"
                      }`}
                    >
                      {p.existingKeeper?.type === "FRANCHISE" ? "FT" : "K"}
                    </span>
                    <PositionBadge position={p.player.position} size="xs" variant="subtle" />
                    <YearsKeptBadge years={p.eligibility.yearsKept - 1} />
                  </div>
                  <p className="text-white font-semibold flex items-center gap-2 truncate">
                    {p.player.fullName}
                    {p.player.yearsExp === 0 && <RookieBadge size="xs" />}
                  </p>
                  <p className="text-gray-500 text-xs">
                    {p.player.team || "FA"} &bull; {p.eligibility.acquisitionType}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <div className="text-right">
                    <p className="text-2xl font-bold text-white">R{p.existingKeeper?.finalCost}</p>
                  </div>
                  {!p.existingKeeper?.isLocked ? (
                    <button
                      onClick={() => removeKeeper(p.existingKeeper!.id, p.player.fullName)}
                      disabled={actionLoading === p.existingKeeper?.id}
                      className="px-3 py-1 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
                    >
                      {actionLoading === p.existingKeeper?.id ? "..." : "Remove"}
                    </button>
                  ) : (
                    <span className="px-3 py-1 bg-gray-800 text-gray-600 rounded-lg text-xs font-semibold">
                      Locked
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-gray-500">No keepers selected yet</p>
            <p className="text-gray-600 text-sm mt-1">Select players from the list below</p>
          </div>
        )}
      </div>

      {/* Available Players */}
      <div className="card-premium rounded-2xl p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <span className="w-1 h-5 bg-purple-500 rounded-full"></span>
            Eligible Players
            <span className="text-gray-500 font-normal">({eligiblePlayers.length})</span>
          </h2>
          <div className="flex items-center gap-3 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded bg-purple-600"></span> Regular
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded bg-gradient-to-r from-amber-500 to-yellow-500"></span> Franchise
            </span>
          </div>
        </div>

        {eligiblePlayers.length > 0 ? (
          <div className="space-y-3">
            {eligiblePlayers.map((p) => {
              const regularCost = p.costs.regular;
              const franchiseCost = p.costs.franchise;
              const canAddRegular = data.canAddMore.any && data.canAddMore.regular;
              const canAddFranchise = data.canAddMore.any && data.canAddMore.franchise;
              const isLoading = actionLoading === p.player.id;

              return (
                <div
                  key={p.player.id}
                  className={`rounded-xl bg-gray-800/40 border border-gray-700/50 transition-all hover:border-purple-500/30 hover:bg-gray-800/60 overflow-hidden`}
                >
                  {/* Player Info Row */}
                  <div className={`flex items-center gap-4 px-4 py-4 border-l-4 ${
                    p.player.position === "QB" ? "border-l-red-500" :
                    p.player.position === "RB" ? "border-l-green-500" :
                    p.player.position === "WR" ? "border-l-blue-500" :
                    p.player.position === "TE" ? "border-l-orange-500" : "border-l-gray-500"
                  }`}>
                    <PlayerAvatar sleeperId={p.player.sleeperId} name={p.player.fullName} size="sm" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <PositionBadge position={p.player.position} size="xs" variant="subtle" />
                        <YearsKeptBadge years={p.eligibility.yearsKept} />
                        {p.player.yearsExp === 0 && <RookieBadge size="xs" />}
                        {p.player.injuryStatus && (
                          <span className="text-xs text-red-400 font-medium">
                            {p.player.injuryStatus}
                          </span>
                        )}
                      </div>
                      <p className="text-white font-semibold truncate">{p.player.fullName}</p>
                      <p className="text-gray-500 text-xs">
                        {p.player.team || "FA"} &bull; {p.eligibility.acquisitionType}
                      </p>
                    </div>
                  </div>

                  {/* Keeper Options Row */}
                  <div className="flex border-t border-gray-700/50">
                    {/* Regular Keeper Option */}
                    <div className="flex-1 px-4 py-3 flex items-center justify-between border-r border-gray-700/50">
                      <div>
                        <p className="text-xs text-gray-500 mb-0.5">Regular Keeper</p>
                        {regularCost ? (
                          <p className="text-lg font-bold text-white">
                            Round {regularCost.finalCost}
                            {regularCost.baseCost !== regularCost.finalCost && (
                              <span className="text-gray-600 text-xs font-normal ml-1">
                                (was {regularCost.baseCost})
                              </span>
                            )}
                          </p>
                        ) : (
                          <p className="text-gray-600 text-sm">N/A</p>
                        )}
                      </div>
                      <button
                        onClick={() => addKeeper(p.player.id, "REGULAR", p.player.fullName)}
                        disabled={!canAddRegular || isLoading || !regularCost}
                        className="px-4 py-2 rounded-lg text-xs font-bold bg-purple-600 hover:bg-purple-500 text-white transition-all disabled:opacity-40 disabled:hover:bg-purple-600"
                      >
                        {isLoading ? "..." : "Keep"}
                      </button>
                    </div>

                    {/* Franchise Tag Option */}
                    <div className="flex-1 px-4 py-3 flex items-center justify-between bg-amber-500/5">
                      <div>
                        <p className="text-xs text-amber-400/70 mb-0.5">Franchise Tag</p>
                        {franchiseCost ? (
                          <p className="text-lg font-bold text-amber-400">
                            Round {franchiseCost.finalCost}
                          </p>
                        ) : (
                          <p className="text-gray-600 text-sm">N/A</p>
                        )}
                      </div>
                      <button
                        onClick={() => addKeeper(p.player.id, "FRANCHISE", p.player.fullName)}
                        disabled={!canAddFranchise || isLoading || !franchiseCost}
                        className="px-4 py-2 rounded-lg text-xs font-bold bg-gradient-to-r from-amber-500 to-yellow-500 text-black transition-all disabled:opacity-40"
                      >
                        {isLoading ? "..." : "Tag"}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-gray-500">No eligible players remaining</p>
          </div>
        )}
      </div>

      {/* Ineligible Players */}
      {ineligiblePlayers.length > 0 && (
        <div className="card-premium rounded-2xl p-6">
          <h2 className="text-lg font-bold text-white mb-5 flex items-center gap-2">
            <span className="w-1 h-5 bg-red-500 rounded-full"></span>
            Ineligible Players
            <span className="text-gray-500 font-normal">({ineligiblePlayers.length})</span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {ineligiblePlayers.map((p) => (
              <div
                key={p.player.id}
                className={`flex items-center gap-4 rounded-xl px-4 py-3 bg-gray-800/20 border border-gray-800/50 border-l-4 ${
                  p.player.position === "QB" ? "border-l-red-500/30" :
                  p.player.position === "RB" ? "border-l-green-500/30" :
                  p.player.position === "WR" ? "border-l-blue-500/30" :
                  p.player.position === "TE" ? "border-l-orange-500/30" : "border-l-gray-500/30"
                }`}
              >
                <PlayerAvatar sleeperId={p.player.sleeperId} name={p.player.fullName} size="sm" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <PositionBadge position={p.player.position} size="xs" variant="subtle" />
                    <YearsKeptBadge years={p.eligibility.yearsKept} />
                  </div>
                  <p className="text-gray-400 font-medium truncate">{p.player.fullName}</p>
                  <p className="text-gray-600 text-xs">
                    {p.player.team || "FA"} &bull; {p.eligibility.acquisitionType}
                  </p>
                </div>
                <div className="flex flex-col items-end">
                  <span className="px-2 py-1 bg-red-500/10 border border-red-500/20 rounded text-red-400 text-xs font-medium">
                    Ineligible
                  </span>
                  <p className="text-gray-500 text-xs mt-1 max-w-[120px] text-right">
                    {p.eligibility.reason}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
