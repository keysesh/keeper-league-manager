"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  FlaskConical,
  Plus,
  X,
  RotateCcw,
  TrendingUp,
  Search,
  Check,
  AlertTriangle,
  Trophy,
  Star,
} from "lucide-react";
import { PositionBadge } from "@/components/ui/PositionBadge";
import { Skeleton } from "@/components/ui/Skeleton";
import { logger } from "@/lib/logger";

const TEAM_COLORS = [
  { bg: "bg-rose-500", bgMuted: "bg-rose-500/20", border: "border-rose-500", text: "text-rose-300", accent: "text-rose-400" },
  { bg: "bg-sky-500", bgMuted: "bg-sky-500/20", border: "border-sky-500", text: "text-sky-300", accent: "text-sky-400" },
  { bg: "bg-emerald-500", bgMuted: "bg-emerald-500/20", border: "border-emerald-500", text: "text-emerald-300", accent: "text-emerald-400" },
  { bg: "bg-amber-500", bgMuted: "bg-amber-500/20", border: "border-amber-500", text: "text-amber-300", accent: "text-amber-400" },
  { bg: "bg-violet-500", bgMuted: "bg-violet-500/20", border: "border-violet-500", text: "text-violet-300", accent: "text-violet-400" },
  { bg: "bg-cyan-500", bgMuted: "bg-cyan-500/20", border: "border-cyan-500", text: "text-cyan-300", accent: "text-cyan-400" },
  { bg: "bg-pink-500", bgMuted: "bg-pink-500/20", border: "border-pink-500", text: "text-pink-300", accent: "text-pink-400" },
  { bg: "bg-lime-500", bgMuted: "bg-lime-500/20", border: "border-lime-500", text: "text-lime-300", accent: "text-lime-400" },
  { bg: "bg-orange-500", bgMuted: "bg-orange-500/20", border: "border-orange-500", text: "text-orange-300", accent: "text-orange-400" },
  { bg: "bg-teal-500", bgMuted: "bg-teal-500/20", border: "border-teal-500", text: "text-teal-300", accent: "text-teal-400" },
  { bg: "bg-indigo-500", bgMuted: "bg-indigo-500/20", border: "border-indigo-500", text: "text-indigo-300", accent: "text-indigo-400" },
  { bg: "bg-fuchsia-500", bgMuted: "bg-fuchsia-500/20", border: "border-fuchsia-500", text: "text-fuchsia-300", accent: "text-fuchsia-400" },
];

function getTeamColor(index: number) {
  return TEAM_COLORS[index % TEAM_COLORS.length];
}

interface Player {
  id: string;
  fullName: string;
  position: string;
  team: string | null;
  yearsKept: number;
  draftRound: number | null;
}

interface Roster {
  id: string;
  teamName: string | null;
  sleeperId: string;
  players: Player[];
  currentKeepers: Array<{
    playerId: string;
    type: string;
    baseCost: number;
    finalCost: number;
  }>;
}

interface SimulatedKeeper {
  playerId: string;
  playerName: string;
  position: string;
  rosterId: string;
  rosterName: string;
  baseCost: number;
  type: "REGULAR" | "FRANCHISE";
  isSimulated: boolean;
}

interface SimulationResult {
  rosterId: string;
  rosterName: string;
  keepers: Array<{
    playerId: string;
    playerName: string;
    position: string;
    baseCost: number;
    finalCost: number;
    cascaded: boolean;
    cascadeReason: string | null;
    type: string;
    isSimulated: boolean;
  }>;
  totalSlotsTaken: number;
  availableSlots: number[];
}

interface SimulationSummary {
  totalKeepers: number;
  cascadedKeepers: number;
  simulatedKeepers: number;
  actualKeepers: number;
}

