"use client";

import { useState, useEffect, useMemo } from "react";
import { TeamLogo } from "../players/PlayerAvatar";
import { Skeleton } from "../ui/Skeleton";

interface TeamSchedule {
  team: string;
  season: number;
  byeWeek: number;
  games: {
    week: number;
    opponent: string;
    isHome: boolean;
    gameday: string;
    result?: "W" | "L" | "T";
    score?: string;
  }[];
}

interface TeamRecord {
  team: string;
  wins: number;
  losses: number;
  ties: number;
  winPct: number;
  pointsFor: number;
  pointsAgainst: number;
}

interface StrengthOfSchedule {
  team: string;
  fullSOS?: number;
  fullRank?: number;
}

interface ScheduleData {
  season: number;
  schedules: Record<string, TeamSchedule>;
  records: Record<string, TeamRecord>;
  strengthOfSchedule: Record<string, StrengthOfSchedule>;
  byeWeeks: Record<string, number>;
  sosRankings: { team: string; sos?: number; rank?: number }[];
}

interface ScheduleViewerProps {
  season?: number;
}

export function ScheduleViewer({ season }: ScheduleViewerProps) {
  const [data, setData] = useState<ScheduleData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<"byeWeeks" | "sos" | "standings">("byeWeeks");
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);

  useEffect(() => {
    const fetchSchedule = async () => {
      setLoading(true);
      setError(null);
      try {
        const url = season
          ? `/api/nflverse/schedule?season=${season}`
          : "/api/nflverse/schedule";
        const res = await fetch(url);
        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || "Failed to fetch schedule");
        }
        const result = await res.json();
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load schedule");
      } finally {
        setLoading(false);
      }
    };

    fetchSchedule();
  }, [season]);

  // Group teams by bye week
  const byeWeekGroups = useMemo(() => {
    if (!data?.byeWeeks) return {};
    const groups: Record<number, string[]> = {};
    for (const [team, week] of Object.entries(data.byeWeeks)) {
      if (!groups[week]) groups[week] = [];
      groups[week].push(team);
    }
    return groups;
  }, [data?.byeWeeks]);

  // Sort standings by win percentage
  const standings = useMemo(() => {
    if (!data?.records) return [];
    return Object.values(data.records).sort((a, b) => b.winPct - a.winPct);
  }, [data?.records]);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400">
        {error}
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">
          {data.season} NFL Schedule
        </h2>
        <div className="flex gap-2">
          <button
            onClick={() => setView("byeWeeks")}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              view === "byeWeeks"
                ? "bg-purple-600 text-white"
                : "bg-gray-800 text-gray-400 hover:bg-gray-700"
            }`}
          >
            Bye Weeks
          </button>
          <button
            onClick={() => setView("sos")}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              view === "sos"
                ? "bg-purple-600 text-white"
                : "bg-gray-800 text-gray-400 hover:bg-gray-700"
            }`}
          >
            Strength of Schedule
          </button>
          <button
            onClick={() => setView("standings")}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              view === "standings"
                ? "bg-purple-600 text-white"
                : "bg-gray-800 text-gray-400 hover:bg-gray-700"
            }`}
          >
            Standings
          </button>
        </div>
      </div>

      {/* Bye Weeks View */}
      {view === "byeWeeks" && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {Object.entries(byeWeekGroups)
            .sort(([a], [b]) => Number(a) - Number(b))
            .map(([week, teams]) => (
              <div
                key={week}
                className="bg-gray-900 border border-gray-800 rounded-lg p-4"
              >
                <div className="text-sm font-medium text-gray-400 mb-3">
                  Week {week}
                </div>
                <div className="space-y-2">
                  {teams.map((team) => (
                    <div
                      key={team}
                      className="flex items-center gap-2 cursor-pointer hover:bg-gray-800 rounded p-1 -m-1"
                      onClick={() => setSelectedTeam(team)}
                    >
                      <TeamLogo team={team} size="sm" />
                      <span className="text-white text-sm">{team}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
        </div>
      )}

      {/* Strength of Schedule View */}
      {view === "sos" && (
        <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="px-4 py-3 text-left text-gray-400 font-medium">
                  Rank
                </th>
                <th className="px-4 py-3 text-left text-gray-400 font-medium">
                  Team
                </th>
                <th className="px-4 py-3 text-left text-gray-400 font-medium">
                  SOS
                </th>
                <th className="px-4 py-3 text-left text-gray-400 font-medium">
                  Difficulty
                </th>
              </tr>
            </thead>
            <tbody>
              {data.sosRankings.map((item, i) => {
                const difficulty =
                  (item.rank || 0) <= 8
                    ? "Hard"
                    : (item.rank || 0) >= 25
                    ? "Easy"
                    : "Medium";
                const diffColor =
                  difficulty === "Hard"
                    ? "text-red-400"
                    : difficulty === "Easy"
                    ? "text-green-400"
                    : "text-yellow-400";

                return (
                  <tr
                    key={item.team}
                    className="border-b border-gray-800 hover:bg-gray-850 cursor-pointer"
                    onClick={() => setSelectedTeam(item.team)}
                  >
                    <td className="px-4 py-3 text-gray-400">{i + 1}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <TeamLogo team={item.team} size="sm" />
                        <span className="text-white">{item.team}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-white">
                      {item.sos !== undefined
                        ? `${(item.sos * 100).toFixed(1)}%`
                        : "—"}
                    </td>
                    <td className={`px-4 py-3 font-medium ${diffColor}`}>
                      {difficulty}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Standings View */}
      {view === "standings" && (
        <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="px-4 py-3 text-left text-gray-400 font-medium">
                  #
                </th>
                <th className="px-4 py-3 text-left text-gray-400 font-medium">
                  Team
                </th>
                <th className="px-4 py-3 text-center text-gray-400 font-medium">
                  W
                </th>
                <th className="px-4 py-3 text-center text-gray-400 font-medium">
                  L
                </th>
                <th className="px-4 py-3 text-center text-gray-400 font-medium">
                  T
                </th>
                <th className="px-4 py-3 text-center text-gray-400 font-medium">
                  Win%
                </th>
                <th className="px-4 py-3 text-center text-gray-400 font-medium">
                  PF
                </th>
                <th className="px-4 py-3 text-center text-gray-400 font-medium">
                  PA
                </th>
              </tr>
            </thead>
            <tbody>
              {standings.map((team, i) => (
                <tr
                  key={team.team}
                  className="border-b border-gray-800 hover:bg-gray-850 cursor-pointer"
                  onClick={() => setSelectedTeam(team.team)}
                >
                  <td className="px-4 py-3 text-gray-400">{i + 1}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <TeamLogo team={team.team} size="sm" />
                      <span className="text-white">{team.team}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center text-white">
                    {team.wins}
                  </td>
                  <td className="px-4 py-3 text-center text-white">
                    {team.losses}
                  </td>
                  <td className="px-4 py-3 text-center text-white">
                    {team.ties}
                  </td>
                  <td className="px-4 py-3 text-center text-white font-medium">
                    {(team.winPct * 100).toFixed(1)}%
                  </td>
                  <td className="px-4 py-3 text-center text-gray-400">
                    {team.pointsFor}
                  </td>
                  <td className="px-4 py-3 text-center text-gray-400">
                    {team.pointsAgainst}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Team Schedule Modal */}
      {selectedTeam && data.schedules[selectedTeam] && (
        <TeamScheduleModal
          schedule={data.schedules[selectedTeam]}
          record={data.records[selectedTeam]}
          sos={data.strengthOfSchedule[selectedTeam]}
          onClose={() => setSelectedTeam(null)}
        />
      )}
    </div>
  );
}

function TeamScheduleModal({
  schedule,
  record,
  sos,
  onClose,
}: {
  schedule: TeamSchedule;
  record?: TeamRecord;
  sos?: StrengthOfSchedule;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
        <div className="p-4 border-b border-gray-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <TeamLogo team={schedule.team} size="lg" />
            <div>
              <h3 className="text-lg font-bold text-white">{schedule.team}</h3>
              <div className="flex items-center gap-3 text-sm text-gray-400">
                {record && (
                  <span>
                    {record.wins}-{record.losses}
                    {record.ties > 0 && `-${record.ties}`}
                  </span>
                )}
                <span>Bye: Week {schedule.byeWeek}</span>
                {sos?.fullRank && <span>SOS: #{sos.fullRank}</span>}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
          >
            <svg
              className="w-5 h-5 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <div className="p-4 overflow-y-auto max-h-[60vh]">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="px-3 py-2 text-left text-gray-400 font-medium text-sm">
                  Week
                </th>
                <th className="px-3 py-2 text-left text-gray-400 font-medium text-sm">
                  Opponent
                </th>
                <th className="px-3 py-2 text-center text-gray-400 font-medium text-sm">
                  Loc
                </th>
                <th className="px-3 py-2 text-center text-gray-400 font-medium text-sm">
                  Result
                </th>
              </tr>
            </thead>
            <tbody>
              {schedule.games.map((game) => (
                <tr key={game.week} className="border-b border-gray-800">
                  <td className="px-3 py-2 text-gray-400">{game.week}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <TeamLogo team={game.opponent} size="xs" />
                      <span className="text-white">{game.opponent}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-center text-gray-400">
                    {game.isHome ? "Home" : "Away"}
                  </td>
                  <td className="px-3 py-2 text-center">
                    {game.result ? (
                      <span
                        className={`font-medium ${
                          game.result === "W"
                            ? "text-green-400"
                            : game.result === "L"
                            ? "text-red-400"
                            : "text-yellow-400"
                        }`}
                      >
                        {game.result} {game.score}
                      </span>
                    ) : (
                      <span className="text-gray-500">{game.gameday}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
