import { describe, it, expect } from "vitest";
import { buildDraftGrid, isBorrowed } from "./draft-grid";

interface K { finalCost: number; name: string }

const team = (
  rosterId: string,
  keepers: K[] = [],
  acquiredPicks: Array<{ round: number; fromRosterId: string }> = []
) => ({ rosterId, keepers, acquiredPicks });

describe("buildDraftGrid", () => {
  it("a clean league is one empty cell per team per round", () => {
    const g = buildDraftGrid(3, [team("a"), team("b")]);
    expect(g.rows).toHaveLength(2);
    expect(g.rows[0].cells.map((c) => c.round)).toEqual([1, 2, 3]);
    expect(g.rows.every((r) => r.cells.every((c) => c.heldBy === c.rosterId && !c.keeper))).toBe(true);
    expect(g.unplaced).toEqual([]);
  });

  it("a keeper spends its own team's pick in its cost round", () => {
    const g = buildDraftGrid(3, [team("a", [{ finalCost: 2, name: "P" }]), team("b")]);
    expect(g.rows[0].cells[1].keeper?.name).toBe("P");
    expect(g.rows[0].cells[0].keeper).toBeNull();
  });

  it("an acquired pick stays in the row it came from, held by the buyer", () => {
    const g = buildDraftGrid(2, [team("a"), team("b", [], [{ round: 1, fromRosterId: "a" }])]);
    const cell = g.rows[0].cells[0];
    expect(cell.rosterId).toBe("a");
    expect(cell.heldBy).toBe("b");
    expect(isBorrowed(cell)).toBe(true);
  });

  it("a keeper on an acquired pick appears in the other team's row", () => {
    const g = buildDraftGrid(2, [
      team("a"),
      team("b", [{ finalCost: 1, name: "P" }], [{ round: 1, fromRosterId: "a" }]),
    ]);
    // b dealt nothing, so its own first is free and takes the keeper
    expect(g.rows[1].cells[0].keeper?.name).toBe("P");
    expect(g.rows[0].cells[0].keeper).toBeNull();
  });

  it("own pick gone: the keeper lands on the acquired one, in that team's row", () => {
    const g = buildDraftGrid(2, [
      team("a", [], [{ round: 1, fromRosterId: "b" }]),          // a bought b's first
      team("b", [{ finalCost: 1, name: "P" }], [{ round: 1, fromRosterId: "c" }]),
      team("c"),
    ]);
    expect(g.rows[1].cells[0].heldBy).toBe("a");   // b's own first belongs to a
    expect(g.rows[1].cells[0].keeper).toBeNull();
    expect(g.rows[2].cells[0].heldBy).toBe("b");   // c's first belongs to b
    expect(g.rows[2].cells[0].keeper?.name).toBe("P");
  });

  it("two keepers in a round fill own pick first, then acquired", () => {
    const g = buildDraftGrid(1, [
      team("a", [
        { finalCost: 1, name: "First" },
        { finalCost: 1, name: "Second" },
      ], [{ round: 1, fromRosterId: "b" }]),
      team("b"),
    ]);
    expect(g.rows[0].cells[0].keeper?.name).toBe("First");
    expect(g.rows[1].cells[0].keeper?.name).toBe("Second");
    expect(g.unplaced).toEqual([]);
  });

  it("more keepers than picks held: the extras are reported, never dropped", () => {
    const g = buildDraftGrid(1, [
      team("a", [
        { finalCost: 1, name: "First" },
        { finalCost: 1, name: "Second" },
      ]),
      team("b"),
    ]);
    expect(g.rows[0].cells[0].keeper?.name).toBe("First");
    expect(g.unplaced).toEqual([{ rosterId: "a", keeper: { finalCost: 1, name: "Second" } }]);
  });

  it("an acquired pick from a team that is not in the league is ignored", () => {
    const g = buildDraftGrid(1, [team("a", [], [{ round: 1, fromRosterId: "ghost" }])]);
    expect(g.rows[0].cells[0].heldBy).toBe("a");
  });

  it("every team keeps a full row of rounds regardless of trades", () => {
    const g = buildDraftGrid(4, [
      team("a", [], [{ round: 2, fromRosterId: "b" }, { round: 3, fromRosterId: "b" }]),
      team("b"),
    ]);
    expect(g.rows.map((r) => r.cells.length)).toEqual([4, 4]);
    expect(g.rows[1].cells.map((c) => c.heldBy)).toEqual(["b", "a", "a", "b"]);
  });
});
