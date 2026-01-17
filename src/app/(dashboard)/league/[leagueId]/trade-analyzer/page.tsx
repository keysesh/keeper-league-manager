"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { PositionBadge } from "@/components/ui/PositionBadge";
import { PlayerAvatar } from "@/components/players/PlayerAvatar";
import { Skeleton, SkeletonAvatar } from "@/components/ui/Skeleton";
import { BackLink } from "@/components/ui/BackLink";
import { Share2, Save, FileText, Check, Copy, X, ArrowLeftRight } from "lucide-react";

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

interface DraftPickOwnership {
  season: number;
  round: number;
  originalOwnerSleeperId: string;
  currentOwnerSleeperId: string;
  originalOwnerName?: string;
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
  const [draftPicks, setDraftPicks] = useState<DraftPickOwnership[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const planningSeason = new Date().getFullYear() + (new Date().getMonth() >= 8 ? 1 : 0); // 2026 if Sept-Dec

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

  // Save/Share state
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [proposalTitle, setProposalTitle] = useState("");
  const [proposalNotes, setProposalNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedProposal, setSavedProposal] = useState<{ id: string; shareUrl: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const fetchLeagueData = useCallback(async () => {
    try {
      // Fetch rosters with players AND draft picks in parallel (just 2 API calls)
      const [rostersRes, picksRes] = await Promise.all([
        fetch(`/api/leagues/${leagueId}/rosters?includePlayers=true`),
        fetch(`/api/leagues/${leagueId}/draft-picks`),
      ]);

      if (!rostersRes.ok) throw new Error("Failed to fetch rosters");

      const rostersData = await rostersRes.json();
      const picksData = picksRes.ok ? await picksRes.json() : { picks: [] };

      // Build roster list
      const rosterList = rostersData.rosters.map((r: { id: string; teamName: string | null; sleeperId: string }) => ({
        id: r.id,
        teamName: r.teamName,
        sleeperId: r.sleeperId,
      }));
      setRosters(rosterList);

      // Build player map from the rosters response
      const playerMap = new Map<string, Player[]>();
      for (const roster of rostersData.rosters) {
        const players = (roster.players || []).map((p: { id: string; sleeperId: string; fullName: string; position: string | null; team: string | null }) => ({
          id: p.id,
          sleeperId: p.sleeperId,
          fullName: p.fullName,
          position: p.position,
          team: p.team,
          age: null, // Not needed for selection
          injuryStatus: null,
        }));
        playerMap.set(roster.id, players);
      }
      setPlayers(playerMap);
      setDraftPicks(picksData.picks || []);
    } catch {
      setError("Failed to load league data");
    } finally {
      setLoading(false);
    }
  }, [leagueId]);

  useEffect(() => {
    fetchLeagueData();
  }, [fetchLeagueData]);

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
    setSavedProposal(null);
  };

  const saveProposal = async () => {
    if (!team1 || !team2 || !proposalTitle.trim()) return;

    setSaving(true);
    try {
      const res = await fetch(`/api/leagues/${leagueId}/trade-proposals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: proposalTitle,
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
          analysis: analysis ? {
            fairnessScore: analysis.summary.fairnessScore,
            team1NetValue: analysis.team1.netValue,
            team2NetValue: analysis.team2.netValue,
          } : undefined,
          notes: proposalNotes,
        }),
      });

      if (!res.ok) throw new Error("Failed to save");

      const data = await res.json();
      setSavedProposal({ id: data.proposal.id, shareUrl: data.shareUrl });
      setShowSaveModal(false);
    } catch {
      setError("Failed to save proposal");
    } finally {
      setSaving(false);
    }
  };

  const copyShareLink = () => {
    if (!savedProposal) return;
    const fullUrl = `${window.location.origin}${savedProposal.shareUrl}`;
    navigator.clipboard.writeText(fullUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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

  // Calculate draft picks owned by each team
  const getTeamPicks = (sleeperId: string | undefined) => {
    if (!sleeperId) return [];
    return draftPicks
      .filter((p: DraftPickOwnership & { currentOwnerSleeperId?: string }) =>
        p.currentOwnerSleeperId === sleeperId
      )
      .sort((a, b) => a.round - b.round)
      .map(p => ({
        season: p.season || planningSeason,
        round: p.round,
        originalOwner: p.originalOwnerName || (p.originalOwnerSleeperId !== sleeperId ? 'Traded' : 'Own'),
        isOwn: p.originalOwnerSleeperId === sleeperId,
      }));
  };

  const team1OwnedPicks = getTeamPicks(team1Roster?.sleeperId);
  const team2OwnedPicks = getTeamPicks(team2Roster?.sleeperId);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Premium Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 border border-gray-700/50 p-6">
        <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 via-transparent to-emerald-500/5" />
        <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />

        <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <BackLink href={`/league/${leagueId}`} label="Back to League" />
            <div className="flex items-center gap-4 mt-2">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/25">
                <ArrowLeftRight className="w-7 h-7 text-white" />
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">Trade Analyzer</h1>
                <p className="text-gray-400 mt-0.5 text-sm">
                  {planningSeason} Draft &bull; Keeper value projections
                </p>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Link
              href={`/league/${leagueId}/trade-proposals`}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm text-white font-medium transition-all backdrop-blur-sm"
            >
              <FileText className="w-4 h-4" />
              Saved
            </Link>
            <button
              onClick={clearTrade}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-xl text-sm text-red-400 font-medium transition-all"
            >
              <X className="w-4 h-4" />
              Clear
            </button>
          </div>
        </div>
      </div>

      {/* Offseason Banner - Always show since we're past trade deadline */}
      <div className="rounded-xl p-4 border bg-amber-500/10 border-amber-500/30">
        <div className="flex items-center gap-3">
          <span className="text-2xl">⚠️</span>
          <div>
            <p className="font-semibold text-amber-400">
              Offseason Period - Years Kept Will Reset
            </p>
            <p className="text-gray-400 text-sm">
              Any trade now until draft day will reset years kept to 0 for traded players. Draft round is always preserved.
            </p>
          </div>
        </div>
      </div>

      {/* Team Selection */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Team 1 */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-b from-gray-800/80 to-gray-900/80 border border-blue-500/20 backdrop-blur-sm">
          {/* Team header */}
          <div className="bg-gradient-to-r from-blue-500/10 to-transparent border-b border-blue-500/20 px-5 py-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                  <span className="text-blue-400 font-bold text-sm">1</span>
                </div>
                {team1Roster?.teamName || "Select Team"}
              </h2>
              {team1Players.length > 0 && (
                <span className="px-2.5 py-1 bg-amber-500/20 text-amber-400 rounded-lg text-xs font-semibold">
                  {team1Players.length} player{team1Players.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>
          </div>

          <div className="p-5 space-y-4">
            <select
              value={team1}
              onChange={(e) => {
                setTeam1(e.target.value);
                setTeam1Players([]);
                setTeam1Picks([]);
                setAnalysis(null);
              }}
              className="w-full px-4 py-3 bg-gray-900/50 border border-gray-700/50 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all font-medium"
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
                <div>
                  <h3 className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wider flex items-center gap-2">
                    <span className="w-1 h-1 bg-blue-400 rounded-full"></span>
                    Players
                  </h3>
                  <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1 scrollbar-thin">
                    {team1PlayerList.map((player) => (
                      <label
                        key={player.id}
                        className={`flex items-center gap-2.5 p-2.5 rounded-xl cursor-pointer transition-all ${
                          team1Players.includes(player.id)
                            ? "bg-gradient-to-r from-amber-500/20 to-orange-500/10 border border-amber-500/50 shadow-lg shadow-amber-500/10"
                            : "bg-gray-800/30 border border-transparent hover:bg-gray-800/50 hover:border-gray-700/50"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={team1Players.includes(player.id)}
                          onChange={() => togglePlayer(player.id, "team1")}
                          className="hidden"
                        />
                        <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                          team1Players.includes(player.id)
                            ? 'bg-amber-500 border-amber-500'
                            : 'border-gray-600 bg-gray-800/50'
                        }`}>
                          {team1Players.includes(player.id) && (
                            <Check className="w-3 h-3 text-white" />
                          )}
                        </div>
                        <PlayerAvatar sleeperId={player.sleeperId} name={player.fullName} size="sm" />
                        <PositionBadge position={player.position} size="xs" />
                        <span className="text-white font-medium flex-1 text-sm truncate">{player.fullName}</span>
                        {player.injuryStatus && player.injuryStatus !== "Active" && (
                          <span className="text-red-400 text-[10px] font-bold px-1.5 py-0.5 bg-red-500/20 rounded">
                            {player.injuryStatus.slice(0, 3).toUpperCase()}
                          </span>
                        )}
                        <span className="text-gray-500 text-xs font-medium">{player.team || 'FA'}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wider flex items-center gap-2">
                    <span className="w-1 h-1 bg-blue-400 rounded-full"></span>
                    {planningSeason} Draft Picks
                  </h3>
                  {/* Selected picks */}
                  {team1Picks.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {team1Picks.map((pick, index) => (
                        <span
                          key={index}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-gradient-to-r from-amber-500/20 to-orange-500/10 text-amber-400 rounded-lg text-xs font-semibold border border-amber-500/30"
                        >
                          Round {pick.round}
                          <button
                            onClick={() => removePick("team1", index)}
                            className="hover:text-red-400 transition-colors ml-0.5"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                  {/* Available picks this team owns */}
                  <div className="flex gap-1.5 flex-wrap">
                    {team1OwnedPicks.length > 0 ? (
                      team1OwnedPicks
                        .filter(p => !team1Picks.some(tp => tp.round === p.round))
                        .map((pick) => (
                          <button
                            key={`${pick.season}-${pick.round}`}
                            onClick={() => addPick("team1", pick.round)}
                            className={`px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                              pick.isOwn
                                ? "bg-gray-800/50 hover:bg-gray-700 border border-gray-700/50 text-gray-300 hover:text-white"
                                : "bg-gradient-to-r from-emerald-500/10 to-teal-500/10 hover:from-emerald-500/20 hover:to-teal-500/20 border border-emerald-500/30 text-emerald-400"
                            }`}
                            title={pick.isOwn ? "Own pick" : `Acquired from ${pick.originalOwner}`}
                          >
                            <span>Rd {pick.round}</span>
                            {!pick.isOwn && (
                              <span className="ml-1 text-[10px] opacity-75">
                                (via {pick.originalOwner.split(' ')[0]})
                              </span>
                            )}
                          </button>
                        ))
                    ) : (
                      <span className="text-gray-600 text-xs">No picks available</span>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Team 2 */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-b from-gray-800/80 to-gray-900/80 border border-emerald-500/20 backdrop-blur-sm">
          {/* Team header */}
          <div className="bg-gradient-to-r from-emerald-500/10 to-transparent border-b border-emerald-500/20 px-5 py-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                  <span className="text-emerald-400 font-bold text-sm">2</span>
                </div>
                {team2Roster?.teamName || "Select Team"}
              </h2>
              {team2Players.length > 0 && (
                <span className="px-2.5 py-1 bg-amber-500/20 text-amber-400 rounded-lg text-xs font-semibold">
                  {team2Players.length} player{team2Players.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>
          </div>

          <div className="p-5 space-y-4">
            <select
              value={team2}
              onChange={(e) => {
                setTeam2(e.target.value);
                setTeam2Players([]);
                setTeam2Picks([]);
                setAnalysis(null);
              }}
              className="w-full px-4 py-3 bg-gray-900/50 border border-gray-700/50 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all font-medium"
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
                <div>
                  <h3 className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wider flex items-center gap-2">
                    <span className="w-1 h-1 bg-emerald-400 rounded-full"></span>
                    Players
                  </h3>
                  <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1 scrollbar-thin">
                    {team2PlayerList.map((player) => (
                      <label
                        key={player.id}
                        className={`flex items-center gap-2.5 p-2.5 rounded-xl cursor-pointer transition-all ${
                          team2Players.includes(player.id)
                            ? "bg-gradient-to-r from-amber-500/20 to-orange-500/10 border border-amber-500/50 shadow-lg shadow-amber-500/10"
                            : "bg-gray-800/30 border border-transparent hover:bg-gray-800/50 hover:border-gray-700/50"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={team2Players.includes(player.id)}
                          onChange={() => togglePlayer(player.id, "team2")}
                          className="hidden"
                        />
                        <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                          team2Players.includes(player.id)
                            ? 'bg-amber-500 border-amber-500'
                            : 'border-gray-600 bg-gray-800/50'
                        }`}>
                          {team2Players.includes(player.id) && (
                            <Check className="w-3 h-3 text-white" />
                          )}
                        </div>
                        <PlayerAvatar sleeperId={player.sleeperId} name={player.fullName} size="sm" />
                        <PositionBadge position={player.position} size="xs" />
                        <span className="text-white font-medium flex-1 text-sm truncate">{player.fullName}</span>
                        {player.injuryStatus && player.injuryStatus !== "Active" && (
                          <span className="text-red-400 text-[10px] font-bold px-1.5 py-0.5 bg-red-500/20 rounded">
                            {player.injuryStatus.slice(0, 3).toUpperCase()}
                          </span>
                        )}
                        <span className="text-gray-500 text-xs font-medium">{player.team || 'FA'}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wider flex items-center gap-2">
                    <span className="w-1 h-1 bg-emerald-400 rounded-full"></span>
                    {planningSeason} Draft Picks
                  </h3>
                  {/* Selected picks */}
                  {team2Picks.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {team2Picks.map((pick, index) => (
                        <span
                          key={index}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-gradient-to-r from-amber-500/20 to-orange-500/10 text-amber-400 rounded-lg text-xs font-semibold border border-amber-500/30"
                        >
                          Round {pick.round}
                          <button
                            onClick={() => removePick("team2", index)}
                            className="hover:text-red-400 transition-colors ml-0.5"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                  {/* Available picks this team owns */}
                  <div className="flex gap-1.5 flex-wrap">
                    {team2OwnedPicks.length > 0 ? (
                      team2OwnedPicks
                        .filter(p => !team2Picks.some(tp => tp.round === p.round))
                        .map((pick) => (
                          <button
                            key={`${pick.season}-${pick.round}`}
                            onClick={() => addPick("team2", pick.round)}
                            className={`px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                              pick.isOwn
                                ? "bg-gray-800/50 hover:bg-gray-700 border border-gray-700/50 text-gray-300 hover:text-white"
                                : "bg-gradient-to-r from-emerald-500/10 to-teal-500/10 hover:from-emerald-500/20 hover:to-teal-500/20 border border-emerald-500/30 text-emerald-400"
                            }`}
                            title={pick.isOwn ? "Own pick" : `Acquired from ${pick.originalOwner}`}
                          >
                            <span>Rd {pick.round}</span>
                            {!pick.isOwn && (
                              <span className="ml-1 text-[10px] opacity-75">
                                (via {pick.originalOwner.split(' ')[0]})
                              </span>
                            )}
                          </button>
                        ))
                    ) : (
                      <span className="text-gray-600 text-xs">No picks available</span>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Analyze Button & Actions */}
      {team1 && team2 && (team1Players.length > 0 || team2Players.length > 0 || team1Picks.length > 0 || team2Picks.length > 0) && (
        <div className="flex flex-col items-center gap-4">
          <div className="flex gap-3">
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

            {analysis && (
              <button
                onClick={() => setShowSaveModal(true)}
                className="px-6 py-4 bg-gray-800/50 hover:bg-gray-700 border border-gray-700 rounded-xl text-white font-medium transition-all hover:scale-[1.02] flex items-center gap-2"
              >
                <Save className="w-5 h-5" />
                Save & Share
              </button>
            )}
          </div>

          {/* Saved Proposal Link */}
          {savedProposal && (
            <div className="flex items-center gap-3 p-4 bg-green-500/10 border border-green-500/30 rounded-xl">
              <Check className="w-5 h-5 text-green-400" />
              <span className="text-green-400 font-medium">Proposal saved!</span>
              <button
                onClick={copyShareLink}
                className="flex items-center gap-2 px-4 py-2 bg-green-500/20 hover:bg-green-500/30 rounded-lg text-green-400 font-medium transition-colors"
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied ? "Copied!" : "Copy Link"}
              </button>
              <Link
                href={savedProposal.shareUrl}
                className="flex items-center gap-2 px-4 py-2 bg-gray-700/50 hover:bg-gray-700 rounded-lg text-gray-300 font-medium transition-colors"
              >
                <FileText className="w-4 h-4" />
                View
              </Link>
            </div>
          )}
        </div>
      )}

      {/* Save Modal */}
      {showSaveModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="card-premium rounded-2xl p-6 w-full max-w-md animate-scale-in">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white">Save Trade Proposal</h2>
              <button
                onClick={() => setShowSaveModal(false)}
                className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Proposal Title *
                </label>
                <input
                  type="text"
                  value={proposalTitle}
                  onChange={(e) => setProposalTitle(e.target.value)}
                  placeholder="e.g., Big Trade Proposal"
                  className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                  maxLength={100}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Notes (optional)
                </label>
                <textarea
                  value={proposalNotes}
                  onChange={(e) => setProposalNotes(e.target.value)}
                  placeholder="Add context or reasoning..."
                  rows={3}
                  className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 resize-none"
                  maxLength={500}
                />
              </div>

              <div className="p-4 bg-gray-800/30 rounded-xl">
                <p className="text-gray-400 text-sm">
                  Saving this trade will create a shareable link that league members can vote on.
                </p>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowSaveModal(false)}
                  className="flex-1 px-4 py-3 bg-gray-800/50 hover:bg-gray-700 border border-gray-700 rounded-xl text-white font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={saveProposal}
                  disabled={saving || !proposalTitle.trim()}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 disabled:opacity-50 rounded-xl text-white font-medium transition-all flex items-center justify-center gap-2"
                >
                  {saving ? (
                    <>
                      <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Saving...
                    </>
                  ) : (
                    <>
                      <Share2 className="w-4 h-4" />
                      Save & Get Link
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Analysis Results */}
      {analysis && analysis.success && (
        <>
          {/* Fairness Score & Summary */}
          <div className="card-premium rounded-2xl p-6">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              {/* Fairness Score */}
              <div className="flex items-center gap-6">
                <div className="relative">
                  <div className={`w-24 h-24 rounded-full flex items-center justify-center border-4 ${
                    analysis.summary.fairnessScore >= 40
                      ? "bg-emerald-500/20 border-emerald-500"
                      : analysis.summary.fairnessScore >= 25
                        ? "bg-amber-500/20 border-amber-500"
                        : "bg-red-500/20 border-red-500"
                  }`}>
                    <div className="text-center">
                      <div className={`text-3xl font-bold ${
                        analysis.summary.fairnessScore >= 40
                          ? "text-emerald-400"
                          : analysis.summary.fairnessScore >= 25
                            ? "text-amber-400"
                            : "text-red-400"
                      }`}>
                        {analysis.summary.fairnessScore}
                      </div>
                      <div className="text-[10px] text-gray-400 uppercase">Fair</div>
                    </div>
                  </div>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white mb-1">Trade Fairness</h3>
                  <p className={`text-sm font-medium ${
                    analysis.summary.fairnessScore >= 40
                      ? "text-emerald-400"
                      : analysis.summary.fairnessScore >= 25
                        ? "text-amber-400"
                        : "text-red-400"
                  }`}>
                    {analysis.summary.fairnessScore >= 40
                      ? "Fair trade - Both teams benefit"
                      : analysis.summary.fairnessScore >= 25
                        ? "Slightly uneven - One team gains more"
                        : "Lopsided - Significant value difference"}
                  </p>
                  <p className="text-gray-500 text-xs mt-1">
                    Value differential: {Math.abs(analysis.summary.valueDifferential)} points
                  </p>
                </div>
              </div>

              {/* Value Comparison */}
              <div className="flex gap-4">
                <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 text-center min-w-[120px]">
                  <div className="text-gray-400 text-xs uppercase tracking-wider mb-1">{analysis.team1.rosterName?.split(' ')[0]}</div>
                  <div className={`text-2xl font-bold ${analysis.team1.netValue >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {analysis.team1.netValue >= 0 ? "+" : ""}{analysis.team1.netValue}
                  </div>
                  <div className="text-gray-500 text-xs">Net Value</div>
                </div>
                <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-center min-w-[120px]">
                  <div className="text-gray-400 text-xs uppercase tracking-wider mb-1">{analysis.team2.rosterName?.split(' ')[0]}</div>
                  <div className={`text-2xl font-bold ${analysis.team2.netValue >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {analysis.team2.netValue >= 0 ? "+" : ""}{analysis.team2.netValue}
                  </div>
                  <div className="text-gray-500 text-xs">Net Value</div>
                </div>
              </div>
            </div>

            {/* Trade Facts */}
            {analysis.summary.facts.length > 0 && (
              <div className="mt-6 pt-6 border-t border-gray-700/50">
                <h4 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Key Insights</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {analysis.summary.facts.map((fact, i) => (
                    <div
                      key={i}
                      className={`flex items-start gap-2 p-3 rounded-lg ${
                        fact.category === "keeper"
                          ? "bg-amber-500/10 border border-amber-500/20"
                          : fact.category === "roster"
                            ? "bg-blue-500/10 border border-blue-500/20"
                            : fact.category === "draft"
                              ? "bg-purple-500/10 border border-purple-500/20"
                              : "bg-gray-800/50 border border-gray-700/30"
                      }`}
                    >
                      <span className="text-lg">
                        {fact.category === "keeper" ? "📌" : fact.category === "roster" ? "👥" : fact.category === "draft" ? "🎯" : "📊"}
                      </span>
                      <span className={`text-sm ${
                        fact.category === "keeper"
                          ? "text-amber-400"
                          : fact.category === "roster"
                            ? "text-blue-400"
                            : fact.category === "draft"
                              ? "text-purple-400"
                              : "text-gray-300"
                      }`}>
                        {fact.description}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Keeper Impact Summary */}
            <div className="mt-6 pt-6 border-t border-gray-700/50">
              <h4 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Keeper Impact</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-gray-800/30 border border-gray-700/30">
                  <div className="text-gray-400 text-xs uppercase tracking-wider mb-2">{analysis.team1.rosterName}</div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <div className="text-gray-500">Keeper Slots</div>
                      <div className="text-white font-medium">
                        {analysis.team1.keeperSlotsBefore} → {analysis.team1.keeperSlotsAfter}
                        <span className="text-gray-500 text-xs ml-1">/ {analysis.team1.keeperSlotsMax}</span>
                      </div>
                    </div>
                    <div>
                      <div className="text-gray-500">Keeper Value</div>
                      <div className={`font-medium ${analysis.team1.netKeeperValue >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                        {analysis.team1.netKeeperValue >= 0 ? "+" : ""}{analysis.team1.netKeeperValue}
                      </div>
                    </div>
                    <div>
                      <div className="text-gray-500">Draft Capital</div>
                      <div className={`font-medium ${analysis.team1.draftCapitalChange >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                        {analysis.team1.draftCapitalChange >= 0 ? "+" : ""}{analysis.team1.draftCapitalChange}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="p-4 rounded-xl bg-gray-800/30 border border-gray-700/30">
                  <div className="text-gray-400 text-xs uppercase tracking-wider mb-2">{analysis.team2.rosterName}</div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <div className="text-gray-500">Keeper Slots</div>
                      <div className="text-white font-medium">
                        {analysis.team2.keeperSlotsBefore} → {analysis.team2.keeperSlotsAfter}
                        <span className="text-gray-500 text-xs ml-1">/ {analysis.team2.keeperSlotsMax}</span>
                      </div>
                    </div>
                    <div>
                      <div className="text-gray-500">Keeper Value</div>
                      <div className={`font-medium ${analysis.team2.netKeeperValue >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                        {analysis.team2.netKeeperValue >= 0 ? "+" : ""}{analysis.team2.netKeeperValue}
                      </div>
                    </div>
                    <div>
                      <div className="text-gray-500">Draft Capital</div>
                      <div className={`font-medium ${analysis.team2.draftCapitalChange >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                        {analysis.team2.draftCapitalChange >= 0 ? "+" : ""}{analysis.team2.draftCapitalChange}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Player Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Team 1 Players */}
            <div className="card-premium rounded-2xl p-6">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-400"></span>
                {analysis.team1.rosterName} Trading Away
              </h3>
              <div className="space-y-4">
                {analysis.team1.tradingAway.map((player) => (
                  <PlayerInfoCard key={player.playerId} player={player} isAfterDeadline={analysis.isAfterDeadline} />
                ))}
                {analysis.team1.tradingAway.length === 0 && analysis.team1.picksGiven.length === 0 && (
                  <p className="text-gray-500 text-sm">No players being traded</p>
                )}
              </div>
              {/* Draft Picks Given */}
              {analysis.team1.picksGiven.length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-700">
                  <p className="text-gray-500 text-xs uppercase tracking-wider mb-2">Draft Picks Given</p>
                  <div className="flex gap-2 flex-wrap">
                    {analysis.team1.picksGiven.map((pick, i) => (
                      <div key={i} className="px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl">
                        <div className="text-red-400 font-bold">{planningSeason} Rd {pick.round}</div>
                        <div className="text-gray-500 text-xs">Value: {pick.value}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {/* Draft Picks Received */}
              {analysis.team1.picksReceived.length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-700">
                  <p className="text-gray-500 text-xs uppercase tracking-wider mb-2">Draft Picks Received</p>
                  <div className="flex gap-2 flex-wrap">
                    {analysis.team1.picksReceived.map((pick, i) => (
                      <div key={i} className="px-4 py-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                        <div className="text-emerald-400 font-bold">{planningSeason} Rd {pick.round}</div>
                        <div className="text-gray-500 text-xs">Value: {pick.value}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Team 2 Players */}
            <div className="card-premium rounded-2xl p-6">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-400"></span>
                {analysis.team2.rosterName} Trading Away
              </h3>
              <div className="space-y-4">
                {analysis.team2.tradingAway.map((player) => (
                  <PlayerInfoCard key={player.playerId} player={player} isAfterDeadline={analysis.isAfterDeadline} />
                ))}
                {analysis.team2.tradingAway.length === 0 && analysis.team2.picksGiven.length === 0 && (
                  <p className="text-gray-500 text-sm">No players being traded</p>
                )}
              </div>
              {/* Draft Picks Given */}
              {analysis.team2.picksGiven.length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-700">
                  <p className="text-gray-500 text-xs uppercase tracking-wider mb-2">Draft Picks Given</p>
                  <div className="flex gap-2 flex-wrap">
                    {analysis.team2.picksGiven.map((pick, i) => (
                      <div key={i} className="px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl">
                        <div className="text-red-400 font-bold">{planningSeason} Rd {pick.round}</div>
                        <div className="text-gray-500 text-xs">Value: {pick.value}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {/* Draft Picks Received */}
              {analysis.team2.picksReceived.length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-700">
                  <p className="text-gray-500 text-xs uppercase tracking-wider mb-2">Draft Picks Received</p>
                  <div className="flex gap-2 flex-wrap">
                    {analysis.team2.picksReceived.map((pick, i) => (
                      <div key={i} className="px-4 py-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                        <div className="text-emerald-400 font-bold">{planningSeason} Rd {pick.round}</div>
                        <div className="text-gray-500 text-xs">Value: {pick.value}</div>
                      </div>
                    ))}
                  </div>
                </div>
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

// Player Info Card Component - Enhanced with comprehensive stats
function PlayerInfoCard({ player, isAfterDeadline }: { player: PlayerTradeValue; isAfterDeadline: boolean }) {
  const { keeperStatus, valueBreakdown, projection } = player;

  // Get age color based on value
  const getAgeColor = (age: number | null) => {
    if (!age) return "text-gray-400";
    if (age <= 25) return "text-emerald-400";
    if (age <= 28) return "text-amber-400";
    return "text-red-400";
  };

  // Get value tier styling
  const getValueTier = (value: number) => {
    if (value >= 40) return { label: "Elite", color: "text-purple-400", bg: "bg-purple-500/20", border: "border-purple-500/30" };
    if (value >= 30) return { label: "Great", color: "text-emerald-400", bg: "bg-emerald-500/20", border: "border-emerald-500/30" };
    if (value >= 20) return { label: "Good", color: "text-blue-400", bg: "bg-blue-500/20", border: "border-blue-500/30" };
    if (value >= 10) return { label: "Avg", color: "text-amber-400", bg: "bg-amber-500/20", border: "border-amber-500/30" };
    return { label: "Low", color: "text-gray-400", bg: "bg-gray-500/20", border: "border-gray-500/30" };
  };

  const valueTier = getValueTier(player.tradeValue);

  return (
    <div className="rounded-xl bg-gradient-to-b from-gray-800/50 to-gray-900/50 border border-gray-700/50 overflow-hidden">
      {/* Header with Trade Value */}
      <div className="p-4 border-b border-gray-700/50">
        <div className="flex items-start gap-3">
          <PlayerAvatar sleeperId={player.sleeperId} name={player.playerName} size="md" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-white font-bold text-lg">{player.playerName}</span>
              <PositionBadge position={player.position} size="sm" />
              {player.injuryStatus && player.injuryStatus !== "Active" && (
                <span className="text-red-400 text-[10px] font-bold px-1.5 py-0.5 bg-red-500/20 rounded">
                  {player.injuryStatus}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-1 text-sm">
              <span className="text-gray-400 font-medium">{player.team || "FA"}</span>
              {player.age && (
                <span className={`font-semibold ${getAgeColor(player.age)}`}>
                  Age {player.age}
                </span>
              )}
              {player.yearsExp !== null && player.yearsExp >= 0 && (
                <span className="text-gray-500">
                  {player.yearsExp === 0 ? "Rookie" : `${player.yearsExp}yr`}
                </span>
              )}
            </div>
          </div>
          {/* Trade Value Badge */}
          <div className={`px-3 py-2 rounded-lg ${valueTier.bg} border ${valueTier.border} text-center`}>
            <div className={`text-2xl font-bold ${valueTier.color}`}>{player.tradeValue}</div>
            <div className={`text-[10px] font-semibold uppercase tracking-wider ${valueTier.color}`}>{valueTier.label}</div>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="p-4 space-y-3">
        {/* Value Breakdown */}
        <div className="p-3 rounded-lg bg-gray-900/50">
          <div className="text-gray-500 text-[10px] uppercase tracking-wider mb-2 font-semibold">Value Breakdown</div>
          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <span className="text-gray-400 text-xs">Position Base</span>
              <span className="text-white font-medium text-sm">{valueBreakdown.basePositionValue}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-400 text-xs">Age Modifier</span>
              <span className={`font-medium text-sm ${valueBreakdown.ageModifier >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                {valueBreakdown.ageModifier >= 0 ? "+" : ""}{valueBreakdown.ageModifier}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-400 text-xs">Keeper Bonus</span>
              <span className="text-amber-400 font-medium text-sm">+{valueBreakdown.keeperValueBonus}</span>
            </div>
            <div className="flex justify-between items-center pt-1.5 border-t border-gray-700/50">
              <span className="text-white text-xs font-semibold">Total Value</span>
              <span className="text-white font-bold text-sm">{valueBreakdown.total}</span>
            </div>
          </div>
        </div>

        {/* Keeper Stats - 2 columns */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-lg bg-gray-900/50">
            <div className="text-gray-500 text-[10px] uppercase tracking-wider mb-1 font-semibold">Keeper Cost</div>
            <div className="text-amber-400 font-bold text-2xl">
              R{projection.newCost}
            </div>
            {projection.costTrajectory.length > 1 && (
              <div className="text-gray-500 text-[10px] mt-1">
                Next: R{projection.costTrajectory[1]?.cost || projection.newCost - 1}
              </div>
            )}
          </div>
          <div className="p-3 rounded-lg bg-gray-900/50">
            <div className="text-gray-500 text-[10px] uppercase tracking-wider mb-1 font-semibold">Years Kept</div>
            <div className={`font-bold text-2xl ${isAfterDeadline ? "text-amber-400" : "text-white"}`}>
              {isAfterDeadline ? "0" : keeperStatus.yearsKept}
            </div>
            <div className="text-gray-500 text-[10px] mt-1">
              Max: {keeperStatus.maxYearsAllowed}yr
            </div>
          </div>
        </div>

        {/* Keeper Eligibility */}
        <div className="p-3 rounded-lg bg-gray-900/50">
          <div className="text-gray-500 text-[10px] uppercase tracking-wider mb-2 font-semibold">Keeper Eligibility</div>
          <div className="flex gap-2">
            <div className={`flex-1 py-2 px-3 rounded-lg text-center text-xs font-semibold ${
              keeperStatus.isEligibleForRegular
                ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                : "bg-gray-800/50 text-gray-600 border border-gray-700/30"
            }`}>
              {keeperStatus.isEligibleForRegular ? "✓" : "✗"} Regular
            </div>
            <div className={`flex-1 py-2 px-3 rounded-lg text-center text-xs font-semibold ${
              keeperStatus.isEligibleForFranchise
                ? "bg-purple-500/20 text-purple-400 border border-purple-500/30"
                : "bg-gray-800/50 text-gray-600 border border-gray-700/30"
            }`}>
              {keeperStatus.isEligibleForFranchise ? "✓" : "✗"} Franchise
            </div>
          </div>
          {keeperStatus.keeperType && (
            <div className="mt-2 text-center">
              <span className={`text-xs font-medium px-2 py-1 rounded ${
                keeperStatus.keeperType === "FRANCHISE"
                  ? "bg-purple-500/20 text-purple-400"
                  : "bg-blue-500/20 text-blue-400"
              }`}>
                Currently: {keeperStatus.keeperType === "FRANCHISE" ? "Franchise Tagged" : "Regular Keeper"}
              </span>
            </div>
          )}
        </div>

        {/* Cost Trajectory */}
        {projection.costTrajectory.length > 0 && (
          <div className="p-3 rounded-lg bg-gray-900/50">
            <div className="text-gray-500 text-[10px] uppercase tracking-wider mb-2 font-semibold">Cost Trajectory</div>
            <div className="flex gap-1">
              {projection.costTrajectory.slice(0, 4).map((year, i) => (
                <div
                  key={year.year}
                  className={`flex-1 py-2 rounded-lg text-center ${
                    i === 0
                      ? "bg-amber-500/20 border border-amber-500/30"
                      : year.isFinalYear
                        ? "bg-red-500/10 border border-red-500/20"
                        : "bg-gray-800/50 border border-gray-700/30"
                  }`}
                >
                  <div className={`text-xs font-bold ${i === 0 ? "text-amber-400" : year.isFinalYear ? "text-red-400" : "text-gray-300"}`}>
                    R{year.cost}
                  </div>
                  <div className="text-[9px] text-gray-500">{year.year}</div>
                  {year.isFinalYear && <div className="text-[8px] text-red-400 font-medium">Final</div>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Trade Impact Notice */}
        {isAfterDeadline && (
          <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <div className="flex items-start gap-2">
              <span className="text-amber-400">⚠️</span>
              <div>
                <div className="text-amber-400 text-xs font-semibold">Offseason Trade Impact</div>
                <div className="text-amber-400/80 text-[11px]">
                  Years kept resets to 0 for new owner. Cost (R{projection.newCost}) is preserved.
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

