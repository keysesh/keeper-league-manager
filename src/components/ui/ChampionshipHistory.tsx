"use client";

import useSWR from "swr";
import { Trophy, Crown, Medal, Star, TrendingUp, Award } from "lucide-react";

const fetcher = (url: string) => fetch(url).then(res => res.json());

interface SeasonChampion {
  season: number;
  champion: {
    rosterId: string;
    teamName: string;
    owners: string[];
    wins: number;
    losses: number;
    pointsFor: number;
  };
  runnerUp: {
    rosterId: string;
    teamName: string;
    owners: string[];
  } | null;
  pointsLeader: {
    rosterId: string;
    teamName: string;
    pointsFor: number;
  };
}

interface OwnerStats {
  userId: string;
  displayName: string;
  championships: number;
  secondPlace: number;
  seasonsPlayed: number;
  totalWins: number;
  totalLosses: number;
}

interface AllTimeRecords {
  mostChampionships: { name: string; count: number } | null;
  mostSeasons: { name: string; count: number } | null;
  highestSingleSeasonPoints: { name: string; season: number; points: number } | null;
  bestRecord: { name: string; season: number; record: string } | null;
}

interface ChampionshipHistoryProps {
  leagueId: string;
  userRosterId?: string;
  compact?: boolean;
}

/**
 * Championship History component
 * Shows past champions, hall of fame, and all-time records
 */
