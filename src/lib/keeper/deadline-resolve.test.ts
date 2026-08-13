import { describe, it, expect } from "vitest";
import { resolveKeeperDeadline } from "./deadline";

const SEASON = 2026;
const BEFORE = new Date("2026-08-01T12:00:00Z");
const AFTER = new Date("2026-08-26T12:00:00Z");
const LEAGUE_DEADLINE = "2026-08-25T04:00:00.000Z";
const DRAFT_START = new Date("2026-08-30T00:00:00Z");

describe("resolveKeeperDeadline", () => {
  it("commissioner deadline, before it → unlocked, source league", () => {
    const s = resolveKeeperDeadline(
      { leagueSettings: { keeperDeadline: LEAGUE_DEADLINE }, draftStartTime: DRAFT_START, draftStatus: "PRE_DRAFT" },
      BEFORE,
      SEASON
    );
    expect(s.source).toBe("league");
    expect(s.deadline).toBe(LEAGUE_DEADLINE);
    expect(s.locked).toBe(false);
    expect(s.lockReason).toBeNull();
  });

  it("commissioner deadline, after it → locked with deadline_passed", () => {
    const s = resolveKeeperDeadline(
      { leagueSettings: { keeperDeadline: LEAGUE_DEADLINE }, draftStartTime: DRAFT_START, draftStatus: "PRE_DRAFT" },
      AFTER,
      SEASON
    );
    expect(s.source).toBe("league");
    expect(s.locked).toBe(true);
    expect(s.lockReason).toBe("deadline_passed");
  });

  it("no commissioner deadline, draft scheduled → labeled draft fallback", () => {
    const s = resolveKeeperDeadline(
      { leagueSettings: null, draftStartTime: DRAFT_START, draftStatus: "PRE_DRAFT" },
      BEFORE,
      SEASON
    );
    expect(s.source).toBe("draft");
    expect(s.deadline).toBe(DRAFT_START.toISOString());
    expect(s.locked).toBe(false);
  });

  it("draft-start fallback passed → locked as draft_started", () => {
    const s = resolveKeeperDeadline(
      { leagueSettings: null, draftStartTime: DRAFT_START, draftStatus: "PRE_DRAFT" },
      new Date("2026-08-31T00:00:00Z"),
      SEASON
    );
    expect(s.source).toBe("draft");
    expect(s.locked).toBe(true);
    expect(s.lockReason).toBe("draft_started");
  });

  it("draft DRAFTING → hard lock even before the commissioner deadline", () => {
    const s = resolveKeeperDeadline(
      { leagueSettings: { keeperDeadline: LEAGUE_DEADLINE }, draftStartTime: DRAFT_START, draftStatus: "DRAFTING" },
      BEFORE, // commissioner deadline hasn't passed
      SEASON
    );
    expect(s.locked).toBe(true);
    expect(s.lockReason).toBe("draft_started");
  });

  it("draft COMPLETE → locked as draft_complete", () => {
    const s = resolveKeeperDeadline(
      { leagueSettings: null, draftStartTime: DRAFT_START, draftStatus: "COMPLETE" },
      AFTER,
      SEASON
    );
    expect(s.locked).toBe(true);
    expect(s.lockReason).toBe("draft_complete");
  });

  it("nothing known → source none, no invented date, unlocked", () => {
    const s = resolveKeeperDeadline(
      { leagueSettings: null, draftStartTime: null, draftStatus: null },
      BEFORE,
      SEASON
    );
    expect(s.source).toBe("none");
    expect(s.deadline).toBeNull();
    expect(s.locked).toBe(false);
    expect(s.planningSeason).toBe(SEASON);
  });

  it("unparseable configured deadline falls through to draft fallback", () => {
    const s = resolveKeeperDeadline(
      { leagueSettings: { keeperDeadline: "not-a-date" }, draftStartTime: DRAFT_START, draftStatus: "PRE_DRAFT" },
      BEFORE,
      SEASON
    );
    expect(s.source).toBe("draft");
  });
});
