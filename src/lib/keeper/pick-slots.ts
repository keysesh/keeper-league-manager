/**
 * A team's draft picks for one season, one entry per pick.
 *
 * A round is not a pick. A team can deal its own fifth away and still hold two
 * fifths it acquired, and the board used to answer that with a single round row
 * — one slot plus a footnote — so a manager holding three sevenths saw one
 * seven. Every pick gets its own slot carrying its own round number: two
 * sevenths read as two sevens.
 */

export type PickSlot<K> =
  | { key: string; round: number; kind: "keeper"; keeper: K; from: string | null }
  | { key: string; round: number; kind: "open"; from: string | null }
  | { key: string; round: number; kind: "traded"; to: string | null };

export interface PickSlotInput<K> {
  draftRounds: number;
  /** This team's keepers; each one occupies a pick in its finalCost round. */
  keepers: K[];
  /** Rounds where this team's own pick was dealt away. */
  tradedAwayPicks: number[];
  /** Picks acquired from other teams. */
  acquiredPicks: Array<{ round: number; fromRosterId: string }>;
  /** Display name for the team a pick came from, or null when unknown. */
  teamName: (rosterId: string) => string | null;
  /** Who a dealt-away round went to, when the board knows. */
  tradedTo?: (round: number) => string | null;
}

/**
 * Flattens a team's season into one slot per pick, in round order.
 *
 * Within a round: the team's own pick first, then each acquired pick, then a
 * line for a pick dealt away — "you sent this away" is a different fact from
 * "you have nothing here", and a round can be both. Keepers fill the picks the
 * team holds in order; the rest read as open.
 */
export function buildPickSlots<K extends { finalCost: number }>({
  draftRounds,
  keepers,
  tradedAwayPicks,
  acquiredPicks,
  teamName,
  tradedTo,
}: PickSlotInput<K>): Array<PickSlot<K>> {
  const slots: Array<PickSlot<K>> = [];

  for (let round = 1; round <= draftRounds; round++) {
    const dealtAway = tradedAwayPicks.filter((r) => r === round).length;
    const own = Math.max(0, 1 - dealtAway);
    // Where each held pick came from: null for the team's own.
    const sources: Array<string | null> = [
      ...Array.from({ length: own }, () => null),
      ...acquiredPicks
        .filter((p) => p.round === round)
        .map((p) => teamName(p.fromRosterId)),
    ];
    const keepersHere = keepers.filter((k) => k.finalCost === round);

    // A keeper is never hidden. If the cascade put more keepers in a round than
    // the team holds picks — inconsistent data, but the board is not the place
    // to lose a player over it — the extras still get a slot.
    const held = Math.max(sources.length, keepersHere.length);
    let n = 0;
    for (let i = 0; i < held; i++) {
      const keeper = keepersHere[i];
      const from = sources[i] ?? null;
      slots.push(
        keeper
          ? { key: `${round}:${n++}`, round, kind: "keeper", keeper, from }
          : { key: `${round}:${n++}`, round, kind: "open", from }
      );
    }

    for (let i = 0; i < dealtAway; i++) {
      slots.push({
        key: `${round}:${n++}`,
        round,
        kind: "traded",
        to: tradedTo?.(round) ?? null,
      });
    }
  }

  return slots;
}

/** Picks the team actually holds — dealt-away lines are not picks. */
export function heldPickCount<K>(slots: Array<PickSlot<K>>): number {
  return slots.filter((s) => s.kind !== "traded").length;
}

/** How many picks the team holds in each round, keyed by round. */
export function heldPicksByRound<K>(slots: Array<PickSlot<K>>): Record<number, number> {
  const counts: Record<number, number> = {};
  for (const slot of slots) {
    if (slot.kind === "traded") continue;
    counts[slot.round] = (counts[slot.round] ?? 0) + 1;
  }
  return counts;
}
