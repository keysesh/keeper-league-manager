"use client";

import { useState, useEffect, useCallback } from "react";
import { TrendingUp, TrendingDown, RefreshCw } from "lucide-react";
import { PositionBadge } from "./PositionBadge";

interface TrendingPlayer {
  sleeperId: string;
  count: number;
  fullName: string;
  position: string;
  team: string | null;
  fantasyPointsPpr: number | null;
  pointsPerGame: number | null;
  gamesPlayed: number | null;
}

interface TrendingPlayersProps {
  type?: "add" | "drop" | "both";
  limit?: number;
  hours?: number;
  className?: string;
}

export function TrendingPlayers({
  type = "both",
  limit = 10,
  hours = 24,
  className = "",
}: TrendingPlayersProps) {
  const [activeTab, setActiveTab] = useState<"add" | "drop">("add");
  const [adds, setAdds] = useState<TrendingPlayer[]>([]);
  const [drops, setDrops] = useState<TrendingPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchTrending = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const fetchType = async (t: "add" | "drop") => {
        const res = await fetch(
          `/api/players/trending?type=${t}&limit=${limit}&hours=${hours}`
        );
        if (!res.ok) throw new Error(`Failed to fetch trending ${t}s`);
        const data = await res.json();
        return data.players as TrendingPlayer[];
      };

      if (type === "both" || type === "add") {
        const addData = await fetchType("add");
        setAdds(addData);
      }

      if (type === "both" || type === "drop") {
        const dropData = await fetchType("drop");
        setDrops(dropData);
      }

      setLastUpdated(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch trending players");
    } finally {
      setLoading(false);
    }
  }, [type, limit, hours]);

  useEffect(() => {
    fetchTrending();
    // Refresh every 5 minutes
    const interval = setInterval(fetchTrending, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchTrending]);

  const displayedPlayers = activeTab === "add" ? adds : drops;

  return (
    <div
      className={`
        relative overflow-hidden rounded-2xl
        bg-gradient-to-br from-zinc-800/60 via-zinc-900/40 to-[#13111a]
        border border-white/[0.06]
        backdrop-blur-xl
        shadow-[0_0_30px_-5px_rgba(113,113,122,0.15)]
        ${className}
      `}
    >
      {/* Glass overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-white/[0.02] pointer-events-none" />

      {/* Header */}
      <div className="relative z-10 px-4 pt-4 pb-3 border-b border-white/[0.06]">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-zinc-300">
            Trending Players
          </h3>
          <button
            onClick={fetchTrending}
            disabled={loading}
            className="p-1.5 rounded-lg bg-zinc-700/30 hover:bg-zinc-700/50 transition-colors disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw
              size={14}
              className={`text-zinc-400 ${loading ? "animate-spin" : ""}`}
            />
          </button>
        </div>

        {/* Tabs */}
        {type === "both" && (
          <div className="flex gap-1 p-1 bg-zinc-900/50 rounded-lg">
            <button
              onClick={() => setActiveTab("add")}
              className={`
                flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all
                ${activeTab === "add"
                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                  : "text-zinc-500 hover:text-zinc-400"
                }
              `}
            >
              <TrendingUp size={12} />
              Adds
            </button>
            <button
              onClick={() => setActiveTab("drop")}
              className={`
                flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all
                ${activeTab === "drop"
                  ? "bg-red-500/20 text-red-400 border border-red-500/30"
                  : "text-zinc-500 hover:text-zinc-400"
                }
              `}
            >
              <TrendingDown size={12} />
              Drops
            </button>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="relative z-10 px-2 py-2">
        {loading && displayedPlayers.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <RefreshCw size={20} className="text-zinc-500 animate-spin" />
          </div>
        ) : error ? (
          <div className="text-center py-6 text-red-400 text-sm">{error}</div>
        ) : displayedPlayers.length === 0 ? (
          <div className="text-center py-6 text-zinc-500 text-sm">
            No trending players found
          </div>
        ) : (
          <div className="space-y-0.5">
            {displayedPlayers.map((player, index) => (
              <TrendingPlayerRow
                key={player.sleeperId}
                player={player}
                rank={index + 1}
                type={activeTab}
              />
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      {lastUpdated && (
        <div className="relative z-10 px-4 py-2 border-t border-white/[0.06]">
          <p className="text-[10px] text-zinc-600 text-center">
            Last {hours}h on Sleeper • Updated {formatTimeAgo(lastUpdated)}
          </p>
        </div>
      )}
    </div>
  );
}

function TrendingPlayerRow({
  player,
  rank,
  type,
}: {
  player: TrendingPlayer;
  rank: number;
  type: "add" | "drop";
}) {
  const isAdd = type === "add";

  return (
    <div
      className={`
        flex items-center gap-3 px-2 py-2 rounded-lg
        hover:bg-white/[0.03] transition-colors group
      `}
    >
      {/* Rank */}
      <div
        className={`
          w-6 h-6 flex items-center justify-center rounded-md text-xs font-bold
          ${isAdd ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"}
        `}
      >
        {rank}
      </div>

      {/* Position */}
      <PositionBadge position={player.position} size="xs" />

      {/* Player Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-zinc-200 truncate">
          {player.fullName}
        </p>
        <p className="text-[10px] text-zinc-500">
          {player.team || "FA"} • {player.pointsPerGame?.toFixed(1) || "—"} PPG
        </p>
      </div>

      {/* Count */}
      <div className="text-right">
        <p
          className={`
            text-sm font-semibold
            ${isAdd ? "text-emerald-400" : "text-red-400"}
          `}
        >
          {formatCount(player.count)}
        </p>
        <p className="text-[10px] text-zinc-600">
          {isAdd ? "adds" : "drops"}
        </p>
      </div>
    </div>
  );
}

function formatCount(count: number): string {
  if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
  if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
  return count.toString();
}

function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  return `${Math.floor(diffMins / 60)}h ago`;
}
