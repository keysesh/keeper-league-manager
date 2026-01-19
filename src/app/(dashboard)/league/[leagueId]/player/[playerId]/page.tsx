"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeftRight,
  Calendar,
  ChevronRight,
  Clock,
  Crown,
  Shield,
  Star,
  Target,
  Trophy,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";
import { PlayerAvatar, TeamLogo } from "@/components/players/PlayerAvatar";
import { PositionBadge } from "@/components/ui/PositionBadge";
import { Skeleton } from "@/components/ui/Skeleton";
import { BackLink } from "@/components/ui/BackLink";

interface SeasonStats {
  season: number;
  gamesPlayed: number;
  fantasyPointsPpr: number;
  ppg: number;
  passingYards: number;
  passingTds: number;
  interceptions: number;
  rushingYards: number;
  rushingTds: number;
  receptions: number;
  receivingYards: number;
  receivingTds: number;
  targets: number;
}

interface TimelineEvent {
  season: number;
  date?: string;
  event: string;
  teamName: string;
  details?: Record<string, unknown>;
}

interface PlayerProfileData {
  player: {
    id: string;
    sleeperId: string;
    fullName: string;
    firstName: string | null;
    lastName: string | null;
    position: string | null;
    team: string | null;
    age: number | null;
    yearsExp: number | null;
    status: string | null;
    injuryStatus: string | null;
    fantasyPointsPpr: number | null;
    gamesPlayed: number | null;
    pointsPerGame: number | null;
    adp: number | null;
    projectedPoints: number | null;
  };
  currentRoster: {
    id: string;
    teamName: string | null;
    sleeperId: string;
  } | null;
  seasonStats: SeasonStats[];
  keeperInfo: {
    originalDraftRound: number | null;
    originalDraftSeason: number | null;
    totalYearsKept: number;
    franchiseTags: number;
    currentKeeper: {
      season: number;
      type: string;
      finalCost: number;
      yearsKept: number;
    } | null;
  };
  timeline: TimelineEvent[];
  tradeHistory: Array<{
    date: string;
    season: number;
    fromTeam: string | null;
    toTeam: string | null;
  }>;
  league: {
    id: string;
    name: string;
    season: number;
  };
}

