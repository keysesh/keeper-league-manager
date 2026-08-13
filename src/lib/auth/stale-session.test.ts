import { describe, it, expect } from "vitest";
import type { NextRequest } from "next/server";
import { GET } from "@/app/api/auth/stale-session/route";

function makeRequest(url: string): NextRequest {
  return { url } as NextRequest;
}

describe("GET /api/auth/stale-session", () => {
  it("redirects to login with a truthful error and clears both session cookies", async () => {
    const response = await GET(
      makeRequest("https://keeper.example.com/api/auth/stale-session")
    );

    expect(response.status).toBeGreaterThanOrEqual(300);
    expect(response.status).toBeLessThan(400);
    expect(response.headers.get("location")).toBe(
      "https://keeper.example.com/login?error=SessionExpired"
    );

    const setCookies = response.headers.getSetCookie();
    const cleared = (name: string) =>
      setCookies.some(
        (c) => c.startsWith(`${name}=`) && /max-age=0/i.test(c)
      );
    expect(cleared("next-auth.session-token")).toBe(true);
    expect(cleared("__Secure-next-auth.session-token")).toBe(true);
  });

  it("cannot loop: the redirect target is the login page, not an authenticated route", async () => {
    const response = await GET(
      makeRequest("https://keeper.example.com/api/auth/stale-session")
    );
    const location = new URL(response.headers.get("location")!);
    expect(location.pathname).toBe("/login");
  });
});
