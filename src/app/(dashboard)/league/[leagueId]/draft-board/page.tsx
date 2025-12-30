"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
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
  FlaskConical,
  FileSpreadsheet,
  Printer,
  Copy,
  Check,
  Zap,
} from "lucide-react";
import { PositionBadge } from "@/components/ui/PositionBadge";
import { Skeleton } from "@/components/ui/Skeleton";
import { BackLink } from "@/components/ui/BackLink";
import { getKeeperDeadlineInfo, getCurrentSeason } from "@/lib/constants/keeper-rules";
import {
  exportKeepersToCSV,
  exportDraftBoardToCSV,
  printDraftBoard,
  copyDraftBoardToClipboard,
} from "@/lib/export";

const TEAM_COLORS = [
  { bg: "bg-rose-500", bgMuted: "bg-rose-500/15", bgSolid: "bg-rose-500/30", border: "border-rose-500/40", text: "text-rose-200", accent: "text-rose-400", ring: "ring-rose-500/30" },
  { bg: "bg-sky-500", bgMuted: "bg-sky-500/15", bgSolid: "bg-sky-500/30", border: "border-sky-500/40", text: "text-sky-200", accent: "text-sky-400", ring: "ring-sky-500/30" },
  { bg: "bg-emerald-500", bgMuted: "bg-emerald-500/15", bgSolid: "bg-emerald-500/30", border: "border-emerald-500/40", text: "text-emerald-200", accent: "text-emerald-400", ring: "ring-emerald-500/30" },
  { bg: "bg-amber-500", bgMuted: "bg-amber-500/15", bgSolid: "bg-amber-500/30", border: "border-amber-500/40", text: "text-amber-200", accent: "text-amber-400", ring: "ring-amber-500/30" },
  { bg: "bg-violet-500", bgMuted: "bg-violet-500/15", bgSolid: "bg-violet-500/30", border: "border-violet-500/40", text: "text-violet-200", accent: "text-violet-400", ring: "ring-violet-500/30" },
  { bg: "bg-cyan-500", bgMuted: "bg-cyan-500/15", bgSolid: "bg-cyan-500/30", border: "border-cyan-500/40", text: "text-cyan-200", accent: "text-cyan-400", ring: "ring-cyan-500/30" },
  { bg: "bg-pink-500", bgMuted: "bg-pink-500/15", bgSolid: "bg-pink-500/30", border: "border-pink-500/40", text: "text-pink-200", accent: "text-pink-400", ring: "ring-pink-500/30" },
  { bg: "bg-lime-500", bgMuted: "bg-lime-500/15", bgSolid: "bg-lime-500/30", border: "border-lime-500/40", text: "text-lime-200", accent: "text-lime-400", ring: "ring-lime-500/30" },
  { bg: "bg-orange-500", bgMuted: "bg-orange-500/15", bgSolid: "bg-orange-500/30", border: "border-orange-500/40", text: "text-orange-200", accent: "text-orange-400", ring: "ring-orange-500/30" },
  { bg: "bg-teal-500", bgMuted: "bg-teal-500/15", bgSolid: "bg-teal-500/30", border: "border-teal-500/40", text: "text-teal-200", accent: "text-teal-400", ring: "ring-teal-500/30" },
  { bg: "bg-indigo-500", bgMuted: "bg-indigo-500/15", bgSolid: "bg-indigo-500/30", border: "border-indigo-500/40", text: "text-indigo-200", accent: "text-indigo-400", ring: "ring-indigo-500/30" },
  { bg: "bg-fuchsia-500", bgMuted: "bg-fuchsia-500/15", bgSolid: "bg-fuchsia-500/30", border: "border-fuchsia-500/40", text: "text-fuchsia-200", accent: "text-fuchsia-400", ring: "ring-fuchsia-500/30" },
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
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [copied, setCopied] = useState(false);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const deadlineInfo = getKeeperDeadlineInfo();

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

  const filteredCascade = data?.cascade.map(team => ({
    ...team,
    results: filterPosition
      ? team.results.filter(k => k.position === filterPosition)
      : team.results,
  }));

  if (loading) {
    return (
      <div className="max-w-full mx-auto space-y-6 p-4 md:p-6">
        <div>
          <Skeleton className="h-4 w-24 mb-3" />
          <Skeleton className="h-10 w-64 mb-2" />
          <Skeleton className="h-5 w-40" />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-96 rounded-2xl" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-7xl mx-auto p-4 md:p-6">
        <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-8 text-center">
          <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <p className="text-red-400 font-semibold text-lg mb-2">{error || "Failed to load data"}</p>
          <p className="text-gray-500 text-sm mb-6">Please try again or contact support if the issue persists.</p>
          <button
            onClick={() => fetchData()}
            className="px-6 py-3 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-xl font-medium transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  const rosters = data.draftBoard[0]?.slots || [];

  return (
    <div className="max-w-full mx-auto space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col gap-6">
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
          <div>
            <BackLink href={`/league/${leagueId}`} label="Back to League" />
            <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight mt-1">
              Draft Board
            </h1>
            <div className="flex items-center gap-3 mt-3">
              <span className="px-3 py-1 rounded-lg bg-purple-500/20 text-purple-400 text-sm font-semibold">
                {data.season} Season
              </span>
              <div
                className={`inline-flex items-center gap-2 px-3 py-1 rounded-lg text-sm font-medium ${
                  deadlineInfo.isActive
                    ? "bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/30"
                    : "bg-red-500/15 text-red-400 ring-1 ring-red-500/30"
                }`}
              >
                {deadlineInfo.isActive ? (
                  <>
                    <Unlock size={14} />
                    Keepers Open
                  </>
                ) : (
                  <>
                    <Lock size={14} />
                    Keepers Locked
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Controls */}
          <div className="flex flex-wrap gap-2">
            <div className="flex rounded-xl overflow-hidden ring-1 ring-white/10">
              <button
                onClick={() => setViewMode("grid")}
                className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-all ${
                  viewMode === "grid"
                    ? "bg-white/10 text-white"
                    : "bg-white/5 text-gray-400 hover:text-white hover:bg-white/10"
                }`}
              >
                <LayoutGrid size={16} />
                <span className="hidden sm:inline">Grid</span>
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-all ${
                  viewMode === "list"
                    ? "bg-white/10 text-white"
                    : "bg-white/5 text-gray-400 hover:text-white hover:bg-white/10"
                }`}
              >
                <List size={16} />
                <span className="hidden sm:inline">Teams</span>
              </button>
            </div>

            <Link
              href={`/league/${leagueId}/simulation`}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-purple-500/15 text-purple-400 hover:bg-purple-500/25 ring-1 ring-purple-500/30 text-sm font-medium transition-all"
            >
              <FlaskConical size={16} />
              <span className="hidden sm:inline">Simulate</span>
            </Link>

            <button
              onClick={() => fetchData()}
              disabled={isRefreshing}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 ring-1 ring-white/10 text-sm font-medium transition-all disabled:opacity-50"
            >
              <RefreshCw size={16} className={isRefreshing ? "animate-spin" : ""} />
              <span className="hidden sm:inline">Refresh</span>
            </button>

            <div className="relative group">
              <button className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 ring-1 ring-white/10 text-sm font-medium transition-all">
                <Download size={16} />
                <span className="hidden sm:inline">Export</span>
                <ChevronDown size={14} />
              </button>
              <div className="absolute right-0 mt-2 w-48 bg-gray-900 border border-gray-700/50 rounded-xl shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 overflow-hidden">
                <button
                  onClick={() => handleExport("print")}
                  className="w-full px-4 py-3 text-left text-sm text-gray-300 hover:bg-white/5 flex items-center gap-3"
                >
                  <Printer size={14} />
                  Print / PDF
                </button>
                <button
                  onClick={() => handleExport("csv-board")}
                  className="w-full px-4 py-3 text-left text-sm text-gray-300 hover:bg-white/5 flex items-center gap-3"
                >
                  <FileSpreadsheet size={14} />
                  Draft Board CSV
                </button>
                <button
                  onClick={() => handleExport("csv-keepers")}
                  className="w-full px-4 py-3 text-left text-sm text-gray-300 hover:bg-white/5 flex items-center gap-3"
                >
                  <FileSpreadsheet size={14} />
                  Keepers CSV
                </button>
                <button
                  onClick={() => handleExport("copy")}
                  className="w-full px-4 py-3 text-left text-sm text-gray-300 hover:bg-white/5 flex items-center gap-3"
                >
                  {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
                  {copied ? "Copied!" : "Copy to Clipboard"}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard
            icon={<Trophy size={18} />}
            value={data.summary.totalKeepers}
            label="Total Keepers"
            color="emerald"
          />
          <StatCard
            icon={<Zap size={18} />}
            value={data.summary.cascadedKeepers}
            label="Cascaded"
            color="amber"
          />
          <StatCard
            icon={<ArrowLeftRight size={18} />}
            value={data.summary.tradedPicks}
            label="Traded Picks"
            color="blue"
          />
          <StatCard
            icon={<Clock size={18} />}
            value={lastUpdated ? lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "--"}
            label="Last Updated"
            color="gray"
            isText
          />
        </div>
      </div>

      {/* Position Filter Pills */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-gray-500 text-sm font-medium mr-1">Filter:</span>
        <button
          onClick={() => setFilterPosition(null)}
          className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
            filterPosition === null
              ? "bg-white text-gray-900"
              : "bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white ring-1 ring-white/10"
          }`}
        >
          All ({data.summary.totalKeepers})
        </button>
        {(["QB", "RB", "WR", "TE"] as const).map((pos) => (
          <button
            key={pos}
            onClick={() => setFilterPosition(filterPosition === pos ? null : pos)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
              filterPosition === pos
                ? "bg-white text-gray-900"
                : "bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white ring-1 ring-white/10"
            }`}
          >
            <PositionBadge position={pos} size="xs" />
            <span>{overallPositions[pos]}</span>
          </button>
        ))}
      </div>

      {viewMode === "grid" ? (
        /* Grid View */
        <div className="card-premium rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="sticky left-0 z-20 bg-gray-900 px-3 py-3 text-left w-12">
                    <span className="text-gray-500 text-xs font-semibold uppercase tracking-wider">Rd</span>
                  </th>
                  {rosters.map((roster, index) => {
                    const color = getTeamColor(index);
                    const teamData = data.cascade.find(t => t.rosterId === roster.rosterId);
                    const keeperCount = teamData?.results.length || 0;
                    return (
                      <th key={roster.rosterId} className="px-1 py-3 min-w-[100px]">
                        <div className={`flex flex-col items-center gap-1 px-2 py-2 rounded-xl ${color.bgMuted}`}>
                          <span className={`text-xs font-bold ${color.accent} truncate max-w-[90px]`}>
                            {roster.rosterName || `Team ${index + 1}`}
                          </span>
                          <span className="text-gray-500 text-[10px] font-medium">
                            {keeperCount} keeper{keeperCount !== 1 ? "s" : ""}
                          </span>
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {data.draftBoard.map((row) => (
                  <tr key={row.round} className="border-t border-white/5">
                    <td className="sticky left-0 z-10 bg-gray-900 px-3 py-1.5">
                      <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-white/5 text-white font-bold text-sm">
                        {row.round}
                      </span>
                    </td>
                    {row.slots.map((slot, slotIndex) => {
                      const columnColor = getTeamColor(slotIndex);
                      const keeper = slot.keeper;
                      const shouldShow = !filterPosition || (keeper?.position === filterPosition);

                      return (
                        <td key={slot.rosterId} className="px-1 py-1.5">
                          <DraftCell
                            slot={shouldShow ? slot : { ...slot, status: slot.status === "keeper" ? "available" : slot.status, keeper: undefined }}
                            columnColor={columnColor}
                            teamInfoMap={teamInfoMap}
                            teamNameToInfo={teamNameToInfo}
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
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {(filteredCascade || data.cascade).map((team, index) => {
            const color = getTeamColor(index);
            return (
              <div key={team.rosterId} className="card-premium rounded-2xl overflow-hidden">
                {/* Team Header */}
                <div className={`${color.bgSolid} px-5 py-4`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full ${color.bg} ring-2 ${color.ring}`} />
                      <span className="font-bold text-white">
                        {team.rosterName || `Team ${team.rosterId.slice(0, 4)}`}
                      </span>
                    </div>
                    <span className={`text-sm font-semibold ${color.accent}`}>
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
                            className={`flex items-center justify-between rounded-xl px-4 py-3 ${
                              keeper.keeperType === "FRANCHISE"
                                ? "bg-amber-500/10 ring-1 ring-amber-500/30"
                                : "bg-white/5 ring-1 ring-white/5"
                            }`}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              {keeper.keeperType === "FRANCHISE" && (
                                <Star size={14} className="text-amber-400 shrink-0 fill-amber-400" />
                              )}
                              <PositionBadge position={keeper.position} size="sm" />
                              <div className="min-w-0">
                                <span className="text-white text-sm font-semibold truncate block">
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
                                <div className="flex items-center gap-1.5">
                                  <span className="text-gray-600 text-xs line-through">R{keeper.baseCost}</span>
                                  <span className="text-amber-400 font-bold">R{keeper.finalCost}</span>
                                </div>
                              ) : (
                                <span className="text-white font-bold">R{keeper.finalCost}</span>
                              )}
                              {keeper.isLocked && <Lock size={12} className="text-gray-600" />}
                            </div>
                          </div>
                        ))}
                    </div>
                  ) : (
                    <div className="text-center py-10">
                      <Users size={32} className="mx-auto text-gray-700 mb-3" />
                      <p className="text-gray-500 font-medium">No keepers selected</p>
                    </div>
                  )}

                  {/* Traded Picks */}
                  {(team.tradedAwayPicks.length > 0 || team.acquiredPicks.length > 0) && (
                    <div className="mt-4 pt-4 border-t border-white/5 space-y-2">
                      {team.tradedAwayPicks.length > 0 && (
                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-red-400/80 font-medium">Traded away:</span>
                          <span className="text-gray-400">R{team.tradedAwayPicks.join(", R")}</span>
                        </div>
                      )}
                      {team.acquiredPicks.length > 0 && (
                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-emerald-400/80 font-medium">Acquired:</span>
                          <span className="text-gray-400">R{team.acquiredPicks.map((p) => p.round).join(", R")}</span>
                        </div>
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
      <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500 pt-2">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-emerald-500/20 ring-1 ring-emerald-500/40 flex items-center justify-center">
            <Trophy size={12} className="text-emerald-400" />
          </div>
          <span>Keeper</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg border-2 border-dashed border-blue-500/50 bg-blue-500/10 flex items-center justify-center">
            <ArrowLeftRight size={10} className="text-blue-400" />
          </div>
          <span>Traded Pick</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-white/5 ring-1 ring-white/10" />
          <span>Available</span>
        </div>
        <div className="flex items-center gap-2">
          <Star size={14} className="text-amber-400 fill-amber-400" />
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
  color: "emerald" | "amber" | "blue" | "gray";
  isText?: boolean;
}) {
  const colorClasses = {
    emerald: "bg-emerald-500/10 text-emerald-400 ring-emerald-500/20",
    amber: "bg-amber-500/10 text-amber-400 ring-amber-500/20",
    blue: "bg-blue-500/10 text-blue-400 ring-blue-500/20",
    gray: "bg-white/5 text-gray-400 ring-white/10",
  };

  return (
    <div className="bg-white/[0.02] rounded-xl p-4 ring-1 ring-white/5">
      <div className="flex items-center gap-3">
        <span className={`flex items-center justify-center w-10 h-10 rounded-xl ring-1 ${colorClasses[color]}`}>
          {icon}
        </span>
        <div>
          <p className={`${isText ? "text-lg" : "text-2xl"} font-bold text-white`}>{value}</p>
          <p className="text-gray-500 text-xs font-medium">{label}</p>
        </div>
      </div>
    </div>
  );
}

interface DraftCellProps {
  slot: DraftSlot;
  columnColor: ReturnType<typeof getTeamColor>;
  teamInfoMap: Map<string, { color: ReturnType<typeof getTeamColor>; name: string; rosterId: string }>;
  teamNameToInfo: Map<string, { color: ReturnType<typeof getTeamColor>; name: string; rosterId: string }>;
}

function DraftCell({ slot, columnColor, teamInfoMap, teamNameToInfo }: DraftCellProps) {
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
      <div className={`${ownerColor.bgMuted} border-2 border-dashed ${ownerColor.border} rounded-xl px-2 py-2 h-[52px] flex flex-col justify-center`}>
        <p className={`${ownerColor.accent} text-[10px] font-bold truncate text-center`}>
          {ownerName}
        </p>
        <p className="text-gray-600 text-[9px] text-center">owns pick</p>
      </div>
    );
  }

  if (slot.status === "keeper" && slot.keeper) {
    const isFranchise = slot.keeper.keeperType === "FRANCHISE";

    return (
      <div
        className={`${columnColor.bgMuted} ${
          isFranchise ? "ring-2 ring-amber-500/50" : `ring-1 ${columnColor.ring}`
        } rounded-xl px-2 py-1.5 h-[52px] flex flex-col justify-center relative`}
      >
        {isFranchise && (
          <Star size={10} className="absolute top-1.5 right-1.5 text-amber-400 fill-amber-400" />
        )}
        <div className="flex items-center justify-center">
          <PositionBadge position={slot.keeper.position} size="xs" />
        </div>
        <p className={`${columnColor.text} text-[10px] font-semibold truncate text-center mt-0.5`}>
          {slot.keeper.playerName}
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white/[0.02] ring-1 ring-white/5 rounded-xl h-[52px] flex items-center justify-center">
      <span className="text-gray-700 text-[10px] font-medium">—</span>
    </div>
  );
}
