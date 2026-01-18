"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  LayoutGrid,
  List,
  ArrowLeftRight,
  Clock,
  Lock,
  Unlock,
  Download,
  RefreshCw,
  AlertTriangle,
  ChevronDown,
  FlaskConical,
  FileSpreadsheet,
  Printer,
  Copy,
  Check,
  Zap,
  Trophy,
  Star,
  Users,
} from "lucide-react";
import { PositionBadge } from "@/components/ui/PositionBadge";
import { PlayerAvatar, TeamLogo } from "@/components/players/PlayerAvatar";
import { KeeperHistoryModal } from "@/components/players/KeeperHistoryModal";
import { Skeleton } from "@/components/ui/Skeleton";
import { BackLink } from "@/components/ui/BackLink";
import { getKeeperDeadlineInfo } from "@/lib/constants/keeper-rules";
import {
  exportKeepersToCSV,
  exportDraftBoardToCSV,
  printDraftBoard,
  copyDraftBoardToClipboard,
} from "@/lib/export";

// High-visibility team colors - maximally distinct, ordered to avoid similar adjacent colors
const TEAM_COLORS = [
  { bg: "bg-red-500", bgMuted: "bg-red-900/30", bgSolid: "bg-red-900/50", border: "border-red-500/50", text: "text-red-200", accent: "text-red-400", ring: "ring-red-500/30" },
  { bg: "bg-blue-500", bgMuted: "bg-blue-900/30", bgSolid: "bg-blue-900/50", border: "border-blue-500/50", text: "text-blue-200", accent: "text-blue-400", ring: "ring-blue-500/30" },
  { bg: "bg-yellow-500", bgMuted: "bg-yellow-900/30", bgSolid: "bg-yellow-900/50", border: "border-yellow-500/50", text: "text-yellow-200", accent: "text-yellow-400", ring: "ring-yellow-500/30" },
  { bg: "bg-green-500", bgMuted: "bg-green-900/30", bgSolid: "bg-green-900/50", border: "border-green-500/50", text: "text-green-200", accent: "text-green-400", ring: "ring-green-500/30" },
  { bg: "bg-purple-500", bgMuted: "bg-purple-900/30", bgSolid: "bg-purple-900/50", border: "border-purple-500/50", text: "text-purple-200", accent: "text-purple-400", ring: "ring-purple-500/30" },
  { bg: "bg-orange-500", bgMuted: "bg-orange-900/30", bgSolid: "bg-orange-900/50", border: "border-orange-500/50", text: "text-orange-200", accent: "text-orange-400", ring: "ring-orange-500/30" },
  { bg: "bg-cyan-500", bgMuted: "bg-cyan-900/30", bgSolid: "bg-cyan-900/50", border: "border-cyan-500/50", text: "text-cyan-200", accent: "text-cyan-400", ring: "ring-cyan-500/30" },
  { bg: "bg-pink-500", bgMuted: "bg-pink-900/30", bgSolid: "bg-pink-900/50", border: "border-pink-500/50", text: "text-pink-200", accent: "text-pink-400", ring: "ring-pink-500/30" },
  { bg: "bg-lime-500", bgMuted: "bg-lime-900/30", bgSolid: "bg-lime-900/50", border: "border-lime-500/50", text: "text-lime-200", accent: "text-lime-400", ring: "ring-lime-500/30" },
  { bg: "bg-indigo-500", bgMuted: "bg-indigo-900/30", bgSolid: "bg-indigo-900/50", border: "border-indigo-500/50", text: "text-indigo-200", accent: "text-indigo-400", ring: "ring-indigo-500/30" },
  { bg: "bg-amber-500", bgMuted: "bg-amber-900/30", bgSolid: "bg-amber-900/50", border: "border-amber-500/50", text: "text-amber-200", accent: "text-amber-400", ring: "ring-amber-500/30" },
  { bg: "bg-teal-500", bgMuted: "bg-teal-900/30", bgSolid: "bg-teal-900/50", border: "border-teal-500/50", text: "text-teal-200", accent: "text-teal-400", ring: "ring-teal-500/30" },
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
    team: string | null;
    yearsKept?: number;
    keeperType?: string;
  };
  tradedTo?: string;
  acquiredFrom?: string;
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
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Detect mobile viewport
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const deadlineInfo = getKeeperDeadlineInfo();

  const syncData = async () => {
    setIsSyncing(true);
    setSyncMessage(null);
    try {
      const syncRes = await fetch("/api/sleeper/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "quick", leagueId }),
      });

      if (!syncRes.ok) {
        const err = await syncRes.json();
        throw new Error(err.error || "Failed to sync league");
      }

      const populateRes = await fetch("/api/sleeper/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "populate-keepers", leagueId }),
      });

      if (!populateRes.ok) {
        const err = await populateRes.json();
        throw new Error(err.error || "Failed to populate keepers");
      }

      const recalcRes = await fetch("/api/sleeper/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "recalculate-keeper-years", leagueId }),
      });

      if (!recalcRes.ok) {
        const err = await recalcRes.json();
        throw new Error(err.error || "Failed to recalculate years");
      }

      const result = await recalcRes.json();
      setSyncMessage(`Synced! ${result.data?.totalUpdated || 0} keepers updated`);

      await fetchData();
    } catch (err) {
      setSyncMessage(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setIsSyncing(false);
      setTimeout(() => setSyncMessage(null), 3000);
    }
  };

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
            <Skeleton key={i} className="h-24 rounded-md" />
          ))}
        </div>
        <Skeleton className="h-96 rounded-md" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-7xl mx-auto p-4 md:p-6">
        <div className="bg-[#1a1a1a] border border-red-500/30 rounded-md p-8 text-center">
          <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <p className="text-red-400 font-semibold text-lg mb-2">{error || "Failed to load data"}</p>
          <p className="text-gray-500 text-sm mb-6">Please try again or contact support if the issue persists.</p>
          <button
            onClick={() => fetchData()}
            className="px-6 py-3 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-md font-medium transition-colors"
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
              <span className="px-3 py-1 rounded-md bg-[#222222] border border-[#2a2a2a] text-blue-400 text-sm font-semibold">
                {data.season} Season
              </span>
              <div
                className={`inline-flex items-center gap-2 px-3 py-1 rounded-md text-sm font-medium border ${
                  deadlineInfo.isActive
                    ? "bg-[#222222] border-blue-500/30 text-blue-400"
                    : "bg-[#222222] border-red-500/30 text-red-400"
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

          {/* Controls - responsive layout */}
          <div className="flex flex-wrap gap-2">
            {/* View mode toggle */}
            <div className="flex rounded-md overflow-hidden border border-[#2a2a2a]">
              <button
                onClick={() => setViewMode("grid")}
                className={`inline-flex items-center gap-1.5 px-3 py-2 md:px-4 md:py-2.5 text-sm font-medium transition-all ${
                  viewMode === "grid"
                    ? "bg-blue-500/20 text-blue-400"
                    : "bg-[#1a1a1a] text-gray-400 hover:text-white hover:bg-[#222222]"
                }`}
              >
                <LayoutGrid size={16} />
                <span className="hidden md:inline">Grid</span>
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`inline-flex items-center gap-1.5 px-3 py-2 md:px-4 md:py-2.5 text-sm font-medium transition-all ${
                  viewMode === "list"
                    ? "bg-blue-500/20 text-blue-400"
                    : "bg-[#1a1a1a] text-gray-400 hover:text-white hover:bg-[#222222]"
                }`}
              >
                <List size={16} />
                <span className="hidden md:inline">Teams</span>
              </button>
            </div>

            {/* Primary actions - always visible */}
            <Link
              href={`/league/${leagueId}/simulation`}
              className="inline-flex items-center gap-1.5 px-3 py-2 md:px-4 md:py-2.5 rounded-md bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors"
            >
              <FlaskConical size={16} />
              <span className="hidden md:inline">Simulate</span>
            </Link>

            <button
              onClick={syncData}
              disabled={isSyncing}
              className="inline-flex items-center gap-1.5 px-3 py-2 md:px-4 md:py-2.5 rounded-md bg-[#1a1a1a] border border-blue-500/30 text-blue-400 hover:bg-[#222222] text-sm font-medium transition-colors disabled:opacity-50"
              title="Sync keepers from Sleeper"
            >
              <RefreshCw size={16} className={isSyncing ? "animate-spin" : ""} />
              <span className="hidden md:inline">{isSyncing ? "Syncing..." : "Sync"}</span>
            </button>

            {/* Secondary actions - hidden on small mobile */}
            <button
              onClick={() => fetchData()}
              disabled={isRefreshing}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 md:px-4 md:py-2.5 rounded-md bg-[#1a1a1a] border border-[#2a2a2a] text-gray-400 hover:text-white hover:bg-[#222222] text-sm font-medium transition-colors disabled:opacity-50"
            >
              <RefreshCw size={16} className={isRefreshing ? "animate-spin" : ""} />
              <span className="hidden md:inline">Refresh</span>
            </button>

            <div className="relative group">
              <button className="inline-flex items-center gap-1.5 px-3 py-2 md:px-4 md:py-2.5 rounded-md bg-[#1a1a1a] border border-[#2a2a2a] text-gray-400 hover:text-white hover:bg-[#222222] text-sm font-medium transition-colors">
                <Download size={16} />
                <span className="hidden md:inline">Export</span>
                <ChevronDown size={14} className="hidden sm:block" />
              </button>
              <div className="absolute right-0 mt-2 w-48 bg-[#1a1a1a] border border-[#2a2a2a] rounded-md shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 overflow-hidden">
                <button
                  onClick={() => handleExport("print")}
                  className="w-full px-4 py-3 text-left text-sm text-gray-300 hover:bg-[#222222] hover:text-white flex items-center gap-3 transition-colors"
                >
                  <Printer size={14} className="text-blue-400" />
                  Print / PDF
                </button>
                <button
                  onClick={() => handleExport("csv-board")}
                  className="w-full px-4 py-3 text-left text-sm text-gray-300 hover:bg-[#222222] hover:text-white flex items-center gap-3 transition-colors"
                >
                  <FileSpreadsheet size={14} className="text-blue-400" />
                  Draft Board CSV
                </button>
                <button
                  onClick={() => handleExport("csv-keepers")}
                  className="w-full px-4 py-3 text-left text-sm text-gray-300 hover:bg-[#222222] hover:text-white flex items-center gap-3 transition-colors"
                >
                  <FileSpreadsheet size={14} className="text-blue-400" />
                  Keepers CSV
                </button>
                <button
                  onClick={() => handleExport("copy")}
                  className="w-full px-4 py-3 text-left text-sm text-gray-300 hover:bg-[#222222] hover:text-white flex items-center gap-3 transition-colors"
                >
                  {copied ? <Check size={14} className="text-blue-400" /> : <Copy size={14} className="text-blue-400" />}
                  {copied ? "Copied!" : "Copy to Clipboard"}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Sync Message */}
        {syncMessage && (
          <div className={`px-4 py-2 rounded-md text-sm font-medium border ${
            syncMessage.includes("failed") || syncMessage.includes("Failed")
              ? "bg-red-500/10 border-red-500/30 text-red-400"
              : "bg-blue-500/10 border-blue-500/30 text-blue-400"
          }`}>
            {syncMessage}
          </div>
        )}

        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard
            icon={<Trophy size={18} />}
            value={data.summary.totalKeepers}
            label="Total Keepers"
            color="blue"
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

      {/* Position Filter */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-gray-500 text-[10px] font-medium uppercase tracking-widest">Filter</span>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setFilterPosition(null)}
            className={`px-3 py-1.5 rounded-md text-[11px] font-medium transition-all border ${
              filterPosition === null
                ? "bg-blue-500/20 text-blue-400 border-blue-500/30"
                : "text-gray-500 hover:text-gray-300 hover:bg-[#222222] border-transparent"
            }`}
          >
            All · {data.summary.totalKeepers}
          </button>
          {(["QB", "RB", "WR", "TE"] as const).map((pos) => (
            <button
              key={pos}
              onClick={() => setFilterPosition(filterPosition === pos ? null : pos)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-medium transition-all border ${
                filterPosition === pos
                  ? "bg-blue-500/20 text-blue-400 border-blue-500/30"
                  : "text-gray-500 hover:text-gray-300 hover:bg-[#222222] border-transparent"
              }`}
            >
              <PositionBadge position={pos} size="xs" variant="minimal" />
              <span>{overallPositions[pos]}</span>
            </button>
          ))}
        </div>
      </div>

      {viewMode === "grid" ? (
        /* Grid View - Desktop: table, Mobile: stacked rounds with horizontal scroll */
        isMobile ? (
          /* Mobile Grid View - Stacked rounds with horizontal scrolling */
          <div className="space-y-4">
            {data.draftBoard.map((row) => (
              <div key={row.round} className="rounded-md border border-[#2a2a2a] bg-[#0d0d0d] overflow-hidden">
                {/* Round Header */}
                <div className="flex items-center gap-3 px-4 py-3 bg-[#1a1a1a] border-b border-[#2a2a2a]">
                  <span className="flex items-center justify-center w-8 h-8 rounded-md bg-[#222222] border border-[#333333] text-blue-400 font-bold text-sm">
                    {row.round}
                  </span>
                  <span className="text-gray-300 text-sm font-medium">Round {row.round}</span>
                  <span className="ml-auto text-gray-500 text-xs">
                    {row.slots.filter(s => s.status === "keeper").length} keepers
                  </span>
                </div>
                {/* Horizontal scrolling picks */}
                <div className="overflow-x-auto">
                  <div className="flex gap-2 p-3" style={{ minWidth: "max-content" }}>
                    {row.slots.map((slot, slotIndex) => {
                      const columnColor = getTeamColor(slotIndex);
                      const keeper = slot.keeper;
                      const shouldShow = !filterPosition || (keeper?.position === filterPosition);
                      const teamName = slot.rosterName || `Team ${slotIndex + 1}`;

                      return (
                        <div key={slot.rosterId} className="flex flex-col gap-1.5" style={{ width: "140px", flexShrink: 0 }}>
                          {/* Team name chip */}
                          <div className={`text-center text-[10px] font-semibold ${columnColor.accent} truncate px-1`}>
                            {teamName}
                          </div>
                          <MobileDraftCell
                            slot={shouldShow ? slot : { ...slot, status: slot.status === "keeper" ? "available" : slot.status, keeper: undefined }}
                            columnColor={columnColor}
                            teamInfoMap={teamInfoMap}
                            teamNameToInfo={teamNameToInfo}
                            onPlayerClick={setSelectedPlayerId}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Desktop Grid View - Traditional table */
          <div className="rounded-md overflow-hidden border border-[#2a2a2a] bg-[#0d0d0d]">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse" style={{ minWidth: `${rosters.length * 145 + 70}px` }}>
                {/* Sticky Header */}
                <thead className="sticky top-0 z-30">
                  <tr className="bg-[#1a1a1a] border-b-2 border-[#333333]">
                    <th className="sticky left-0 z-40 bg-[#1a1a1a] px-3 py-3 text-center w-14 border-r border-[#2a2a2a]">
                      <span className="text-blue-400 text-xs font-bold">RD</span>
                    </th>
                    {rosters.map((roster, index) => {
                      const color = getTeamColor(index);
                      const teamData = data.cascade.find(t => t.rosterId === roster.rosterId);
                      const keeperCount = teamData?.results.length || 0;
                      return (
                        <th key={roster.rosterId} className="px-2 py-3 min-w-[140px] border-r border-[#222222] last:border-r-0">
                          <div className="flex flex-col items-center gap-1">
                            <div className={`w-2 h-2 rounded-full ${color.bg}`} />
                            <span className={`text-xs font-bold ${color.accent} truncate max-w-[110px]`} title={roster.rosterName || undefined}>
                              {roster.rosterName || `Team ${index + 1}`}
                            </span>
                            <span className={`text-[10px] font-medium ${keeperCount > 0 ? "text-blue-400" : "text-gray-600"}`}>
                              {keeperCount} keeper{keeperCount !== 1 ? "s" : ""}
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
                      className={`
                        ${rowIndex % 2 === 0 ? "bg-[#0d0d0d]" : "bg-[#111111]"}
                        hover:bg-[#1a1a1a] transition-colors
                      `}
                    >
                      <td className="sticky left-0 z-20 px-3 py-2 border-r border-[#2a2a2a] bg-inherit">
                        <span className="flex items-center justify-center w-8 h-8 rounded-md bg-[#222222] border border-[#333333] text-blue-400 font-bold text-sm">
                          {row.round}
                        </span>
                      </td>
                      {row.slots.map((slot, slotIndex) => {
                        const columnColor = getTeamColor(slotIndex);
                        const keeper = slot.keeper;
                        const shouldShow = !filterPosition || (keeper?.position === filterPosition);

                        return (
                          <td key={slot.rosterId} className="px-1.5 py-2 border-r border-[#1a1a1a] last:border-r-0">
                            <DraftCell
                              slot={shouldShow ? slot : { ...slot, status: slot.status === "keeper" ? "available" : slot.status, keeper: undefined }}
                              columnColor={columnColor}
                              teamInfoMap={teamInfoMap}
                              teamNameToInfo={teamNameToInfo}
                              onPlayerClick={setSelectedPlayerId}
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
        )
      ) : (
        /* List View - By Team */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {(filteredCascade || data.cascade).map((team, index) => {
            const color = getTeamColor(index);
            return (
              <div key={team.rosterId} className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-md overflow-hidden">
                {/* Team Header */}
                <div className={`${color.bgSolid} px-5 py-4 border-b border-[#333333]`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full ${color.bg}`} />
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
                            className={`flex items-center justify-between rounded-md px-4 py-3 border ${
                              keeper.keeperType === "FRANCHISE"
                                ? "bg-amber-500/10 border-amber-500/30"
                                : "bg-[#222222] border-[#333333]"
                            }`}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              {keeper.keeperType === "FRANCHISE" && (
                                <Star size={14} className="text-amber-400" />
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
                      <Users size={32} className="mx-auto mb-3 text-gray-600" />
                      <p className="text-gray-500 font-medium">No keepers selected</p>
                    </div>
                  )}

                  {/* Traded Picks */}
                  {(team.tradedAwayPicks.length > 0 || team.acquiredPicks.length > 0) && (
                    <div className="mt-4 pt-4 border-t border-[#2a2a2a] space-y-2">
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

      {/* Legend - responsive grid on mobile */}
      <div className="pt-4 border-t border-[#2a2a2a]">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 md:gap-6 text-xs md:text-sm text-gray-400">
          <span className="text-gray-500 text-[10px] md:text-xs uppercase tracking-wide font-medium w-full md:w-auto">Legend:</span>
          <div className="flex items-center gap-1.5 md:gap-2">
            <div className="w-6 h-5 md:w-8 md:h-6 rounded bg-[#222222] border border-[#333333] relative">
              <div className="absolute left-0 top-0 bottom-0 w-0.5 md:w-1 bg-blue-500 rounded-l" />
            </div>
            <span>Keeper</span>
          </div>
          <div className="flex items-center gap-1.5 md:gap-2">
            <div className="w-6 h-5 md:w-8 md:h-6 rounded bg-amber-500/20 border-2 border-amber-400 relative flex items-center justify-center">
              <Star size={10} className="text-amber-400" />
            </div>
            <span>Franchise</span>
          </div>
          <div className="flex items-center gap-1.5 md:gap-2">
            <div className="w-6 h-5 md:w-8 md:h-6 rounded bg-[#1a1a1a] border-2 border-dashed border-gray-500 flex items-center justify-center">
              <ArrowLeftRight size={6} className="md:w-2 md:h-2 text-gray-500" />
            </div>
            <span>Traded</span>
          </div>
          <div className="flex items-center gap-1.5 md:gap-2">
            <div className="w-6 h-5 md:w-8 md:h-6 rounded bg-[#111111] border border-[#2a2a2a]" />
            <span>Open</span>
          </div>
          <div className="flex items-center gap-2 md:gap-3 md:ml-4 md:pl-4 md:border-l md:border-[#2a2a2a] w-full md:w-auto mt-2 md:mt-0 pt-2 md:pt-0 border-t md:border-t-0 border-[#2a2a2a]">
            <span className="text-gray-500 text-[10px] md:text-xs uppercase tracking-wide font-medium">Years:</span>
            <div className="flex items-center gap-1">
              <span className="px-1 md:px-1.5 py-0.5 rounded bg-[#222222] text-gray-300 text-[9px] md:text-[10px] font-bold">Y1</span>
              <span className="px-1 md:px-1.5 py-0.5 rounded bg-yellow-500/30 text-yellow-200 text-[9px] md:text-[10px] font-bold">Y2</span>
              <span className="px-1 md:px-1.5 py-0.5 rounded bg-red-500/30 text-red-200 text-[9px] md:text-[10px] font-bold">Y3+</span>
            </div>
          </div>
        </div>
      </div>

      {/* Keeper History Modal */}
      <KeeperHistoryModal
        playerId={selectedPlayerId || ""}
        isOpen={!!selectedPlayerId}
        onClose={() => setSelectedPlayerId(null)}
      />
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
    emerald: "text-emerald-400",
    amber: "text-amber-400",
    blue: "text-blue-400",
    gray: "text-gray-400",
  };

  return (
    <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-md p-4 hover:border-[#333333] transition-colors">
      <div className="flex items-center gap-3">
        <span className={`flex items-center justify-center w-10 h-10 rounded-md bg-[#222222] border border-[#333333] ${colorClasses[color]}`}>
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
  onPlayerClick?: (playerId: string) => void;
}

// Position accent colors for cards
const POSITION_ACCENTS: Record<string, { border: string }> = {
  QB: { border: "border-l-rose-500" },
  RB: { border: "border-l-emerald-500" },
  WR: { border: "border-l-sky-500" },
  TE: { border: "border-l-amber-500" },
  K: { border: "border-l-violet-500" },
  DEF: { border: "border-l-slate-500" },
};

function DraftCell({ slot, columnColor, teamInfoMap, teamNameToInfo, onPlayerClick }: DraftCellProps) {
  // Traded pick - show who owns this pick now
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
      <div className="h-[88px] rounded-md bg-[#1a1a1a] border-2 border-dashed border-gray-600 flex flex-col items-center justify-center gap-1 relative overflow-hidden">
        <div className={`w-8 h-8 rounded-full ${ownerColor.bgMuted} flex items-center justify-center`}>
          <ArrowLeftRight size={14} className={ownerColor.accent} />
        </div>
        <div className="text-center px-2">
          <span className="text-[9px] text-gray-500 uppercase tracking-wide block">Traded to</span>
          <span className={`${ownerColor.accent} text-[10px] font-semibold truncate block max-w-[100px]`}>
            {ownerName}
          </span>
        </div>
      </div>
    );
  }

  // Keeper cell - clean design
  if (slot.status === "keeper" && slot.keeper) {
    const isFranchise = slot.keeper.keeperType === "FRANCHISE";
    const posAccent = POSITION_ACCENTS[slot.keeper.position || ""] || POSITION_ACCENTS.DEF;
    const yearsKept = slot.keeper.yearsKept || 1;
    const isAcquiredPick = !!slot.acquiredFrom;

    // Get the first name initial and last name for compact display
    const nameParts = slot.keeper.playerName.split(" ");
    const firstName = nameParts[0] || "";
    const lastName = nameParts.slice(1).join(" ") || "";
    const displayName = lastName ? `${firstName.charAt(0)}. ${lastName}` : firstName;

    return (
      <div
        onClick={() => slot.keeper && onPlayerClick?.(slot.keeper.playerId)}
        className={`
          group h-[88px] rounded-md relative overflow-hidden cursor-pointer
          transition-all duration-200
          hover:scale-105 hover:z-20
          ${isFranchise
            ? "bg-amber-500/20 border-2 border-amber-400"
            : isAcquiredPick
              ? "bg-[#1a1a1a] border border-emerald-500/50 hover:border-emerald-400"
              : "bg-[#1a1a1a] border border-[#333333] hover:border-[#444444]"
          }
        `}
      >
        {/* Position stripe */}
        <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${
          isFranchise ? "bg-amber-400" : isAcquiredPick ? "bg-emerald-400" : posAccent.border.replace("border-l-", "bg-")
        }`} />

        {/* Acquired pick indicator */}
        {isAcquiredPick && !isFranchise && (
          <div className="absolute top-1.5 right-1.5 z-10" title={`Acquired from ${slot.acquiredFrom}`}>
            <ArrowLeftRight size={12} className="text-emerald-400" />
          </div>
        )}

        {/* Franchise star badge */}
        {isFranchise && (
          <div className="absolute top-1.5 right-1.5 z-10">
            <Star size={16} className="text-amber-400" />
          </div>
        )}

        {/* Main content - side by side layout */}
        <div className="flex h-full pl-3 pr-2 py-2 gap-2">
          {/* Large Player Avatar */}
          <div className="relative shrink-0 self-center">
            <div className={`rounded-md overflow-hidden ${isFranchise ? "ring-2 ring-amber-400/60" : "ring-1 ring-[#333333]"}`}>
              <PlayerAvatar
                sleeperId={slot.keeper.playerId}
                name={slot.keeper.playerName}
                size="lg"
              />
            </div>
            {/* NFL Team overlay */}
            {slot.keeper.team && (
              <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-[#1a1a1a] ring-2 ring-[#222222] flex items-center justify-center">
                <TeamLogo team={slot.keeper.team} size="xs" />
              </div>
            )}
          </div>

          {/* Info Column */}
          <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
            {/* Top: Position + Year */}
            <div className="flex items-center justify-between gap-1">
              <PositionBadge position={slot.keeper.position} size="xs" variant="filled" />
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                isFranchise
                  ? "bg-amber-400/30 text-amber-100"
                  : yearsKept >= 3
                    ? "bg-red-500/30 text-red-200"
                    : yearsKept === 2
                      ? "bg-yellow-500/30 text-yellow-200"
                      : "bg-[#222222] text-gray-300"
              }`}>
                {isFranchise ? "FT" : `Y${yearsKept}`}
              </span>
            </div>

            {/* Middle: Player Name */}
            <div className="flex-1 flex flex-col justify-center min-w-0">
              <span
                className="text-[13px] font-bold leading-tight truncate text-white"
                title={slot.keeper.playerName}
              >
                {displayName}
              </span>
              {slot.keeper.team && (
                <span className={`text-[10px] font-medium ${isFranchise ? "text-amber-200/70" : "text-gray-400"}`}>
                  {slot.keeper.team}
                </span>
              )}
            </div>

            {/* Bottom: Status indicator */}
            <div className={`text-[8px] font-semibold uppercase tracking-wider ${
              isFranchise ? "text-amber-300" : "text-gray-500"
            }`}>
              {isFranchise ? "Franchise" : "Keeper"}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Empty cell - minimal, but show if acquired via trade
  const isAcquiredEmpty = !!slot.acquiredFrom;
  return (
    <div className={`h-[88px] rounded-md ${
      isAcquiredEmpty
        ? "bg-emerald-900/10 border border-emerald-500/20"
        : "bg-[#111111] border border-[#1a1a1a]"
    } relative`}>
      {isAcquiredEmpty && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
          <ArrowLeftRight size={14} className="text-emerald-500/50" />
          <span className="text-[9px] text-emerald-500/70 text-center px-1">
            via {slot.acquiredFrom?.split(' ')[0]}
          </span>
        </div>
      )}
    </div>
  );
}

// Mobile-optimized draft cell - more compact, touch-friendly
function MobileDraftCell({ slot, columnColor, teamInfoMap, teamNameToInfo, onPlayerClick }: DraftCellProps) {
  // Traded pick
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
      <div className="h-[72px] rounded-md bg-[#1a1a1a] border-2 border-dashed border-gray-600 flex flex-col items-center justify-center gap-0.5">
        <ArrowLeftRight size={14} className={ownerColor.accent} />
        <span className="text-[8px] text-gray-500 uppercase">To</span>
        <span className={`${ownerColor.accent} text-[9px] font-semibold truncate max-w-[90%] text-center`}>
          {ownerName}
        </span>
      </div>
    );
  }

  // Keeper cell - compact mobile design
  if (slot.status === "keeper" && slot.keeper) {
    const isFranchise = slot.keeper.keeperType === "FRANCHISE";
    const posAccent = POSITION_ACCENTS[slot.keeper.position || ""] || POSITION_ACCENTS.DEF;
    const yearsKept = slot.keeper.yearsKept || 1;
    const isAcquiredPick = !!slot.acquiredFrom;

    // Get last name for compact display
    const nameParts = slot.keeper.playerName.split(" ");
    const lastName = nameParts.slice(1).join(" ") || nameParts[0] || "";

    return (
      <div
        onClick={() => slot.keeper && onPlayerClick?.(slot.keeper.playerId)}
        className={`
          h-[72px] rounded-md relative overflow-hidden cursor-pointer active:scale-95 transition-transform
          ${isFranchise
            ? "bg-amber-500/20 border-2 border-amber-400"
            : isAcquiredPick
              ? "bg-[#1a1a1a] border border-emerald-500/50"
              : "bg-[#1a1a1a] border border-[#333333]"
          }
        `}
      >
        {/* Position stripe */}
        <div className={`absolute left-0 top-0 bottom-0 w-1 ${
          isFranchise ? "bg-amber-400" : isAcquiredPick ? "bg-emerald-400" : posAccent.border.replace("border-l-", "bg-")
        }`} />

        {/* Acquired pick indicator */}
        {isAcquiredPick && !isFranchise && (
          <div className="absolute top-1 right-1">
            <ArrowLeftRight size={10} className="text-emerald-400" />
          </div>
        )}

        {/* Franchise star */}
        {isFranchise && (
          <div className="absolute top-1 right-1">
            <Star size={12} className="text-amber-400" />
          </div>
        )}

        {/* Content */}
        <div className="flex items-center h-full pl-2.5 pr-2 gap-2">
          {/* Avatar */}
          <div className="shrink-0">
            <div className={`rounded overflow-hidden ${isFranchise ? "ring-1 ring-amber-400/60" : "ring-1 ring-[#333333]"}`}>
              <PlayerAvatar
                sleeperId={slot.keeper.playerId}
                name={slot.keeper.playerName}
                size="md"
              />
            </div>
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0 flex flex-col justify-center gap-0.5">
            <div className="flex items-center gap-1">
              <PositionBadge position={slot.keeper.position} size="xs" variant="minimal" />
              <span className={`text-[9px] font-bold px-1 py-0.5 rounded ${
                isFranchise ? "bg-amber-400/30 text-amber-100" :
                yearsKept >= 3 ? "bg-red-500/30 text-red-200" :
                yearsKept === 2 ? "bg-yellow-500/30 text-yellow-200" :
                "bg-[#222222] text-gray-300"
              }`}>
                {isFranchise ? "FT" : `Y${yearsKept}`}
              </span>
            </div>
            <span className="text-[11px] font-bold text-white truncate leading-tight">
              {lastName}
            </span>
            {slot.keeper.team && (
              <span className="text-[9px] text-gray-400">{slot.keeper.team}</span>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Empty cell - show if acquired via trade
  const isAcquiredEmpty = !!slot.acquiredFrom;
  return (
    <div className={`h-[72px] rounded-md ${
      isAcquiredEmpty
        ? "bg-emerald-900/10 border border-emerald-500/20"
        : "bg-[#111111] border border-[#1a1a1a]"
    } relative`}>
      {isAcquiredEmpty && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5">
          <ArrowLeftRight size={12} className="text-emerald-500/50" />
          <span className="text-[8px] text-emerald-500/70">
            via {slot.acquiredFrom?.split(' ')[0]}
          </span>
        </div>
      )}
    </div>
  );
}
