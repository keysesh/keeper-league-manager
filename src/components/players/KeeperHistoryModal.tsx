"use client";

import { useState, useEffect } from "react";
import { PlayerAvatar } from "./PlayerAvatar";
import { PositionBadge } from "@/components/ui/PositionBadge";

interface Player {
  id: string;
  sleeperId: string;
  fullName: string;
  position?: string | null;
  team?: string | null;
  age?: number | null;
  yearsExp?: number | null;
}

interface TimelineEvent {
  season: number;
  event: "DRAFTED" | "KEPT_REGULAR" | "KEPT_FRANCHISE" | "NOT_KEPT";
  teamName: string;
  sleeperId: string | null;
  leagueName: string;
  leagueId: string;
  details?: {
    round?: number;
    pick?: number;
    cost?: number;
  };
}

interface KeeperHistoryData {
  player: Player;
  timeline: TimelineEvent[];
  seasons: number[];
  summary: {
    totalTimesKept: number;
    totalTimesDrafted: number;
    franchiseTags: number;
    regularKeeps: number;
  };
}

interface KeeperHistoryModalProps {
  playerId: string;
  isOpen: boolean;
  onClose: () => void;
}

const eventStyles = {
  DRAFTED: {
    bg: "bg-blue-500/20",
    border: "border-blue-500/50",
    text: "text-blue-300",
    icon: "D",
    label: "Drafted",
  },
  KEPT_REGULAR: {
    bg: "bg-amber-500/20",
    border: "border-amber-500/50",
    text: "text-amber-300",
    icon: "K",
    label: "Kept",
  },
  KEPT_FRANCHISE: {
    bg: "bg-gradient-to-r from-amber-400/20 to-amber-600/20",
    border: "border-amber-400/60",
    text: "text-amber-200",
    icon: "FT",
    label: "Franchise",
  },
  NOT_KEPT: {
    bg: "bg-gray-700/30",
    border: "border-gray-600/30",
    text: "text-gray-500",
    icon: "—",
    label: "Not Kept",
  },
};

export function KeeperHistoryModal({
  playerId,
  isOpen,
  onClose,
}: KeeperHistoryModalProps) {
  const [data, setData] = useState<KeeperHistoryData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && playerId) {
      setLoading(true);
      setError(null);
      fetch(`/api/players/${playerId}/keeper-history`)
        .then((res) => {
          if (!res.ok) throw new Error("Failed to fetch");
          return res.json();
        })
        .then((data) => setData(data))
        .catch((err) => setError(err.message))
        .finally(() => setLoading(false));
    }
  }, [isOpen, playerId]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      {/* Modal */}
      <div
        className="relative bg-gray-900 border border-gray-700 rounded-xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <h2 className="text-lg font-bold text-white">Keeper History</h2>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto max-h-[calc(80vh-120px)]">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500" />
            </div>
          )}

          {error && (
            <div className="text-center py-8 text-red-400">
              Failed to load keeper history
            </div>
          )}

          {data && (
            <>
              {/* Player Info */}
              <div className="flex items-center gap-4 mb-6 pb-4 border-b border-gray-800">
                <PlayerAvatar
                  sleeperId={data.player.sleeperId}
                  name={data.player.fullName}
                  size="lg"
                />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xl font-bold text-white">
                      {data.player.fullName}
                    </span>
                    <PositionBadge position={data.player.position} size="sm" />
                  </div>
                  <div className="text-sm text-gray-400 mt-1">
                    {data.player.team || "Free Agent"} • {data.player.age || "?"} yrs
                  </div>
                </div>
              </div>

              {/* Summary Stats */}
              <div className="grid grid-cols-4 gap-3 mb-6">
                <div className="bg-gray-800/50 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-white">
                    {data.summary.totalTimesDrafted}
                  </div>
                  <div className="text-[10px] text-gray-500 uppercase tracking-wide">
                    Times Drafted
                  </div>
                </div>
                <div className="bg-gray-800/50 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-amber-400">
                    {data.summary.totalTimesKept}
                  </div>
                  <div className="text-[10px] text-gray-500 uppercase tracking-wide">
                    Times Kept
                  </div>
                </div>
                <div className="bg-gray-800/50 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-amber-300">
                    {data.summary.regularKeeps}
                  </div>
                  <div className="text-[10px] text-gray-500 uppercase tracking-wide">
                    Regular
                  </div>
                </div>
                <div className="bg-gray-800/50 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-amber-200">
                    {data.summary.franchiseTags}
                  </div>
                  <div className="text-[10px] text-gray-500 uppercase tracking-wide">
                    Franchise
                  </div>
                </div>
              </div>

              {/* Timeline */}
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-gray-400 mb-3">
                  Timeline
                </h3>

                {data.seasons.length === 0 ? (
                  <div className="text-center py-6 text-gray-500">
                    No keeper history found
                  </div>
                ) : (
                  <div className="relative">
                    {/* Vertical line */}
                    <div className="absolute left-[19px] top-0 bottom-0 w-px bg-gray-700" />

                    {/* Events */}
                    <div className="space-y-3">
                      {data.timeline.map((event, index) => {
                        const style = eventStyles[event.event];
                        return (
                          <div key={index} className="relative flex items-start gap-4 pl-2">
                            {/* Timeline node */}
                            <div
                              className={`relative z-10 w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold border-2 ${style.bg} ${style.border} ${style.text}`}
                            >
                              {style.icon}
                            </div>

                            {/* Event content */}
                            <div className="flex-1 min-w-0 pt-1">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-semibold text-white">
                                  {event.season}
                                </span>
                                <span className={`text-xs ${style.text}`}>
                                  {style.label}
                                </span>
                              </div>
                              <div className="text-xs text-gray-400 mt-0.5">
                                {event.teamName}
                                {event.details?.round && (
                                  <span className="text-gray-500">
                                    {" "}• R{event.details.round}
                                    {event.details.pick && `.${event.details.pick}`}
                                  </span>
                                )}
                                {event.details?.cost && (
                                  <span className="text-amber-400">
                                    {" "}• Cost: R{event.details.cost}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
