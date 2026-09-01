import { describe, it, expect, vi, afterEach } from "vitest";
import { resolvePlanningSeason } from "./planning-season";
import { getKeeperPlanningSeason } from "@/lib/constants/keeper-rules";

afterEach(() => {
  vi.useRealTimers();
});

describe("resolvePlanningSeason", () => {
  it("keeps planning for the league's own season while its draft is pending", () => {
    expect(resolvePlanningSeason({ season: 2026, status: "PRE_DRAFT" })).toBe(2026);
    expect(resolvePlanningSeason({ season: 2026, status: "DRAFTING" })).toBe(2026);
  });

  it("plans for next season once the draft is done", () => {
    expect(resolvePlanningSeason({ season: 2026, status: "IN_SEASON" })).toBe(2027);
    expect(resolvePlanningSeason({ season: 2025, status: "COMPLETE" })).toBe(2026);
  });

  it("TRIPWIRE: a September date does not flip a pre-draft league to next year", () => {
    // 2026-09-01: the calendar rule says 2027, but the 2026 draft is on Sept 3.
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-01T12:00:00-04:00"));
    expect(getKeeperPlanningSeason()).toBe(2027); // the calendar rule, unchanged
    expect(resolvePlanningSeason({ season: 2026, status: "PRE_DRAFT" })).toBe(2026);
  });

  it("falls back to the calendar rule when no league state is known", () => {
    const fallback = vi.fn(() => 2099);
    expect(resolvePlanningSeason(null, fallback)).toBe(2099);
    expect(resolvePlanningSeason(undefined, fallback)).toBe(2099);
    expect(resolvePlanningSeason({ season: 2026 }, fallback)).toBe(2099);
    expect(resolvePlanningSeason({ season: 2026, status: "WEIRD" }, fallback)).toBe(2099);
    expect(resolvePlanningSeason({ status: "PRE_DRAFT" }, fallback)).toBe(2099);
    expect(fallback).toHaveBeenCalledTimes(5);
  });

  it("uses getKeeperPlanningSeason as the default fallback", () => {
    expect(resolvePlanningSeason(null)).toBe(getKeeperPlanningSeason());
  });
});
