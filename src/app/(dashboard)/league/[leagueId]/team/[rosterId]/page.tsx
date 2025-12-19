"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

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

  const [data, setData] = useState<RosterData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<"FRANCHISE" | "REGULAR">("REGULAR");

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

  const addKeeper = async (playerId: string, type: "FRANCHISE" | "REGULAR") => {
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

      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add keeper");
    } finally {
      setActionLoading(null);
    }
  };

  const removeKeeper = async (keeperId: string) => {
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

      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove keeper");
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500" />
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
      <div className="flex items-center justify-between">
        <div>
          <Link
            href={`/league/${leagueId}`}
            className="text-gray-400 hover:text-white text-sm mb-2 inline-block"
          >
            &larr; Back to League
          </Link>
          <h1 className="text-2xl font-bold text-white">Manage Keepers</h1>
          <p className="text-gray-400 mt-1">{data.season} Season</p>
        </div>
      </div>

      {/* Keeper Summary */}
      <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700">
        <h2 className="text-lg font-semibold text-white mb-4">Keeper Status</h2>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <p className="text-3xl font-bold text-white">
              {data.currentKeepers.total}
              <span className="text-gray-500 text-lg">/{data.limits.maxKeepers}</span>
            </p>
            <p className="text-gray-400 text-sm">Total Keepers</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-yellow-400">
              {data.currentKeepers.franchise}
              <span className="text-gray-500 text-lg">/{data.limits.maxFranchiseTags}</span>
            </p>
            <p className="text-gray-400 text-sm">Franchise Tags</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-blue-400">
              {data.currentKeepers.regular}
              <span className="text-gray-500 text-lg">/{data.limits.maxRegularKeepers}</span>
            </p>
            <p className="text-gray-400 text-sm">Regular Keepers</p>
          </div>
        </div>
      </div>

      {/* Current Keepers */}
      <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700">
        <h2 className="text-lg font-semibold text-white mb-4">
          Current Keepers ({currentKeepers.length})
        </h2>
        {currentKeepers.length > 0 ? (
          <div className="space-y-2">
            {currentKeepers.map((p) => (
              <div
                key={p.player.id}
                className="flex items-center justify-between bg-gray-700/50 rounded-lg px-4 py-3"
              >
                <div className="flex items-center gap-4">
                  <span
                    className={`px-2 py-1 rounded text-xs font-medium ${
                      p.existingKeeper?.type === "FRANCHISE"
                        ? "bg-yellow-500/20 text-yellow-400"
                        : "bg-blue-500/20 text-blue-400"
                    }`}
                  >
                    {p.existingKeeper?.type === "FRANCHISE" ? "FRANCHISE" : "REGULAR"}
                  </span>
                  <div>
                    <p className="text-white font-medium">{p.player.fullName}</p>
                    <p className="text-gray-400 text-sm">
                      {p.player.position} - {p.player.team || "FA"} &bull; Year{" "}
                      {p.eligibility.yearsKept} &bull; {p.eligibility.acquisitionType}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-white font-medium">
                      Round {p.existingKeeper?.finalCost}
                    </p>
                    <p className="text-gray-400 text-sm">Draft Cost</p>
                  </div>
                  {!p.existingKeeper?.isLocked && (
                    <button
                      onClick={() => removeKeeper(p.existingKeeper!.id)}
                      disabled={actionLoading === p.existingKeeper?.id}
                      className="px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded text-sm transition-colors disabled:opacity-50"
                    >
                      {actionLoading === p.existingKeeper?.id ? "..." : "Remove"}
                    </button>
                  )}
                  {p.existingKeeper?.isLocked && (
                    <span className="px-3 py-1.5 bg-gray-700 text-gray-500 rounded text-sm">
                      Locked
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500">No keepers selected yet</p>
        )}
      </div>

      {/* Available Players */}
      <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">
            Eligible Players ({eligiblePlayers.length})
          </h2>
          <div className="flex gap-2">
            <button
              onClick={() => setSelectedType("REGULAR")}
              className={`px-3 py-1.5 rounded text-sm transition-colors ${
                selectedType === "REGULAR"
                  ? "bg-blue-500 text-white"
                  : "bg-gray-700 text-gray-400 hover:text-white"
              }`}
            >
              Regular
            </button>
            <button
              onClick={() => setSelectedType("FRANCHISE")}
              disabled={!data.canAddMore.franchise}
              className={`px-3 py-1.5 rounded text-sm transition-colors ${
                selectedType === "FRANCHISE"
                  ? "bg-yellow-500 text-black"
                  : "bg-gray-700 text-gray-400 hover:text-white disabled:opacity-50"
              }`}
            >
              Franchise
            </button>
          </div>
        </div>

        {eligiblePlayers.length > 0 ? (
          <div className="space-y-2">
            {eligiblePlayers.map((p) => {
              const cost =
                selectedType === "FRANCHISE" ? p.costs.franchise : p.costs.regular;
              const canAdd =
                data.canAddMore.any &&
                (selectedType === "FRANCHISE"
                  ? data.canAddMore.franchise
                  : data.canAddMore.regular);

              return (
                <div
                  key={p.player.id}
                  className="flex items-center justify-between bg-gray-700/30 hover:bg-gray-700/50 rounded-lg px-4 py-3 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <PositionBadge position={p.player.position} />
                    <div>
                      <p className="text-white font-medium">
                        {p.player.fullName}
                        {p.player.injuryStatus && (
                          <span className="ml-2 text-xs text-red-400">
                            ({p.player.injuryStatus})
                          </span>
                        )}
                      </p>
                      <p className="text-gray-400 text-sm">
                        {p.player.team || "FA"} &bull; Age {p.player.age || "?"} &bull;{" "}
                        {p.player.yearsExp || 0} yrs exp &bull; {p.eligibility.acquisitionType}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    {cost && (
                      <div className="text-right">
                        <p className="text-white font-medium">Round {cost.finalCost}</p>
                        <p className="text-gray-500 text-xs">{cost.costBreakdown}</p>
                      </div>
                    )}
                    <button
                      onClick={() => addKeeper(p.player.id, selectedType)}
                      disabled={!canAdd || actionLoading === p.player.id}
                      className={`px-3 py-1.5 rounded text-sm transition-colors disabled:opacity-50 ${
                        selectedType === "FRANCHISE"
                          ? "bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400"
                          : "bg-purple-500/20 hover:bg-purple-500/30 text-purple-400"
                      }`}
                    >
                      {actionLoading === p.player.id
                        ? "..."
                        : `Keep as ${selectedType === "FRANCHISE" ? "FT" : "Regular"}`}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-gray-500">No eligible players remaining</p>
        )}
      </div>

      {/* Ineligible Players */}
      {ineligiblePlayers.length > 0 && (
        <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700">
          <h2 className="text-lg font-semibold text-white mb-4">
            Ineligible Players ({ineligiblePlayers.length})
          </h2>
          <div className="space-y-2">
            {ineligiblePlayers.map((p) => (
              <div
                key={p.player.id}
                className="flex items-center justify-between bg-gray-700/20 rounded-lg px-4 py-3 opacity-60"
              >
                <div className="flex items-center gap-4">
                  <PositionBadge position={p.player.position} />
                  <div>
                    <p className="text-white">{p.player.fullName}</p>
                    <p className="text-gray-400 text-sm">
                      {p.player.position} - {p.player.team || "FA"}
                    </p>
                  </div>
                </div>
                <p className="text-red-400 text-sm max-w-xs text-right">
                  {p.eligibility.reason}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function PositionBadge({ position }: { position: string | null }) {
  const colors: Record<string, string> = {
    QB: "bg-red-500/20 text-red-400",
    RB: "bg-green-500/20 text-green-400",
    WR: "bg-blue-500/20 text-blue-400",
    TE: "bg-orange-500/20 text-orange-400",
    K: "bg-purple-500/20 text-purple-400",
    DEF: "bg-gray-500/20 text-gray-400",
  };

  return (
    <span
      className={`w-10 text-center px-2 py-1 rounded text-xs font-medium ${
        colors[position || ""] || "bg-gray-500/20 text-gray-400"
      }`}
    >
      {position || "?"}
    </span>
  );
}
