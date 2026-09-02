import { describe, it, expect } from "vitest";
import { buildPickSlots, heldPickCount, heldPicksByRound } from "./pick-slots";

interface K { finalCost: number; name: string }

const NAMES: Record<string, string> = { r2: "Team Two", r3: "Team Three" };
const teamName = (id: string) => NAMES[id] ?? null;

function slots(over: Partial<Parameters<typeof buildPickSlots<K>>[0]> = {}) {
  return buildPickSlots<K>({
    draftRounds: 3,
    keepers: [],
    tradedAwayPicks: [],
    acquiredPicks: [],
    teamName,
    ...over,
  });
}

describe("buildPickSlots", () => {
  it("a clean team gets one open slot per round", () => {
    expect(slots().map((s) => [s.round, s.kind])).toEqual([
      [1, "open"],
      [2, "open"],
      [3, "open"],
    ]);
  });

  it("two picks in a round are two slots, both carrying the round", () => {
    const board = slots({ acquiredPicks: [{ round: 2, fromRosterId: "r2" }] });
    const round2 = board.filter((s) => s.round === 2);
    expect(round2).toHaveLength(2);
    expect(round2.every((s) => s.round === 2)).toBe(true);
    expect(round2[0]).toMatchObject({ kind: "open", from: null });
    expect(round2[1]).toMatchObject({ kind: "open", from: "Team Two" });
  });

  it("three of a round: a keeper fills one, the other two stay open", () => {
    const board = slots({
      keepers: [{ finalCost: 2, name: "Player" }],
      acquiredPicks: [
        { round: 2, fromRosterId: "r2" },
        { round: 2, fromRosterId: "r3" },
      ],
    });
    const round2 = board.filter((s) => s.round === 2);
    expect(round2.map((s) => s.kind)).toEqual(["keeper", "open", "open"]);
    expect(round2[0]).toMatchObject({ kind: "keeper", from: null });
    expect(round2[1]).toMatchObject({ from: "Team Two" });
    expect(round2[2]).toMatchObject({ from: "Team Three" });
  });

  it("a dealt-away pick gets its own line, not a missing round", () => {
    const board = slots({ tradedAwayPicks: [3], tradedTo: () => "Team Two" });
    const round3 = board.filter((s) => s.round === 3);
    expect(round3).toEqual([
      { key: "3:0", round: 3, kind: "traded", to: "Team Two" },
    ]);
  });

  it("dealt your own away and acquired two: two held slots plus the outgoing line", () => {
    const board = slots({
      tradedAwayPicks: [1],
      acquiredPicks: [
        { round: 1, fromRosterId: "r2" },
        { round: 1, fromRosterId: "r3" },
      ],
      tradedTo: () => "Team Three",
    });
    const round1 = board.filter((s) => s.round === 1);
    expect(round1.map((s) => s.kind)).toEqual(["open", "open", "traded"]);
    expect(round1[0]).toMatchObject({ from: "Team Two" });
    expect(round1[1]).toMatchObject({ from: "Team Three" });
  });

  it("an unknown source team reads as no source, never as an id", () => {
    const board = slots({ acquiredPicks: [{ round: 1, fromRosterId: "ghost" }] });
    expect(board.filter((s) => s.round === 1)[1]).toMatchObject({ from: null });
  });

  it("more keepers in a round than picks held: no keeper is dropped", () => {
    const board = slots({
      keepers: [
        { finalCost: 1, name: "A" },
        { finalCost: 1, name: "B" },
      ],
    });
    const round1 = board.filter((s) => s.round === 1);
    expect(round1).toHaveLength(2);
    expect(round1.map((s) => (s.kind === "keeper" ? s.keeper.name : null))).toEqual(["A", "B"]);
  });

  it("keys are unique across the board", () => {
    const board = slots({
      tradedAwayPicks: [1],
      acquiredPicks: [
        { round: 1, fromRosterId: "r2" },
        { round: 1, fromRosterId: "r3" },
      ],
    });
    expect(new Set(board.map((s) => s.key)).size).toBe(board.length);
  });
});

describe("heldPickCount", () => {
  it("counts picks held, not rounds, and ignores outgoing lines", () => {
    const board = slots({
      tradedAwayPicks: [1],
      acquiredPicks: [
        { round: 1, fromRosterId: "r2" },
        { round: 2, fromRosterId: "r3" },
      ],
    });
    // R1: own dealt away, one acquired. R2: own + acquired. R3: own.
    expect(heldPickCount(board)).toBe(4);
  });
});

describe("heldPicksByRound", () => {
  it("reports multiplicity per round and omits rounds held empty", () => {
    const board = slots({
      tradedAwayPicks: [3],
      acquiredPicks: [{ round: 2, fromRosterId: "r2" }],
    });
    expect(heldPicksByRound(board)).toEqual({ 1: 1, 2: 2 });
  });
});
