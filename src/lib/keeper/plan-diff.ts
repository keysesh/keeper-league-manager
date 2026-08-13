/**
 * "Since you last planned" — pure diff between the previous visit's plan
 * snapshot and the current one.
 *
 * Signal rules (noise is the failure mode here):
 * - A still-selected keeper whose cost moved → alert with before/after rounds.
 * - A previously selected keeper who is no longer on the roster at all →
 *   alert (a league transaction removed them).
 * - A previously selected keeper who is still rostered but deselected →
 *   NO alert (the user did that themselves, possibly on another device).
 * - Snapshots from a different season are ignored entirely — stale device
 *   storage must never fabricate before/after claims.
 */

export interface PlanSnapshotEntry {
  name: string;
  cost: number;
}

export interface PlanSnapshot {
  [playerSleeperId: string]: PlanSnapshotEntry;
}

export interface StoredPlanSnapshot {
  season: number;
  plan: PlanSnapshot;
}

export interface PlanChange {
  message: string;
}

export function diffPlanSnapshots(
  previous: StoredPlanSnapshot | null,
  currentSeason: number,
  currentPlan: PlanSnapshot,
  rosteredSleeperIds: Set<string>
): PlanChange[] {
  if (!previous) return [];
  // Stale-season snapshot: not comparable, never fabricate claims from it
  if (previous.season !== currentSeason) return [];

  const changes: PlanChange[] = [];

  for (const [sleeperId, was] of Object.entries(previous.plan)) {
    const now = currentPlan[sleeperId];
    if (now && now.cost !== was.cost) {
      changes.push({
        message: `${was.name}'s keeper cost moved R${was.cost} → R${now.cost}`,
      });
    } else if (!now && !rosteredSleeperIds.has(sleeperId)) {
      changes.push({
        message: `${was.name} is no longer on your roster — keeper removed`,
      });
    }
  }

  return changes;
}
