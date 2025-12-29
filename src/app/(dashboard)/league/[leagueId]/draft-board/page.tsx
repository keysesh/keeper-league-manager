"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  LayoutGrid,
  List,
  Users,
  TrendingUp,
  ArrowLeftRight,
  Trophy,
  Clock,
  Lock,
  Unlock,
  Download,
  RefreshCw,
  Star,
  AlertTriangle,
  ChevronDown,
  Filter,
  FlaskConical,
  FileSpreadsheet,
  Printer,
  Copy,
  Check,
} from "lucide-react";
import { PositionBadge } from "@/components/ui/PositionBadge";
import { Skeleton } from "@/components/ui/Skeleton";
import { getKeeperDeadlineInfo, getCurrentSeason } from "@/lib/constants/keeper-rules";
import {
  exportKeepersToCSV,
  exportDraftBoardToCSV,
  printDraftBoard,
  copyDraftBoardToClipboard,
} from "@/lib/export";

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

interface KeeperResult {
  playerId: string;
  playerName: string;
  position: string | null;
  team: string | null;
  baseCost: number;
  finalCost: number;
  cascaded: boolean;
  cascadeReason: string | null;
  yearsKept?: number;
  keeperType?: "FRANCHISE" | "REGULAR";
  isLocked?: boolean;
}

interface DraftSlot {
  rosterId: string;
  rosterName: string | null;
  status: "available" | "keeper" | "traded";
  keeper?: {
    playerId: string;
    playerName: string;
    position: string | null;
    yearsKept?: number;
    keeperType?: string;
  };
  tradedTo?: string;
}

interface CascadeResult {
  rosterId: string;
  rosterName: string | null;
  results: KeeperResult[];
  tradedAwayPicks: number[];
  acquiredPicks: Array<{ round: number; fromRosterId: string }>;
}

interface DraftBoardData {
  season: number;
  leagueId: string;
  totalRosters: number;
  draftRounds: number;
  cascade: CascadeResult[];
  draftBoard: Array<{
    round: number;
    slots: DraftSlot[];
  }>;
  summary: {
    totalKeepers: number;
    cascadedKeepers: number;
    tradedPicks: number;
  };
}

interface PositionCount {
  QB: number;
  RB: number;
  WR: number;
  TE: number;
  K: number;
  DEF: number;
}

