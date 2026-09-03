import { PickSlot } from "./pick-slots";

/**
 * The league draft board as a grid: one row per team, one column per round,
 * one cell per pick in the draft.
 *
 * [[pick-slots]] answers "what do I hold"; this answers "what happens at this
 * pick". They are different questions because a pick keeps its place in the
 * draft order when it changes hands — deal your seventh away and someone else
 * picks in your row, at your slot, in round seven. So a cell is indexed by the
 * team whose pick it originally was, and carries who holds it now and which
 * keeper, if any, is spending it.
 */

export interface GridTeamInput<K> {
  rosterId: string;
  /** This team's keepers; each spends a pick in its finalCost round. */
  keepers: K[];
  /** Picks acquired from other teams — the origin is what places them. */
  acquiredPicks: Array<{ round: number; fromRosterId: string }>;
}

export interface GridCell<K> {
  round: number;
  /** The team whose pick this originally was — the row it sits in. */
  rosterId: string;
  /** Who holds it now; equal to rosterId unless it was traded. */
  heldBy: string;
  /** The keeper spending this pick, and whose keeper it is. */
  keeper: K | null;
}

export interface DraftGrid<K> {
  rows: Array<{ rosterId: string; cells: Array<GridCell<K>> }>;
}

/**
 * Places every keeper on the board.
 *
 * A keeper fills one of the picks its team holds in that round, own pick
 * first and acquired picks after — the same order [[buildPickSlots]] uses, so
 * the grid and the per-team list never disagree about which pick a keeper
 * spent. A team holding more keepers in a round than picks is inconsistent
 * data; the extras are returned rather than dropped, because a keeper missing
 * from the board is the one failure nobody would catch by looking.
 */
export function buildDraftGrid<K extends { finalCost: number }>(
  draftRounds: number,
  teams: Array<GridTeamInput<K>>
): DraftGrid<K> & { unplaced: Array<{ rosterId: string; keeper: K }> } {
  const order = teams.map((t) => t.rosterId);
  const cells = new Map<string, GridCell<K>>();
  const key = (round: number, rosterId: string) => `${round}:${rosterId}`;

  for (const team of teams) {
    for (let round = 1; round <= draftRounds; round++) {
      cells.set(key(round, team.rosterId), {
        round,
        rosterId: team.rosterId,
        heldBy: team.rosterId,
        keeper: null,
      });
    }
  }

  // Only the acquiring side names the pick's origin, so ownership is applied
  // from the acquisitions rather than from the dealing team's round list.
  for (const team of teams) {
    for (const pick of team.acquiredPicks) {
      const cell = cells.get(key(pick.round, pick.fromRosterId));
      if (cell) cell.heldBy = team.rosterId;
    }
  }

  const unplaced: Array<{ rosterId: string; keeper: K }> = [];
  for (const team of teams) {
    for (let round = 1; round <= draftRounds; round++) {
      const held = [...cells.values()]
        .filter((c) => c.round === round && c.heldBy === team.rosterId)
        .sort((a, b) => {
          if (a.rosterId === team.rosterId) return -1;
          if (b.rosterId === team.rosterId) return 1;
          return order.indexOf(a.rosterId) - order.indexOf(b.rosterId);
        });
      const here = team.keepers.filter((k) => k.finalCost === round);
      here.forEach((keeper, i) => {
        if (i < held.length) held[i].keeper = keeper;
        else unplaced.push({ rosterId: team.rosterId, keeper });
      });
    }
  }

  return {
    rows: teams.map((t) => ({
      rosterId: t.rosterId,
      cells: Array.from({ length: draftRounds }, (_, i) => cells.get(key(i + 1, t.rosterId))!),
    })),
    unplaced,
  };
}

/** Who spends a cell's pick, when that is not the team whose row it is. */
export function isBorrowed<K>(cell: GridCell<K>): boolean {
  return cell.heldBy !== cell.rosterId;
}

/** Re-export so a screen can hold both shapes without two import lines. */
export type { PickSlot };
