"use client";

import { useState, useEffect, useCallback } from "react";
import { Trophy, TrendingUp, RefreshCw } from "lucide-react";
import { PlayerAvatar } from "@/components/players/PlayerAvatar";

interface TopScorer {
  id: string;
  sleeperId: string;
  fullName: string;
  position: string | null;
  team: string | null;
  age: number | null;
  yearsExp: number | null;
  fantasyPointsPpr: number | null;
  pointsPerGame: number | null;
  gamesPlayed: number | null;
  rank: number;
}

interface TopScorersProps {
  className?: string;
}

const positions = ["QB", "RB", "WR", "TE"] as const;
type Position = (typeof positions)[number];

export function TopScorers({ className = "" }: TopScorersProps) {
  const [activePosition, setActivePosition] = useState<Position>("RB");
  const [scorers, setScorers] = useState<Record<string, TopScorer[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTopScorers = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/players/top-scorers?position=all&limit=10&minGames=6&sortBy=ppg");
      if (!res.ok) throw new Error("Failed to fetch top scorers");
      const data = await res.json();
      setScorers(data.byPosition || {});
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch top scorers");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTopScorers();
  }, [fetchTopScorers]);

  const displayedPlayers = scorers[activePosition] || [];

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
      {/* Header */}
      <div className="p-4 border-b border-white/[0.04]">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Trophy className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-semibold text-white">Top Scorers</h3>
            <span className="text-[10px] text-gray-500">PPG Leaders</span>
          </div>
          <button
            onClick={fetchTopScorers}
            disabled={loading}
            className="p-1.5 rounded-lg hover:bg-white/5 transition-colors disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-gray-400 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>

        {/* Position Tabs */}
        <div className="flex gap-1">
          {positions.map((pos) => (
            <button
              key={pos}
              onClick={() => setActivePosition(pos)}
              className={`
                flex-1 py-1.5 px-2 rounded-lg text-xs font-medium transition-all
                ${
                  activePosition === pos
                    ? "bg-white/10 text-white"
                    : "text-gray-400 hover:text-gray-300 hover:bg-white/5"
                }
              `}
            >
              {pos}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="p-3">
        {loading ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-2 animate-pulse">
                <div className="w-5 h-5 rounded-full bg-gray-700" />
                <div className="w-8 h-8 rounded-full bg-gray-700" />
                <div className="flex-1 space-y-1">
                  <div className="h-3 bg-gray-700 rounded w-24" />
                  <div className="h-2 bg-gray-700 rounded w-16" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="text-center py-6">
            <p className="text-red-400 text-sm">{error}</p>
            <button
              onClick={fetchTopScorers}
              className="mt-2 text-xs text-blue-400 hover:underline"
            >
              Try again
            </button>
          </div>
        ) : displayedPlayers.length === 0 ? (
          <div className="text-center py-6 text-gray-400 text-sm">
            No data available
          </div>
        ) : (
          <div className="space-y-1">
            {displayedPlayers.slice(0, 8).map((player) => (
              <div
                key={player.id}
                className="flex items-center gap-2 p-2 rounded-lg hover:bg-white/5 transition-colors"
              >
                {/* Rank */}
                <div
                  className={`
                    w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold
                    ${
                      player.rank === 1
                        ? "bg-amber-400/20 text-amber-400"
                        : player.rank === 2
                        ? "bg-gray-400/20 text-gray-300"
                        : player.rank === 3
                        ? "bg-orange-400/20 text-orange-400"
                        : "bg-gray-700/50 text-gray-400"
                    }
                  `}
                >
                  {player.rank}
                </div>

                {/* Avatar */}
                <PlayerAvatar sleeperId={player.sleeperId} name={player.fullName} size="sm" />

                {/* Player Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-medium text-white truncate">
                      {player.fullName}
                    </span>
                    {player.yearsExp === 0 && (
                      <span className="text-[8px] px-1 py-0.5 rounded bg-purple-500/20 text-purple-400">
                        R
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-gray-500">
                    <span>{player.team || "FA"}</span>
                    <span>·</span>
                    <span>{player.gamesPlayed}G</span>
                    {player.age && (
                      <>
                        <span>·</span>
                        <span>{player.age}yo</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Stats */}
                <div className="text-right">
                  <div className="text-sm font-bold text-emerald-400">
                    {player.pointsPerGame?.toFixed(1)}
                  </div>
                  <div className="text-[9px] text-gray-500">PPG</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t border-white/[0.04]">
        <div className="flex items-center justify-between text-[10px] text-gray-500">
          <span>Last Season Stats (Min 6 games)</span>
          <div className="flex items-center gap-1">
            <TrendingUp className="w-3 h-3" />
            <span>Half PPR</span>
          </div>
        </div>
      </div>
    </div>
  );
}
