"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { PositionBadge } from "@/components/ui/PositionBadge";
import { PlayerAvatar } from "@/components/players/PlayerAvatar";
import { Skeleton, SkeletonAvatar } from "@/components/ui/Skeleton";
import { BackLink } from "@/components/ui/BackLink";
import { AgeBadge } from "@/components/ui/AgeBadge";
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

interface PlayerSeasonStatsData {
  season: number;
  gamesPlayed: number;
  fantasyPointsPpr: number;
  fantasyPointsHalfPpr: number;
  fantasyPointsStd: number;
  passingYards: number;
  passingTds: number;
  interceptions: number;
  rushingYards: number;
  rushingTds: number;
  carries: number;
  receptions: number;
  receivingYards: number;
  receivingTds: number;
  targets: number;
}

interface PlayerRankingData {
  ecr: number | null;
  positionRank: number | null;
  depthChart: number | null;
  sosRank: number | null;
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
  stats: {
    gamesPlayed: number | null;
    pointsPerGame: number | null;
    fantasyPointsPpr: number | null;
    adp: number | null;
    projectedPoints: number | null;
  };
  seasonStats: PlayerSeasonStatsData | null;
  ranking: PlayerRankingData;
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

  // Schedule data for bye weeks
  const [byeWeeks, setByeWeeks] = useState<Record<string, number>>({});

