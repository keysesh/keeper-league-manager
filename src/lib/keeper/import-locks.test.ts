import { describe, it, expect } from "vitest";
import { planLockImport, type LockLimits } from "./import-locks";

const LIMITS: LockLimits = { maxKeepers: 7, maxRegularKeepers: 5, maxFranchiseTags: 2 };

describe("planLockImport", () => {
  it("adds a lock the plan is missing", () => {
    const plan = planLockImport([{ rosterId: "r", locks: ["p1"], existing: [] }], LIMITS);
    expect(plan.create).toEqual([{ rosterId: "r", playerId: "p1", type: "REGULAR" }]);
    expect(plan.blocked).toEqual([]);
  });

  it("leaves a lock the plan already has alone", () => {
    const plan = planLockImport(
      [{ rosterId: "r", locks: ["p1"], existing: [{ playerId: "p1", type: "REGULAR" }] }],
      LIMITS
    );
    expect(plan.create).toEqual([]);
    expect(plan.unchanged).toBe(1);
  });

  it("never awards a franchise tag on its own", () => {
    const plan = planLockImport([{ rosterId: "r", locks: ["p1", "p2"], existing: [] }], LIMITS);
    expect(plan.create.every((c) => c.type === "REGULAR")).toBe(true);
  });

  it("refuses a lock past the regular limit and says a tag is the manager's call", () => {
    const existing = ["a", "b", "c", "d", "e"].map((playerId) => ({ playerId, type: "REGULAR" as const }));
    const plan = planLockImport([{ rosterId: "r", locks: [...existing.map((e) => e.playerId), "p6"], existing }], LIMITS);
    expect(plan.create).toEqual([]);
    expect(plan.blocked).toHaveLength(1);
    expect(plan.blocked[0].playerId).toBe("p6");
    expect(plan.blocked[0].reason).toContain("franchise tag");
  });

  it("a franchise keeper already held does not count against the regular limit", () => {
    const existing = [
      { playerId: "a", type: "REGULAR" as const },
      { playerId: "b", type: "REGULAR" as const },
      { playerId: "c", type: "REGULAR" as const },
      { playerId: "tag", type: "FRANCHISE" as const },
    ];
    const plan = planLockImport(
      [{ rosterId: "r", locks: ["a", "b", "c", "tag", "new"], existing }],
      LIMITS
    );
    expect(plan.create).toEqual([{ rosterId: "r", playerId: "new", type: "REGULAR" }]);
  });

  it("refuses past the total limit even when regular has room", () => {
    const existing = [
      ...["a", "b", "c", "d"].map((playerId) => ({ playerId, type: "REGULAR" as const })),
      ...["t1", "t2"].map((playerId) => ({ playerId, type: "FRANCHISE" as const })),
    ];
    const wide: LockLimits = { maxKeepers: 6, maxRegularKeepers: 5, maxFranchiseTags: 2 };
    const plan = planLockImport(
      [{ rosterId: "r", locks: [...existing.map((e) => e.playerId), "new"], existing }],
      wide
    );
    expect(plan.create).toEqual([]);
    expect(plan.blocked[0].reason).toContain("6 keepers");
  });

  it("reports a planned keeper Sleeper does not have, and never deletes it", () => {
    const plan = planLockImport(
      [{ rosterId: "r", locks: ["p1"], existing: [{ playerId: "gone", type: "REGULAR" }] }],
      LIMITS
    );
    expect(plan.extra).toEqual([{ rosterId: "r", playerId: "gone" }]);
    expect(plan.create).toEqual([{ rosterId: "r", playerId: "p1", type: "REGULAR" }]);
  });

  it("fills to the limit in Sleeper's order rather than refusing the whole roster", () => {
    const existing = ["a", "b", "c", "d"].map((playerId) => ({ playerId, type: "REGULAR" as const }));
    const plan = planLockImport(
      [{ rosterId: "r", locks: [...existing.map((e) => e.playerId), "fits", "spills"], existing }],
      LIMITS
    );
    expect(plan.create.map((c) => c.playerId)).toEqual(["fits"]);
    expect(plan.blocked.map((b) => b.playerId)).toEqual(["spills"]);
  });

  it("keeps rosters independent", () => {
    const full = ["a", "b", "c", "d", "e"].map((playerId) => ({ playerId, type: "REGULAR" as const }));
    const plan = planLockImport(
      [
        { rosterId: "full", locks: [...full.map((f) => f.playerId), "no"], existing: full },
        { rosterId: "empty", locks: ["yes"], existing: [] },
      ],
      LIMITS
    );
    expect(plan.create).toEqual([{ rosterId: "empty", playerId: "yes", type: "REGULAR" }]);
    expect(plan.blocked.map((b) => b.rosterId)).toEqual(["full"]);
  });
});
