import { describe, it, expect } from "vitest";
import { parseLeagueKeeperDeadline } from "./deadline";

describe("parseLeagueKeeperDeadline", () => {
  it("parses a valid ISO deadline from League.settings", () => {
    const result = parseLeagueKeeperDeadline({ keeperDeadline: "2026-08-25T04:00:00.000Z" });
    expect(result).toBeInstanceOf(Date);
    expect(result?.toISOString()).toBe("2026-08-25T04:00:00.000Z");
  });

  it("returns null when settings is null/undefined", () => {
    expect(parseLeagueKeeperDeadline(null)).toBeNull();
    expect(parseLeagueKeeperDeadline(undefined)).toBeNull();
  });

  it("returns null when settings has no keeperDeadline", () => {
    expect(parseLeagueKeeperDeadline({ someOtherKey: 1 })).toBeNull();
    expect(parseLeagueKeeperDeadline({})).toBeNull();
  });

  it("returns null for a non-string keeperDeadline", () => {
    expect(parseLeagueKeeperDeadline({ keeperDeadline: 12345 })).toBeNull();
    expect(parseLeagueKeeperDeadline({ keeperDeadline: null })).toBeNull();
  });

  it("returns null for an unparseable date string", () => {
    expect(parseLeagueKeeperDeadline({ keeperDeadline: "not-a-date" })).toBeNull();
  });

  it("ignores non-object settings", () => {
    expect(parseLeagueKeeperDeadline("2026-08-25")).toBeNull();
    expect(parseLeagueKeeperDeadline(42)).toBeNull();
  });
});
