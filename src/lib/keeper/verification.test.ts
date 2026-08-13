import { describe, it, expect } from "vitest";
import { computeKeeperVerification, type PlannedKeeper } from "./verification";

const planned: PlannedKeeper[] = [
  { playerId: "p1", playerSleeperId: "s1", playerName: "Alpha One", plannedRound: 3 },
  { playerId: "p2", playerSleeperId: "s2", playerName: "Beta Two", plannedRound: 7 },
];

describe("computeKeeperVerification", () => {
  it("exact match → matches", () => {
    const result = computeKeeperVerification(
      planned,
      [
        { playerId: "p1", round: 3 },
        { playerId: "p2", round: 7 },
      ],
      true
    );
    expect(result.verifiable).toBe(true);
    expect(result.entries.map((e) => e.state)).toEqual(["matches", "matches"]);
    expect(result.summary).toEqual({
      planned: 2,
      matches: 2,
      wrongRound: 0,
      notSet: 0,
      unexpected: 0,
    });
  });

  it("keeper set in the wrong round → wrong_round with both rounds", () => {
    const result = computeKeeperVerification(
      planned,
      [{ playerId: "p1", round: 5 }],
      true
    );
    const entry = result.entries.find((e) => e.playerId === "p1")!;
    expect(entry.state).toBe("wrong_round");
    expect(entry.plannedRound).toBe(3);
    expect(entry.sleeperRound).toBe(5);
  });

  it("planned keeper missing from board → not_set (when board has evidence)", () => {
    const result = computeKeeperVerification(
      planned,
      [{ playerId: "p1", round: 3 }],
      true
    );
    expect(result.verifiable).toBe(true);
    expect(result.entries.find((e) => e.playerId === "p2")!.state).toBe("not_set");
    expect(result.summary.notSet).toBe(1);
  });

  it("unexpected keeper on the board → surfaced explicitly", () => {
    const result = computeKeeperVerification(
      planned,
      [
        { playerId: "p1", round: 3 },
        { playerId: "p2", round: 7 },
        { playerId: "p9", round: 10 },
      ],
      true
    );
    expect(result.unexpectedPlayerIds).toEqual(["p9"]);
    expect(result.summary.unexpected).toBe(1);
  });

  it("no draft at all → not verifiable, never a mismatch", () => {
    const result = computeKeeperVerification(planned, [], false);
    expect(result.verifiable).toBe(false);
    // Entries still computed as not_set, but verifiable=false tells the UI
    // to show "pending" instead of failures
    expect(result.entries.every((e) => e.state === "not_set")).toBe(true);
  });

  it("draft exists but no keeper picks published yet → not verifiable", () => {
    const result = computeKeeperVerification(planned, [], true);
    expect(result.verifiable).toBe(false);
  });

  it("null playerId picks (undrafted slots) never count as unexpected", () => {
    const result = computeKeeperVerification(
      planned,
      [
        { playerId: "p1", round: 3 },
        { playerId: null, round: 8 },
      ],
      true
    );
    expect(result.unexpectedPlayerIds).toEqual([]);
  });

  it("empty plan with board evidence → all board keepers unexpected", () => {
    const result = computeKeeperVerification(
      [],
      [{ playerId: "p9", round: 2 }],
      true
    );
    expect(result.verifiable).toBe(true);
    expect(result.entries).toEqual([]);
    expect(result.unexpectedPlayerIds).toEqual(["p9"]);
  });
});
