import { describe, it, expect } from "vitest";
import { resolveDashboardGate } from "./dashboard-gate";

describe("resolveDashboardGate", () => {
  it("renders for a valid user with membership (valid user + valid JWT)", () => {
    expect(
      resolveDashboardGate({
        onboardingComplete: true,
        isAdmin: false,
        teamMembershipCount: 1,
      })
    ).toEqual({ action: "render", isAdmin: false });
  });

  it("preserves admin flag for valid admins", () => {
    expect(
      resolveDashboardGate({
        onboardingComplete: true,
        isAdmin: true,
        teamMembershipCount: 3,
      })
    ).toEqual({ action: "render", isAdmin: true });
  });

  it("rejects a token whose user no longer exists (deleted-user JWT)", () => {
    // This is the Marcus/BlckMessiah ghost-session case: the JWT still
    // carries an old display name, but there is no User row behind it. It
    // must NOT reach the app as a logged-in-but-empty session.
    expect(resolveDashboardGate(null)).toEqual({ action: "stale-session" });
  });

  it("sends brand-new users (no membership, onboarding pending) to onboarding", () => {
    expect(
      resolveDashboardGate({
        onboardingComplete: false,
        isAdmin: false,
        teamMembershipCount: 0,
      })
    ).toEqual({ action: "onboarding" });
  });

  it("does NOT bounce established members into onboarding just because the flag was never set", () => {
    // Every pre-fix user has onboardingComplete=false (the redirect was being
    // swallowed) — they must go straight to their leagues.
    expect(
      resolveDashboardGate({
        onboardingComplete: false,
        isAdmin: false,
        teamMembershipCount: 4,
      })
    ).toEqual({ action: "render", isAdmin: false });
  });

  it("fails open (renders without admin) when the user lookup errored", () => {
    expect(resolveDashboardGate(undefined)).toEqual({
      action: "render",
      isAdmin: false,
    });
  });
});
