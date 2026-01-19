"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

/**
 * My Team Page - Redirects to user's specific team roster
 * This provides a quick access point without needing to know the roster ID
 */
export default function MyTeamPage() {
  const params = useParams();
  const router = useRouter();
  const leagueId = params.leagueId as string;

  // Fetch league data to find user's roster
  const { data, error } = useSWR(`/api/leagues/${leagueId}`, fetcher);

  useEffect(() => {
    if (data?.rosters) {
      // Find the user's roster
      const userRoster = data.rosters.find((r: { isUserRoster: boolean }) => r.isUserRoster);

      if (userRoster) {
        // Redirect to user's team page
        router.replace(`/league/${leagueId}/team/${userRoster.id}`);
      } else {
        // No roster found - redirect to all teams
        router.replace(`/league/${leagueId}/team`);
      }
    }
  }, [data, leagueId, router]);

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center">
          <p className="text-red-400 mb-2">Failed to load your team</p>
          <button
            onClick={() => router.push(`/league/${leagueId}/team`)}
            className="text-blue-400 hover:underline"
          >
            View all teams
          </button>
        </div>
      </div>
    );
  }

  // Loading state while fetching and redirecting
  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-gray-400">Loading your team...</p>
      </div>
    </div>
  );
}
