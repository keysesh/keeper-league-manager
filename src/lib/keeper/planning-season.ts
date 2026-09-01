import { getKeeperPlanningSeason } from "@/lib/constants/keeper-rules";

/**
 * Which season's draft are members planning keepers for?
 *
 * The calendar rule in keeper-rules (`getKeeperPlanningSeason`) flips to
 * "next year" on September 1. This league drafts in late August / early
 * September, so on the morning of Sept 1 2026 — three days before the 2026
 * draft — every keeper screen switched to planning 2027 and showed empty
 * plans. The calendar cannot know when the draft is; the synced league can.
 *
 * Rule: while a league's own draft has not finished (PRE_DRAFT / DRAFTING),
 * members are planning for THAT season. Once the draft is done (IN_SEASON /
 * COMPLETE) they are planning for the next one. The calendar is only a
 * fallback for when no league row is available.
 *
 * Pure and prisma-free so client components can use it on data they already
 * hold; `getPlanningSeasonForLeague` (planning-season-db) is the DB wrapper.
 */
export interface PlanningSeasonLeague {
  season: number;
  status: string | null | undefined;
}

export function resolvePlanningSeason(
  league: Partial<PlanningSeasonLeague> | null | undefined,
  fallback: () => number = getKeeperPlanningSeason
): number {
  if (!league || typeof league.season !== "number") return fallback();
  switch (league.status) {
    case "PRE_DRAFT":
    case "DRAFTING":
      return league.season;
    case "IN_SEASON":
    case "COMPLETE":
      return league.season + 1;
    default:
      return fallback();
  }
}
