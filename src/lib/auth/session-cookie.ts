/**
 * next-auth's session cookie name depends on whether the site is served over
 * https. next-auth derives it from NEXTAUTH_URL (core/init.js →
 * defaultCookies(url.startsWith("https://"))): on https the cookie is
 * `__Secure-next-auth.session-token` and marked Secure; on http it is the
 * plain `next-auth.session-token`.
 *
 * Anything that sets the session cookie by hand (the invite-accept flow) must
 * use the same name, or next-auth never sees the cookie and the user lands on
 * the login page immediately after "signing in".
 */
export function secureSessionCookies(
  nextAuthUrl: string | undefined = process.env.NEXTAUTH_URL
): boolean {
  return (nextAuthUrl ?? "").startsWith("https://");
}

export function sessionCookieName(
  nextAuthUrl: string | undefined = process.env.NEXTAUTH_URL
): string {
  return `${secureSessionCookies(nextAuthUrl) ? "__Secure-" : ""}next-auth.session-token`;
}