export default function SimulationPage() {
  const params = useParams();
  const leagueId = params.leagueId as string;

  const [rosters, setRosters] = useState<Roster[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [simulatedKeepers, setSimulatedKeepers] = useState<SimulatedKeeper[]>([]);
  const [simulationResults, setSimulationResults] = useState<SimulationResult[] | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const [selectedRosterId, setSelectedRosterId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [keeperSettings, setKeeperSettings] = useState<{
    maxKeepers: number;
    maxFranchiseTags: number;
    undraftedRound: number;
  } | null>(null);

  // Fetch initial data
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [rostersRes, settingsRes] = await Promise.all([
        fetch(`/api/leagues/${leagueId}/rosters?includePlayers=true`),
        fetch(`/api/leagues/${leagueId}/settings`),
      ]);

      if (!rostersRes.ok) throw new Error("Failed to fetch rosters");

      const rostersData = await rostersRes.json();
      setRosters(rostersData.rosters || []);

      if (settingsRes.ok) {
        const settingsData = await settingsRes.json();
        setKeeperSettings(settingsData.keeperSettings);
      }

      setError("");
    } catch {
      setError("Failed to load simulation data");
    } finally {
      setLoading(false);
    }
  }, [leagueId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Initialize simulated keepers from actual keepers
  useEffect(() => {
    if (rosters.length > 0 && simulatedKeepers.length === 0) {
      const initialKeepers: SimulatedKeeper[] = [];
      rosters.forEach((roster) => {
        roster.currentKeepers.forEach((keeper) => {
          const player = roster.players.find((p) => p.id === keeper.playerId);
          if (player) {
            initialKeepers.push({
              playerId: keeper.playerId,
              playerName: player.fullName,
              position: player.position,
              rosterId: roster.id,
              rosterName: roster.teamName || `Team ${roster.sleeperId.slice(0, 4)}`,
              baseCost: keeper.baseCost,
              type: keeper.type as "REGULAR" | "FRANCHISE",
              isSimulated: false,
            });
          }
        });
      });
      setSimulatedKeepers(initialKeepers);
    }
  }, [rosters, simulatedKeepers.length]);

  // Run simulation using existing draft/simulate endpoint
  const runSimulation = useCallback(async () => {
    setIsSimulating(true);
    try {
      const res = await fetch(`/api/leagues/${leagueId}/draft/simulate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keepers: simulatedKeepers.map((k) => ({
            playerId: k.playerId,
            rosterId: k.rosterId,
            type: k.type,
          })),
        }),
      });

      if (!res.ok) throw new Error("Simulation failed");

      const data = await res.json();

      // Transform the response to match our expected format
      const results: SimulationResult[] = data.simulation.byRoster.map((roster: {
        rosterId: string;
        rosterName: string | null;
        keepers: Array<{
          playerId: string;
          playerName: string;
          position: string | null;
          baseCost: number;
          finalCost: number;
          isCascaded: boolean;
        }>;
      }) => {
        const simulatedKeeperIds = simulatedKeepers
          .filter((k) => k.isSimulated && k.rosterId === roster.rosterId)
          .map((k) => k.playerId);

        return {
          rosterId: roster.rosterId,
          rosterName: roster.rosterName || "Unknown Team",
          keepers: roster.keepers.map((k) => ({
            playerId: k.playerId,
            playerName: k.playerName,
            position: k.position || "?",
            baseCost: k.baseCost,
            finalCost: k.finalCost,
            cascaded: k.isCascaded,
            cascadeReason: k.isCascaded ? `Cascaded from R${k.baseCost} to R${k.finalCost}` : null,
            type: simulatedKeepers.find((sk) => sk.playerId === k.playerId)?.type || "REGULAR",
            isSimulated: simulatedKeeperIds.includes(k.playerId),
          })),
          totalSlotsTaken: roster.keepers.length,
          availableSlots: Array.from({ length: 15 }, (_, i) => i + 1).filter(
            (round) => !roster.keepers.some((k) => k.finalCost === round)
          ),
        };
      });

      setSimulationResults(results);
    } catch (err) {
      logger.error("Simulation error", err);
      setError("Failed to run simulation");
    } finally {
      setIsSimulating(false);
    }
  }, [leagueId, simulatedKeepers]);

  // Add simulated keeper
  const addSimulatedKeeper = (
    player: Player,
    roster: Roster,
    type: "REGULAR" | "FRANCHISE"
  ) => {
    const baseCost = player.draftRound || keeperSettings?.undraftedRound || 10;
    setSimulatedKeepers((prev) => [
      ...prev,
      {
        playerId: player.id,
        playerName: player.fullName,
        position: player.position,
        rosterId: roster.id,
        rosterName: roster.teamName || `Team ${roster.sleeperId.slice(0, 4)}`,
        baseCost,
        type,
        isSimulated: true,
      },
    ]);
    setShowAddModal(false);
    setSearchQuery("");
  };

  // Remove simulated keeper
  const removeKeeper = (playerId: string) => {
    setSimulatedKeepers((prev) => prev.filter((k) => k.playerId !== playerId));
  };

  // Reset to actual keepers
  const resetSimulation = () => {
    const initialKeepers: SimulatedKeeper[] = [];
    rosters.forEach((roster) => {
      roster.currentKeepers.forEach((keeper) => {
        const player = roster.players.find((p) => p.id === keeper.playerId);
        if (player) {
          initialKeepers.push({
            playerId: keeper.playerId,
            playerName: player.fullName,
            position: player.position,
            rosterId: roster.id,
            rosterName: roster.teamName || `Team ${roster.sleeperId.slice(0, 4)}`,
            baseCost: keeper.baseCost,
            type: keeper.type as "REGULAR" | "FRANCHISE",
            isSimulated: false,
          });
        }
      });
    });
    setSimulatedKeepers(initialKeepers);
    setSimulationResults(null);
  };

  // Get available players for adding
  const getAvailablePlayers = useCallback(
    (roster: Roster) => {
      const existingKeeperIds = simulatedKeepers
        .filter((k) => k.rosterId === roster.id)
        .map((k) => k.playerId);

      return roster.players
        .filter((p) => !existingKeeperIds.includes(p.id))
        .filter((p) =>
          searchQuery
            ? p.fullName.toLowerCase().includes(searchQuery.toLowerCase())
            : true
        );
    },
    [simulatedKeepers, searchQuery]
  );

  // Calculate summary
  const summary: SimulationSummary = useMemo(() => {
    return {
      totalKeepers: simulatedKeepers.length,
      cascadedKeepers: simulationResults
        ? simulationResults.reduce(
            (acc, r) => acc + r.keepers.filter((k) => k.cascaded).length,
            0
          )
        : 0,
      simulatedKeepers: simulatedKeepers.filter((k) => k.isSimulated).length,
      actualKeepers: simulatedKeepers.filter((k) => !k.isSimulated).length,
    };
  }, [simulatedKeepers, simulationResults]);

  // Get team index for color
  const getTeamIndex = (rosterId: string) => {
    return rosters.findIndex((r) => r.id === rosterId);
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto space-y-6 p-4">
        <Skeleton className="h-10 w-48 mb-2" />
        <Skeleton className="h-5 w-32" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24 w-full rounded-2xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-96 w-full rounded-2xl" />
          <Skeleton className="h-96 w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  if (error && !rosters.length) {
    return (
      <div className="max-w-7xl mx-auto p-4">
        <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-6">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-red-400" />
            <p className="text-red-400 font-medium">{error}</p>
          </div>
          <button
            onClick={fetchData}
            className="mt-4 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg text-sm font-medium"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  const selectedRoster = selectedRosterId
    ? rosters.find((r) => r.id === selectedRosterId)
    : null;

  return (
    <div className="max-w-7xl mx-auto space-y-6 p-4">
      {/* Premium Icon Gradient Definitions */}
      
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
        <div>
          <Link
            href={`/league/${leagueId}/draft-board`}
            className="inline-flex items-center gap-2 text-gray-500 hover:text-amber-400 text-sm mb-3 transition-colors group"
          >
            <ArrowLeft
              size={16}
              strokeWidth={2}
              className="group-hover:-translate-x-0.5 transition-transform"
            />
            <span>Back to Draft Board</span>
          </Link>
          <div className="flex items-center gap-3">
            <FlaskConical className="w-8 h-8 text-purple-400" />
            <h1 className="text-3xl font-bold text-white tracking-tight">
              Draft Simulation
            </h1>
          </div>
          <p className="text-gray-500 mt-2">
            Test &quot;what-if&quot; scenarios by adding or removing keepers
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={resetSimulation}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gray-800/50 text-gray-400 hover:text-white border border-gray-700/50 hover:border-gray-600 text-sm font-medium transition-all"
          >
            <RotateCcw size={16} strokeWidth={2} />
            Reset
          </button>
          <button
            onClick={runSimulation}
            disabled={isSimulating}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-500 to-purple-600 text-white text-sm font-medium transition-all hover:from-purple-600 hover:to-purple-700 disabled:opacity-50"
          >
            {isSimulating ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Simulating...
              </>
            ) : (
              <>
                <FlaskConical size={16} strokeWidth={2} />
                Run Simulation
              </>
            )}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<Trophy size={20} />}
          value={summary.totalKeepers}
          label="Total Keepers"
          color="white"
        />
        <StatCard
          icon={<TrendingUp size={20} />}
          value={summary.cascadedKeepers}
          label="Cascaded"
          color="amber"
        />
        <StatCard
          icon={<FlaskConical size={20} />}
          value={summary.simulatedKeepers}
          label="Simulated"
          color="purple"
        />
        <StatCard
          icon={<Check size={20} />}
          value={summary.actualKeepers}
          label="Actual"
          color="emerald"
        />
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Team Keepers */}
        <div className="bg-gradient-to-b from-gray-800/40 to-gray-900/40 rounded-2xl border border-gray-700/40 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-700/40 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">Simulated Keepers</h2>
            <button
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 text-sm font-medium transition-colors"
            >
              <Plus size={16} />
              Add Keeper
            </button>
          </div>

          <div className="p-4 max-h-[500px] overflow-y-auto">
            {rosters.map((roster, index) => {
              const color = getTeamColor(index);
              const teamKeepers = simulatedKeepers.filter(
                (k) => k.rosterId === roster.id
              );
              const maxKeepers = keeperSettings?.maxKeepers || 7;

              return (
                <div key={roster.id} className="mb-4 last:mb-0">
                  <div
                    className={`${color.bgMuted} px-4 py-3 rounded-t-xl border-l-4 ${color.border}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${color.bg}`} />
                        <span className={`font-semibold text-sm ${color.text}`}>
                          {roster.teamName || `Team ${roster.sleeperId.slice(0, 4)}`}
                        </span>
                      </div>
                      <span className="text-gray-400 text-xs">
                        {teamKeepers.length}/{maxKeepers}
                      </span>
                    </div>
                  </div>

                  <div className="bg-gray-900/50 rounded-b-xl border border-t-0 border-gray-700/30 p-3">
                    {teamKeepers.length > 0 ? (
                      <div className="space-y-2">
                        {teamKeepers.map((keeper) => (
                          <div
                            key={keeper.playerId}
                            className={`flex items-center justify-between px-3 py-2 rounded-lg ${
                              keeper.isSimulated
                                ? "bg-purple-500/10 border border-purple-500/30"
                                : "bg-gray-800/50 border border-gray-700/30"
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              {keeper.type === "FRANCHISE" && (
                                <Star size={12} />
                              )}
                              <PositionBadge position={keeper.position} size="xs" />
                              <span className="text-white text-sm">
                                {keeper.playerName}
                              </span>
                              {keeper.isSimulated && (
                                <span className="text-[10px] bg-purple-500/20 text-purple-400 px-1.5 py-0.5 rounded">
                                  SIM
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-gray-400 text-xs">
                                R{keeper.baseCost}
                              </span>
                              <button
                                onClick={() => removeKeeper(keeper.playerId)}
                                className="p-1 hover:bg-red-500/20 rounded text-gray-500 hover:text-red-400 transition-colors"
                              >
                                <X size={14} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-gray-500 text-sm text-center py-2">
                        No keepers
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Simulation Results */}
        <div className="bg-gradient-to-b from-gray-800/40 to-gray-900/40 rounded-2xl border border-gray-700/40 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-700/40">
            <h2 className="text-lg font-semibold text-white">
              Simulation Results
            </h2>
          </div>

          <div className="p-4 max-h-[500px] overflow-y-auto">
            {simulationResults ? (
              <div className="space-y-4">
                {simulationResults.map((result) => {
                  const index = getTeamIndex(result.rosterId);
                  const color = getTeamColor(index);

                  return (
                    <div key={result.rosterId}>
                      <div
                        className={`${color.bgMuted} px-4 py-3 rounded-t-xl border-l-4 ${color.border}`}
                      >
                        <div className="flex items-center justify-between">
                          <span className={`font-semibold text-sm ${color.text}`}>
                            {result.rosterName}
                          </span>
                          <span className="text-gray-400 text-xs">
                            {result.keepers.length} keepers
                          </span>
                        </div>
                      </div>

                      <div className="bg-gray-900/50 rounded-b-xl border border-t-0 border-gray-700/30 p-3">
                        {result.keepers.length > 0 ? (
                          <div className="space-y-2">
                            {result.keepers.map((keeper) => (
                              <div
                                key={keeper.playerId}
                                className={`flex items-center justify-between px-3 py-2 rounded-lg ${
                                  keeper.isSimulated
                                    ? "bg-purple-500/10 border border-purple-500/30"
                                    : "bg-gray-800/50 border border-gray-700/30"
                                }`}
                              >
                                <div className="flex items-center gap-2">
                                  {keeper.type === "FRANCHISE" && (
                                    <Star size={12} />
                                  )}
                                  <PositionBadge
                                    position={keeper.position}
                                    size="xs"
                                  />
                                  <span className="text-white text-sm">
                                    {keeper.playerName}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2">
                                  {keeper.cascaded ? (
                                    <>
                                      <span className="text-gray-500 text-xs line-through">
                                        R{keeper.baseCost}
                                      </span>
                                      <span className="text-amber-400 text-sm font-semibold">
                                        R{keeper.finalCost}
                                      </span>
                                      <TrendingUp
                                        size={12}
                                        className="text-amber-400"
                                      />
                                    </>
                                  ) : (
                                    <span className="text-white text-sm font-semibold">
                                      R{keeper.finalCost}
                                    </span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-gray-500 text-sm text-center py-2">
                            No keepers
                          </p>
                        )}

                        {/* Available Slots */}
                        {result.availableSlots.length > 0 && (
                          <div className="mt-3 pt-3 border-t border-gray-700/40">
                            <p className="text-gray-400 text-xs">
                              Available picks: R
                              {result.availableSlots.join(", R")}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <FlaskConical size={48} className="text-gray-600 mb-4" />
                <p className="text-gray-400 font-medium">No simulation run yet</p>
                <p className="text-gray-500 text-sm mt-1">
                  Add or remove keepers, then click &quot;Run Simulation&quot;
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add Keeper Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg max-h-[80vh] overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-700 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">
                Add Simulated Keeper
              </h3>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setSelectedRosterId(null);
                  setSearchQuery("");
                }}
                className="p-1.5 hover:bg-gray-800 rounded-lg text-gray-400 hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-4">
              {/* Team Selector */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Select Team
                </label>
                <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto">
                  {rosters.map((roster, index) => {
                    const color = getTeamColor(index);
                    const teamKeepers = simulatedKeepers.filter(
                      (k) => k.rosterId === roster.id
                    );
                    const maxKeepers = keeperSettings?.maxKeepers || 7;
                    const isFull = teamKeepers.length >= maxKeepers;

                    return (
                      <button
                        key={roster.id}
                        onClick={() => setSelectedRosterId(roster.id)}
                        disabled={isFull}
                        className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                          selectedRosterId === roster.id
                            ? `${color.bgMuted} ${color.border} border`
                            : isFull
                            ? "bg-gray-800/30 text-gray-600 cursor-not-allowed"
                            : "bg-gray-800/50 text-gray-300 hover:bg-gray-700/50 border border-transparent"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${color.bg}`} />
                          <span className="truncate">
                            {roster.teamName || `Team ${roster.sleeperId.slice(0, 4)}`}
                          </span>
                          <span className="text-gray-500">
                            ({teamKeepers.length}/{maxKeepers})
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {selectedRoster && (
                <>
                  {/* Search */}
                  <div className="mb-4">
                    <div className="relative">
                      <Search
                        size={16}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
                      />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search players..."
                        className="w-full pl-10 pr-4 py-2.5 bg-gray-800/50 border border-gray-700/50 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50"
                      />
                    </div>
                  </div>

                  {/* Player List */}
                  <div className="max-h-64 overflow-y-auto space-y-2">
                    {getAvailablePlayers(selectedRoster).map((player) => (
                      <div
                        key={player.id}
                        className="flex items-center justify-between px-3 py-2 bg-gray-800/50 rounded-lg border border-gray-700/30 hover:border-gray-600/50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <PositionBadge position={player.position} size="sm" />
                          <div>
                            <p className="text-white text-sm">{player.fullName}</p>
                            <p className="text-gray-500 text-xs">
                              {player.team || "FA"} • R
                              {player.draftRound || keeperSettings?.undraftedRound || 10}
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-1.5">
                          <button
                            onClick={() =>
                              addSimulatedKeeper(player, selectedRoster, "REGULAR")
                            }
                            className="px-2.5 py-1 bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 rounded text-xs font-medium transition-colors"
                          >
                            Keeper
                          </button>
                          <button
                            onClick={() =>
                              addSimulatedKeeper(player, selectedRoster, "FRANCHISE")
                            }
                            className="px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 rounded text-xs font-medium transition-colors"
                          >
                            FT
                          </button>
                        </div>
                      </div>
                    ))}
                    {getAvailablePlayers(selectedRoster).length === 0 && (
                      <p className="text-gray-500 text-sm text-center py-4">
                        No players available
                      </p>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({
  icon,
  value,
  label,
  color,
}: {
  icon: React.ReactNode;
  value: number | string;
  label: string;
  color: "white" | "amber" | "purple" | "emerald";
}) {
  const colorClasses = {
    white: {
      bg: "from-gray-700/30 to-gray-800/30",
      border: "border-gray-600/30",
      text: "text-white",
      icon: "bg-gray-700/50 text-gray-300",
    },
    amber: {
      bg: "from-amber-500/20 to-amber-500/5",
      border: "border-amber-500/20",
      text: "text-amber-400",
      icon: "bg-amber-500/20 text-amber-400",
    },
    purple: {
      bg: "from-purple-500/20 to-purple-500/5",
      border: "border-purple-500/20",
      text: "text-purple-400",
      icon: "bg-purple-500/20 text-purple-400",
    },
    emerald: {
      bg: "from-emerald-500/20 to-emerald-500/5",
      border: "border-emerald-500/20",
      text: "text-emerald-400",
      icon: "bg-emerald-500/20 text-emerald-400",
    },
  };

  const styles = colorClasses[color];

  return (
    <div
      className={`bg-gradient-to-b ${styles.bg} rounded-2xl p-5 border ${styles.border}`}
    >
      <div className="flex items-center justify-between mb-3">
        <span
          className={`flex items-center justify-center w-10 h-10 rounded-xl ${styles.icon}`}
        >
          {icon}
        </span>
      </div>
      <p className={`text-3xl font-bold ${styles.text} tracking-tight`}>
        {value}
      </p>
      <p className="text-gray-500 text-xs mt-1 font-medium">{label}</p>
    </div>
  );
}
