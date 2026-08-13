/**
 * Round-trip verification — pure comparison logic.
 *
 * Compares the locally saved keeper plan against keeper evidence synced from
 * Sleeper's draft board (DraftPick rows with is_keeper=true).
 *
 * Truthfulness rules:
 * - No draft, or a draft with zero keeper picks, means NOT VERIFIABLE —
 *   missing data is never converted into success or into a mismatch.
 * - "matches" requires the same player at the same round.
 * - Keeper picks on Sleeper's board that aren't in the plan are surfaced
 *   explicitly as unexpected.
 */

export type KeeperVerificationState = "matches" | "wrong_round" | "not_set";

export interface PlannedKeeper {
  playerId: string;
  playerSleeperId: string;
  playerName: string;
  /** The round the plan expects (cascade-final cost) */
  plannedRound: number;
}

export interface SleeperKeeperPick {
  playerId: string | null;
  round: number;
}

export interface VerificationEntry {
  playerId: string;
  playerSleeperId: string;
  playerName: string;
  plannedRound: number;
  sleeperRound: number | null;
  state: KeeperVerificationState;
}

export interface VerificationResult {
  verifiable: boolean;
  entries: VerificationEntry[];
  /** playerIds of keeper picks on Sleeper's board that are not in the plan */
  unexpectedPlayerIds: string[];
  summary: {
    planned: number;
    matches: number;
    wrongRound: number;
    notSet: number;
    unexpected: number;
  };
}

export function computeKeeperVerification(
  planned: PlannedKeeper[],
  sleeperKeeperPicks: SleeperKeeperPick[],
  draftExists: boolean
): VerificationResult {
  const verifiable = draftExists && sleeperKeeperPicks.length > 0;

  const entries: VerificationEntry[] = planned.map((k) => {
    const pick = sleeperKeeperPicks.find((p) => p.playerId === k.playerId);
    let state: KeeperVerificationState;
    if (!pick) {
      state = "not_set";
    } else if (pick.round === k.plannedRound) {
      state = "matches";
    } else {
      state = "wrong_round";
    }
    return {
      playerId: k.playerId,
      playerSleeperId: k.playerSleeperId,
      playerName: k.playerName,
      plannedRound: k.plannedRound,
      sleeperRound: pick?.round ?? null,
      state,
    };
  });

  const plannedPlayerIds = new Set(planned.map((k) => k.playerId));
  const unexpectedPlayerIds = sleeperKeeperPicks
    .filter((p) => p.playerId !== null && !plannedPlayerIds.has(p.playerId))
    .map((p) => p.playerId as string);

  return {
    verifiable,
    entries,
    unexpectedPlayerIds,
    summary: {
      planned: entries.length,
      matches: entries.filter((e) => e.state === "matches").length,
      wrongRound: entries.filter((e) => e.state === "wrong_round").length,
      notSet: entries.filter((e) => e.state === "not_set").length,
      unexpected: unexpectedPlayerIds.length,
    },
  };
}
