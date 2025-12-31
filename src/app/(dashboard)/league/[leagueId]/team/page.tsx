"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import useSWR from "swr";
import { Skeleton } from "@/components/ui/Skeleton";
import { BackLink } from "@/components/ui/BackLink";
import { Users, Trophy, Star, ChevronRight } from "lucide-react";

const fetcher = (url: string) => fetch(url).then(res => {
  if (!res.ok) throw new Error("Failed to fetch");
  return res.json();
});

interface Roster {
  id: string;
  teamName: string | null;
  owners?: { displayName: string }[];
  wins: number;
  losses: number;
  ties: number;
  pointsFor: number;
  pointsAgainst: number;
  keeperCount?: number;
}

interface LeagueData {
  id: string;
  name: string;
  season: number;
  rosters: Roster[];
}

export default function TeamsPage() {
  const params = useParams();
  const leagueId = params.leagueId as string;

  const { data: league, error, isLoading } = useSWR<LeagueData>(
    `/api/leagues/${leagueId}`,
    fetcher
  );

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-6">
        <div>
          <Skeleton className="h-4 w-24 mb-3" />
          <Skeleton className="h-10 w-48" />
        </div>
        <div className="space-y-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !league) {
    return (
      <div className="max-w-4xl mx-auto p-4 md:p-6">
        <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-6">
          <p className="text-red-400 font-medium">Failed to load teams</p>
        </div>
      </div>
    );
  }

  // Sort by wins (desc), then points for (desc)
  const sortedRosters = [...league.rosters].sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    return b.pointsFor - a.pointsFor;
  });

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-6">
      {/* Header */}
      <div>
        <BackLink href={`/league/${leagueId}`} label="Back to League" />
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-600/10 ring-1 ring-blue-500/20 flex items-center justify-center">
            <Users className="w-6 h-6 text-blue-400" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">Teams</h1>
            <p className="text-gray-500 mt-0.5">{league.name} • {league.season}</p>
          </div>
        </div>
      </div>

      {/* Teams List */}
      <div className="space-y-3">
        {sortedRosters.map((roster, index) => (
          <Link
            key={roster.id}
            href={`/league/${leagueId}/team/${roster.id}`}
            className="block card-premium rounded-xl p-4 hover:bg-gray-800/50 transition-colors group"
          >
            <div className="flex items-center gap-4">
              {/* Rank */}
              <div className="w-8 h-8 rounded-lg bg-gray-800 flex items-center justify-center text-sm font-bold text-gray-400">
                {index + 1}
              </div>

              {/* Team Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-white truncate">
                    {roster.teamName || "Unnamed Team"}
                  </span>
                  {index === 0 && (
                    <Trophy className="w-4 h-4 text-amber-400" />
                  )}
                </div>
                <div className="text-sm text-gray-500 mt-0.5">
                  {roster.owners?.[0]?.displayName || "Unknown Owner"}
                </div>
              </div>

              {/* Record */}
              <div className="text-right">
                <div className="text-sm font-semibold text-white">
                  {roster.wins}-{roster.losses}{roster.ties > 0 ? `-${roster.ties}` : ""}
                </div>
                <div className="text-xs text-gray-500">
                  {roster.pointsFor.toFixed(1)} PF
                </div>
              </div>

              {/* Keepers Badge */}
              {roster.keeperCount !== undefined && roster.keeperCount > 0 && (
                <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-500/20 text-amber-400">
                  <Star className="w-3 h-3" />
                  <span className="text-xs font-semibold">{roster.keeperCount}</span>
                </div>
              )}

              {/* Arrow */}
              <ChevronRight className="w-5 h-5 text-gray-600 group-hover:text-gray-400 transition-colors" />
            </div>
          </Link>
        ))}
      </div>

      {sortedRosters.length === 0 && (
        <div className="text-center py-12">
          <Users className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-500">No teams found</p>
        </div>
      )}
    </div>
  );
}
