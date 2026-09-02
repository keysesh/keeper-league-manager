import { prisma } from "@/lib/prisma";
import { resolvePlanningSeason } from "./planning-season";

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
  | "superseded"
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
  /**
   * True when a DIFFERENT league row already exists for the planning season —
   * i.e. Sleeper has rolled the league over and this row is last year's.
   *
   * A COMPLETE league plans for season+1, which is right through the whole
   * offseason and stops being right the moment the successor appears: from
   * then on two rows answer for the same planning season, each with its own
   * rosters, and every keeper read and write is scoped by roster.leagueId. Two
   * plans, silently diverging — the 2025 row still held a January plan with
   * Marvin Harrison on a roster he had been traded off. Only the successor is
   * the planning context; this row is history.
   *
   * Guarded on the successor EXISTING, never on the league being COMPLETE, so
   * ordinary offseason planning on the newest league row is untouched.
   */
  supersededByLeague: boolean;
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

  // Checked before the draft status: this row has no planning-season draft of
  // its own to consult, which is exactly why it looked open.
  if (inputs.supersededByLeague) {
    return {
      source: leagueDeadline ? "league" : draftStartTime ? "draft" : "none",
      deadline: leagueDeadline?.toISOString() ?? draftStartTime?.toISOString() ?? null,
      draftStartTime: draftStartTime?.toISOString() ?? null,
      draftStatus,
      locked: true,
      lockReason: "superseded",
      planningSeason,
    };
  }

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
  // Planning season comes from the league's own draft state, not the calendar
  const league = await prisma.league.findUnique({
    where: { id: leagueId },
    select: {
      season: true,
      status: true,
      settings: true,
      drafts: {
        select: { season: true, startTime: true, status: true },
        orderBy: { startTime: "desc" },
      },
    },
  });

  const planningSeason = resolvePlanningSeason(league);
  const draft = league?.drafts.find((d) => d.season === planningSeason) ?? null;

  // Has the league already rolled over past this row?
  const successor =
    league && league.season !== planningSeason
      ? await prisma.league.findFirst({
          where: { season: planningSeason, id: { not: leagueId } },
          select: { id: true },
        })
      : null;

  return resolveKeeperDeadline(
    {
      leagueSettings: league?.settings ?? null,
      draftStartTime: draft?.startTime ?? null,
      draftStatus: draft?.status ?? null,
      supersededByLeague: successor !== null,
    },
    now,
    planningSeason
  );
}