export default function DraftBoardPage() {
  const params = useParams();
  const leagueId = params.leagueId as string;

  const [data, setData] = useState<DraftBoardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [filterPosition, setFilterPosition] = useState<string | null>(null);
  const [showProjections, setShowProjections] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [copied, setCopied] = useState(false);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const deadlineInfo = getKeeperDeadlineInfo();
  const currentSeason = getCurrentSeason();

  const fetchData = useCallback(async (showLoading = true) => {
    if (showLoading) setIsRefreshing(true);
    try {
      const res = await fetch(`/api/leagues/${leagueId}/keepers/cascade`);
      if (!res.ok) throw new Error("Failed to fetch draft board");
      const result = await res.json();
      setData(result);
      setLastUpdated(new Date());
      setError("");
    } catch {
      setError("Failed to load draft board");
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [leagueId]);

  useEffect(() => {
    fetchData();

    // Set up polling for real-time updates (every 30 seconds)
    pollIntervalRef.current = setInterval(() => {
      fetchData(false);
    }, 30000);

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [fetchData]);

  const handleExport = async (format: "csv-keepers" | "csv-board" | "print" | "copy") => {
    if (!data) return;

    switch (format) {
      case "csv-keepers": {
        const keepers = data.cascade.flatMap((team) =>
          team.results.map((k) => ({
            playerName: k.playerName,
            position: k.position,
            team: k.team,
            rosterName: team.rosterName,
            finalCost: k.finalCost,
            baseCost: k.baseCost,
            cascaded: k.cascaded,
            yearsKept: k.yearsKept,
            keeperType: k.keeperType,
          }))
        );
        exportKeepersToCSV(keepers, `keepers-${data.season}`);
        break;
      }
      case "csv-board": {
        const rosters = data.draftBoard[0]?.slots || [];
        exportDraftBoardToCSV(
          data.draftBoard,
          rosters.map((r) => ({ rosterName: r.rosterName })),
          `draft-board-${data.season}`
        );
        break;
      }
      case "print": {
        printDraftBoard();
        break;
      }
      case "copy": {
        const rosters = data.draftBoard[0]?.slots || [];
        await copyDraftBoardToClipboard(
          data.draftBoard,
          rosters.map((r) => ({ rosterName: r.rosterName }))
        );
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        break;
      }
    }
  };

  const getOverallPositionSummary = (): PositionCount => {
    const counts: PositionCount = { QB: 0, RB: 0, WR: 0, TE: 0, K: 0, DEF: 0 };
    if (!data) return counts;

    for (const team of data.cascade) {
      for (const keeper of team.results) {
        if (keeper.position) {
          const pos = keeper.position as keyof PositionCount;
          if (pos in counts) {
            counts[pos]++;
          }
        }
      }
    }
    return counts;
  };

  const overallPositions = getOverallPositionSummary();

  const teamInfoMap = new Map<string, { color: ReturnType<typeof getTeamColor>; name: string; rosterId: string }>();
  const teamNameToInfo = new Map<string, { color: ReturnType<typeof getTeamColor>; name: string; rosterId: string }>();

  if (data) {
    const rosters = data.draftBoard[0]?.slots || [];
    rosters.forEach((roster, index) => {
      const info = {
        color: getTeamColor(index),
        name: roster.rosterName || `Team ${roster.rosterId.slice(0, 4)}`,
        rosterId: roster.rosterId,
      };
      teamInfoMap.set(roster.rosterId, info);
      if (roster.rosterName) {
        teamNameToInfo.set(roster.rosterName, info);
      }
    });
  }

  // Filter keepers by position if filter is active
  const filteredCascade = data?.cascade.map(team => ({
    ...team,
    results: filterPosition
      ? team.results.filter(k => k.position === filterPosition)
      : team.results,
  }));

  if (loading) {
    return (
      <div className="max-w-full mx-auto space-y-6 p-4">
        <div>
          <Skeleton className="h-4 w-24 mb-2" />
          <Skeleton className="h-10 w-48 mb-2" />
          <Skeleton className="h-5 w-32" />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-gray-800/40 rounded-2xl p-5 border border-gray-700/50">
              <Skeleton className="h-10 w-16 mb-2" />
              <Skeleton className="h-4 w-24" />
            </div>
          ))}
        </div>
        <div className="bg-gray-800/40 rounded-2xl p-5 border border-gray-700/50">
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-7xl mx-auto p-4">
        <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-6">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-red-400" />
            <p className="text-red-400 font-medium">{error || "Failed to load data"}</p>
          </div>
          <button
            onClick={() => fetchData()}
            className="mt-4 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg text-sm font-medium transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  const rosters = data.draftBoard[0]?.slots || [];

  return (
    <div className="max-w-full mx-auto space-y-6 p-4">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
        <div>
          <Link
            href={`/league/${leagueId}`}
            className="inline-flex items-center gap-2 text-gray-500 hover:text-amber-400 text-sm mb-3 transition-colors group"
          >
            <ArrowLeft size={16} strokeWidth={2} className="group-hover:-translate-x-0.5 transition-transform" />
            <span>Back to League</span>
          </Link>
          <h1 className="text-3xl font-bold text-white tracking-tight">Draft Board</h1>
          <div className="flex items-center gap-3 mt-2">
            <span className="text-gray-500">{data.season} Season</span>
            <span className="text-gray-700">•</span>
            {/* Keeper Status Badge */}
            <div
              className={`inline-flex items-center gap-2 px-3 py-1 rounded-lg text-xs font-medium ${
                deadlineInfo.isActive
                  ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                  : "bg-red-500/10 text-red-400 border border-red-500/20"
              }`}
            >
              {deadlineInfo.isActive ? (
                <>
                  <Unlock size={12} />
                  Keepers Open
                </>
              ) : (
                <>
                  <Lock size={12} />
                  Keepers Locked
                </>
              )}
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap gap-2">
          {/* View Mode Toggle */}
          <div className="flex rounded-xl overflow-hidden border border-gray-700/50">
            <button
              onClick={() => setViewMode("grid")}
              className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-all ${
                viewMode === "grid"
                  ? "bg-amber-500/20 text-amber-400"
                  : "bg-gray-800/50 text-gray-400 hover:text-white"
              }`}
            >
              <LayoutGrid size={16} strokeWidth={2} />
              <span className="hidden sm:inline">Grid</span>
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-all ${
                viewMode === "list"
                  ? "bg-amber-500/20 text-amber-400"
                  : "bg-gray-800/50 text-gray-400 hover:text-white"
              }`}
            >
              <List size={16} strokeWidth={2} />
              <span className="hidden sm:inline">By Team</span>
            </button>
          </div>

          {/* Simulation Link */}
          <Link
            href={`/league/${leagueId}/simulation`}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 border border-purple-500/30 hover:border-purple-500/50 text-sm font-medium transition-all"
          >
            <FlaskConical size={16} strokeWidth={2} />
            <span className="hidden sm:inline">Simulate</span>
          </Link>

          {/* Refresh Button */}
          <button
            onClick={() => fetchData()}
            disabled={isRefreshing}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gray-800/50 text-gray-400 hover:text-white border border-gray-700/50 hover:border-gray-600 text-sm font-medium transition-all disabled:opacity-50"
          >
            <RefreshCw size={16} strokeWidth={2} className={isRefreshing ? "animate-spin" : ""} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          {/* Export Button */}
          <div className="relative group">
            <button
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gray-800/50 text-gray-400 hover:text-white border border-gray-700/50 hover:border-gray-600 text-sm font-medium transition-all"
            >
              <Download size={16} strokeWidth={2} />
              <span className="hidden sm:inline">Export</span>
              <ChevronDown size={14} />
            </button>
            <div className="absolute right-0 mt-2 w-48 bg-gray-800 border border-gray-700 rounded-xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
              <button
                onClick={() => handleExport("print")}
                className="w-full px-4 py-2.5 text-left text-sm text-gray-300 hover:bg-gray-700/50 rounded-t-xl flex items-center gap-2"
              >
                <Printer size={14} />
                Print / PDF
              </button>
              <button
                onClick={() => handleExport("csv-board")}
                className="w-full px-4 py-2.5 text-left text-sm text-gray-300 hover:bg-gray-700/50 flex items-center gap-2"
              >
                <FileSpreadsheet size={14} />
                Draft Board CSV
              </button>
              <button
                onClick={() => handleExport("csv-keepers")}
                className="w-full px-4 py-2.5 text-left text-sm text-gray-300 hover:bg-gray-700/50 flex items-center gap-2"
              >
                <FileSpreadsheet size={14} />
                Keepers CSV
              </button>
              <button
                onClick={() => handleExport("copy")}
                className="w-full px-4 py-2.5 text-left text-sm text-gray-300 hover:bg-gray-700/50 rounded-b-xl flex items-center gap-2"
              >
                {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
                {copied ? "Copied!" : "Copy to Clipboard"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard
          icon={<Trophy size={20} strokeWidth={2} />}
          value={data.summary.totalKeepers}
          label="Total Keepers"
          color="white"
        />
        <StatCard
          icon={<TrendingUp size={20} strokeWidth={2} />}
          value={data.summary.cascadedKeepers}
          label="Cascaded"
          color="amber"
        />
        <StatCard
          icon={<ArrowLeftRight size={20} strokeWidth={2} />}
          value={data.summary.tradedPicks}
          label="Traded Picks"
          color="blue"
        />
        <StatCard
          icon={<Users size={20} strokeWidth={2} />}
          value={data.totalRosters}
          label="Teams"
          color="emerald"
        />
        <StatCard
          icon={<Clock size={20} strokeWidth={2} />}
          value={lastUpdated ? lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "--"}
          label="Last Updated"
          color="purple"
          isText
        />
      </div>

      {/* Team Color Legend */}
      <div className="bg-gradient-to-b from-gray-800/40 to-gray-800/20 rounded-2xl p-5 border border-gray-700/40">
        <div className="flex flex-wrap gap-2">
          {rosters.map((roster, index) => {
            const color = getTeamColor(index);
            const teamData = data.cascade.find(t => t.rosterId === roster.rosterId);
            const keeperCount = teamData?.results.length || 0;
            return (
              <div
                key={roster.rosterId}
                className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-900/50 border border-gray-700/30"
              >
                <div className={`w-3 h-3 rounded-full ${color.bg} shadow-lg`} />
                <span className="text-gray-200 text-sm font-medium truncate max-w-[100px]">
                  {roster.rosterName || `Team ${roster.rosterId.slice(0, 4)}`}
                </span>
                <span className="text-gray-500 text-xs font-medium">({keeperCount})</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Position Summary & Filter */}
      <div className="bg-gradient-to-b from-gray-800/40 to-gray-800/20 rounded-2xl p-5 border border-gray-700/40">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
          <div className="flex items-center gap-2">
            <Filter size={16} className="text-gray-500" />
            <span className="text-gray-500 text-sm font-medium">Filter by Position:</span>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setFilterPosition(null)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                filterPosition === null
                  ? "bg-amber-500/20 text-amber-400 border border-amber-500/40"
                  : "bg-gray-800/50 text-gray-400 hover:text-white border border-gray-700/50"
              }`}
            >
              All ({data.summary.totalKeepers})
            </button>
            {(["QB", "RB", "WR", "TE"] as const).map((pos) => (
              <button
                key={pos}
                onClick={() => setFilterPosition(filterPosition === pos ? null : pos)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  filterPosition === pos
                    ? "bg-amber-500/20 text-amber-400 border border-amber-500/40"
                    : "bg-gray-800/50 text-gray-400 hover:text-white border border-gray-700/50"
                }`}
              >
                <PositionBadge position={pos} size="xs" />
                <span>{overallPositions[pos]}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {viewMode === "grid" ? (
        /* Grid View - Clean Table */
        <div className="bg-gradient-to-b from-gray-900/60 to-gray-900/40 rounded-2xl border border-gray-700/40 overflow-hidden print:bg-white print:text-black">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="sticky left-0 z-20 bg-gradient-to-r from-gray-900 to-gray-900/95 px-4 py-4 text-left text-gray-400 text-sm font-semibold border-b border-gray-700/50 w-14">
                    Rd
                  </th>
                  {rosters.map((roster, index) => {
                    const color = getTeamColor(index);
                    return (
                      <th
                        key={roster.rosterId}
                        className="px-1 py-4 text-center border-b border-gray-700/50 min-w-[110px]"
                      >
                        <div className="flex flex-col items-center gap-1.5">
                          <div className={`w-3 h-3 rounded-full ${color.bg}`} />
                          <span className="text-gray-300 text-xs font-medium truncate max-w-[100px]">
                            {roster.rosterName || `Team ${roster.rosterId.slice(0, 4)}`}
                          </span>
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {data.draftBoard.map((row, rowIndex) => (
                  <tr
                    key={row.round}
                    className={rowIndex % 2 === 0 ? "bg-gray-800/10" : "bg-transparent"}
                  >
                    <td className="sticky left-0 z-10 bg-gradient-to-r from-gray-900 to-gray-900/95 px-4 py-2 text-white font-bold text-sm border-r border-gray-800/50">
                      {row.round}
                    </td>
                    {row.slots.map((slot, slotIndex) => {
                      const columnColor = getTeamColor(slotIndex);
                      // Check if keeper should be shown based on filter
                      const keeper = slot.keeper;
                      const shouldShow = !filterPosition || (keeper?.position === filterPosition);

                      return (
                        <td key={slot.rosterId} className="px-1 py-1.5">
                          <DraftCell
                            slot={shouldShow ? slot : { ...slot, status: slot.status === "keeper" ? "available" : slot.status, keeper: undefined }}
                            columnColor={columnColor}
                            teamInfoMap={teamInfoMap}
                            teamNameToInfo={teamNameToInfo}
                            showProjections={showProjections}
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* List View - By Team */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {(filteredCascade || data.cascade).map((team, index) => {
            const color = getTeamColor(index);
            return (
              <div
                key={team.rosterId}
                className="bg-gradient-to-b from-gray-800/40 to-gray-900/40 rounded-2xl border border-gray-700/40 overflow-hidden"
              >
                {/* Team Header */}
                <div className={`${color.bgMuted} px-5 py-4 border-b ${color.border}/20`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-3.5 h-3.5 rounded-full ${color.bg}`} />
                      <span className={`font-semibold ${color.text}`}>
                        {team.rosterName || `Team ${team.rosterId.slice(0, 4)}`}
                      </span>
                    </div>
                    <span className="text-gray-400 text-sm font-medium">
                      {team.results.length} keeper{team.results.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                </div>

                {/* Keepers List */}
                <div className="p-4">
                  {team.results.length > 0 ? (
                    <div className="space-y-2">
                      {team.results
                        .sort((a, b) => a.finalCost - b.finalCost)
                        .map((keeper) => (
                          <div
                            key={keeper.playerId}
                            className="flex items-center justify-between bg-gray-900/50 rounded-xl px-4 py-3 border border-gray-700/30"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              {keeper.keeperType === "FRANCHISE" && (
                                <Star size={14} className="text-amber-400 shrink-0" />
                              )}
                              <PositionBadge position={keeper.position} size="xs" />
                              <div className="min-w-0">
                                <span className="text-white text-sm font-medium truncate block">
                                  {keeper.playerName}
                                </span>
                                {keeper.yearsKept && (
                                  <span className="text-gray-500 text-xs">
                                    Year {keeper.yearsKept}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {keeper.cascaded ? (
                                <>
                                  <span className="text-gray-500 text-xs line-through">R{keeper.baseCost}</span>
                                  <span className="text-amber-400 text-sm font-bold">R{keeper.finalCost}</span>
                                </>
                              ) : (
                                <span className="text-white text-sm font-bold">R{keeper.finalCost}</span>
                              )}
                              {keeper.isLocked && <Lock size={12} className="text-gray-500" />}
                            </div>
                          </div>
                        ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <Users size={24} className="mx-auto text-gray-600 mb-2" />
                      <p className="text-gray-500 text-sm">No keepers selected</p>
                    </div>
                  )}

                  {/* Traded Picks */}
                  {(team.tradedAwayPicks.length > 0 || team.acquiredPicks.length > 0) && (
                    <div className="mt-4 pt-4 border-t border-gray-700/40 space-y-1.5">
                      {team.tradedAwayPicks.length > 0 && (
                        <p className="text-red-400/80 text-xs font-medium flex items-center gap-2">
                          <ArrowLeftRight size={12} />
                          Traded away: R{team.tradedAwayPicks.join(", R")}
                        </p>
                      )}
                      {team.acquiredPicks.length > 0 && (
                        <p className="text-emerald-400/80 text-xs font-medium flex items-center gap-2">
                          <ArrowLeftRight size={12} />
                          Acquired: R{team.acquiredPicks.map((p) => p.round).join(", R")}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-6 text-sm text-gray-400">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center">
            <Trophy size={12} className="text-emerald-400" />
          </div>
          <span>Keeper</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg border-2 border-dashed border-sky-500/50 bg-sky-500/10 flex items-center justify-center">
            <ArrowLeftRight size={12} className="text-sky-400" />
          </div>
          <span>Traded Pick</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gray-800/30 border border-gray-700/40" />
          <span>Available</span>
        </div>
        <div className="flex items-center gap-2">
          <Star size={14} className="text-amber-400" />
          <span>Franchise Tag</span>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  value,
  label,
  color,
  isText = false,
}: {
  icon: React.ReactNode;
  value: number | string;
  label: string;
  color: "white" | "amber" | "blue" | "emerald" | "purple";
  isText?: boolean;
}) {
  const colorClasses = {
    white: { bg: "from-gray-700/30 to-gray-800/30", border: "border-gray-600/30", text: "text-white", icon: "bg-gray-700/50 text-gray-300" },
    amber: { bg: "from-amber-500/20 to-amber-500/5", border: "border-amber-500/20", text: "text-amber-400", icon: "bg-amber-500/20 text-amber-400" },
    blue: { bg: "from-blue-500/20 to-blue-500/5", border: "border-blue-500/20", text: "text-blue-400", icon: "bg-blue-500/20 text-blue-400" },
    emerald: { bg: "from-emerald-500/20 to-emerald-500/5", border: "border-emerald-500/20", text: "text-emerald-400", icon: "bg-emerald-500/20 text-emerald-400" },
    purple: { bg: "from-purple-500/20 to-purple-500/5", border: "border-purple-500/20", text: "text-purple-400", icon: "bg-purple-500/20 text-purple-400" },
  };

  const styles = colorClasses[color];

  return (
    <div className={`bg-gradient-to-b ${styles.bg} rounded-2xl p-5 border ${styles.border}`}>
      <div className="flex items-center justify-between mb-3">
        <span className={`flex items-center justify-center w-10 h-10 rounded-xl ${styles.icon}`}>
          {icon}
        </span>
      </div>
      <p className={`${isText ? "text-xl" : "text-3xl"} font-bold ${styles.text} tracking-tight`}>{value}</p>
      <p className="text-gray-500 text-xs mt-1 font-medium">{label}</p>
    </div>
  );
}

interface DraftCellProps {
  slot: DraftSlot;
  columnColor: ReturnType<typeof getTeamColor>;
  teamInfoMap: Map<string, { color: ReturnType<typeof getTeamColor>; name: string; rosterId: string }>;
  teamNameToInfo: Map<string, { color: ReturnType<typeof getTeamColor>; name: string; rosterId: string }>;
  showProjections?: boolean;
}

function DraftCell({ slot, columnColor, teamInfoMap, teamNameToInfo, showProjections }: DraftCellProps) {
  if (slot.status === "traded" && slot.tradedTo) {
    let newOwnerInfo = teamNameToInfo.get(slot.tradedTo) || teamInfoMap.get(slot.tradedTo);

    if (!newOwnerInfo) {
      for (const [name, info] of teamNameToInfo) {
        if (name.includes(slot.tradedTo) || slot.tradedTo.includes(name)) {
          newOwnerInfo = info;
          break;
        }
      }
    }

    const ownerColor = newOwnerInfo?.color || columnColor;
    const ownerName = newOwnerInfo?.name || slot.tradedTo;

    return (
      <div
        className={`${ownerColor.bgMuted} border-2 border-dashed ${ownerColor.border}/50 rounded-xl px-2 py-2.5 text-center h-[56px] flex flex-col justify-center`}
      >
        <p className={`${ownerColor.accent} text-[10px] font-semibold truncate`}>
          {ownerName}
        </p>
        <p className="text-gray-500 text-[9px] mt-0.5">owns pick</p>
      </div>
    );
  }

  if (slot.status === "keeper" && slot.keeper) {
    const isFranchise = slot.keeper.keeperType === "FRANCHISE";

    return (
      <div
        className={`${columnColor.bgMuted} border ${isFranchise ? "border-amber-500/60" : columnColor.border + "/40"} rounded-xl px-2 py-2 h-[56px] flex flex-col justify-center relative`}
      >
        {isFranchise && (
          <Star size={10} className="absolute top-1.5 right-1.5 text-amber-400" />
        )}
        <div className="flex items-center justify-center">
          <PositionBadge position={slot.keeper.position} size="xs" />
        </div>
        <p className={`${columnColor.text} text-[10px] font-medium truncate text-center mt-1`}>
          {slot.keeper.playerName}
        </p>
        {showProjections && slot.keeper.yearsKept && (
          <p className="text-gray-500 text-[8px] text-center">Yr {slot.keeper.yearsKept}</p>
        )}
      </div>
    );
  }

  return (
    <div
      className="bg-gray-800/20 border border-gray-700/20 rounded-xl h-[56px] flex items-center justify-center"
    >
      <span className="text-gray-600 text-[10px] font-medium uppercase tracking-wider">Open</span>
    </div>
  );
}
