import { describe, it, expect } from "vitest";
import { diffPlanSnapshots } from "./plan-diff";

const SEASON = 2026;

describe("diffPlanSnapshots", () => {
  it("no previous snapshot → no alerts (first visit)", () => {
    expect(diffPlanSnapshots(null, SEASON, { s1: { name: "A", cost: 3 } }, new Set(["s1"]))).toEqual([]);
  });

  it("no change → no alerts", () => {
    const prev = { season: SEASON, plan: { s1: { name: "A", cost: 3 } } };
    expect(diffPlanSnapshots(prev, SEASON, { s1: { name: "A", cost: 3 } }, new Set(["s1"]))).toEqual([]);
  });

  it("cost moved (e.g. traded pick changed cascade) → one alert with both rounds", () => {
    const prev = { season: SEASON, plan: { s1: { name: "A", cost: 7 } } };
    const changes = diffPlanSnapshots(prev, SEASON, { s1: { name: "A", cost: 6 } }, new Set(["s1"]));
    expect(changes).toHaveLength(1);
    expect(changes[0].message).toBe("A's keeper cost moved R7 → R6");
  });

  it("keeper left the roster entirely → one alert", () => {
    const prev = { season: SEASON, plan: { s1: { name: "A", cost: 3 } } };
    const changes = diffPlanSnapshots(prev, SEASON, {}, new Set()); // not rostered
    expect(changes).toHaveLength(1);
    expect(changes[0].message).toContain("no longer on your roster");
  });

  it("deselected but still rostered (user's own change, e.g. other device) → NO alert", () => {
    const prev = { season: SEASON, plan: { s1: { name: "A", cost: 3 } } };
    expect(diffPlanSnapshots(prev, SEASON, {}, new Set(["s1"]))).toEqual([]);
  });

  it("stale snapshot from another season → ignored, no fabricated claims", () => {
    const prev = { season: SEASON - 1, plan: { s1: { name: "A", cost: 12 } } };
    expect(diffPlanSnapshots(prev, SEASON, { s1: { name: "A", cost: 3 } }, new Set(["s1"]))).toEqual([]);
  });

  it("multiple changes reported individually", () => {
    const prev = {
      season: SEASON,
      plan: {
        s1: { name: "A", cost: 7 },
        s2: { name: "B", cost: 4 },
        s3: { name: "C", cost: 9 },
      },
    };
    const changes = diffPlanSnapshots(
      prev,
      SEASON,
      { s1: { name: "A", cost: 6 }, s2: { name: "B", cost: 4 } },
      new Set(["s1", "s2"]) // C gone from roster
    );
    expect(changes.map((c) => c.message)).toEqual([
      "A's keeper cost moved R7 → R6",
      "C is no longer on your roster — keeper removed",
    ]);
  });

  it("newly added keeper (not in previous snapshot) → no alert", () => {
    const prev = { season: SEASON, plan: {} };
    expect(
      diffPlanSnapshots(prev, SEASON, { s1: { name: "A", cost: 3 } }, new Set(["s1"]))
    ).toEqual([]);
  });
});