export function ChampionshipHistory({ leagueId, userRosterId, compact = false }: ChampionshipHistoryProps) {
  const { data, isLoading, error } = useSWR<{
    championships: SeasonChampion[];
    ownerStats: OwnerStats[];
    allTimeRecords: AllTimeRecords;
    totalSeasons: number;
  }>(
    `/api/leagues/${leagueId}/history/championships`,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 60000 }
  );

  if (isLoading) {
    return (
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg overflow-hidden animate-pulse">
        <div className="px-4 py-4 border-b border-[#2a2a2a]">
          <div className="h-8 w-40 bg-[#2a2a2a] rounded" />
        </div>
        <div className="p-4 space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-24 bg-[#2a2a2a] rounded" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !data?.championships) {
    return (
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-8 text-center">
        <Trophy className="w-12 h-12 text-gray-600 mx-auto mb-3" />
        <p className="text-base text-gray-400 font-medium">No championship data</p>
        <p className="text-sm text-gray-600 mt-1">Complete a season to see champions</p>
      </div>
    );
  }

  const { championships, ownerStats, allTimeRecords, totalSeasons } = data;

  if (championships.length === 0) {
    return (
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-8 text-center">
        <Trophy className="w-12 h-12 text-gray-600 mx-auto mb-3" />
        <p className="text-base text-gray-400 font-medium">No champions yet</p>
        <p className="text-sm text-gray-600 mt-1">Crown your first champion!</p>
      </div>
    );
  }

  // Compact view for dashboard
  if (compact) {
    return (
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg overflow-hidden">
        <div className="px-4 sm:px-5 py-4 border-b border-[#2a2a2a]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-md bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center">
              <Trophy className="w-5 h-5 text-yellow-400" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">Trophy Case</h3>
              <p className="text-sm text-gray-500">{totalSeasons} season{totalSeasons !== 1 ? "s" : ""} of history</p>
            </div>
          </div>
        </div>

        <div className="divide-y divide-[#2a2a2a]">
          {championships.slice(0, 3).map((c) => (
            <div key={c.season} className="p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-yellow-500/20 to-yellow-600/10 border border-yellow-500/20 flex items-center justify-center">
                <Crown className="w-6 h-6 text-yellow-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold text-white">{c.season}</span>
                  <span className="text-sm text-gray-400">Champion</span>
                </div>
                <p className="text-base text-white truncate">{c.champion.teamName}</p>
                <p className="text-sm text-gray-500">{c.champion.wins}-{c.champion.losses} · {Math.round(c.champion.pointsFor).toLocaleString()} pts</p>
              </div>
            </div>
          ))}
        </div>

        {ownerStats.length > 0 && ownerStats[0].championships > 0 && (
          <div className="p-4 border-t border-[#2a2a2a] bg-[#222]/50">
            <div className="flex items-center gap-2 text-sm">
              <Star className="w-4 h-4 text-yellow-400" />
              <span className="text-gray-500">Dynasty:</span>
              <span className="text-yellow-400 font-medium">{ownerStats[0].displayName}</span>
              <span className="text-gray-500">({ownerStats[0].championships} titles)</span>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Full view
  return (
    <div className="space-y-6">
      {/* All-Time Records */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {allTimeRecords.mostChampionships && (
          <div className="bg-[#1a1a1a] border border-yellow-500/20 rounded-lg p-5 text-center">
            <Trophy className="w-7 h-7 text-yellow-400 mx-auto mb-2" />
            <p className="text-3xl font-bold text-yellow-400">{allTimeRecords.mostChampionships.count}</p>
            <p className="text-sm text-gray-500 mt-1">Championships</p>
            <p className="text-base text-white font-medium truncate mt-2">{allTimeRecords.mostChampionships.name}</p>
          </div>
        )}
        {allTimeRecords.bestRecord && (
          <div className="bg-[#1a1a1a] border border-emerald-500/20 rounded-lg p-5 text-center">
            <Award className="w-7 h-7 text-emerald-400 mx-auto mb-2" />
            <p className="text-3xl font-bold text-emerald-400">{allTimeRecords.bestRecord.record}</p>
            <p className="text-sm text-gray-500 mt-1">Best Record ({allTimeRecords.bestRecord.season})</p>
            <p className="text-base text-white font-medium truncate mt-2">{allTimeRecords.bestRecord.name}</p>
          </div>
        )}
        {allTimeRecords.highestSingleSeasonPoints && (
          <div className="bg-[#1a1a1a] border border-blue-500/20 rounded-lg p-5 text-center">
            <TrendingUp className="w-7 h-7 text-blue-400 mx-auto mb-2" />
            <p className="text-3xl font-bold text-blue-400">{Math.round(allTimeRecords.highestSingleSeasonPoints.points).toLocaleString()}</p>
            <p className="text-sm text-gray-500 mt-1">Most Points ({allTimeRecords.highestSingleSeasonPoints.season})</p>
            <p className="text-base text-white font-medium truncate mt-2">{allTimeRecords.highestSingleSeasonPoints.name}</p>
          </div>
        )}
        {allTimeRecords.mostSeasons && (
          <div className="bg-[#1a1a1a] border border-purple-500/20 rounded-lg p-5 text-center">
            <Star className="w-7 h-7 text-purple-400 mx-auto mb-2" />
            <p className="text-3xl font-bold text-purple-400">{allTimeRecords.mostSeasons.count}</p>
            <p className="text-sm text-gray-500 mt-1">Seasons Played</p>
            <p className="text-base text-white font-medium truncate mt-2">{allTimeRecords.mostSeasons.name}</p>
          </div>
        )}
      </div>

      {/* Championship History */}
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg overflow-hidden">
        <div className="px-4 sm:px-5 py-4 border-b border-[#2a2a2a]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-md bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center">
              <Trophy className="w-5 h-5 text-yellow-400" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">Championship History</h3>
              <p className="text-sm text-gray-500">{totalSeasons} season{totalSeasons !== 1 ? "s" : ""}</p>
            </div>
          </div>
        </div>

        <div className="divide-y divide-[#2a2a2a]">
          {championships.map((c) => {
            const isUserChampion = c.champion.rosterId === userRosterId;

            return (
              <div
                key={c.season}
                className={`p-5 ${isUserChampion ? "bg-yellow-500/5" : ""}`}
              >
                <div className="flex items-start gap-4">
                  {/* Year/Trophy */}
                  <div className="flex flex-col items-center">
                    <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-yellow-500/20 to-yellow-600/10 border border-yellow-500/20 flex items-center justify-center">
                      <Crown className="w-8 h-8 text-yellow-400" />
                    </div>
                    <span className="text-xl font-bold text-white mt-2">{c.season}</span>
                  </div>

                  {/* Champion Details */}
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="text-lg font-bold text-white">{c.champion.teamName}</h4>
                      {isUserChampion && (
                        <span className="text-xs px-2 py-0.5 bg-yellow-500/20 text-yellow-400 rounded font-bold">
                          YOU
                        </span>
                      )}
                    </div>
                    <p className="text-base text-gray-400 mb-2">
                      {c.champion.owners.join(", ")}
                    </p>
                    <div className="flex items-center gap-4 text-base">
                      <span className="text-emerald-400 font-semibold">{c.champion.wins}-{c.champion.losses}</span>
                      <span className="text-gray-500">{Math.round(c.champion.pointsFor).toLocaleString()} pts</span>
                    </div>

                    {/* Runner-up */}
                    {c.runnerUp && (
                      <div className="mt-3 flex items-center gap-2 text-base">
                        <Medal className="w-5 h-5 text-gray-400" />
                        <span className="text-gray-500">Runner-up:</span>
                        <span className="text-gray-300">{c.runnerUp.teamName}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Hall of Fame */}
      {ownerStats.length > 0 && (
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg overflow-hidden">
          <div className="px-4 sm:px-5 py-4 border-b border-[#2a2a2a]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-md bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
                <Star className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-white">Hall of Fame</h3>
                <p className="text-sm text-gray-500">All-time owner rankings</p>
              </div>
            </div>
          </div>

          <div className="divide-y divide-[#2a2a2a]">
            {ownerStats.map((owner, index) => (
              <div key={owner.userId} className="p-4 flex items-center gap-4">
                <div className={`w-10 h-10 rounded-md flex items-center justify-center font-bold text-base ${
                  index === 0 ? "bg-yellow-500 text-black" :
                  index === 1 ? "bg-gray-400 text-black" :
                  index === 2 ? "bg-orange-600 text-white" :
                  "bg-[#2a2a2a] text-gray-400"
                }`}>
                  {index + 1}
                </div>
                <div className="flex-1">
                  <p className="text-base font-medium text-white">{owner.displayName}</p>
                  <p className="text-sm text-gray-500">{owner.seasonsPlayed} seasons · {owner.totalWins}-{owner.totalLosses}</p>
                </div>
                <div className="flex items-center gap-4 text-base">
                  {owner.championships > 0 && (
                    <span className="flex items-center gap-1 text-yellow-400">
                      <Trophy className="w-4 h-4" />
                      {owner.championships}
                    </span>
                  )}
                  {owner.secondPlace > 0 && (
                    <span className="flex items-center gap-1 text-gray-400">
                      <Medal className="w-4 h-4" />
                      {owner.secondPlace}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
