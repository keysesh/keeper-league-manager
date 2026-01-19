"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { PositionBadge } from "@/components/ui/PositionBadge";
import { Skeleton } from "@/components/ui/Skeleton";
import { BackLink } from "@/components/ui/BackLink";
import { SeasonComparison } from "@/components/history/SeasonComparison";
import { ChampionshipHistory } from "@/components/ui/ChampionshipHistory";
import { HeadToHead } from "@/components/ui/HeadToHead";
import { ArrowRightLeft, List, TrendingUp, Trophy, Swords } from "lucide-react";

interface KeeperHistory {
  id: string;
  season: number;
  type: string;
  baseCost: number;
  finalCost: number;
  yearsKept: number;
  player: {
    id: string;
    fullName: string;
    position: string | null;
    team: string | null;
  };
  roster: {
    id: string;
    teamName: string | null;
  };
}

interface SeasonStats {
  season: number;
  totalKeepers: number;
  franchiseTags: number;
  regularKeepers: number;
  avgCost: number;
  mostKeptPosition: string;
}

export default function HistoryPage() {
  const params = useParams();
  const leagueId = params.leagueId as string;

  const [history, setHistory] = useState<KeeperHistory[]>([]);
  const [stats, setStats] = useState<SeasonStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [viewMode, setViewMode] = useState<"list" | "comparison">("list");

  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch(`/api/leagues/${leagueId}/history`);
      if (!res.ok) throw new Error("Failed to fetch keeper history");
      const data = await res.json();

      setHistory(data.keepers || []);
      setStats(data.seasonStats || []);
    } catch {
      setError("Failed to load keeper history");
    } finally {
      setLoading(false);
    }
  }, [leagueId]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const seasons = [...new Set(history.map((k) => k.season))].sort(
    (a, b) => b - a
  );

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto space-y-8">
        <div>
          <Skeleton className="h-4 w-24 mb-2" />
          <Skeleton className="h-10 w-64 mb-2" />
          <Skeleton className="h-5 w-48" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="card-premium rounded-2xl p-6">
              <Skeleton className="h-8 w-16 mb-4" />
              <Skeleton className="h-4 w-24 mb-3" />
              <div className="space-y-2">
                {[1, 2, 3, 4, 5].map((j) => (
                  <Skeleton key={j} className="h-4 w-full" />
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

  return (
    <div className="max-w-7xl mx-auto space-y-8 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <BackLink href={`/league/${leagueId}`} label="Back to League" />
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500/20 to-amber-600/10 ring-1 ring-amber-500/20 flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-amber-400" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">Keeper History</h1>
              <p className="text-gray-500 mt-0.5">View historical keeper data and trends</p>
            </div>
          </div>
        </div>
        <div className="flex bg-gray-800/50 rounded-xl p-1">
          <button
            onClick={() => setViewMode("list")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              viewMode === "list"
                ? "bg-purple-500 text-white"
                : "text-gray-400 hover:text-white"
            }`}
          >
            <List className="w-4 h-4" />
            List View
          </button>
          <button
            onClick={() => setViewMode("comparison")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              viewMode === "comparison"
                ? "bg-purple-500 text-white"
                : "text-gray-400 hover:text-white"
            }`}
          >
            <ArrowRightLeft className="w-4 h-4" />
            Compare
          </button>
        </div>
      </div>

      {/* Comparison View */}
      {viewMode === "comparison" && (
        <SeasonComparison keepers={history} seasons={seasons} />
      )}

      {/* List View */}
      {viewMode === "list" && (
        <>
          {/* Championship History & Head-to-Head */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-yellow-500/20 to-yellow-600/10 ring-1 ring-yellow-500/20 flex items-center justify-center">
                  <Trophy className="w-5 h-5 text-yellow-400" />
                </div>
                <h2 className="text-lg font-bold text-white">Championship History</h2>
              </div>
              <ChampionshipHistory leagueId={leagueId} compact={false} />
            </div>

            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500/20 to-orange-600/10 ring-1 ring-orange-500/20 flex items-center justify-center">
                  <Swords className="w-5 h-5 text-orange-400" />
                </div>
                <h2 className="text-lg font-bold text-white">Head-to-Head Records</h2>
              </div>
              <HeadToHead leagueId={leagueId} />
            </div>
          </div>

          {/* Season Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {stats.map((s) => (
          <div
            key={s.season}
            className="card-premium rounded-2xl p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-white">{s.season}</h3>
              <span className="text-xs px-2 py-1 rounded-full bg-purple-500/20 text-purple-400 font-semibold">
                Season
              </span>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-500 text-sm">Total Keepers</span>
                <span className="text-white font-bold text-lg">{s.totalKeepers}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500 text-sm">Franchise Tags</span>
                <span className="badge-franchise">{s.franchiseTags}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500 text-sm">Regular Keepers</span>
                <span className="badge-keeper">{s.regularKeepers}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500 text-sm">Avg Cost</span>
                <span className="text-white font-semibold">Rd {s.avgCost}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500 text-sm">Top Position</span>
                <PositionBadge position={s.mostKeptPosition} size="sm" />
              </div>
            </div>
          </div>
        ))}
      </div>

        </>
      )}
    </div>
  );
}