export default function PlayerProfilePage() {
  const params = useParams();
  const leagueId = params.leagueId as string;
  const playerId = params.playerId as string;

  const [data, setData] = useState<PlayerProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch(`/api/leagues/${leagueId}/players/${playerId}`);
        if (!res.ok) throw new Error("Failed to fetch player data");
        const result = await res.json();
        setData(result);
      } catch {
        setError("Failed to load player profile");
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [leagueId, playerId]);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-6">
        <Skeleton className="h-4 w-24" />
        <div className="flex gap-6">
          <Skeleton className="w-24 h-24 rounded-lg" />
          <div className="space-y-3 flex-1">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-64" />
          </div>
        </div>
        <Skeleton className="h-64 rounded-lg" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-4xl mx-auto p-4 md:p-6">
        <div className="bg-[#1a1a1a] border border-red-500/30 rounded-lg p-8 text-center">
          <p className="text-red-400 font-semibold">{error || "Player not found"}</p>
        </div>
      </div>
    );
  }

  const { player, currentRoster, seasonStats, keeperInfo, timeline } = data;

  // Get position-specific stats to display
  const getPositionStats = (stats: SeasonStats) => {
    if (player.position === "QB") {
      return [
        { label: "Pass Yds", value: stats.passingYards.toLocaleString() },
        { label: "Pass TDs", value: stats.passingTds },
        { label: "INTs", value: stats.interceptions },
        { label: "Rush Yds", value: stats.rushingYards.toLocaleString() },
      ];
    }
    if (player.position === "RB") {
      return [
        { label: "Rush Yds", value: stats.rushingYards.toLocaleString() },
        { label: "Rush TDs", value: stats.rushingTds },
        { label: "Rec", value: stats.receptions },
        { label: "Rec Yds", value: stats.receivingYards.toLocaleString() },
      ];
    }
    if (player.position === "WR" || player.position === "TE") {
      return [
        { label: "Rec", value: stats.receptions },
        { label: "Targets", value: stats.targets },
        { label: "Rec Yds", value: stats.receivingYards.toLocaleString() },
        { label: "Rec TDs", value: stats.receivingTds },
      ];
    }
    return [];
  };

  const getEventIcon = (event: string) => {
    switch (event) {
      case "DRAFTED":
        return <Target size={14} className="text-blue-400" />;
      case "KEPT":
        return <Shield size={14} className="text-emerald-400" />;
      case "FRANCHISE_TAG":
        return <Star size={14} className="text-amber-400" />;
      case "TRADED":
        return <ArrowLeftRight size={14} className="text-purple-400" />;
      default:
        return <Clock size={14} className="text-gray-400" />;
    }
  };

  const getEventLabel = (event: string) => {
    switch (event) {
      case "DRAFTED":
        return "Drafted";
      case "KEPT":
        return "Kept";
      case "FRANCHISE_TAG":
        return "Franchise Tagged";
      case "TRADED":
        return "Traded";
      default:
        return event;
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-6">
      {/* Back link */}
      <BackLink href={`/league/${leagueId}`} label="Back to League" />

      {/* Player Header */}
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-6">
        <div className="flex flex-col sm:flex-row gap-6">
          {/* Avatar */}
          <div className="relative shrink-0 self-center sm:self-start">
            <div className="w-24 h-24 rounded-lg overflow-hidden ring-2 ring-[#333333]">
              <PlayerAvatar
                sleeperId={player.sleeperId}
                name={player.fullName}
                size="xl"
              />
            </div>
            {player.team && (
              <div className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full bg-[#1a1a1a] ring-2 ring-[#2a2a2a] flex items-center justify-center">
                <TeamLogo team={player.team} size="sm" />
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 text-center sm:text-left">
            <div className="flex items-center justify-center sm:justify-start gap-3 mb-2">
              <h1 className="text-2xl md:text-3xl font-bold text-white">
                {player.fullName}
              </h1>
              {keeperInfo.currentKeeper?.type === "FRANCHISE" && (
                <Star size={20} className="text-amber-400" />
              )}
            </div>

            <div className="flex items-center justify-center sm:justify-start gap-3 mb-4">
              <PositionBadge position={player.position} size="md" />
              {player.team && (
                <span className="text-gray-400 font-medium">{player.team}</span>
              )}
              {player.injuryStatus && (
                <span className="px-2 py-0.5 rounded bg-red-500/20 text-red-400 text-xs font-medium">
                  {player.injuryStatus}
                </span>
              )}
            </div>

            {/* Quick stats */}
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 text-sm">
              {player.age && (
                <div className="flex items-center gap-1.5 text-gray-400">
                  <Calendar size={14} />
                  <span>{player.age} years old</span>
                </div>
              )}
              {player.yearsExp !== null && (
                <div className="flex items-center gap-1.5 text-gray-400">
                  <Trophy size={14} />
                  <span>
                    {player.yearsExp === 0 ? "Rookie" : `${player.yearsExp} yr${player.yearsExp !== 1 ? "s" : ""} exp`}
                  </span>
                </div>
              )}
              {player.pointsPerGame && (
                <div className="flex items-center gap-1.5 text-emerald-400">
                  <Zap size={14} />
                  <span>{player.pointsPerGame.toFixed(1)} PPG</span>
                </div>
              )}
            </div>
          </div>

          {/* Current Owner */}
          {currentRoster && (
            <div className="sm:text-right">
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Current Owner</p>
              <Link
                href={`/league/${leagueId}/team/${currentRoster.id}`}
                className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 font-medium"
              >
                <Users size={16} />
                {currentRoster.teamName || "Unknown Team"}
                <ChevronRight size={14} />
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Keeper Info Card */}
      {(keeperInfo.totalYearsKept > 0 || keeperInfo.originalDraftRound) && (
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-6">
          <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <Crown size={18} className="text-amber-400" />
            Keeper History in {data.league.name}
          </h2>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {keeperInfo.originalDraftRound && (
              <div className="bg-[#222222] rounded-lg p-4 text-center">
                <p className="text-2xl font-bold text-blue-400">R{keeperInfo.originalDraftRound}</p>
                <p className="text-xs text-gray-500 mt-1">Original Draft ({keeperInfo.originalDraftSeason})</p>
              </div>
            )}
            <div className="bg-[#222222] rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-emerald-400">{keeperInfo.totalYearsKept}</p>
              <p className="text-xs text-gray-500 mt-1">Times Kept</p>
            </div>
            <div className="bg-[#222222] rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-amber-400">{keeperInfo.franchiseTags}</p>
              <p className="text-xs text-gray-500 mt-1">Franchise Tags</p>
            </div>
            {keeperInfo.currentKeeper && (
              <div className="bg-[#222222] rounded-lg p-4 text-center">
                <p className="text-2xl font-bold text-white">R{keeperInfo.currentKeeper.finalCost}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {keeperInfo.currentKeeper.type === "FRANCHISE" ? "FT" : `Y${keeperInfo.currentKeeper.yearsKept}`} Cost
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Season Stats */}
      {seasonStats.length > 0 && (
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-6">
          <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <TrendingUp size={18} className="text-blue-400" />
            Season Stats
          </h2>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#333333]">
                  <th className="text-left py-3 px-2 text-gray-500 font-medium">Season</th>
                  <th className="text-center py-3 px-2 text-gray-500 font-medium">GP</th>
                  <th className="text-center py-3 px-2 text-gray-500 font-medium">PPR Pts</th>
                  <th className="text-center py-3 px-2 text-gray-500 font-medium">PPG</th>
                  {getPositionStats(seasonStats[0]).map((stat) => (
                    <th key={stat.label} className="text-center py-3 px-2 text-gray-500 font-medium">
                      {stat.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {seasonStats.map((stats) => (
                  <tr key={stats.season} className="border-b border-[#222222] hover:bg-[#222222]">
                    <td className="py-3 px-2 font-semibold text-white">{stats.season}</td>
                    <td className="text-center py-3 px-2 text-gray-300">{stats.gamesPlayed}</td>
                    <td className="text-center py-3 px-2 text-gray-300">{stats.fantasyPointsPpr.toFixed(1)}</td>
                    <td className="text-center py-3 px-2 text-emerald-400 font-semibold">{stats.ppg}</td>
                    {getPositionStats(stats).map((stat, i) => (
                      <td key={i} className="text-center py-3 px-2 text-gray-300">{stat.value}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Timeline */}
      {timeline.length > 0 && (
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-6">
          <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <Clock size={18} className="text-purple-400" />
            History in {data.league.name}
          </h2>

          <div className="space-y-3">
            {timeline.map((event, index) => (
              <div
                key={index}
                className="flex items-start gap-4 p-3 rounded-lg bg-[#222222] border border-[#2a2a2a]"
              >
                <div className="w-8 h-8 rounded-full bg-[#1a1a1a] border border-[#333333] flex items-center justify-center shrink-0">
                  {getEventIcon(event.event)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-white">{getEventLabel(event.event)}</span>
                    <span className="text-sm text-gray-500">{event.season}</span>
                  </div>
                  <p className="text-sm text-gray-400 mt-0.5">
                    {event.event === "TRADED" && event.details
                      ? `From ${event.details.from} to ${event.details.to}`
                      : event.event === "DRAFTED" && event.details
                      ? `Round ${event.details.round} by ${event.teamName}`
                      : event.event === "KEPT" && event.details
                      ? `By ${event.teamName} (R${event.details.cost})`
                      : event.event === "FRANCHISE_TAG" && event.details
                      ? `By ${event.teamName} (R${event.details.cost})`
                      : event.teamName}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {timeline.length === 0 && seasonStats.length === 0 && !keeperInfo.totalYearsKept && (
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-8 text-center">
          <Users size={48} className="mx-auto mb-4 text-gray-600" />
          <p className="text-gray-400">No history found for this player in {data.league.name}</p>
        </div>
      )}
    </div>
  );
}
