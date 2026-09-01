import { describe, it, expect } from "vitest";
import { createRequire } from "node:module";
import path from "node:path";
import { sessionCookieName, secureSessionCookies } from "./session-cookie";

describe("sessionCookieName", () => {
  it("uses the __Secure- prefix on https (production)", () => {
    expect(sessionCookieName("https://keeper-league-manager.vercel.app")).toBe(
      "__Secure-next-auth.session-token"
    );
    expect(secureSessionCookies("https://keeper-league-manager.vercel.app")).toBe(true);
  });

  it("uses the plain name on http (local dev) or when unset", () => {
    expect(sessionCookieName("http://localhost:3000")).toBe("next-auth.session-token");
    expect(sessionCookieName(undefined)).toBe("next-auth.session-token");
    expect(secureSessionCookies("http://localhost:3000")).toBe(false);
  });

  it("TRIPWIRE: matches the name next-auth itself will read", () => {
    // Read next-auth's own default-cookie table so a library upgrade that
    // renames the cookie fails here instead of silently logging users out.
    const require = createRequire(import.meta.url);
    // next-auth's exports map hides core/lib/cookie, so resolve it from the package root
    const nextAuthRoot = path.dirname(require.resolve("next-auth"));
    const { defaultCookies } = require(path.join(nextAuthRoot, "core/lib/cookie.js")) as {
      defaultCookies: (secure: boolean) => { sessionToken: { name: string } };
    };
    expect(sessionCookieName("https://example.com")).toBe(defaultCookies(true).sessionToken.name);
    expect(sessionCookieName("http://example.com")).toBe(defaultCookies(false).sessionToken.name);
  });
});