  // Save/Share state
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [proposalTitle, setProposalTitle] = useState("");
  const [proposalNotes, setProposalNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedProposal, setSavedProposal] = useState<{ id: string; shareUrl: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const fetchLeagueData = useCallback(async () => {
    try {
      // Fetch rosters with players, draft picks, and schedule in parallel
      const [rostersRes, picksRes, scheduleRes] = await Promise.all([
        fetch(`/api/leagues/${leagueId}/rosters?includePlayers=true`),
        fetch(`/api/leagues/${leagueId}/draft-picks`),
        fetch(`/api/nflverse/schedule?season=${planningSeason}`),
      ]);

      if (!rostersRes.ok) throw new Error("Failed to fetch rosters");

      const rostersData = await rostersRes.json();
      const picksData = picksRes.ok ? await picksRes.json() : { picks: [] };
      const scheduleData = scheduleRes.ok ? await scheduleRes.json() : { byeWeeks: {} };

      // Set bye weeks if available
      if (scheduleData.byeWeeks) {
        setByeWeeks(scheduleData.byeWeeks);
      }

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
      <div className="max-w-7xl mx-auto space-y-6">
        <div>
          <Skeleton className="h-4 w-24 mb-2" />
          <Skeleton className="h-8 w-64 mb-2" />
          <Skeleton className="h-4 w-48" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[1, 2].map((i) => (
            <div key={i} className="bg-[#141414] border border-[#2a2a2a] rounded-lg p-5">
              <Skeleton className="h-5 w-24 mb-4" />
              <Skeleton className="h-10 w-full mb-4" />
              <Skeleton className="h-4 w-40 mb-3" />
              <div className="space-y-2">
                {[1, 2, 3, 4, 5].map((j) => (
                  <div key={j} className="flex items-center gap-3 p-2 bg-[#1a1a1a] rounded-md">
                    <SkeletonAvatar size="sm" />
                    <Skeleton className="h-5 w-12" />
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
      <div className="max-w-7xl mx-auto">
        <div className="bg-red-500/5 border border-red-500/20 rounded-md p-4">
          <p className="text-red-400 text-sm">{error}</p>
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
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <BackLink href={`/league/${leagueId}`} label="Back to League" />
          <div className="flex items-center gap-4 mt-2">
            <div className="w-12 h-12 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
              <ArrowLeftRight className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Trade Analyzer</h1>
              <p className="text-gray-500 text-sm">
                {planningSeason} Draft &bull; Keeper value projections
              </p>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/league/${leagueId}/trade-proposals`}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#1a1a1a] hover:bg-[#222] border border-[#2a2a2a] rounded-md text-sm text-gray-300 hover:text-white font-medium transition-colors"
          >
            <FileText className="w-4 h-4" />
            Saved
          </Link>
          <button
            onClick={clearTrade}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-md text-sm text-red-400 font-medium transition-colors"
          >
            <X className="w-4 h-4" />
            Clear
          </button>
        </div>
      </div>

      {/* Offseason Banner - Always show since we're past trade deadline */}
      <div className="rounded-md p-4 border bg-amber-500/5 border-amber-500/20">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-amber-500/10 flex items-center justify-center flex-shrink-0">
            <span className="text-amber-400 text-sm">!</span>
          </div>
          <div>
            <p className="font-medium text-amber-400 text-sm">
              Offseason Period - Years Kept Will Reset
            </p>
            <p className="text-gray-500 text-sm">
              Any trade now until draft day will reset years kept to 0 for traded players. Draft round is always preserved.
            </p>
          </div>
        </div>
      </div>

      {/* Team Selection */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Team 1 */}
        <div className="rounded-lg bg-[#141414] border border-[#2a2a2a]">
          {/* Team header */}
          <div className="border-b border-[#2a2a2a] px-5 py-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-white flex items-center gap-3">
                <div className="w-7 h-7 rounded bg-blue-500/10 flex items-center justify-center">
                  <span className="text-blue-400 font-semibold text-xs">1</span>
                </div>
                {team1Roster?.teamName || "Select Team"}
              </h2>
              {team1Players.length > 0 && (
                <span className="px-2 py-0.5 bg-blue-500/10 text-blue-400 rounded text-xs font-medium">
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
              className="w-full px-3 py-2.5 bg-[#0a0a0a] border border-[#2a2a2a] rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-colors text-sm"
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
                  <div className="space-y-1 max-h-64 overflow-y-auto pr-1 scrollbar-thin">
                    {team1PlayerList.map((player) => (
                      <label
                        key={player.id}
                        className={`flex items-center gap-2.5 p-2 rounded-md cursor-pointer transition-colors ${
                          team1Players.includes(player.id)
                            ? "bg-blue-500/10 border border-blue-500/30"
                            : "bg-[#1a1a1a] border border-transparent hover:bg-[#222] hover:border-[#333]"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={team1Players.includes(player.id)}
                          onChange={() => togglePlayer(player.id, "team1")}
                          className="hidden"
                        />
                        <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                          team1Players.includes(player.id)
                            ? 'bg-blue-500 border-blue-500'
                            : 'border-gray-600 bg-transparent'
                        }`}>
                          {team1Players.includes(player.id) && (
                            <Check className="w-2.5 h-2.5 text-white" />
                          )}
                        </div>
                        <PlayerAvatar sleeperId={player.sleeperId} name={player.fullName} size="sm" />
                        <PositionBadge position={player.position} size="xs" />
                        <span className="text-white font-medium flex-1 text-sm truncate">{player.fullName}</span>
                        {player.injuryStatus && player.injuryStatus !== "Active" && (
                          <span className="text-red-400 text-[10px] font-medium px-1.5 py-0.5 bg-red-500/10 rounded">
                            {player.injuryStatus.slice(0, 3).toUpperCase()}
                          </span>
                        )}
                        <span className="text-gray-500 text-xs">{player.team || 'FA'}</span>
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
                          className="inline-flex items-center gap-1.5 px-2 py-1 bg-blue-500/10 text-blue-400 rounded text-xs font-medium border border-blue-500/20"
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
                            className={`px-2.5 py-1.5 rounded text-xs font-medium transition-colors ${
                              pick.isOwn
                                ? "bg-[#1a1a1a] hover:bg-[#222] border border-[#2a2a2a] text-gray-400 hover:text-white"
                                : "bg-blue-500/5 hover:bg-blue-500/10 border border-blue-500/20 text-blue-400"
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
        <div className="rounded-lg bg-[#141414] border border-[#2a2a2a]">
          {/* Team header */}
          <div className="border-b border-[#2a2a2a] px-5 py-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-white flex items-center gap-3">
                <div className="w-7 h-7 rounded bg-gray-500/10 flex items-center justify-center">
                  <span className="text-gray-400 font-semibold text-xs">2</span>
                </div>
                {team2Roster?.teamName || "Select Team"}
              </h2>
              {team2Players.length > 0 && (
                <span className="px-2 py-0.5 bg-gray-500/10 text-gray-400 rounded text-xs font-medium">
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
              className="w-full px-3 py-2.5 bg-[#0a0a0a] border border-[#2a2a2a] rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-colors text-sm"
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
                    <span className="w-1 h-1 bg-gray-400 rounded-full"></span>
                    Players
                  </h3>
                  <div className="space-y-1 max-h-64 overflow-y-auto pr-1 scrollbar-thin">
                    {team2PlayerList.map((player) => (
                      <label
                        key={player.id}
                        className={`flex items-center gap-2.5 p-2 rounded-md cursor-pointer transition-colors ${
                          team2Players.includes(player.id)
                            ? "bg-blue-500/10 border border-blue-500/30"
                            : "bg-[#1a1a1a] border border-transparent hover:bg-[#222] hover:border-[#333]"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={team2Players.includes(player.id)}
                          onChange={() => togglePlayer(player.id, "team2")}
                          className="hidden"
                        />
                        <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                          team2Players.includes(player.id)
                            ? 'bg-blue-500 border-blue-500'
                            : 'border-gray-600 bg-transparent'
                        }`}>
                          {team2Players.includes(player.id) && (
                            <Check className="w-2.5 h-2.5 text-white" />
                          )}
                        </div>
                        <PlayerAvatar sleeperId={player.sleeperId} name={player.fullName} size="sm" />
                        <PositionBadge position={player.position} size="xs" />
                        <span className="text-white font-medium flex-1 text-sm truncate">{player.fullName}</span>
                        {player.injuryStatus && player.injuryStatus !== "Active" && (
                          <span className="text-red-400 text-[10px] font-medium px-1.5 py-0.5 bg-red-500/10 rounded">
                            {player.injuryStatus.slice(0, 3).toUpperCase()}
                          </span>
                        )}
                        <span className="text-gray-500 text-xs">{player.team || 'FA'}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wider flex items-center gap-2">
                    <span className="w-1 h-1 bg-gray-400 rounded-full"></span>
                    {planningSeason} Draft Picks
                  </h3>
                  {/* Selected picks */}
                  {team2Picks.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {team2Picks.map((pick, index) => (
                        <span
                          key={index}
                          className="inline-flex items-center gap-1.5 px-2 py-1 bg-blue-500/10 text-blue-400 rounded text-xs font-medium border border-blue-500/20"
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
                            className={`px-2.5 py-1.5 rounded text-xs font-medium transition-colors ${
                              pick.isOwn
                                ? "bg-[#1a1a1a] hover:bg-[#222] border border-[#2a2a2a] text-gray-400 hover:text-white"
                                : "bg-blue-500/5 hover:bg-blue-500/10 border border-blue-500/20 text-blue-400"
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
              className="px-8 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-md text-white font-semibold transition-colors"
            >
              {analyzing ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
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
                className="px-5 py-3 bg-[#1a1a1a] hover:bg-[#222] border border-[#2a2a2a] rounded-md text-white font-medium transition-colors flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                Save & Share
              </button>
            )}
          </div>

          {/* Saved Proposal Link */}
          {savedProposal && (
            <div className="flex items-center gap-3 p-3 bg-emerald-500/5 border border-emerald-500/20 rounded-md">
              <Check className="w-4 h-4 text-emerald-400" />
              <span className="text-emerald-400 text-sm font-medium">Proposal saved!</span>
              <button
                onClick={copyShareLink}
                className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 rounded text-emerald-400 text-sm font-medium transition-colors"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? "Copied!" : "Copy Link"}
              </button>
              <Link
                href={savedProposal.shareUrl}
                className="flex items-center gap-2 px-3 py-1.5 bg-[#1a1a1a] hover:bg-[#222] rounded text-gray-300 text-sm font-medium transition-colors"
              >
                <FileText className="w-3.5 h-3.5" />
                View
              </Link>
            </div>
          )}
        </div>
      )}

      {/* Save Modal */}
      {showSaveModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-[#141414] border border-[#2a2a2a] rounded-lg p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-white">Save Trade Proposal</h2>
              <button
                onClick={() => setShowSaveModal(false)}
                className="p-1.5 hover:bg-[#222] rounded transition-colors"
              >
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1.5">
                  Proposal Title *
                </label>
                <input
                  type="text"
                  value={proposalTitle}
                  onChange={(e) => setProposalTitle(e.target.value)}
                  placeholder="e.g., Big Trade Proposal"
                  className="w-full px-3 py-2.5 bg-[#0a0a0a] border border-[#2a2a2a] rounded-md text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 text-sm"
                  maxLength={100}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1.5">
                  Notes (optional)
                </label>
                <textarea
                  value={proposalNotes}
                  onChange={(e) => setProposalNotes(e.target.value)}
                  placeholder="Add context or reasoning..."
                  rows={3}
                  className="w-full px-3 py-2.5 bg-[#0a0a0a] border border-[#2a2a2a] rounded-md text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 resize-none text-sm"
                  maxLength={500}
                />
              </div>

              <div className="p-3 bg-[#1a1a1a] rounded-md border border-[#2a2a2a]">
                <p className="text-gray-500 text-sm">
                  Saving this trade will create a shareable link that league members can vote on.
                </p>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowSaveModal(false)}
                  className="flex-1 px-4 py-2.5 bg-[#1a1a1a] hover:bg-[#222] border border-[#2a2a2a] rounded-md text-white font-medium transition-colors text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={saveProposal}
                  disabled={saving || !proposalTitle.trim()}
                  className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-md text-white font-medium transition-colors flex items-center justify-center gap-2 text-sm"
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
          {/* Player Cards - Side by Side */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Team 1 Card */}
            <div className="bg-[#141414] border border-[#2a2a2a] rounded-lg overflow-hidden">
              {/* Team Header with Roster Impact */}
              <div className="p-4 border-b border-[#2a2a2a]">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-white flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-400"></span>
                    {analysis.team1.rosterName}
                  </h3>
                  <div className="flex items-center gap-3 text-xs text-gray-500">
                    <span>Keepers: <span className="text-white">{analysis.team1.keeperSlotsBefore}→{analysis.team1.keeperSlotsAfter}</span><span className="text-gray-600">/{analysis.team1.keeperSlotsMax}</span></span>
                    {analysis.team1.picksGiven.length > 0 && <span className="text-red-400">−{analysis.team1.picksGiven.length} pick{analysis.team1.picksGiven.length > 1 ? 's' : ''}</span>}
                    {analysis.team1.picksReceived.length > 0 && <span className="text-blue-400">+{analysis.team1.picksReceived.length} pick{analysis.team1.picksReceived.length > 1 ? 's' : ''}</span>}
                  </div>
                </div>
                {/* What they send/receive summary */}
                <div className="mt-2 flex items-center gap-4 text-sm">
                  {analysis.team1.tradingAway.length > 0 && (
                    <span><span className="text-red-400 font-medium">Sends:</span> <span className="text-gray-400">{analysis.team1.tradingAway.map(p => p.position).join(', ')}</span></span>
                  )}
                  {analysis.team1.acquiring.length > 0 && (
                    <span><span className="text-blue-400 font-medium">Gets:</span> <span className="text-gray-400">{analysis.team1.acquiring.map(p => p.position).join(', ')}</span></span>
                  )}
                </div>
              </div>

              {/* Players */}
              <div className="p-4 space-y-3">
                {analysis.team1.tradingAway.map((player) => (
                  <PlayerInfoCard key={player.playerId} player={player} isAfterDeadline={analysis.isAfterDeadline} byeWeek={player.team ? byeWeeks[player.team] : undefined} />
                ))}
                {analysis.team1.tradingAway.length === 0 && analysis.team1.picksGiven.length === 0 && (
                  <p className="text-gray-600 text-sm py-4 text-center">No players being traded</p>
                )}

                {/* Draft Picks */}
                {(analysis.team1.picksGiven.length > 0 || analysis.team1.picksReceived.length > 0) && (
                  <div className="pt-3 border-t border-[#2a2a2a]">
                    <div className="flex gap-2 flex-wrap">
                      {analysis.team1.picksGiven.map((pick, i) => (
                        <div key={`g${i}`} className="px-2.5 py-1.5 bg-red-500/5 border border-red-500/20 rounded text-sm">
                          <span className="text-red-400 font-medium">−Rd {pick.round}</span>
                          <span className="text-gray-600 ml-1">({planningSeason})</span>
                        </div>
                      ))}
                      {analysis.team1.picksReceived.map((pick, i) => (
                        <div key={`r${i}`} className="px-2.5 py-1.5 bg-blue-500/5 border border-blue-500/20 rounded text-sm">
                          <span className="text-blue-400 font-medium">+Rd {pick.round}</span>
                          <span className="text-gray-600 ml-1">({planningSeason})</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Team 2 Card */}
            <div className="bg-[#141414] border border-[#2a2a2a] rounded-lg overflow-hidden">
              {/* Team Header with Roster Impact */}
              <div className="p-4 border-b border-[#2a2a2a]">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-white flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-gray-400"></span>
                    {analysis.team2.rosterName}
                  </h3>
                  <div className="flex items-center gap-3 text-xs text-gray-500">
                    <span>Keepers: <span className="text-white">{analysis.team2.keeperSlotsBefore}→{analysis.team2.keeperSlotsAfter}</span><span className="text-gray-600">/{analysis.team2.keeperSlotsMax}</span></span>
                    {analysis.team2.picksGiven.length > 0 && <span className="text-red-400">−{analysis.team2.picksGiven.length} pick{analysis.team2.picksGiven.length > 1 ? 's' : ''}</span>}
                    {analysis.team2.picksReceived.length > 0 && <span className="text-blue-400">+{analysis.team2.picksReceived.length} pick{analysis.team2.picksReceived.length > 1 ? 's' : ''}</span>}
                  </div>
                </div>
                {/* What they send/receive summary */}
                <div className="mt-2 flex items-center gap-4 text-sm">
                  {analysis.team2.tradingAway.length > 0 && (
                    <span><span className="text-red-400 font-medium">Sends:</span> <span className="text-gray-400">{analysis.team2.tradingAway.map(p => p.position).join(', ')}</span></span>
                  )}
                  {analysis.team2.acquiring.length > 0 && (
                    <span><span className="text-blue-400 font-medium">Gets:</span> <span className="text-gray-400">{analysis.team2.acquiring.map(p => p.position).join(', ')}</span></span>
                  )}
                </div>
              </div>

              {/* Players */}
              <div className="p-4 space-y-3">
                {analysis.team2.tradingAway.map((player) => (
                  <PlayerInfoCard key={player.playerId} player={player} isAfterDeadline={analysis.isAfterDeadline} byeWeek={player.team ? byeWeeks[player.team] : undefined} />
                ))}
                {analysis.team2.tradingAway.length === 0 && analysis.team2.picksGiven.length === 0 && (
                  <p className="text-gray-600 text-sm py-4 text-center">No players being traded</p>
                )}

                {/* Draft Picks */}
                {(analysis.team2.picksGiven.length > 0 || analysis.team2.picksReceived.length > 0) && (
                  <div className="pt-3 border-t border-[#2a2a2a]">
                    <div className="flex gap-2 flex-wrap">
                      {analysis.team2.picksGiven.map((pick, i) => (
                        <div key={`g${i}`} className="px-2.5 py-1.5 bg-red-500/5 border border-red-500/20 rounded text-sm">
                          <span className="text-red-400 font-medium">−Rd {pick.round}</span>
                          <span className="text-gray-600 ml-1">({planningSeason})</span>
                        </div>
                      ))}
                      {analysis.team2.picksReceived.map((pick, i) => (
                        <div key={`r${i}`} className="px-2.5 py-1.5 bg-blue-500/5 border border-blue-500/20 rounded text-sm">
                          <span className="text-blue-400 font-medium">+Rd {pick.round}</span>
                          <span className="text-gray-600 ml-1">({planningSeason})</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}

    </div>
  );
}

// Tooltip wrapper component
function Tooltip({ children, text }: { children: React.ReactNode; text: string }) {
  return (
    <div className="relative group cursor-help">
      {children}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-gray-900 border border-gray-700 rounded text-[10px] text-gray-300 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
        {text}
      </div>
    </div>
  );
}

// Stat cell with tooltip
function StatCell({ value, label, tooltip, highlight, muted }: { value: string | number; label: string; tooltip: string; highlight?: boolean; muted?: boolean }) {
  return (
    <Tooltip text={tooltip}>
      <div className="py-1.5 px-2 rounded bg-[#0a0a0a] text-center">
        <div className={`font-semibold text-sm ${highlight ? "text-purple-400" : muted ? "text-gray-500" : "text-white"}`}>{value}</div>
        <div className="text-gray-600 text-[9px]">{label}</div>
      </div>
    </Tooltip>
  );
}

// Player Info Card Component - Objective information only
function PlayerInfoCard({ player, isAfterDeadline, byeWeek }: { player: PlayerTradeValue; isAfterDeadline: boolean; byeWeek?: number }) {
  const { keeperStatus, projection, stats, seasonStats, ranking } = player;
  const gamesPlayed = seasonStats?.gamesPlayed || stats.gamesPlayed || 0;
  const displaySeason = seasonStats?.season || new Date().getFullYear() - 1;

  // Detect if stats are missing (sync issue or truly no data)
  const hasNoStats = !stats.pointsPerGame && !seasonStats?.fantasyPointsPpr;
  const isRookie = player.yearsExp === 0;
  const statsMissing = hasNoStats && !isRookie; // Likely a sync issue if not a rookie

  // Check if there are eligibility issues to show
  const hasEligibilityIssue = !keeperStatus.isEligibleForRegular || !keeperStatus.isEligibleForFranchise;

  // Format position rank as "WR12" or "RB5"
  const posRankDisplay = ranking.positionRank && player.position
    ? `${player.position}${ranking.positionRank}`
    : null;

  // Calculate per-game stats for position-specific display
  const perGame = (total: number) => gamesPlayed > 0 ? (total / gamesPlayed).toFixed(1) : "—";

  // Position-specific stats rendering - PER GAME focused
  // Only show if we have detailed season stats (not just PPG/Total from Player model)
  const renderPositionStats = () => {
    if (!seasonStats || gamesPlayed === 0) return null;
    // Check if we have actual detailed stats (not just fantasy points)
    const hasDetailedStats = seasonStats.passingYards > 0 || seasonStats.rushingYards > 0 ||
                             seasonStats.receivingYards > 0 || seasonStats.targets > 0;
    if (!hasDetailedStats) return null;

    const pos = player.position?.toUpperCase();

    if (pos === "QB") {
      const ydsPerGame = perGame(seasonStats.passingYards);
      const tdPerGame = perGame(seasonStats.passingTds);
      return (
        <div className="grid grid-cols-4 gap-1.5">
          <StatCell value={ydsPerGame} label="Yds/G" tooltip={`Pass yards per game (${seasonStats.passingYards.toLocaleString()} total)`} />
          <StatCell value={tdPerGame} label="TD/G" tooltip={`Pass TDs per game (${seasonStats.passingTds} total)`} />
          <StatCell value={seasonStats.interceptions} label="INT" tooltip="Total interceptions" />
          <StatCell value={seasonStats.rushingTds} label="Rush TD" tooltip="Rushing touchdowns" />
        </div>
      );
    }

    if (pos === "RB") {
      const ypc = seasonStats.carries > 0 ? (seasonStats.rushingYards / seasonStats.carries).toFixed(1) : "—";
      const rushYdsPerGame = perGame(seasonStats.rushingYards);
      const recPerGame = perGame(seasonStats.receptions);
      return (
        <div className="grid grid-cols-4 gap-1.5">
          <StatCell value={rushYdsPerGame} label="Rush/G" tooltip={`Rush yards per game (${seasonStats.rushingYards.toLocaleString()} total)`} />
          <StatCell value={seasonStats.rushingTds} label="Rush TD" tooltip="Total rushing touchdowns" />
          <StatCell value={ypc} label="YPC" tooltip="Yards per carry" />
          <StatCell value={recPerGame} label="Rec/G" tooltip={`Receptions per game (${seasonStats.receptions} total)`} />
        </div>
      );
    }

    if (pos === "WR" || pos === "TE") {
      const catchRate = seasonStats.targets > 0 ? Math.round((seasonStats.receptions / seasonStats.targets) * 100) + "%" : "—";
      const tgtPerGame = perGame(seasonStats.targets);
      const recYdsPerGame = perGame(seasonStats.receivingYards);
      return (
        <div className="grid grid-cols-4 gap-1.5">
          <StatCell value={tgtPerGame} label="Tgt/G" tooltip={`Targets per game (${seasonStats.targets} total)`} />
          <StatCell value={recYdsPerGame} label="Yds/G" tooltip={`Receiving yards per game (${seasonStats.receivingYards.toLocaleString()} total)`} />
          <StatCell value={seasonStats.receivingTds} label="Rec TD" tooltip="Total receiving touchdowns" />
          <StatCell value={catchRate} label="Catch%" tooltip="Catch rate (receptions/targets)" />
        </div>
      );
    }

    return null;
  };

  return (
    <div className="rounded-md bg-[#1a1a1a] border border-[#2a2a2a] p-3">
      {/* Player Header */}
      <div className="flex items-center gap-3 mb-3">
        <PlayerAvatar sleeperId={player.sleeperId} name={player.playerName} size="md" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-white font-medium">{player.playerName}</span>
            {/* Position + Rank combined: "WR" badge then "12" */}
            <div className="flex items-center">
              <PositionBadge position={player.position} size="sm" />
              {ranking.positionRank && (
                <span className="text-purple-400 text-[10px] font-bold ml-0.5">{ranking.positionRank}</span>
              )}
            </div>
            {/* Games played indicator */}
            {gamesPlayed > 0 ? (
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-gray-800 text-gray-300">
                {gamesPlayed}G
              </span>
            ) : isRookie && hasNoStats ? (
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-cyan-500/15 text-cyan-400 border border-cyan-500/30">
                Rookie
              </span>
            ) : statsMissing ? (
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30" title="Stats not synced - run NFLverse sync">
                No Stats
              </span>
            ) : null}
            {ranking.depthChart === 1 && (
              <span className="text-emerald-400 text-[9px] font-bold px-1 py-0.5 bg-emerald-500/10 rounded">ST</span>
            )}
            {player.injuryStatus && player.injuryStatus !== "Active" && (
              <span className="text-red-400 text-[10px] font-medium px-1.5 py-0.5 bg-red-500/10 rounded">
                {player.injuryStatus}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-500 flex-wrap">
            <span>{player.team || "FA"}</span>
            {byeWeek && <span className="text-gray-400">Bye {byeWeek}</span>}
            {/* Age with position-aware color coding */}
            <AgeBadge age={player.age} yearsExp={player.yearsExp} position={player.position} size="xs" />
            <span className="text-gray-600">•</span>
            <span className="text-blue-400 font-medium">R{projection.newCost}</span>
            <span className="text-gray-600">kept {keeperStatus.yearsKept}/{keeperStatus.maxYearsAllowed}</span>
          </div>
        </div>
      </div>

      {/* Cost Trajectory - Show future keeper costs */}
      {projection.costTrajectory.length > 0 && (
        <div className="flex items-center gap-2 mb-3 px-2 py-1.5 bg-[#0f0f0f] rounded-md border border-[#222]">
          <span className="text-[9px] text-gray-500 uppercase tracking-wider">Future Costs:</span>
          <div className="flex items-center gap-1">
            {projection.costTrajectory.map((year, idx) => (
              <span
                key={year.year}
                className={`
                  text-[10px] font-semibold px-1.5 py-0.5 rounded
                  ${idx === 0 ? "bg-blue-500/20 text-blue-400" : "bg-gray-800 text-gray-400"}
                  ${year.isFinalYear ? "ring-1 ring-amber-500/50" : ""}
                `}
                title={`Year ${year.year}: Round ${year.cost}${year.isFinalYear ? " (Final Year)" : ""}`}
              >
                R{year.cost}
              </span>
            ))}
            {projection.costTrajectory.length > 0 && projection.costTrajectory[projection.costTrajectory.length - 1].isFinalYear && (
              <span className="text-[9px] text-amber-400 ml-1">→ Expires</span>
            )}
          </div>
        </div>
      )}

      {/* Stats Section */}
      <div className="space-y-2">
        {/* Fantasy PPG - The key metric */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-500 uppercase tracking-wider w-24">
            {hasNoStats && isRookie ? "Projected" : `${displaySeason} PPR`}
          </span>
          <div className="flex-1 grid grid-cols-4 gap-1.5">
            <StatCell
              value={
                stats.pointsPerGame?.toFixed(1) ||
                (hasNoStats && stats.projectedPoints ? `~${(stats.projectedPoints / 17).toFixed(1)}` : "—")
              }
              label="PPG"
              tooltip={hasNoStats && stats.projectedPoints ? "Projected PPG (17 games)" : "Fantasy points per game (PPR)"}
              highlight
            />
            <StatCell
              value={
                seasonStats?.fantasyPointsPpr?.toFixed(0) ||
                stats.fantasyPointsPpr?.toFixed(0) ||
                (hasNoStats && stats.projectedPoints ? `~${stats.projectedPoints.toFixed(0)}` : "—")
              }
              label={hasNoStats && stats.projectedPoints ? "Proj" : "Total"}
              tooltip={hasNoStats && stats.projectedPoints ? "Projected fantasy points" : "Total fantasy points (PPR)"}
              muted
            />
            <StatCell
              value={ranking.ecr ? `#${Math.round(ranking.ecr)}` : "—"}
              label="ECR"
              tooltip="Expert Consensus Ranking"
            />
            {posRankDisplay ? (
              <StatCell
                value={posRankDisplay}
                label="Pos Rank"
                tooltip={`Position rank: ${posRankDisplay}`}
                highlight
              />
            ) : ranking.sosRank ? (
              <StatCell
                value={`#${ranking.sosRank}`}
                label="SOS"
                tooltip="Strength of Schedule rank (lower = harder)"
              />
            ) : (
              <StatCell
                value={player.yearsExp !== null ? (player.yearsExp === 0 ? "R" : `Yr ${player.yearsExp + 1}`) : "—"}
                label="Season"
                tooltip={player.yearsExp === 0 ? "Rookie - entering 1st NFL season" : `Entering year ${(player.yearsExp || 0) + 1} in NFL`}
                muted
              />
            )}
          </div>
        </div>

        {/* Position-Specific Per-Game Stats */}
        {renderPositionStats() && (
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-gray-500 uppercase tracking-wider w-24">Per Game</span>
            <div className="flex-1">
              {renderPositionStats()}
            </div>
          </div>
        )}
      </div>

      {/* Warnings - Only show if relevant */}
      {(hasEligibilityIssue || projection.costTrajectory.length === 1 || isAfterDeadline) && (
        <div className="space-y-1 text-xs mt-3">
          {hasEligibilityIssue && (
            <div className="text-gray-500">
              {!keeperStatus.isEligibleForRegular && <span className="text-red-400">Not eligible as regular keeper</span>}
              {!keeperStatus.isEligibleForRegular && !keeperStatus.isEligibleForFranchise && <span> • </span>}
              {!keeperStatus.isEligibleForFranchise && <span className="text-red-400">Not eligible for franchise</span>}
            </div>
          )}
          {projection.costTrajectory.length === 1 && !isAfterDeadline && (
            <div className="text-amber-400">Final keepable year</div>
          )}
          {isAfterDeadline && (
            <div className="text-amber-400 bg-amber-500/5 border border-amber-500/20 rounded px-2 py-1.5">
              Offseason: Years reset to 0, cost R{projection.newCost} preserved
            </div>
          )}
        </div>
      )}
    </div>
  );
}

