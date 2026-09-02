import { describe, it, expect } from "vitest";
import {
  adpFormatForScoring,
  adpKey,
  normalizeName,
  normalizePosition,
  parseAdpResponse,
  pickToRound,
} from "./adp";

describe("adpFormatForScoring", () => {
  it("reads the format off the league's own reception points", () => {
    // This league scores rec: 1.0. Asking FFC for standard ADP would hand back
    // a board where the first two rounds are the wrong players entirely.
    expect(adpFormatForScoring(1)).toBe("ppr");
    expect(adpFormatForScoring(0.5)).toBe("half-ppr");
    expect(adpFormatForScoring(0)).toBe("standard");
  });

  it("treats an unscored league as standard rather than guessing PPR", () => {
    expect(adpFormatForScoring(null)).toBe("standard");
    expect(adpFormatForScoring(undefined)).toBe("standard");
  });
});

describe("normalizeName", () => {
  it("ignores the things two spellings of one player disagree on", () => {
    expect(normalizeName("Marvin Harrison Jr.")).toBe(normalizeName("Marvin Harrison"));
    expect(normalizeName("Ja'Marr Chase")).toBe(normalizeName("JaMarr Chase"));
    expect(normalizeName("Amon-Ra St. Brown")).toBe(normalizeName("Amon Ra St Brown"));
  });

  it("keeps genuinely different players apart", () => {
    expect(normalizeName("Justin Jefferson")).not.toBe(normalizeName("Justin Fields"));
  });
});

describe("normalizePosition", () => {
  it("maps FFC's PK onto the K everyone else uses", () => {
    expect(normalizePosition("PK")).toBe("K");
    expect(normalizePosition("pk")).toBe("K");
    expect(normalizePosition("RB")).toBe("RB");
  });
});

describe("adpKey", () => {
  it("joins defenses on the club, because the names never agree", () => {
    // "Seattle Defense" vs "Seattle Seahawks" — 9 of the 52 unmatched rows on
    // the first run were exactly this, and no name normalisation fixes it.
    expect(adpKey("Seattle Defense", "DEF", "SEA")).toBe(
      adpKey("Seattle Seahawks", "DEF", "SEA")
    );
  });

  it("does not collapse two defenses onto one key", () => {
    expect(adpKey("Seattle Defense", "DEF", "SEA")).not.toBe(
      adpKey("Denver Defense", "DEF", "DEN")
    );
  });

  it("joins a kicker across the PK/K spelling", () => {
    expect(adpKey("Brandon Aubrey", "PK", "DAL")).toBe(
      adpKey("Brandon Aubrey", "K", "DAL")
    );
  });

  it("does not join two players who merely share a club", () => {
    expect(adpKey("Bijan Robinson", "RB", "ATL")).not.toBe(
      adpKey("Drake London", "WR", "ATL")
    );
  });
});

describe("parseAdpResponse", () => {
  const body = {
    meta: { type: "PPR", teams: 10, total_drafts: 8007, start_date: "2026-08-26", end_date: "2026-09-02" },
    players: [
      { name: "Jahmyr Gibbs", position: "RB", team: "DET", adp: 1.5, times_drafted: 528 },
      { name: "Seattle Defense", position: "DEF", team: "SEA", adp: 81.4, times_drafted: 40 },
      { name: "Brandon Aubrey", position: "PK", team: "DAL", adp: 128.9, times_drafted: 33 },
    ],
  };

  it("keeps the sample's provenance so staleness is visible", () => {
    const s = parseAdpResponse(body);
    expect(s.format).toBe("PPR");
    expect(s.totalDrafts).toBe(8007);
    expect(s.startDate).toBe("2026-08-26");
  });

  it("keys every position the way the join needs", () => {
    const s = parseAdpResponse(body);
    expect(s.entries.get(adpKey("Jahmyr Gibbs", "RB", "DET"))?.pick).toBe(1.5);
    expect(s.entries.get(adpKey("Seattle Seahawks", "DEF", "SEA"))?.pick).toBe(81.4);
    expect(s.entries.get(adpKey("Brandon Aubrey", "K", "DAL"))?.pick).toBe(128.9);
  });

  it("skips malformed rows instead of writing NaN into the market", () => {
    const s = parseAdpResponse({ players: [
      { name: "", position: "RB", team: "DET", adp: 2, times_drafted: 1 },
      { name: "Ghost", position: "RB", team: "DET", adp: undefined as never, times_drafted: 1 },
    ] });
    expect(s.entries.size).toBe(0);
  });

  it("takes the earlier pick when a key appears twice", () => {
    const s = parseAdpResponse({ players: [
      { name: "Dup Player", position: "WR", team: "SF", adp: 40, times_drafted: 5 },
      { name: "Dup Player", position: "WR", team: "SF", adp: 12, times_drafted: 9 },
    ] });
    expect(s.entries.get(adpKey("Dup Player", "WR", "SF"))?.pick).toBe(12);
  });
});

describe("pickToRound", () => {
  it("converts a pick number using the league's own size", () => {
    // The same ADP is a different round in a different league — pick 11 is
    // round 2 with ten teams and round 1 with twelve.
    expect(pickToRound(1, 10, 16)).toBe(1);
    expect(pickToRound(10, 10, 16)).toBe(1);
    expect(pickToRound(11, 10, 16)).toBe(2);
    expect(pickToRound(11, 12, 16)).toBe(1);
  });

  it("clamps past the last round rather than inventing one", () => {
    expect(pickToRound(500, 10, 16)).toBe(16);
  });

  it("never returns round 0 or NaN for junk input", () => {
    expect(pickToRound(0, 10, 16)).toBe(16);
    expect(pickToRound(-5, 10, 16)).toBe(16);
    expect(pickToRound(NaN, 10, 16)).toBe(16);
    expect(pickToRound(5, 0, 16)).toBe(16);
  });
});
