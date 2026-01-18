"use client";

import { useState, useEffect } from "react";
import { PlayerAvatar } from "./PlayerAvatar";
import { PositionBadge } from "@/components/ui/PositionBadge";
import { AgeBadge } from "@/components/ui/AgeBadge";

interface PlayerMetadata {
  nflverse?: {
    headshotUrl?: string;
    pfrId?: string;
    espnId?: string;
    ranking?: {
      ecr?: number;
      positionRank?: number;
      rankingDate?: string;
    };
    depthChart?: {
      depthPosition?: number;
      formation?: string;
    };
    injury?: {
      status?: string;
      primaryInjury?: string;
      secondaryInjury?: string;
      practiceStatus?: string;
    };
  };
  rookie_year?: string;
  college?: string;
  height?: string;
  weight?: string;
}

interface Player {
  id: string;
  sleeperId: string;
  fullName: string;
  firstName?: string | null;
  lastName?: string | null;
  position?: string | null;
  team?: string | null;
  age?: number | null;
  yearsExp?: number | null;
  status?: string | null;
  injuryStatus?: string | null;
  fantasyPointsPpr?: number | null;
  gamesPlayed?: number | null;
  pointsPerGame?: number | null;
  metadata?: PlayerMetadata | null;
}

interface TimelineEvent {
  season: number;
  date?: string;
  event: "DRAFTED" | "KEPT_REGULAR" | "KEPT_FRANCHISE" | "TRADED" | "WAIVER" | "FREE_AGENT" | "DROPPED" | "NOT_KEPT";
  teamName: string;
  sleeperId: string | null;
  leagueName: string;
  leagueId: string;
  details?: {
    round?: number;
    pick?: number;
    cost?: number;
    fromTeam?: string;
    toTeam?: string;
  };
}

interface KeeperHistoryData {
  player: Player;
  timeline: TimelineEvent[];
  seasons: number[];
  summary: {
    totalTimesDrafted: number;
    totalTimesKept: number;
    franchiseTags: number;
    regularKeeps: number;
    trades: number;
    waiverPickups: number;
    faPickups: number;
    drops: number;
  };
}

interface KeeperHistoryModalProps {
  playerId: string;
  isOpen: boolean;
  onClose: () => void;
}

const eventConfig: Record<string, {
  color: string;
  bgColor: string;
  icon: React.ReactNode;
  label: string;
}> = {
  DRAFTED: {
    color: "text-blue-400",
    bgColor: "bg-blue-500/10",
    icon: <DraftIcon />,
    label: "Drafted",
  },
  KEPT_REGULAR: {
    color: "text-amber-400",
    bgColor: "bg-amber-500/10",
    icon: <KeeperIcon />,
    label: "Kept",
  },
  KEPT_FRANCHISE: {
    color: "text-yellow-300",
    bgColor: "bg-yellow-500/10",
    icon: <FranchiseIcon />,
    label: "Franchise Tag",
  },
  TRADED: {
    color: "text-purple-400",
    bgColor: "bg-purple-500/10",
    icon: <TradeIcon />,
    label: "Traded",
  },
  WAIVER: {
    color: "text-emerald-400",
    bgColor: "bg-emerald-500/10",
    icon: <WaiverIcon />,
    label: "Waiver Claim",
  },
  FREE_AGENT: {
    color: "text-amber-400",
    bgColor: "bg-amber-500/10",
    icon: <FAIcon />,
    label: "Free Agent",
  },
  DROPPED: {
    color: "text-red-400",
    bgColor: "bg-red-500/10",
    icon: <DropIcon />,
    label: "Dropped",
  },
  NOT_KEPT: {
    color: "text-gray-400",
    bgColor: "bg-gray-500/10",
    icon: <NotKeptIcon />,
    label: "Not Kept",
  },
};

function DraftIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
}

function KeeperIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
    </svg>
  );
}

function FranchiseIcon() {
  return (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  );
}

function TradeIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
    </svg>
  );
}

function WaiverIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function FAIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
    </svg>
  );
}

function DropIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  );
}

function NotKeptIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function StatPill({ label, value, color = "text-gray-300" }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="flex flex-col items-center px-3 py-1.5 bg-gray-800/50 rounded-lg">
      <span className={`text-sm font-semibold ${color}`}>{value}</span>
      <span className="text-[10px] text-gray-500 uppercase">{label}</span>
    </div>
  );
}

