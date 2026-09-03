/**
 * Bringing Sleeper's keeper locks into the app's plan.
 *
 * The app is where a keeper plan is made and Sleeper is where it is committed,
 * so the two drift in one direction: a manager who locks a keeper in Sleeper
 * without ever opening the app leaves the plan short, and nothing in the sync
 * closes that gap. The board then shows their pick as open, which on a draft
 * board is not a gap but a lie.
 *
 * The import only ever ADDS. A keeper the plan has and Sleeper does not is
 * reported, never deleted — that direction is a manager deselecting someone,
 * and undoing that on a schedule is how a planning tool loses a user's work.
 */

export type KeeperKind = "FRANCHISE" | "REGULAR";

export interface LockRoster {
  rosterId: string;
  /** Player ids locked as keepers on Sleeper, in Sleeper's order. */
  locks: string[];
  /** What the plan already holds for this roster this season. */
  existing: Array<{ playerId: string; type: KeeperKind }>;
}

export interface LockLimits {
  maxKeepers: number;
  maxRegularKeepers: number;
  maxFranchiseTags: number;
}

export interface LockImportPlan {
  /** Locks the plan is missing and has room for. */
  create: Array<{ rosterId: string; playerId: string; type: KeeperKind }>;
  /** Locks the plan is missing but the league's own limits refuse. */
  blocked: Array<{ rosterId: string; playerId: string; reason: string }>;
  /** In the plan, not locked on Sleeper. Reported only. */
  extra: Array<{ rosterId: string; playerId: string }>;
  /** Locks the plan already had. */
  unchanged: number;
}

/**
 * Decides what an import would do, without doing any of it.
 *
 * Imported keepers are REGULAR. A franchise tag is a manager's decision about
 * which player to spend one on — it buys eligibility past the year limit, not
 * a cheaper price — so the import never awards one, and a roster whose locks
 * only fit by spending tags comes back blocked with that said plainly.
 */
export function planLockImport(
  rosters: LockRoster[],
  limits: LockLimits
): LockImportPlan {
  const plan: LockImportPlan = { create: [], blocked: [], extra: [], unchanged: 0 };

  for (const roster of rosters) {
    const have = new Map(roster.existing.map((k) => [k.playerId, k.type]));
    let total = roster.existing.length;
    let regular = roster.existing.filter((k) => k.type === "REGULAR").length;

    for (const playerId of roster.locks) {
      if (have.has(playerId)) {
        plan.unchanged++;
        continue;
      }
      if (total >= limits.maxKeepers) {
        plan.blocked.push({
          rosterId: roster.rosterId,
          playerId,
          reason: `the league allows ${limits.maxKeepers} keepers and this roster already has ${total}`,
        });
        continue;
      }
      if (regular >= limits.maxRegularKeepers) {
        plan.blocked.push({
          rosterId: roster.rosterId,
          playerId,
          reason:
            `the league allows ${limits.maxRegularKeepers} regular keepers and this roster ` +
            `already has ${regular}; holding this one needs a franchise tag, which is the ` +
            `manager's call to spend`,
        });
        continue;
      }
      plan.create.push({ rosterId: roster.rosterId, playerId, type: "REGULAR" });
      total++;
      regular++;
    }

    const locked = new Set(roster.locks);
    for (const k of roster.existing) {
      if (!locked.has(k.playerId)) {
        plan.extra.push({ rosterId: roster.rosterId, playerId: k.playerId });
      }
    }
  }

  return plan;
}
