"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";

interface ScheduleData {
  season: number;
  byeWeeks: Record<string, number>;
  sosRankings: Record<string, { sos: number; rank: number }>;
  isLoading: boolean;
  error: string | null;
}

const ScheduleContext = createContext<ScheduleData | null>(null);

export function ScheduleProvider({
  children,
  season
}: {
  children: ReactNode;
  season?: number;
}) {
  const [data, setData] = useState<ScheduleData>({
    season: season || new Date().getFullYear(),
    byeWeeks: {},
    sosRankings: {},
    isLoading: true,
    error: null,
  });

  useEffect(() => {
    const fetchSchedule = async () => {
      try {
        const targetSeason = season || new Date().getFullYear();
        const res = await fetch(`/api/nflverse/schedule?season=${targetSeason}`);

        if (!res.ok) {
          const errData = await res.json();
          setData(prev => ({
            ...prev,
            isLoading: false,
            error: errData.error || "Failed to fetch schedule",
          }));
          return;
        }

        const result = await res.json();

        // Build SOS rankings lookup
        const sosRankings: Record<string, { sos: number; rank: number }> = {};
        if (result.sosRankings) {
          for (const item of result.sosRankings) {
            sosRankings[item.team] = { sos: item.sos || 0, rank: item.rank || 0 };
          }
        }

        setData({
          season: result.season || targetSeason,
          byeWeeks: result.byeWeeks || {},
          sosRankings,
          isLoading: false,
          error: null,
        });
      } catch (err) {
        setData(prev => ({
          ...prev,
          isLoading: false,
          error: err instanceof Error ? err.message : "Failed to load schedule",
        }));
      }
    };

    fetchSchedule();
  }, [season]);

  return (
    <ScheduleContext.Provider value={data}>
      {children}
    </ScheduleContext.Provider>
  );
}

export function useSchedule() {
  return useContext(ScheduleContext);
}

/**
 * Hook to get bye week for a specific team
 */
export function useTeamByeWeek(team: string | null | undefined): number | null {
  const schedule = useSchedule();
  if (!schedule || !team) return null;
  return schedule.byeWeeks[team] || null;
}

/**
 * Hook to get SOS for a specific team
 */
export function useTeamSOS(team: string | null | undefined): { sos: number; rank: number } | null {
  const schedule = useSchedule();
  if (!schedule || !team) return null;
  return schedule.sosRankings[team] || null;
}
