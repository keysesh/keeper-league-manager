import { prisma } from "@/lib/prisma";
import { getKeeperPlanningSeason } from "@/lib/constants/keeper-rules";

/**
 * Keeper deadline resolution — replaces the old hardcoded calendar dates
 * (Aug 31 in keeper-rules, Aug 25 in the countdown — which contradicted
 * each other and could both be wrong).
 *
 * These are DIFFERENT concepts and are kept distinct:
 *  - League keeper deadline: a rule the commissioner sets (may be well
 *    before the draft). Stored in League.settings.keeperDeadline.
 *  - Sleeper draft start: a fact synced from Sleeper. Used only as a
 *    clearly-labeled fallback — keepers must be entered before the draft.
 *  - Draft status: the technical hard stop. Once Sleeper's draft is in
 *    progress or complete, keeper changes are pointless regardless of any
 *    configured deadline.
 *
 * A fallback is never presented as a commissioner-defined rule: the
 * `source` field says exactly where the date came from, and when nothing
 * is known the answer is "none" — not an invented date.
 */

export type DeadlineSource = "league" | "draft" | "none";

export type LockReason =
  | "deadline_passed"
  | "draft_started"
  | "draft_complete"
  | null;

export interface KeeperDeadlineStatus {
  /** Where the deadline date came from */
  source: DeadlineSource;
  /** The effective keeper deadline (ISO), or null when nothing is known */
  deadline: string | null;
  /** Sleeper draft start for the planning season (ISO), when known */
  draftStartTime: string | null;
  /** Sleeper draft status for the planning season, when a draft exists */
  draftStatus: string | null;
  /** Are keeper changes closed right now? */
  locked: boolean;
  lockReason: LockReason;
  planningSeason: number;
}

interface LeagueSettingsJson {
  keeperDeadline?: string;
  [key: string]: unknown;
}

/**
 * Read the commissioner-configured keeper deadline from League.settings.
 * Returns null when unset or unparseable.
 */
export function parseLeagueKeeperDeadline(settings: unknown): Date | null {
  if (!settings || typeof settings !== "object") return null;
  const raw = (settings as LeagueSettingsJson).keeperDeadline;
  if (typeof raw !== "string") return null;
  const parsed = new Date(raw);
  return isNaN(parsed.getTime()) ? null : parsed;
}

export interface DeadlineInputs {
  /** League.settings JSON (may carry keeperDeadline) */
  leagueSettings: unknown;
  /** Planning-season Sleeper draft start, when known */
  draftStartTime: Date | null;
  /** Planning-season Sleeper draft status (PRE_DRAFT | DRAFTING | COMPLETE) */
  draftStatus: string | null;
}

/**
 * Pure deadline resolution — the precedence and lock rules, testable without
 * a database. getKeeperDeadlineStatus is the prisma-backed wrapper.
 */
export function resolveKeeperDeadline(
  inputs: DeadlineInputs,
  now: Date,
  planningSeason: number
): KeeperDeadlineStatus {
  const { draftStartTime, draftStatus } = inputs;
  const leagueDeadline = parseLeagueKeeperDeadline(inputs.leagueSettings);

  // Technical hard stop: Sleeper's draft has started or finished
  if (draftStatus === "DRAFTING" || draftStatus === "COMPLETE") {
    return {
      source: leagueDeadline ? "league" : draftStartTime ? "draft" : "none",
      deadline: leagueDeadline?.toISOString() ?? draftStartTime?.toISOString() ?? null,
      draftStartTime: draftStartTime?.toISOString() ?? null,
      draftStatus,
      locked: true,
      lockReason: draftStatus === "COMPLETE" ? "draft_complete" : "draft_started",
      planningSeason,
    };
  }

  // Commissioner-configured league deadline
  if (leagueDeadline) {
    return {
      source: "league",
      deadline: leagueDeadline.toISOString(),
      draftStartTime: draftStartTime?.toISOString() ?? null,
      draftStatus,
      locked: now.getTime() > leagueDeadline.getTime(),
      lockReason: now.getTime() > leagueDeadline.getTime() ? "deadline_passed" : null,
      planningSeason,
    };
  }

  // Fallback: Sleeper draft start (clearly labeled via source: "draft")
  if (draftStartTime) {
    return {
      source: "draft",
      deadline: draftStartTime.toISOString(),
      draftStartTime: draftStartTime.toISOString(),
      draftStatus,
      locked: now.getTime() > draftStartTime.getTime(),
      lockReason: now.getTime() > draftStartTime.getTime() ? "draft_started" : null,
      planningSeason,
    };
  }

  // Nothing known — say so instead of inventing a date
  return {
    source: "none",
    deadline: null,
    draftStartTime: null,
    draftStatus,
    locked: false,
    lockReason: null,
    planningSeason,
  };
}

/** Prisma-backed wrapper: fetch the league's inputs and resolve. */
export async function getKeeperDeadlineStatus(
  leagueId: string,
  now: Date = new Date()
): Promise<KeeperDeadlineStatus> {
  const planningSeason = getKeeperPlanningSeason();

  const league = await prisma.league.findUnique({
    where: { id: leagueId },
    select: {
      settings: true,
      drafts: {
        where: { season: planningSeason },
        select: { startTime: true, status: true },
        orderBy: { startTime: "desc" },
        take: 1,
      },
    },
  });

  const draft = league?.drafts[0] ?? null;

  return resolveKeeperDeadline(
    {
      leagueSettings: league?.settings ?? null,
      draftStartTime: draft?.startTime ?? null,
      draftStatus: draft?.status ?? null,
    },
    now,
    planningSeason
  );
}
