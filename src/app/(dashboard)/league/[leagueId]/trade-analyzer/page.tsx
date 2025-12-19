"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { PositionBadge } from "@/components/ui/PositionBadge";
import { PlayerAvatar } from "@/components/players/PlayerAvatar";
import { Skeleton, SkeletonAvatar } from "@/components/ui/Skeleton";

interface Player {
  id: string;
  sleeperId: string;
  fullName: string;
  position: string | null;
  team: string | null;
  age: number | null;
  injuryStatus: string | null;
}

interface Roster {
  id: string;
  teamName: string | null;
  sleeperId: string;
}

// Comprehensive trade analysis types from API
interface CostTrajectoryYear {
  year: number;
  cost: number;
  isFinalYear: boolean;
}

interface PlayerTradeValue {
  playerId: string;
  sleeperId: string;
  playerName: string;
  position: string | null;
  team: string | null;
  age: number | null;
  yearsExp: number | null;
  injuryStatus: string | null;
  keeperStatus: {
    isCurrentKeeper: boolean;
    currentCost: number | null;
    yearsKept: number;
    maxYearsAllowed: number;
    isEligibleForRegular: boolean;
    isEligibleForFranchise: boolean;
    keeperType: "FRANCHISE" | "REGULAR" | null;
  };
  projection: {
    newCost: number;
    costChange: number;
    yearsKeptReset: boolean;
    tradeDeadlineImpact: "preserved" | "reset";
    costTrajectory: CostTrajectoryYear[];
  };
  tradeValue: number;
  valueBreakdown: {
    basePositionValue: number;
    ageModifier: number;
    keeperValueBonus: number;
    total: number;
  };
}

interface PositionChange {
  position: string;
  before: number;
  after: number;
  change: number;
}

interface DraftPickValue {
  season: number;
  round: number;
  value: number;
}

interface TradeFact {
  category: "keeper" | "roster" | "draft" | "value";
  description: string;
}

interface TeamTradeAnalysis {
  rosterId: string;
  rosterName: string;
  tradingAway: PlayerTradeValue[];
  acquiring: PlayerTradeValue[];
  positionChanges: PositionChange[];
  keeperSlotsBefore: number;
  keeperSlotsAfter: number;
  keeperSlotsMax: number;
  keeperValueLost: number;
  keeperValueGained: number;
  netKeeperValue: number;
  picksGiven: DraftPickValue[];
  picksReceived: DraftPickValue[];
  draftCapitalChange: number;
  totalValueGiven: number;
  totalValueReceived: number;
  netValue: number;
}

interface TradeAnalysisResult {
  success: boolean;
  tradeDate: string;
  isAfterDeadline: boolean;
  season: number;
  team1: TeamTradeAnalysis;
  team2: TeamTradeAnalysis;
  summary: {
    fairnessScore: number;
    valueDifferential: number;
    facts: TradeFact[];
  };
}

