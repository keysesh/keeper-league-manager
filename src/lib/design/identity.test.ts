import { describe, it, expect } from "vitest";
import {
  NFL_TEAM_COLORS,
  MANAGER_HUES,
  teamColors,
  teamWash,
  withAlpha,
  managerHues,
  managerHue,
  playerCutoutUrl,
  managerAvatarUrl,
  managerInitials,
} from "./identity";

describe("teamColors", () => {
  it("covers all 32 clubs", () => {
    expect(Object.keys(NFL_TEAM_COLORS)).toHaveLength(32);
  });

  it("is case-insensitive on the abbreviation", () => {
    expect(teamColors("tb")).toEqual(teamColors("TB"));
  });

  it("falls back for a player with no club rather than returning null", () => {
    // Free agents and retired players reach the row too; a null here would
    // put `undefined` straight into a gradient string and paint nothing.
    for (const t of [null, undefined, "", "XXX"]) {
      expect(teamColors(t).primary).toMatch(/^#[0-9A-F]{6}$/i);
    }
  });
});

describe("teamWash", () => {
  it("bleeds the club colour into the app ground", () => {
    expect(teamWash("TB")).toBe(
      "linear-gradient(100deg, #D50A0A8c, rgba(12, 14, 20, 0.45))"
    );
  });

  it("stays a valid gradient for an unknown club", () => {
    expect(teamWash("XXX")).toContain("linear-gradient(");
  });
});

describe("withAlpha", () => {
  it("appends the alpha channel", () => {
    expect(withAlpha("#D50A0A", 1)).toBe("#D50A0Aff");
    expect(withAlpha("#D50A0A", 0)).toBe("#D50A0A00");
  });

  it("clamps out-of-range alpha instead of emitting a broken colour", () => {
    expect(withAlpha("#D50A0A", 2)).toBe("#D50A0Aff");
    expect(withAlpha("#D50A0A", -1)).toBe("#D50A0A00");
  });

  it("passes through anything that is not a 6-digit hex", () => {
    expect(withAlpha("rgba(0,0,0,0.5)", 0.5)).toBe("rgba(0,0,0,0.5)");
  });
});

describe("managerHues", () => {
  const league = [
    "991458275134676992", "1000570442467409920", "1000542619040026624",
    "1000541678584823808", "915284089220337664", "1000541309863559168",
    "1000590759122321408", "1000543453752680448", "1000580881666367488",
    "864935658458877952",
  ];

  it("gives every manager in a ten-team league a different hue", () => {
    const hues = [...managerHues(league).values()];
    expect(new Set(hues).size).toBe(league.length);
  });

  it("is deterministic regardless of the order it is handed", () => {
    const a = managerHues(league);
    const b = managerHues([...league].reverse());
    for (const id of league) expect(a.get(id)).toBe(b.get(id));
  });

  it("ignores duplicates rather than burning a hue on each", () => {
    const hues = managerHues([...league, ...league]);
    expect(hues.size).toBe(league.length);
    expect(new Set(hues.values()).size).toBe(league.length);
  });

  it("wraps rather than returning undefined past the ramp", () => {
    const many = Array.from({ length: MANAGER_HUES.length + 3 }, (_, i) => `owner-${i}`);
    for (const hue of managerHues(many).values()) {
      expect(MANAGER_HUES).toContain(hue);
    }
  });

  it("managerHue agrees with the batch mapping", () => {
    const all = managerHues(league);
    for (const id of league) expect(managerHue(id, league)).toBe(all.get(id));
  });

  it("falls back to the first hue for an owner outside the league", () => {
    expect(managerHue("nobody", league)).toBe(MANAGER_HUES[0]);
  });
});

describe("asset urls", () => {
  it("uses the full cutout, not the circular thumb crop", () => {
    // The thumb is a circle on a solid plate — it cannot sit on a team wash.
    expect(playerCutoutUrl("4037")).toContain("/content/nfl/players/4037");
    expect(playerCutoutUrl("4037")).not.toContain("/thumb/");
  });

  it("asks for .jpg, because .png is a 403", () => {
    // Sleeper serves PNG bytes with alpha under a .jpg path. Correcting the
    // extension to match the payload returns 403 and every player silently
    // falls back to an initial — verified against the CDN on 2026-09-02.
    expect(playerCutoutUrl("4037")).toBe(
      "https://sleepercdn.com/content/nfl/players/4037.jpg"
    );
  });

  it("returns null for a manager who never uploaded an avatar", () => {
    expect(managerAvatarUrl(null)).toBeNull();
    expect(managerAvatarUrl(undefined)).toBeNull();
    expect(managerAvatarUrl("b4f4b6b25e3b007c9e4269052e8fa564")).toBe(
      "https://sleepercdn.com/avatars/thumbs/b4f4b6b25e3b007c9e4269052e8fa564"
    );
  });
});

describe("managerInitials", () => {
  it("takes the first and last word", () => {
    expect(managerInitials("The Concept of a Team")).toBe("TT");
    expect(managerInitials("One Jets Drive")).toBe("OD");
  });

  it("handles a single-word name", () => {
    expect(managerInitials("lottaviano")).toBe("LO");
  });

  it("never renders an empty badge", () => {
    expect(managerInitials(null)).toBe("?");
    expect(managerInitials("   ")).toBe("?");
  });
});
