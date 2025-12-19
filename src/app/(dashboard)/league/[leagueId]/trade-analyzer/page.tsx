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
}

interface Roster {
  id: string;
  teamName: string | null;
  sleeperId: string;
}

interface TradePlayer {
  player: Player;
  fromRoster: Roster;
  toRoster: Roster;
  keeperCost: number | null;
  yearsKept: number;
}

interface TradePick {
  season: number;
  round: number;
  fromRoster: Roster;
  toRoster: Roster;
}

interface TradeAnalysis {
  team1Value: number;
  team2Value: number;
  fairnessScore: number;
  keeperImplications: string[];
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
  const [analysis, setAnalysis] = useState<TradeAnalysis | null>(null);
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
            eligibleData.players.map((p: { player: Player }) => p.player)
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
      // Simple value calculation based on position and draft cost
      const positionValues: Record<string, number> = {
        QB: 25,
        RB: 30,
        WR: 28,
        TE: 20,
        K: 5,
        DEF: 8,
      };

      const team1Roster = rosters.find((r) => r.id === team1);
      const team2Roster = rosters.find((r) => r.id === team2);

      const team1PlayerList = players.get(team1) || [];
      const team2PlayerList = players.get(team2) || [];

      // Calculate team 1's outgoing value
      let team1Value = 0;
      const team1SelectedPlayers = team1PlayerList.filter((p) =>
        team1Players.includes(p.id)
      );
      for (const player of team1SelectedPlayers) {
        team1Value += positionValues[player.position || ""] || 10;
      }
      // Add pick values (earlier rounds = more value)
      for (const pick of team1Picks) {
        team1Value += Math.max(1, 17 - pick.round) * 2;
      }

      // Calculate team 2's outgoing value
      let team2Value = 0;
      const team2SelectedPlayers = team2PlayerList.filter((p) =>
        team2Players.includes(p.id)
      );
      for (const player of team2SelectedPlayers) {
        team2Value += positionValues[player.position || ""] || 10;
      }
      for (const pick of team2Picks) {
        team2Value += Math.max(1, 17 - pick.round) * 2;
      }

      // Calculate fairness (100 = perfectly fair)
      const totalValue = team1Value + team2Value;
      const fairnessScore =
        totalValue > 0
          ? 100 - Math.abs(((team1Value - team2Value) / totalValue) * 100)
          : 100;

      // Generate keeper implications
      const implications: string[] = [];

      for (const player of team1SelectedPlayers) {
        implications.push(
          `${player.fullName} moves to ${team2Roster?.teamName || "Team 2"} - keeper cost will be recalculated based on original acquisition`
        );
      }

      for (const player of team2SelectedPlayers) {
        implications.push(
          `${player.fullName} moves to ${team1Roster?.teamName || "Team 1"} - keeper cost will be recalculated based on original acquisition`
        );
      }

      if (team1Picks.length > 0) {
        implications.push(
          `${team1Roster?.teamName || "Team 1"} gives up ${team1Picks.length} draft pick(s)`
        );
      }

      if (team2Picks.length > 0) {
        implications.push(
          `${team2Roster?.teamName || "Team 2"} gives up ${team2Picks.length} draft pick(s)`
        );
      }

