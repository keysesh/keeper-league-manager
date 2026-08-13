import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/auth/stale-session
 *
 * Terminal stop for JWTs whose User row no longer exists. Server components
 * can't clear cookies, so the layouts redirect here; this clears the NextAuth
 * session cookies and lands on the login page with a truthful message. With
 * the cookie gone the login page sees a signed-out visitor, so there is no
 * redirect loop.
 */
export async function GET(request: NextRequest) {
  const response = NextResponse.redirect(
    new URL("/login?error=SessionExpired", request.url)
  );

  // NextAuth v4 uses the __Secure- prefix on HTTPS; clear both variants.
  response.cookies.set("next-auth.session-token", "", {
    maxAge: 0,
    path: "/",
    httpOnly: true,
    sameSite: "lax",
  });
  response.cookies.set("__Secure-next-auth.session-token", "", {
    maxAge: 0,
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: true,
  });

  return response;
}
