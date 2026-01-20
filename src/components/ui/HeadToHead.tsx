"use client";

import { useState } from "react";
import useSWR from "swr";
import { Swords, ChevronDown, Check, X, Minus, Users } from "lucide-react";

const fetcher = (url: string) => fetch(url).then(res => res.json());

interface HeadToHeadRecord {
  rosterId: string;
  opponentId: string;
  wins: number;
  losses: number;
  ties: number;
}

interface TeamH2HData {
  rosterId: string;
  teamName: string;
  owners: string[];
  overallRecord: { wins: number; losses: number; ties: number };
  records: HeadToHeadRecord[];
  dominates: string[];
  struggles: string[];
}

interface HeadToHeadProps {
  leagueId: string;
  userRosterId?: string;
}

/**
 * Head-to-Head Records component
 * Shows H2H records between all teams as a matrix or list
 */
export function HeadToHead({ leagueId, userRosterId }: HeadToHeadProps) {
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);
  const [view, setView] = useState<"matrix" | "list">("list");

  const { data, isLoading, error } = useSWR<{
    headToHead: TeamH2HData[];
    matrix: Record<string, Record<string, HeadToHeadRecord>>;
    rivalries: Array<{
      team1: { id: string; name: string };
      team2: { id: string; name: string };
      record: string;
      totalGames: number;
    }>;
    note: string;
  }>(
    `/api/leagues/${leagueId}/head-to-head`,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 300000 }
  );

  if (isLoading) {
    return (
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg overflow-hidden animate-pulse">
        <div className="px-4 py-4 border-b border-[#2a2a2a]">
          <div className="h-8 w-32 bg-[#2a2a2a] rounded" />
        </div>
        <div className="p-4 space-y-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-16 bg-[#2a2a2a] rounded" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !data?.headToHead) {
    return (
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-8 text-center">
        <Swords className="w-12 h-12 text-gray-600 mx-auto mb-3" />
        <p className="text-base text-gray-400 font-medium">H2H data unavailable</p>
        <p className="text-sm text-gray-600 mt-1">Play some games to see head-to-head records</p>
      </div>
    );
  }

  const { headToHead, rivalries } = data;
  const teams = headToHead.sort((a, b) => b.overallRecord.wins - a.overallRecord.wins);

  // Get selected team data or user's team
  const focusedTeamId = selectedTeam || userRosterId;
  const focusedTeam = teams.find(t => t.rosterId === focusedTeamId);

  return (
    <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg overflow-hidden">
      <div className="px-4 sm:px-5 py-4 border-b border-[#2a2a2a]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-md bg-orange-500/10 border border-orange-500/20 flex items-center justify-center">
              <Swords className="w-5 h-5 text-orange-400" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">Head-to-Head</h3>
              <p className="text-sm text-gray-500">Records vs each opponent</p>
            </div>
          </div>

          {/* View toggle */}
          <div className="flex items-center gap-1 bg-[#222] rounded-md p-0.5">
            <button
              onClick={() => setView("list")}
              className={`px-3 py-1.5 text-sm rounded ${
                view === "list" ? "bg-[#333] text-white" : "text-gray-500"
              }`}
            >
              List
            </button>
            <button
              onClick={() => setView("matrix")}
              className={`px-3 py-1.5 text-sm rounded ${
                view === "matrix" ? "bg-[#333] text-white" : "text-gray-500"
              }`}
            >
              Matrix
            </button>
          </div>
        </div>
      </div>

      {/* Team selector */}
      <div className="px-4 py-3 border-b border-[#2a2a2a]">
        <div className="relative">
          <select
            value={focusedTeamId || ""}
            onChange={(e) => setSelectedTeam(e.target.value || null)}
            className="w-full bg-[#222] border border-[#333] rounded-md px-4 py-2.5 text-base text-white appearance-none cursor-pointer pr-10"
          >
            {teams.map((team) => (
              <option key={team.rosterId} value={team.rosterId}>
                {team.teamName} ({team.overallRecord.wins}-{team.overallRecord.losses})
                {team.rosterId === userRosterId ? " (You)" : ""}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 pointer-events-none" />
        </div>
      </div>

      {/* Rivalries */}
      {rivalries.length > 0 && (
        <div className="px-4 py-3 border-b border-[#2a2a2a]">
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-2 font-medium">Close Rivalries</p>
          <div className="flex flex-wrap gap-2">
            {rivalries.slice(0, 3).map((rivalry, i) => (
              <span
                key={i}
                className="text-sm px-3 py-1.5 bg-orange-500/10 border border-orange-500/20 text-orange-400 rounded"
              >
                {rivalry.team1.name.split(" ")[0]} vs {rivalry.team2.name.split(" ")[0]}: {rivalry.record}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* List view */}
      {view === "list" && focusedTeam && (
        <div className="divide-y divide-[#2a2a2a]">
          {focusedTeam.records.map((record) => {
            const opponent = teams.find(t => t.rosterId === record.opponentId);
            if (!opponent) return null;

            const isWinning = record.wins > record.losses;
            const isLosing = record.losses > record.wins;

            return (
              <div
                key={record.opponentId}
                className="p-4 flex items-center justify-between hover:bg-[#222] transition-colors min-h-[72px]"
              >
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-md flex items-center justify-center ${
                    isWinning ? "bg-emerald-500/20 text-emerald-400" :
                    isLosing ? "bg-red-500/20 text-red-400" :
                    "bg-gray-500/20 text-gray-400"
                  }`}>
                    {isWinning ? <Check className="w-5 h-5" /> :
                     isLosing ? <X className="w-5 h-5" /> :
                     <Minus className="w-5 h-5" />}
                  </div>
                  <div>
                    <p className="text-base font-medium text-white">{opponent.teamName}</p>
                    <p className="text-sm text-gray-500">{opponent.overallRecord.wins}-{opponent.overallRecord.losses} overall</p>
                  </div>
                </div>

                <div className="text-right">
                  <p className={`text-xl font-bold ${
                    isWinning ? "text-emerald-400" :
                    isLosing ? "text-red-400" :
                    "text-gray-400"
                  }`}>
                    {record.wins}-{record.losses}
                  </p>
                  <p className="text-sm text-gray-500">
                    {isWinning ? "Winning" : isLosing ? "Losing" : "Even"}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Matrix view */}
      {view === "matrix" && (
        <div className="p-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="text-left p-2 text-gray-500">vs</th>
                {teams.slice(0, 8).map((team) => (
                  <th key={team.rosterId} className="p-2 text-gray-500 text-center">
                    {team.teamName.substring(0, 3)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {teams.slice(0, 8).map((team) => (
                <tr key={team.rosterId}>
                  <td className={`p-2 font-medium ${
                    team.rosterId === userRosterId ? "text-blue-400" : "text-white"
                  }`}>
                    {team.teamName.substring(0, 6)}
                  </td>
                  {teams.slice(0, 8).map((opponent) => {
                    if (team.rosterId === opponent.rosterId) {
                      return (
                        <td key={opponent.rosterId} className="p-2 text-center text-gray-600">
                          -
                        </td>
                      );
                    }

                    const record = team.records.find(r => r.opponentId === opponent.rosterId);
                    if (!record) return <td key={opponent.rosterId} className="p-2 text-center">?</td>;

                    const isWinning = record.wins > record.losses;
                    const isLosing = record.losses > record.wins;

                    return (
                      <td
                        key={opponent.rosterId}
                        className={`p-2 text-center font-medium ${
                          isWinning ? "text-emerald-400 bg-emerald-500/10" :
                          isLosing ? "text-red-400 bg-red-500/10" :
                          "text-gray-400"
                        }`}
                      >
                        {record.wins}-{record.losses}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Summary for focused team */}
      {focusedTeam && (
        <div className="px-4 py-3 border-t border-[#2a2a2a] bg-[#222]/50">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">
              <Users className="w-4 h-4 inline mr-1" />
              Dominates {focusedTeam.dominates.length} · Struggles vs {focusedTeam.struggles.length}
            </span>
            <span className="text-gray-600 italic">
              *Estimated from standings
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