      setAnalysis({
        team1Value,
        team2Value,
        fairnessScore: Math.round(fairnessScore),
        keeperImplications: implications,
      });
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
      <div className="p-6 space-y-6">
        <div>
          <Skeleton className="h-4 w-24 mb-2" />
          <Skeleton className="h-8 w-48 mb-1" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[1, 2].map((i) => (
            <div key={i} className="bg-gray-800/50 rounded-xl p-6 border border-gray-700">
              <Skeleton className="h-6 w-24 mb-4" />
              <Skeleton className="h-10 w-full mb-4" />
              <Skeleton className="h-4 w-40 mb-2" />
              <div className="space-y-2">
                {[1, 2, 3, 4, 5].map((j) => (
                  <div key={j} className="flex items-center gap-3 p-2 bg-gray-700/30 rounded">
                    <SkeletonAvatar size="sm" />
                    <Skeleton className="h-5 w-10" />
                    <Skeleton className="h-4 w-32" />
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
      <div className="p-6">
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
          <p className="text-red-400">{error}</p>
        </div>
      </div>
    );
  }

  const team1Roster = rosters.find((r) => r.id === team1);
  const team2Roster = rosters.find((r) => r.id === team2);
  const team1PlayerList = players.get(team1) || [];
  const team2PlayerList = players.get(team2) || [];

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
          <h1 className="text-2xl font-bold text-white">Trade Analyzer</h1>
          <p className="text-gray-400 mt-1">
            Analyze potential trades and keeper implications
          </p>
        </div>
        <button
          onClick={clearTrade}
          className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm text-white transition-colors"
        >
          Clear Trade
        </button>
      </div>

      {/* Team Selection */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Team 1 */}
        <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700">
          <h2 className="text-lg font-semibold text-white mb-4">Team 1</h2>
          <select
            value={team1}
            onChange={(e) => {
              setTeam1(e.target.value);
              setTeam1Players([]);
              setTeam1Picks([]);
              setAnalysis(null);
            }}
            className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white mb-4"
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
              <h3 className="text-sm font-medium text-gray-400 mb-2">
                Players to trade away:
              </h3>
              <div className="space-y-2 max-h-60 overflow-y-auto mb-4">
                {team1PlayerList.map((player) => (
                  <label
                    key={player.id}
                    className={`flex items-center gap-3 p-2 rounded cursor-pointer transition-colors ${
                      team1Players.includes(player.id)
                        ? "bg-purple-500/20 border border-purple-500"
                        : "bg-gray-700/30 hover:bg-gray-700/50"
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
                    <span className="text-white">{player.fullName}</span>
                    <span className="text-gray-500 text-sm">{player.team}</span>
                  </label>
                ))}
              </div>

              <h3 className="text-sm font-medium text-gray-400 mb-2">
                Draft picks to include:
              </h3>
              <div className="flex flex-wrap gap-2 mb-2">
                {team1Picks.map((pick, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center gap-1 px-2 py-1 bg-blue-500/20 text-blue-400 rounded text-sm"
                  >
                    {pick.season} Rd {pick.round}
                    <button
                      onClick={() => removePick("team1", index)}
                      className="ml-1 hover:text-red-400"
                    >
                      &times;
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((round) => (
                  <button
                    key={round}
                    onClick={() => addPick("team1", round)}
                    className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm text-gray-300"
                  >
                    +Rd {round}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Team 2 */}
        <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700">
          <h2 className="text-lg font-semibold text-white mb-4">Team 2</h2>
          <select
            value={team2}
            onChange={(e) => {
              setTeam2(e.target.value);
              setTeam2Players([]);
              setTeam2Picks([]);
              setAnalysis(null);
            }}
            className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white mb-4"
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
              <h3 className="text-sm font-medium text-gray-400 mb-2">
                Players to trade away:
              </h3>
              <div className="space-y-2 max-h-60 overflow-y-auto mb-4">
                {team2PlayerList.map((player) => (
                  <label
                    key={player.id}
                    className={`flex items-center gap-3 p-2 rounded cursor-pointer transition-colors ${
                      team2Players.includes(player.id)
                        ? "bg-purple-500/20 border border-purple-500"
                        : "bg-gray-700/30 hover:bg-gray-700/50"
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
                    <span className="text-white">{player.fullName}</span>
                    <span className="text-gray-500 text-sm">{player.team}</span>
                  </label>
                ))}
              </div>

              <h3 className="text-sm font-medium text-gray-400 mb-2">
                Draft picks to include:
              </h3>
              <div className="flex flex-wrap gap-2 mb-2">
                {team2Picks.map((pick, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center gap-1 px-2 py-1 bg-blue-500/20 text-blue-400 rounded text-sm"
                  >
                    {pick.season} Rd {pick.round}
                    <button
                      onClick={() => removePick("team2", index)}
                      className="ml-1 hover:text-red-400"
                    >
                      &times;
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((round) => (
                  <button
                    key={round}
                    onClick={() => addPick("team2", round)}
                    className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm text-gray-300"
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
            className="px-8 py-3 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 rounded-lg text-white font-medium transition-colors"
          >
            {analyzing ? "Analyzing..." : "Analyze Trade"}
          </button>
        </div>
      )}

      {/* Analysis Results */}
      {analysis && (
        <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700">
          <h2 className="text-lg font-semibold text-white mb-4">
            Trade Analysis
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div className="text-center">
              <p className="text-gray-400 text-sm mb-1">
                {team1Roster?.teamName || "Team 1"} Value
              </p>
              <p className="text-2xl font-bold text-white">{analysis.team1Value}</p>
            </div>
            <div className="text-center">
              <p className="text-gray-400 text-sm mb-1">Fairness Score</p>
              <p
                className={`text-2xl font-bold ${
                  analysis.fairnessScore >= 80
                    ? "text-green-400"
                    : analysis.fairnessScore >= 60
                    ? "text-yellow-400"
                    : "text-red-400"
                }`}
              >
                {analysis.fairnessScore}%
              </p>
            </div>
            <div className="text-center">
              <p className="text-gray-400 text-sm mb-1">
                {team2Roster?.teamName || "Team 2"} Value
              </p>
              <p className="text-2xl font-bold text-white">{analysis.team2Value}</p>
            </div>
          </div>

          {/* Fairness Bar */}
          <div className="mb-6">
            <div className="h-4 bg-gray-700 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all ${
                  analysis.fairnessScore >= 80
                    ? "bg-green-500"
                    : analysis.fairnessScore >= 60
                    ? "bg-yellow-500"
                    : "bg-red-500"
                }`}
                style={{ width: `${analysis.fairnessScore}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>Unfair</span>
              <span>Fair</span>
            </div>
          </div>

          {/* Keeper Implications */}
          {analysis.keeperImplications.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-400 mb-2">
                Keeper Implications
              </h3>
              <ul className="space-y-2">
                {analysis.keeperImplications.map((implication, index) => (
                  <li
                    key={index}
                    className="flex items-start gap-2 text-gray-300 text-sm"
                  >
                    <span className="text-purple-400">•</span>
                    {implication}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Trade Summary */}
      {(team1Players.length > 0 || team2Players.length > 0 || team1Picks.length > 0 || team2Picks.length > 0) && (
        <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700">
          <h2 className="text-lg font-semibold text-white mb-4">Trade Summary</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-sm font-medium text-gray-400 mb-2">
                {team1Roster?.teamName || "Team 1"} sends:
              </h3>
              <ul className="space-y-1">
                {team1PlayerList
                  .filter((p) => team1Players.includes(p.id))
                  .map((player) => (
                    <li key={player.id} className="text-white text-sm">
                      {player.fullName} ({player.position})
                    </li>
                  ))}
                {team1Picks.map((pick, i) => (
                  <li key={i} className="text-blue-400 text-sm">
                    {pick.season} Round {pick.round} pick
                  </li>
                ))}
                {team1Players.length === 0 && team1Picks.length === 0 && (
                  <li className="text-gray-500 text-sm">Nothing selected</li>
                )}
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-400 mb-2">
                {team2Roster?.teamName || "Team 2"} sends:
              </h3>
              <ul className="space-y-1">
                {team2PlayerList
                  .filter((p) => team2Players.includes(p.id))
                  .map((player) => (
                    <li key={player.id} className="text-white text-sm">
                      {player.fullName} ({player.position})
                    </li>
                  ))}
                {team2Picks.map((pick, i) => (
                  <li key={i} className="text-blue-400 text-sm">
                    {pick.season} Round {pick.round} pick
                  </li>
                ))}
                {team2Players.length === 0 && team2Picks.length === 0 && (
                  <li className="text-gray-500 text-sm">Nothing selected</li>
                )}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
