/**
 * Server-side gate for the authenticated app shell.
 *
 * A JWT session can outlive its User row (90-day rolling sessions survive DB
 * rebuilds), and the layouts already look the user up on every server render —
 * this reuses that lookup as the boundary that decides what the session is
 * actually worth. Pure so it can be unit-tested apart from Next redirects.
 */

export interface GateUser {
  onboardingComplete: boolean;
  isAdmin: boolean;
  teamMembershipCount: number;
}

export type GateDecision =
  | { action: "stale-session" }
  | { action: "onboarding" }
  | { action: "render"; isAdmin: boolean };

/**
 * @param user  The DB row for the session's user id, or null when no such
 *              user exists (stale token). Pass `undefined` when the lookup
 *              itself failed — we fail open and render rather than lock
 *              everyone out during a DB hiccup.
 */
export function resolveDashboardGate(
  user: GateUser | null | undefined
): GateDecision {
  if (user === null) {
    // Token references a user that no longer exists — the session must not
    // enter the app as a logged-in-but-empty ghost.
    return { action: "stale-session" };
  }
  if (user === undefined) {
    return { action: "render", isAdmin: false };
  }
  if (!user.onboardingComplete && user.teamMembershipCount === 0) {
    // Only users with nothing to see get the onboarding wizard — members who
    // predate the wizard (or whose flag was never set) go straight in.
    return { action: "onboarding" };
  }
  return { action: "render", isAdmin: user.isAdmin };
}
