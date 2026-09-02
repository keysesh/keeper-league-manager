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
      { supersededByLeague: false, leagueSettings: { keeperDeadline: LEAGUE_DEADLINE }, draftStartTime: DRAFT_START, draftStatus: "PRE_DRAFT" },
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
      { supersededByLeague: false, leagueSettings: { keeperDeadline: LEAGUE_DEADLINE }, draftStartTime: DRAFT_START, draftStatus: "PRE_DRAFT" },
      AFTER,
      SEASON
    );
    expect(s.source).toBe("league");
    expect(s.locked).toBe(true);
    expect(s.lockReason).toBe("deadline_passed");
  });

  it("no commissioner deadline, draft scheduled → labeled draft fallback", () => {
    const s = resolveKeeperDeadline(
      { supersededByLeague: false, leagueSettings: null, draftStartTime: DRAFT_START, draftStatus: "PRE_DRAFT" },
      BEFORE,
      SEASON
    );
    expect(s.source).toBe("draft");
    expect(s.deadline).toBe(DRAFT_START.toISOString());
    expect(s.locked).toBe(false);
  });

  it("draft-start fallback passed → locked as draft_started", () => {
    const s = resolveKeeperDeadline(
      { supersededByLeague: false, leagueSettings: null, draftStartTime: DRAFT_START, draftStatus: "PRE_DRAFT" },
      new Date("2026-08-31T00:00:00Z"),
      SEASON
    );
    expect(s.source).toBe("draft");
    expect(s.locked).toBe(true);
    expect(s.lockReason).toBe("draft_started");
  });

  it("draft DRAFTING → hard lock even before the commissioner deadline", () => {
    const s = resolveKeeperDeadline(
      { supersededByLeague: false, leagueSettings: { keeperDeadline: LEAGUE_DEADLINE }, draftStartTime: DRAFT_START, draftStatus: "DRAFTING" },
      BEFORE, // commissioner deadline hasn't passed
      SEASON
    );
    expect(s.locked).toBe(true);
    expect(s.lockReason).toBe("draft_started");
  });

  it("draft COMPLETE → locked as draft_complete", () => {
    const s = resolveKeeperDeadline(
      { supersededByLeague: false, leagueSettings: null, draftStartTime: DRAFT_START, draftStatus: "COMPLETE" },
      AFTER,
      SEASON
    );
    expect(s.locked).toBe(true);
    expect(s.lockReason).toBe("draft_complete");
  });

  it("nothing known → source none, no invented date, unlocked", () => {
    const s = resolveKeeperDeadline(
      { supersededByLeague: false, leagueSettings: null, draftStartTime: null, draftStatus: null },
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
      { supersededByLeague: false, leagueSettings: { keeperDeadline: "not-a-date" }, draftStartTime: DRAFT_START, draftStatus: "PRE_DRAFT" },
      BEFORE,
      SEASON
    );
    expect(s.source).toBe("draft");
  });
});

describe("resolveKeeperDeadline — superseded league row", () => {
  const SUPERSEDED = { supersededByLeague: true, leagueSettings: null, draftStartTime: null, draftStatus: null };

  it("locks last season's row once the successor league exists", () => {
    // A COMPLETE 2025 league plans for 2026 all offseason, which is correct
    // until Sleeper creates the 2026 league. After that both rows answer for
    // planning season 2026 with different rosters, and keeper reads and writes
    // are scoped by roster.leagueId — so the old row accepts edits nobody will
    // ever draft from. It has no 2026 draft of its own, which is exactly why
    // none of the draft-status locks caught it.
    const s = resolveKeeperDeadline(SUPERSEDED, new Date("2026-09-02T12:00:00Z"), 2026);
    expect(s.locked).toBe(true);
    expect(s.lockReason).toBe("superseded");
  });

  it("leaves ordinary offseason planning open when there is no successor yet", () => {
    // Same COMPLETE league, same date, successor not created — this is the
    // normal way keepers get picked and must stay open.
    const s = resolveKeeperDeadline(
      { ...SUPERSEDED, supersededByLeague: false },
      new Date("2026-09-02T12:00:00Z"),
      2026
    );
    expect(s.locked).toBe(false);
    expect(s.lockReason).toBeNull();
  });

  it("outranks an unexpired commissioner deadline on the stale row", () => {
    const s = resolveKeeperDeadline(
      { supersededByLeague: true, leagueSettings: { keeperDeadline: LEAGUE_DEADLINE }, draftStartTime: DRAFT_START, draftStatus: "PRE_DRAFT" },
      BEFORE,
      SEASON
    );
    expect(s.locked).toBe(true);
    expect(s.lockReason).toBe("superseded");
    // The date is still reported, so the UI can say what the deadline was
    expect(s.deadline).toBe(LEAGUE_DEADLINE);
  });
});
