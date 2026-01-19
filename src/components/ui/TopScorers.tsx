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
  condensed?: boolean;
}

const positions = ["QB", "RB", "WR", "TE"] as const;
type Position = (typeof positions)[number];

export function TopScorers({ className = "", condensed = false }: TopScorersProps) {
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

  const allPlayers = scorers[activePosition] || [];
  const displayedPlayers = condensed ? allPlayers.slice(0, 5) : allPlayers;

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
      <div className="p-4 sm:p-5 border-b border-white/[0.04]">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Trophy className="w-5 h-5 text-amber-400" />
            <h3 className="text-base font-semibold text-white">Top Scorers</h3>
            <span className="text-sm text-gray-500">PPG Leaders</span>
          </div>
          <button
            onClick={fetchTopScorers}
            disabled={loading}
            className="p-2 rounded-lg hover:bg-white/5 transition-colors disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 text-gray-400 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>

        {/* Position Tabs */}
        <div className="flex gap-2">
          {positions.map((pos) => (
            <button
              key={pos}
              onClick={() => setActivePosition(pos)}
              className={`
                flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all
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
      <div className="p-4">
        {loading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-3 animate-pulse">
                <div className="w-7 h-7 rounded-full bg-gray-700" />
                <div className="w-10 h-10 rounded-full bg-gray-700" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-700 rounded w-28" />
                  <div className="h-3 bg-gray-700 rounded w-20" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="text-center py-8">
            <p className="text-red-400 text-base">{error}</p>
            <button
              onClick={fetchTopScorers}
              className="mt-3 text-sm text-blue-400 hover:underline"
            >
              Try again
            </button>
          </div>
        ) : displayedPlayers.length === 0 ? (
          <div className="text-center py-8 text-gray-400 text-base">
            No data available
          </div>
        ) : (
          <div className="space-y-2">
            {displayedPlayers.slice(0, condensed ? 5 : 8).map((player) => (
              <div
                key={player.id}
                className={`flex items-center gap-3 ${condensed ? "p-2" : "p-3"} rounded-lg hover:bg-white/5 transition-colors ${condensed ? "min-h-[48px]" : "min-h-[56px]"}`}
              >
                {/* Rank */}
                <div
                  className={`
                    w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold
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
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-white truncate">
                      {player.fullName}
                    </span>
                    {player.yearsExp === 0 && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400">
                        R
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-500">
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
                  <div className="text-base font-bold text-emerald-400">
                    {player.pointsPerGame?.toFixed(1)}
                  </div>
                  <div className="text-sm text-gray-500">PPG</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer - hide in condensed */}
      {!condensed && (
        <div className="px-4 py-3 border-t border-white/[0.04]">
          <div className="flex items-center justify-between text-sm text-gray-500">
            <span>Last Season Stats (Min 6 games)</span>
            <div className="flex items-center gap-1">
              <TrendingUp className="w-4 h-4" />
              <span>Half PPR</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
