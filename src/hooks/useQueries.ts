"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

/**
 * Query keys for consistent cache management
 */
export const queryKeys = {
  // League queries
  league: (leagueId: string) => ["league", leagueId] as const,
  leagueSettings: (leagueId: string) => ["league", leagueId, "settings"] as const,
  leagueRosters: (leagueId: string) => ["league", leagueId, "rosters"] as const,
  leagueMembers: (leagueId: string) => ["league", leagueId, "members"] as const,
  leagueDraftBoard: (leagueId: string, season: number) =>
    ["league", leagueId, "draftboard", season] as const,
  leagueTradeProposals: (leagueId: string) =>
    ["league", leagueId, "trade-proposals"] as const,
  leaguePolls: (leagueId: string) => ["league", leagueId, "polls"] as const,

  // Roster queries
  roster: (rosterId: string) => ["roster", rosterId] as const,
  rosterKeepers: (rosterId: string, season: number) =>
    ["roster", rosterId, "keepers", season] as const,
  rosterEligible: (rosterId: string, season: number) =>
    ["roster", rosterId, "eligible", season] as const,

  // User queries
  userLeagues: (userId: string) => ["user", userId, "leagues"] as const,

  // Trade queries
  tradeAnalysis: (hash: string) => ["trade", "analysis", hash] as const,
  tradeProposal: (proposalId: string) => ["trade", "proposal", proposalId] as const,

  // Player queries
  player: (playerId: string) => ["player", playerId] as const,
  playerProjections: (playerId: string, season: number) =>
    ["player", playerId, "projections", season] as const,
};

/**
 * Hook to fetch league data
 */
export function useLeague(leagueId: string) {
  return useQuery({
    queryKey: queryKeys.league(leagueId),
    queryFn: async () => {
      const res = await fetch(`/api/leagues/${leagueId}`);
      if (!res.ok) throw new Error("Failed to fetch league");
      return res.json();
    },
    enabled: !!leagueId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook to fetch league settings
 */
export function useLeagueSettings(leagueId: string) {
  return useQuery({
    queryKey: queryKeys.leagueSettings(leagueId),
    queryFn: async () => {
      const res = await fetch(`/api/leagues/${leagueId}/settings`);
      if (!res.ok) throw new Error("Failed to fetch settings");
      return res.json();
    },
    enabled: !!leagueId,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Hook to fetch league rosters
 */
export function useLeagueRosters(leagueId: string) {
  return useQuery({
    queryKey: queryKeys.leagueRosters(leagueId),
    queryFn: async () => {
      const res = await fetch(`/api/leagues/${leagueId}/rosters`);
      if (!res.ok) throw new Error("Failed to fetch rosters");
      return res.json();
    },
    enabled: !!leagueId,
    staleTime: 2 * 60 * 1000, // 2 minutes - rosters change more frequently
  });
}

/**
 * Hook to fetch eligible keepers for a roster
 */
export function useEligibleKeepers(
  leagueId: string,
  rosterId: string,
  season: number
) {
  return useQuery({
    queryKey: queryKeys.rosterEligible(rosterId, season),
    queryFn: async () => {
      const res = await fetch(
        `/api/leagues/${leagueId}/rosters/${rosterId}/eligible-keepers?season=${season}`
      );
      if (!res.ok) throw new Error("Failed to fetch eligible keepers");
      return res.json();
    },
    enabled: !!leagueId && !!rosterId && !!season,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Hook to fetch draft board
 */
export function useDraftBoard(leagueId: string, season: number) {
  return useQuery({
    queryKey: queryKeys.leagueDraftBoard(leagueId, season),
    queryFn: async () => {
      const res = await fetch(
        `/api/leagues/${leagueId}/draft-board?season=${season}`
      );
      if (!res.ok) throw new Error("Failed to fetch draft board");
      return res.json();
    },
    enabled: !!leagueId && !!season,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Hook to fetch trade proposals
 */
export function useTradeProposals(leagueId: string, status?: string) {
  return useQuery({
    queryKey: [...queryKeys.leagueTradeProposals(leagueId), status],
    queryFn: async () => {
      const url = status
        ? `/api/leagues/${leagueId}/trade-proposals?status=${status}`
        : `/api/leagues/${leagueId}/trade-proposals`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch trade proposals");
      return res.json();
    },
    enabled: !!leagueId,
    staleTime: 60 * 1000, // 1 minute - proposals change frequently
  });
}

/**
 * Hook to fetch a single trade proposal
 */
export function useTradeProposal(leagueId: string, proposalId: string) {
  return useQuery({
    queryKey: queryKeys.tradeProposal(proposalId),
    queryFn: async () => {
      const res = await fetch(
        `/api/leagues/${leagueId}/trade-proposals/${proposalId}`
      );
      if (!res.ok) throw new Error("Failed to fetch trade proposal");
      return res.json();
    },
    enabled: !!leagueId && !!proposalId,
    staleTime: 30 * 1000, // 30 seconds - voting can change quickly
  });
}

/**
 * Hook to vote on a trade proposal
 */
export function useTradeVote(leagueId: string, proposalId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (vote: "approve" | "reject") => {
      const res = await fetch(
        `/api/leagues/${leagueId}/trade-proposals/${proposalId}/vote`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ vote }),
        }
      );
      if (!res.ok) throw new Error("Failed to submit vote");
      return res.json();
    },
    onSuccess: () => {
      // Invalidate and refetch the proposal
      queryClient.invalidateQueries({
        queryKey: queryKeys.tradeProposal(proposalId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.leagueTradeProposals(leagueId),
      });
    },
  });
}

/**
 * Hook to fetch league polls
 */
export function usePolls(leagueId: string, status?: string) {
  return useQuery({
    queryKey: [...queryKeys.leaguePolls(leagueId), status],
    queryFn: async () => {
      const url = status
        ? `/api/leagues/${leagueId}/polls?status=${status}`
        : `/api/leagues/${leagueId}/polls`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch polls");
      return res.json();
    },
    enabled: !!leagueId,
    staleTime: 60 * 1000,
  });
}

/**
 * Hook to invalidate league-related caches
 */
export function useInvalidateLeague() {
  const queryClient = useQueryClient();

  return (leagueId: string) => {
    queryClient.invalidateQueries({
      queryKey: ["league", leagueId],
    });
  };
}

/**
 * Hook to prefetch data
 */
export function usePrefetch() {
  const queryClient = useQueryClient();

  return {
    prefetchLeague: (leagueId: string) => {
      queryClient.prefetchQuery({
        queryKey: queryKeys.league(leagueId),
        queryFn: async () => {
          const res = await fetch(`/api/leagues/${leagueId}`);
          if (!res.ok) throw new Error("Failed to fetch league");
          return res.json();
        },
      });
    },
    prefetchRosters: (leagueId: string) => {
      queryClient.prefetchQuery({
        queryKey: queryKeys.leagueRosters(leagueId),
        queryFn: async () => {
          const res = await fetch(`/api/leagues/${leagueId}/rosters`);
          if (!res.ok) throw new Error("Failed to fetch rosters");
          return res.json();
        },
      });
    },
  };
}
