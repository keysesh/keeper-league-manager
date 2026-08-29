import { describe, it, expect, vi } from "vitest";

/**
 * Discord OAuth scope tripwire.
 *
 * Requesting the `email` scope makes Discord enforce its verified-account gate
 * on the consent screen. Users whose Discord account has no verified email or
 * phone — and phone-only accounts, which have no email at all — are hard-blocked
 * with "You need a verified email or phone number to perform this action". That
 * happens on Discord's side, before the redirect back, so our callback never runs
 * and nothing lands in our logs. It presented as "Discord login is broken".
 *
 * We never read the Discord email: identity is `discordId` (see the signIn/jwt
 * callbacks in auth.ts), and the account email is typed by the user into the
 * /link-sleeper form. So the scope bought nothing and cost logins.
 *
 * The trap this guards: next-auth's DiscordProvider DEFAULTS its authorization
 * URL to `?scope=identify+email`. Deleting our explicit `authorization.params`
 * override silently reintroduces the bug with no visible diff at the call site.
 */

vi.mock("@/lib/prisma", () => ({
  prisma: { user: { findUnique: vi.fn(), update: vi.fn(), upsert: vi.fn() } },
}));

vi.mock("@/lib/sleeper/client", () => ({
  SleeperClient: class {
    getUser = vi.fn();
  },
}));

import { authOptions } from "@/lib/auth";

type OAuthish = {
  id?: string;
  /** next-auth's built-in default, e.g. ".../authorize?scope=identify+email" */
  authorization?: string | { params?: Record<string, string> };
  /** the options WE passed to DiscordProvider(); these win at parseProviders time */
  options?: { authorization?: { params?: Record<string, string> } };
};

function scopeOf(
  authorization: OAuthish["authorization"]
): string | undefined {
  if (!authorization) return undefined;
  if (typeof authorization === "string") {
    return new URL(authorization).searchParams.get("scope") ?? undefined;
  }
  return authorization.params?.scope;
}

describe("Discord OAuth scope", () => {
  const discord = (authOptions.providers as OAuthish[]).find(
    (p) => p.id === "discord"
  );

  it("the Discord provider is configured", () => {
    expect(discord).toBeDefined();
  });

  it("explicitly overrides the scope instead of inheriting next-auth's default", () => {
    // Not `toBeDefined()` on the whole options object — we specifically need the
    // scope override to survive, because the inherited default includes `email`.
    expect(discord?.options?.authorization?.params?.scope).toBeTypeOf("string");
  });

  it("does NOT request the email scope", () => {
    const effective = scopeOf(discord?.options?.authorization) ?? scopeOf(discord?.authorization);

    expect(effective).toBeDefined();
    expect(effective?.split(/[\s+]+/)).not.toContain("email");
  });

  it("requests exactly `identify`", () => {
    const effective = scopeOf(discord?.options?.authorization);

    expect(effective).toBe("identify");
  });

  it("next-auth's default still includes email — proving the override is load-bearing", () => {
    // If this ever fails, next-auth changed its Discord default. That is good
    // news, not a bug: re-read the comment above, then relax or delete this case.
    // It exists so nobody concludes the override is redundant and removes it.
    const inherited = scopeOf(discord?.authorization);

    expect(inherited?.split(/[\s+]+/)).toContain("email");
  });
});