export function KeeperHistoryModal({
  playerId,
  isOpen,
  onClose,
}: KeeperHistoryModalProps) {
  const [data, setData] = useState<KeeperHistoryData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Data fetching effect - setState calls here are intentional for loading/error states
  /* eslint-disable react-hooks/set-state-in-effect */
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
  /* eslint-enable react-hooks/set-state-in-effect */

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />

      <div
        className="relative bg-gray-900 border border-gray-700/50 rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800/50">
          <h2 className="text-base font-semibold text-white">Player History</h2>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-all"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto max-h-[calc(90vh-60px)]">
          {loading && (
            <div className="flex items-center justify-center py-16">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-amber-500 border-t-transparent" />
            </div>
          )}

          {error && (
            <div className="text-center py-12 text-red-400">
              Failed to load player history
            </div>
          )}

          {data && (
            <>
              {/* Player Card */}
              <div className="px-5 py-4 bg-gradient-to-b from-gray-800/30 to-transparent">
                <div className="flex gap-4">
                  <PlayerAvatar
                    sleeperId={data.player.sleeperId}
                    name={data.player.fullName}
                    size="xl"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-lg font-bold text-white truncate">
                        {data.player.fullName}
                      </h3>
                      <PositionBadge position={data.player.position} size="sm" />
                      {data.player.metadata?.nflverse?.ranking?.positionRank && (
                        <span className="text-xs font-bold text-purple-400">
                          #{data.player.metadata.nflverse.ranking.positionRank}
                        </span>
                      )}
                      {data.player.metadata?.nflverse?.depthChart?.depthPosition === 1 && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400">
                          STARTER
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-400 mb-3 flex-wrap">
                      <span className="font-medium">{data.player.team || "FA"}</span>
                      {(data.player.age !== null && data.player.age !== undefined) && (
                        <>
                          <span className="text-gray-600">•</span>
                          <AgeBadge
                            age={data.player.age}
                            yearsExp={data.player.yearsExp ?? null}
                            position={data.player.position ?? null}
                            size="sm"
                          />
                        </>
                      )}
                      {(data.player.metadata?.nflverse?.injury?.status || data.player.injuryStatus) && (
                        <>
                          <span className="text-gray-600">•</span>
                          <span className="text-red-400">
                            {data.player.metadata?.nflverse?.injury?.status || data.player.injuryStatus}
                            {data.player.metadata?.nflverse?.injury?.primaryInjury && (
                              <span className="text-gray-500 ml-1">
                                ({data.player.metadata.nflverse.injury.primaryInjury})
                              </span>
                            )}
                          </span>
                        </>
                      )}
                    </div>

                    {/* Stats Row */}
                    <div className="flex gap-2 flex-wrap">
                      {data.player.metadata?.nflverse?.ranking?.ecr && (
                        <StatPill
                          label="ECR"
                          value={`#${Math.round(data.player.metadata.nflverse.ranking.ecr)}`}
                          color="text-purple-400"
                        />
                      )}
                      {data.player.fantasyPointsPpr !== null && data.player.fantasyPointsPpr !== undefined && (
                        <StatPill
                          label="PPR Pts"
                          value={data.player.fantasyPointsPpr.toFixed(1)}
                          color="text-emerald-400"
                        />
                      )}
                      {data.player.gamesPlayed !== null && data.player.gamesPlayed !== undefined && (
                        <StatPill label="Games" value={data.player.gamesPlayed} />
                      )}
                      {data.player.pointsPerGame !== null && data.player.pointsPerGame !== undefined && (
                        <StatPill
                          label="PPG"
                          value={data.player.pointsPerGame.toFixed(1)}
                          color="text-blue-400"
                        />
                      )}
                      {data.player.metadata?.rookie_year && (
                        <StatPill label="Rookie" value={data.player.metadata.rookie_year} />
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Quick Stats Bar */}
              <div className="grid grid-cols-4 gap-px bg-gray-800/30 mx-5 rounded-lg overflow-hidden mb-4">
                <QuickStat value={data.summary.totalTimesDrafted} label="Drafted" color="blue" />
                <QuickStat value={data.summary.totalTimesKept} label="Kept" color="amber" />
                <QuickStat value={data.summary.trades} label="Traded" color="purple" />
                <QuickStat value={data.summary.waiverPickups + data.summary.faPickups} label="Pickups" color="emerald" />
              </div>

              {/* Timeline - grouped by league */}
              <div className="px-5 pb-5">
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                  Transaction History
                </h4>

                {data.timeline.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 text-sm">
                    No transaction history found
                  </div>
                ) : (
                  <div className="space-y-4">
                    {Object.entries(groupByLeague(data.timeline))
                      .map(([leagueName, leagueEvents]) => (
                        <LeagueGroup key={leagueName} leagueName={leagueName} events={leagueEvents} />
                      ))}
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

function QuickStat({ value, label, color }: { value: number; label: string; color: string }) {
  const colorClasses: Record<string, string> = {
    blue: "text-blue-400",
    amber: "text-amber-400",
    purple: "text-purple-400",
    emerald: "text-emerald-400",
  };

  return (
    <div className="bg-gray-900/50 py-2.5 text-center">
      <div className={`text-lg font-bold ${colorClasses[color]}`}>{value}</div>
      <div className="text-[10px] text-gray-500 uppercase tracking-wide">{label}</div>
    </div>
  );
}

function SeasonGroup({ season, events }: { season: string; events: TimelineEvent[] }) {
  return (
    <div>
      <div className="px-3 py-1.5 bg-gray-800/30">
        <span className="text-xs font-semibold text-gray-400">{season}</span>
      </div>
      <div className="divide-y divide-gray-800/30">
        {events.map((event, idx) => (
          <TimelineEventRow key={idx} event={event} />
        ))}
      </div>
    </div>
  );
}

function TimelineEventRow({ event }: { event: TimelineEvent }) {
  const config = eventConfig[event.event] || eventConfig.DRAFTED;

  return (
    <div className="flex items-center gap-3 px-3 py-2.5 hover:bg-gray-700/20 transition-colors">
      {/* Icon */}
      <div className={`flex-shrink-0 w-8 h-8 rounded-lg ${config.bgColor} ${config.color} flex items-center justify-center`}>
        {config.icon}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={`text-sm font-medium ${config.color}`}>
            {config.label}
          </span>
          {event.date && (
            <span className="text-xs text-gray-500">
              {formatDate(event.date)}
            </span>
          )}
        </div>
        <div className="text-xs text-gray-400 truncate">
          {getEventDescription(event)}
        </div>
      </div>

      {/* Right side details */}
      {event.details?.round && (
        <div className="flex-shrink-0 text-xs text-gray-500">
          Round {event.details.round}
        </div>
      )}
      {event.details?.cost && (
        <div className="flex-shrink-0 text-xs text-amber-400 font-medium">
          R{event.details.cost}
        </div>
      )}
    </div>
  );
}

function getEventDescription(event: TimelineEvent): string {
  switch (event.event) {
    case "DRAFTED":
      return `By ${event.teamName}`;
    case "KEPT_REGULAR":
    case "KEPT_FRANCHISE":
      return `By ${event.teamName}`;
    case "TRADED":
      return event.details?.fromTeam
        ? `${event.details.fromTeam} → ${event.teamName}`
        : `To ${event.teamName}`;
    case "WAIVER":
      return `Claimed by ${event.teamName}`;
    case "FREE_AGENT":
      return `Signed by ${event.teamName}`;
    case "DROPPED":
      return `By ${event.teamName}`;
    case "NOT_KEPT":
      return `Released by ${event.teamName}`;
    default:
      return event.teamName;
  }
}

// Group events by league first, then by season within each league
function groupByLeague(timeline: TimelineEvent[]): Record<string, TimelineEvent[]> {
  const grouped: Record<string, TimelineEvent[]> = {};

  for (const event of timeline) {
    const leagueName = event.leagueName || "Unknown League";
    if (!grouped[leagueName]) {
      grouped[leagueName] = [];
    }
    grouped[leagueName].push(event);
  }

  // Sort events within each league by season (desc) then date
  for (const leagueName of Object.keys(grouped)) {
    grouped[leagueName].sort((a, b) => {
      if (a.season !== b.season) return b.season - a.season;
      if (a.date && b.date) return new Date(b.date).getTime() - new Date(a.date).getTime();
      return 0;
    });
  }

  return grouped;
}

// Group events by season within a league
function groupBySeason(events: TimelineEvent[]): Record<string, TimelineEvent[]> {
  const grouped: Record<string, TimelineEvent[]> = {};

  for (const event of events) {
    const seasonKey = String(event.season);
    if (!grouped[seasonKey]) {
      grouped[seasonKey] = [];
    }
    grouped[seasonKey].push(event);
  }

  return grouped;
}

function LeagueGroup({ leagueName, events }: { leagueName: string; events: TimelineEvent[] }) {
  const seasonGroups = groupBySeason(events);

  return (
    <div className="rounded-xl overflow-hidden border border-gray-700/30">
      {/* League Header */}
      <div className="px-4 py-2.5 bg-gradient-to-r from-purple-500/10 to-transparent border-b border-gray-700/30">
        <span className="text-sm font-semibold text-purple-400">{leagueName}</span>
      </div>

      {/* Seasons within this league */}
      <div className="divide-y divide-gray-800/50">
        {Object.entries(seasonGroups)
          .sort(([a], [b]) => Number(b) - Number(a))
          .map(([season, seasonEvents]) => (
            <SeasonGroup key={season} season={season} events={seasonEvents} />
          ))}
      </div>
    </div>
  );
}