export default function TradeAnalyzerPage() {
  const params = useParams();
  const leagueId = params.leagueId as string;

  const [rosters, setRosters] = useState<Roster[]>([]);
  const [players, setPlayers] = useState<Map<string, Player[]>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Trade builder state
  const [team1, setTeam1] = useState<string>("");
  const [team2, setTeam2] = useState<string>("");
  const [team1Players, setTeam1Players] = useState<string[]>([]);
  const [team2Players, setTeam2Players] = useState<string[]>([]);
  const [team1Picks, setTeam1Picks] = useState<{ season: number; round: number }[]>([]);
  const [team2Picks, setTeam2Picks] = useState<{ season: number; round: number }[]>([]);

  // Analysis state
  const [analysis, setAnalysis] = useState<TradeAnalysisResult | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  useEffect(() => {
    fetchLeagueData();
  }, [leagueId]);

  const fetchLeagueData = async () => {
    try {
      const res = await fetch(`/api/leagues/${leagueId}`);
      if (!res.ok) throw new Error("Failed to fetch league");
      const data = await res.json();

      setRosters(data.rosters.map((r: { id: string; teamName: string | null; sleeperId: string }) => ({
        id: r.id,
        teamName: r.teamName,
        sleeperId: r.sleeperId,
      })));

      // Fetch players for each roster
      const playerMap = new Map<string, Player[]>();
      for (const roster of data.rosters) {
        const eligibleRes = await fetch(
          `/api/leagues/${leagueId}/rosters/${roster.id}/eligible-keepers`
        );
        if (eligibleRes.ok) {
          const eligibleData = await eligibleRes.json();
          playerMap.set(
            roster.id,
            eligibleData.players.map((p: { player: Player }) => ({
              ...p.player,
              age: p.player.age,
              injuryStatus: p.player.injuryStatus,
            }))
          );
        }
      }
      setPlayers(playerMap);
    } catch {
      setError("Failed to load league data");
    } finally {
      setLoading(false);
    }
  };

  const analyzeTrade = async () => {
    if (!team1 || !team2) return;

    setAnalyzing(true);
    try {
      const res = await fetch(`/api/leagues/${leagueId}/trade/calculate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          team1: {
            rosterId: team1,
            players: team1Players,
            picks: team1Picks,
          },
          team2: {
            rosterId: team2,
            players: team2Players,
            picks: team2Picks,
          },
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to analyze trade");
      }

      const data = await res.json();
      setAnalysis(data);
    } catch {
      setError("Failed to analyze trade");
    } finally {
      setAnalyzing(false);
    }
  };

  const togglePlayer = (
    playerId: string,
    team: "team1" | "team2"
  ) => {
    if (team === "team1") {
      setTeam1Players((prev) =>
        prev.includes(playerId)
          ? prev.filter((id) => id !== playerId)
          : [...prev, playerId]
      );
    } else {
      setTeam2Players((prev) =>
        prev.includes(playerId)
          ? prev.filter((id) => id !== playerId)
          : [...prev, playerId]
      );
    }
    setAnalysis(null);
  };

  const addPick = (team: "team1" | "team2", round: number) => {
    const currentYear = new Date().getFullYear();
    const pick = { season: currentYear + 1, round };

    if (team === "team1") {
      setTeam1Picks((prev) => [...prev, pick]);
    } else {
      setTeam2Picks((prev) => [...prev, pick]);
    }
    setAnalysis(null);
  };

  const removePick = (team: "team1" | "team2", index: number) => {
    if (team === "team1") {
      setTeam1Picks((prev) => prev.filter((_, i) => i !== index));
    } else {
      setTeam2Picks((prev) => prev.filter((_, i) => i !== index));
    }
    setAnalysis(null);
  };

  const clearTrade = () => {
    setTeam1("");
    setTeam2("");
    setTeam1Players([]);
    setTeam2Players([]);
    setTeam1Picks([]);
    setTeam2Picks([]);
    setAnalysis(null);
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto space-y-8">
        <div>
          <Skeleton className="h-4 w-24 mb-2" />
          <Skeleton className="h-10 w-64 mb-2" />
          <Skeleton className="h-5 w-48" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[1, 2].map((i) => (
            <div key={i} className="card-premium rounded-2xl p-6">
              <Skeleton className="h-6 w-24 mb-4" />
              <Skeleton className="h-12 w-full mb-4" />
              <Skeleton className="h-5 w-40 mb-3" />
              <div className="space-y-2">
                {[1, 2, 3, 4, 5].map((j) => (
                  <div key={j} className="flex items-center gap-3 p-3 bg-gray-800/30 rounded-xl">
                    <SkeletonAvatar size="sm" />
                    <Skeleton className="h-6 w-12" />
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-4 w-12" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-6">
          <p className="text-red-400 font-medium">{error}</p>
        </div>
      </div>
    );
  }

  const team1Roster = rosters.find((r) => r.id === team1);
  const team2Roster = rosters.find((r) => r.id === team2);
  const team1PlayerList = players.get(team1) || [];
  const team2PlayerList = players.get(team2) || [];

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link
            href={`/league/${leagueId}`}
            className="inline-flex items-center gap-2 text-gray-500 hover:text-amber-400 text-sm mb-4 transition-colors"
          >
            <span>&larr;</span>
            <span>Back to League</span>
          </Link>
          <h1 className="text-4xl font-extrabold text-white tracking-tight">Trade Analyzer</h1>
          <p className="text-gray-500 mt-2 text-lg">
            Comprehensive trade analysis with keeper value projections
          </p>
        </div>
        <button
          onClick={clearTrade}
          className="px-5 py-2.5 bg-gray-800/50 hover:bg-gray-700 border border-gray-700 rounded-xl text-sm text-white font-medium transition-all hover:scale-[1.02]"
        >
          Clear Trade
        </button>
      </div>

      {/* Trade Deadline Status */}
      {analysis && (
        <div className={`rounded-xl p-4 border ${
          analysis.isAfterDeadline
            ? "bg-amber-500/10 border-amber-500/30"
            : "bg-green-500/10 border-green-500/30"
        }`}>
          <div className="flex items-center gap-3">
            <span className={`text-xl ${analysis.isAfterDeadline ? "text-amber-400" : "text-green-400"}`}>
              {analysis.isAfterDeadline ? "!" : "+"}
            </span>
            <div>
              <p className={`font-semibold ${analysis.isAfterDeadline ? "text-amber-400" : "text-green-400"}`}>
                {analysis.isAfterDeadline ? "Offseason Trade" : "In-Season Trade"}
              </p>
              <p className="text-gray-400 text-sm">
                {analysis.isAfterDeadline
                  ? "Keeper values will reset to undrafted round, years kept resets to 0"
                  : "Keeper values and years kept will be preserved from source team"}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Team Selection */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Team 1 */}
        <div className="card-premium rounded-2xl p-6">
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <span className="w-1 h-5 bg-blue-500 rounded-full"></span>
            Team 1
          </h2>
          <select
            value={team1}
            onChange={(e) => {
              setTeam1(e.target.value);
              setTeam1Players([]);
              setTeam1Picks([]);
              setAnalysis(null);
            }}
            className="w-full px-4 py-3.5 bg-gray-800/50 border border-gray-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all font-medium mb-5"
          >
            <option value="">Select a team...</option>
            {rosters
              .filter((r) => r.id !== team2)
              .map((roster) => (
                <option key={roster.id} value={roster.id}>
                  {roster.teamName || `Team ${roster.sleeperId}`}
                </option>
              ))}
          </select>

          {team1 && (
            <>
              <h3 className="text-sm font-semibold text-gray-400 mb-3 uppercase tracking-wider">
                Players to trade away
              </h3>
              <div className="space-y-2 max-h-72 overflow-y-auto mb-5 pr-1">
                {team1PlayerList.map((player) => (
                  <label
                    key={player.id}
                    className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all ${
                      team1Players.includes(player.id)
                        ? "bg-amber-500/20 border-2 border-amber-500 shadow-lg shadow-amber-500/10"
                        : "bg-gray-800/30 border-2 border-transparent hover:bg-gray-800/50"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={team1Players.includes(player.id)}
                      onChange={() => togglePlayer(player.id, "team1")}
                      className="hidden"
                    />
                    <PlayerAvatar sleeperId={player.sleeperId} name={player.fullName} size="sm" />
                    <PositionBadge position={player.position} size="xs" />
                    <span className="text-white font-medium flex-1">{player.fullName}</span>
                    {player.injuryStatus && player.injuryStatus !== "Active" && (
                      <span className="text-red-400 text-xs font-medium px-2 py-0.5 bg-red-500/20 rounded">
                        {player.injuryStatus}
                      </span>
                    )}
                    <span className="text-gray-500 text-sm">{player.team}</span>
                  </label>
                ))}
              </div>

              <h3 className="text-sm font-semibold text-gray-400 mb-3 uppercase tracking-wider">
                Draft picks to include
              </h3>
              <div className="flex flex-wrap gap-2 mb-3">
                {team1Picks.map((pick, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-500/20 text-blue-400 rounded-lg text-sm font-medium"
                  >
                    {pick.season} Rd {pick.round}
                    <button
                      onClick={() => removePick("team1", index)}
                      className="hover:text-red-400 transition-colors"
                    >
                      &times;
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2 flex-wrap">
                {[1, 2, 3, 4, 5].map((round) => (
                  <button
                    key={round}
                    onClick={() => addPick("team1", round)}
                    className="px-4 py-2 bg-gray-800/50 hover:bg-gray-700 border border-gray-700 rounded-lg text-sm text-gray-300 font-medium transition-colors"
                  >
                    +Rd {round}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Team 2 */}
        <div className="card-premium rounded-2xl p-6">
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <span className="w-1 h-5 bg-green-500 rounded-full"></span>
            Team 2
          </h2>
          <select
            value={team2}
            onChange={(e) => {
              setTeam2(e.target.value);
              setTeam2Players([]);
              setTeam2Picks([]);
              setAnalysis(null);
            }}
            className="w-full px-4 py-3.5 bg-gray-800/50 border border-gray-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all font-medium mb-5"
          >
            <option value="">Select a team...</option>
            {rosters
              .filter((r) => r.id !== team1)
              .map((roster) => (
                <option key={roster.id} value={roster.id}>
                  {roster.teamName || `Team ${roster.sleeperId}`}
                </option>
              ))}
          </select>

          {team2 && (
            <>
              <h3 className="text-sm font-semibold text-gray-400 mb-3 uppercase tracking-wider">
                Players to trade away
              </h3>
              <div className="space-y-2 max-h-72 overflow-y-auto mb-5 pr-1">
                {team2PlayerList.map((player) => (
                  <label
                    key={player.id}
                    className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all ${
                      team2Players.includes(player.id)
                        ? "bg-amber-500/20 border-2 border-amber-500 shadow-lg shadow-amber-500/10"
                        : "bg-gray-800/30 border-2 border-transparent hover:bg-gray-800/50"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={team2Players.includes(player.id)}
                      onChange={() => togglePlayer(player.id, "team2")}
                      className="hidden"
                    />
                    <PlayerAvatar sleeperId={player.sleeperId} name={player.fullName} size="sm" />
                    <PositionBadge position={player.position} size="xs" />
                    <span className="text-white font-medium flex-1">{player.fullName}</span>
                    {player.injuryStatus && player.injuryStatus !== "Active" && (
                      <span className="text-red-400 text-xs font-medium px-2 py-0.5 bg-red-500/20 rounded">
                        {player.injuryStatus}
                      </span>
                    )}
                    <span className="text-gray-500 text-sm">{player.team}</span>
                  </label>
                ))}
              </div>

              <h3 className="text-sm font-semibold text-gray-400 mb-3 uppercase tracking-wider">
                Draft picks to include
              </h3>
              <div className="flex flex-wrap gap-2 mb-3">
                {team2Picks.map((pick, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-500/20 text-blue-400 rounded-lg text-sm font-medium"
                  >
                    {pick.season} Rd {pick.round}
                    <button
                      onClick={() => removePick("team2", index)}
                      className="hover:text-red-400 transition-colors"
                    >
                      &times;
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2 flex-wrap">
                {[1, 2, 3, 4, 5].map((round) => (
                  <button
                    key={round}
                    onClick={() => addPick("team2", round)}
                    className="px-4 py-2 bg-gray-800/50 hover:bg-gray-700 border border-gray-700 rounded-lg text-sm text-gray-300 font-medium transition-colors"
                  >
                    +Rd {round}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Analyze Button */}
      {team1 && team2 && (team1Players.length > 0 || team2Players.length > 0 || team1Picks.length > 0 || team2Picks.length > 0) && (
        <div className="flex justify-center">
          <button
            onClick={analyzeTrade}
            disabled={analyzing}
            className="px-10 py-4 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 disabled:opacity-50 rounded-xl text-white font-bold text-lg transition-all shadow-lg shadow-amber-500/30 hover:shadow-amber-500/40 hover:scale-[1.02]"
          >
            {analyzing ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Analyzing...
              </span>
            ) : (
              "Analyze Trade"
            )}
          </button>
        </div>
      )}

      {/* Comprehensive Analysis Results */}
      {analysis && analysis.success && (
        <>
          {/* Fairness Score */}
          <div className="card-premium rounded-2xl p-6">
            <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
              <span className="w-1 h-5 bg-amber-500 rounded-full"></span>
              Trade Value Overview
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="text-center p-6 rounded-xl bg-blue-500/10 border border-blue-500/20">
                <p className="text-gray-400 text-sm mb-2 font-medium">
                  {analysis.team1.rosterName} Net Value
                </p>
                <p className={`text-4xl font-extrabold ${analysis.team1.netValue >= 0 ? "text-green-400" : "text-red-400"}`}>
                  {analysis.team1.netValue >= 0 ? "+" : ""}{analysis.team1.netValue}
                </p>
              </div>
              <div className="text-center p-6 rounded-xl bg-gradient-to-br from-gray-800/50 to-gray-900/50 border border-gray-700">
                <p className="text-gray-400 text-sm mb-2 font-medium">Fairness Score</p>
                <p
                  className={`text-4xl font-extrabold ${
                    analysis.summary.fairnessScore >= 40
                      ? "text-green-400"
                      : analysis.summary.fairnessScore >= 30
                      ? "text-amber-400"
                      : "text-red-400"
                  }`}
                >
                  {analysis.summary.fairnessScore}%
                </p>
              </div>
              <div className="text-center p-6 rounded-xl bg-green-500/10 border border-green-500/20">
                <p className="text-gray-400 text-sm mb-2 font-medium">
                  {analysis.team2.rosterName} Net Value
                </p>
                <p className={`text-4xl font-extrabold ${analysis.team2.netValue >= 0 ? "text-green-400" : "text-red-400"}`}>
                  {analysis.team2.netValue >= 0 ? "+" : ""}{analysis.team2.netValue}
                </p>
              </div>
            </div>

            {/* Fairness Bar */}
            <div>
              <div className="h-4 bg-gray-700 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 ${
                    analysis.summary.fairnessScore >= 40
                      ? "bg-gradient-to-r from-green-500 to-green-400"
                      : analysis.summary.fairnessScore >= 30
                      ? "bg-gradient-to-r from-amber-500 to-amber-400"
                      : "bg-gradient-to-r from-red-500 to-red-400"
                  }`}
                  style={{ width: `${Math.min(100, analysis.summary.fairnessScore * 2)}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-gray-500 mt-2 font-medium">
                <span>Unbalanced</span>
                <span>Fair</span>
              </div>
            </div>
          </div>

          {/* Player Value Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Team 1 Players */}
            <div className="card-premium rounded-2xl p-6">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-400"></span>
                {analysis.team1.rosterName} Trading Away
              </h3>
              <div className="space-y-4">
                {analysis.team1.tradingAway.map((player) => (
                  <PlayerValueCard key={player.playerId} player={player} isAfterDeadline={analysis.isAfterDeadline} />
                ))}
                {analysis.team1.tradingAway.length === 0 && (
                  <p className="text-gray-500 text-sm">No players being traded</p>
                )}
              </div>
            </div>

            {/* Team 2 Players */}
            <div className="card-premium rounded-2xl p-6">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-400"></span>
                {analysis.team2.rosterName} Trading Away
              </h3>
              <div className="space-y-4">
                {analysis.team2.tradingAway.map((player) => (
                  <PlayerValueCard key={player.playerId} player={player} isAfterDeadline={analysis.isAfterDeadline} />
                ))}
                {analysis.team2.tradingAway.length === 0 && (
                  <p className="text-gray-500 text-sm">No players being traded</p>
                )}
              </div>
            </div>
          </div>

          {/* Team Summary Panels */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <TeamSummaryPanel team={analysis.team1} color="blue" />
            <TeamSummaryPanel team={analysis.team2} color="green" />
          </div>

          {/* Trade Facts */}
          <div className="card-premium rounded-2xl p-6">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <span className="w-1 h-5 bg-gray-500 rounded-full"></span>
              Trade Facts
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {analysis.summary.facts.map((fact, index) => (
                <div
                  key={index}
                  className={`p-4 rounded-xl border ${
                    fact.category === "keeper"
                      ? "bg-amber-500/10 border-amber-500/20"
                      : fact.category === "roster"
                      ? "bg-blue-500/10 border-blue-500/20"
                      : fact.category === "draft"
                      ? "bg-green-500/10 border-green-500/20"
                      : "bg-gray-800/50 border-gray-700"
                  }`}
                >
                  <span className="text-xs uppercase tracking-wider text-gray-500 block mb-1">
                    {fact.category}
                  </span>
                  <p className="text-white text-sm">{fact.description}</p>
                </div>
              ))}
              {analysis.summary.facts.length === 0 && (
                <p className="text-gray-500 col-span-2">No significant facts to display</p>
              )}
            </div>
          </div>
        </>
      )}

      {/* Trade Summary (always visible when players selected) */}
      {(team1Players.length > 0 || team2Players.length > 0 || team1Picks.length > 0 || team2Picks.length > 0) && (
        <div className="card-premium rounded-2xl p-6">
          <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
            <span className="w-1 h-5 bg-amber-500 rounded-full"></span>
            Trade Summary
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <h3 className="text-sm font-semibold text-blue-400 mb-4 uppercase tracking-wider flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-400"></span>
                {team1Roster?.teamName || "Team 1"} sends
              </h3>
              <ul className="space-y-2">
                {team1PlayerList
                  .filter((p) => team1Players.includes(p.id))
                  .map((player) => (
                    <li key={player.id} className="flex items-center gap-3 text-white p-3 rounded-lg bg-gray-800/30">
                      <PositionBadge position={player.position} size="xs" />
                      <span className="font-medium">{player.fullName}</span>
                    </li>
                  ))}
                {team1Picks.map((pick, i) => (
                  <li key={i} className="text-blue-400 p-3 rounded-lg bg-blue-500/10 font-medium">
                    {pick.season} Round {pick.round} pick
                  </li>
                ))}
                {team1Players.length === 0 && team1Picks.length === 0 && (
                  <li className="text-gray-500 p-3">Nothing selected</li>
                )}
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-green-400 mb-4 uppercase tracking-wider flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-400"></span>
                {team2Roster?.teamName || "Team 2"} sends
              </h3>
              <ul className="space-y-2">
                {team2PlayerList
                  .filter((p) => team2Players.includes(p.id))
                  .map((player) => (
                    <li key={player.id} className="flex items-center gap-3 text-white p-3 rounded-lg bg-gray-800/30">
                      <PositionBadge position={player.position} size="xs" />
                      <span className="font-medium">{player.fullName}</span>
                    </li>
                  ))}
                {team2Picks.map((pick, i) => (
                  <li key={i} className="text-blue-400 p-3 rounded-lg bg-blue-500/10 font-medium">
                    {pick.season} Round {pick.round} pick
                  </li>
                ))}
                {team2Players.length === 0 && team2Picks.length === 0 && (
                  <li className="text-gray-500 p-3">Nothing selected</li>
                )}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Player Value Card Component
function PlayerValueCard({ player, isAfterDeadline }: { player: PlayerTradeValue; isAfterDeadline: boolean }) {
  return (
    <div className="p-4 rounded-xl bg-gray-800/30 border border-gray-700">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <PlayerAvatar sleeperId={player.sleeperId} name={player.playerName} size="sm" />
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-white font-semibold">{player.playerName}</span>
            <PositionBadge position={player.position} size="xs" />
            {player.injuryStatus && player.injuryStatus !== "Active" && (
              <span className="text-red-400 text-xs font-medium px-2 py-0.5 bg-red-500/20 rounded">
                {player.injuryStatus}
              </span>
            )}
          </div>
          <div className="text-gray-500 text-sm">
            {player.team || "FA"} {player.age && `| Age ${player.age}`}
          </div>
        </div>
        <div className="text-right">
          <div className="text-amber-400 font-bold text-lg">{player.tradeValue} pts</div>
          <div className="text-gray-500 text-xs">Trade Value</div>
        </div>
      </div>

      {/* Keeper Cost Comparison */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="p-3 rounded-lg bg-gray-900/50">
          <div className="text-gray-500 text-xs uppercase tracking-wider mb-1">Current Cost</div>
          <div className="text-white font-semibold">
            {player.keeperStatus.currentCost ? `R${player.keeperStatus.currentCost}` : "N/A"}
          </div>
          <div className="text-gray-500 text-xs">
            {player.keeperStatus.yearsKept} yr{player.keeperStatus.yearsKept !== 1 ? "s" : ""} kept
          </div>
        </div>
        <div className="p-3 rounded-lg bg-gray-900/50">
          <div className="text-gray-500 text-xs uppercase tracking-wider mb-1">After Trade</div>
          <div className={`font-semibold ${
            player.projection.costChange > 0 ? "text-red-400" :
            player.projection.costChange < 0 ? "text-green-400" : "text-white"
          }`}>
            R{player.projection.newCost}
          </div>
          <div className="text-gray-500 text-xs">
            {player.projection.yearsKeptReset ? "0 yrs (reset)" : `${player.keeperStatus.yearsKept} yrs`}
          </div>
        </div>
      </div>

      {/* Cost Change Indicator */}
      {player.projection.costChange !== 0 && (
        <div className={`p-2 rounded-lg text-sm ${
          player.projection.costChange > 0
            ? "bg-red-500/10 text-red-400"
            : "bg-green-500/10 text-green-400"
        }`}>
          Cost {player.projection.costChange > 0 ? "increases" : "improves"} by {Math.abs(player.projection.costChange)} round{Math.abs(player.projection.costChange) !== 1 ? "s" : ""}
          {isAfterDeadline && " (offseason trade reset)"}
        </div>
      )}

      {/* Cost Trajectory */}
      {player.projection.costTrajectory.length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-700">
          <div className="text-gray-500 text-xs uppercase tracking-wider mb-2">
            Cost Trajectory (max {player.keeperStatus.maxYearsAllowed} yrs)
          </div>
          <div className="flex gap-2 flex-wrap">
            {player.projection.costTrajectory.map((yr) => (
              <span
                key={yr.year}
                className={`px-2 py-1 rounded text-xs font-medium ${
                  yr.isFinalYear
                    ? "bg-red-500/20 text-red-400"
                    : "bg-gray-700 text-gray-300"
                }`}
              >
                Yr{yr.year}: R{yr.cost}{yr.isFinalYear ? " (FINAL)" : ""}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Value Breakdown */}
      <div className="mt-3 pt-3 border-t border-gray-700">
        <div className="text-gray-500 text-xs uppercase tracking-wider mb-2">Value Breakdown</div>
        <div className="flex gap-4 text-xs">
          <span className="text-gray-400">
            Base: <span className="text-white">{player.valueBreakdown.basePositionValue}</span>
          </span>
          <span className="text-gray-400">
            Age: <span className="text-white">+{player.valueBreakdown.ageModifier}</span>
          </span>
          <span className="text-gray-400">
            Keeper: <span className="text-white">+{player.valueBreakdown.keeperValueBonus}</span>
          </span>
        </div>
      </div>
    </div>
  );
}

// Team Summary Panel Component
function TeamSummaryPanel({ team, color }: { team: TeamTradeAnalysis; color: "blue" | "green" }) {
  const colorClasses = color === "blue"
    ? "border-blue-500/20 bg-blue-500/5"
    : "border-green-500/20 bg-green-500/5";
  const headerColor = color === "blue" ? "text-blue-400" : "text-green-400";

  return (
    <div className={`card-premium rounded-2xl p-6 border ${colorClasses}`}>
      <h3 className={`text-lg font-bold mb-4 ${headerColor}`}>
        {team.rosterName} Impact
      </h3>

      {/* Position Changes */}
      {team.positionChanges.length > 0 && (
        <div className="mb-4">
          <div className="text-gray-500 text-xs uppercase tracking-wider mb-2">Roster Changes</div>
          <div className="space-y-1">
            {team.positionChanges.map((change) => (
              <div key={change.position} className="flex justify-between text-sm">
                <span className="text-gray-400">{change.position}</span>
                <span className={change.change > 0 ? "text-green-400" : "text-red-400"}>
                  {change.before} &rarr; {change.after} ({change.change > 0 ? "+" : ""}{change.change})
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Keeper Slots */}
      <div className="mb-4">
        <div className="text-gray-500 text-xs uppercase tracking-wider mb-2">Keeper Slots</div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-400">Before</span>
          <span className="text-white">{team.keeperSlotsBefore}/{team.keeperSlotsMax}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-400">After</span>
          <span className="text-white">{team.keeperSlotsAfter}/{team.keeperSlotsMax}</span>
        </div>
        {team.keeperSlotsBefore !== team.keeperSlotsAfter && (
          <div className={`mt-1 text-sm ${team.keeperSlotsAfter < team.keeperSlotsBefore ? "text-green-400" : "text-amber-400"}`}>
            {team.keeperSlotsAfter < team.keeperSlotsBefore
              ? `+${team.keeperSlotsBefore - team.keeperSlotsAfter} slot${team.keeperSlotsBefore - team.keeperSlotsAfter > 1 ? "s" : ""} freed`
              : `${team.keeperSlotsAfter - team.keeperSlotsBefore} slot${team.keeperSlotsAfter - team.keeperSlotsBefore > 1 ? "s" : ""} used`
            }
          </div>
        )}
      </div>

      {/* Draft Capital */}
      {(team.picksGiven.length > 0 || team.picksReceived.length > 0) && (
        <div className="mb-4">
          <div className="text-gray-500 text-xs uppercase tracking-wider mb-2">Draft Capital</div>
          {team.picksGiven.length > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Given</span>
              <span className="text-red-400">
                {team.picksGiven.map(p => `R${p.round}`).join(", ")} ({team.picksGiven.reduce((s, p) => s + p.value, 0)} pts)
              </span>
            </div>
          )}
          {team.picksReceived.length > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Received</span>
              <span className="text-green-400">
                {team.picksReceived.map(p => `R${p.round}`).join(", ")} ({team.picksReceived.reduce((s, p) => s + p.value, 0)} pts)
              </span>
            </div>
          )}
          <div className="flex justify-between text-sm mt-1 pt-1 border-t border-gray-700">
            <span className="text-gray-400">Net</span>
            <span className={team.draftCapitalChange >= 0 ? "text-green-400" : "text-red-400"}>
              {team.draftCapitalChange >= 0 ? "+" : ""}{team.draftCapitalChange} pts
            </span>
          </div>
        </div>
      )}

      {/* Value Summary */}
      <div className="pt-4 border-t border-gray-700">
        <div className="text-gray-500 text-xs uppercase tracking-wider mb-2">Value Summary</div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-400">Given</span>
          <span className="text-white">{team.totalValueGiven} pts</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-400">Received</span>
          <span className="text-white">{team.totalValueReceived} pts</span>
        </div>
        <div className="flex justify-between text-sm mt-2 pt-2 border-t border-gray-700 font-semibold">
          <span className="text-gray-400">Net Value</span>
          <span className={team.netValue >= 0 ? "text-green-400" : "text-red-400"}>
            {team.netValue >= 0 ? "+" : ""}{team.netValue} pts
          </span>
        </div>
      </div>
    </div>
  );
}
