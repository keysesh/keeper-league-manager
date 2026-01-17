/**
 * Edge Middleware for global rate limiting
 *
 * Runs at the edge before any route handlers.
 * Provides IP-based rate limiting to prevent abuse.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// Only initialize if environment variables are set
const redis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      })
    : null;

// Global rate limiter - generous limit to catch abuse without affecting normal users
const globalLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(200, "60 s"), // 200 requests per minute per IP
      analytics: true,
      prefix: "ratelimit:global",
    })
  : null;

// Stricter limiter for API routes
const apiLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(100, "60 s"), // 100 requests per minute per IP
      analytics: true,
      prefix: "ratelimit:api",
    })
  : null;

function getClientIp(request: NextRequest): string {
  // Vercel provides this header
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim();
  }

  // Cloudflare
  const cfIp = request.headers.get("cf-connecting-ip");
  if (cfIp) return cfIp;

  // Vercel Edge
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp;

  return "unknown";
}

export async function middleware(request: NextRequest) {
  // Skip rate limiting for static assets and non-API routes
  const pathname = request.nextUrl.pathname;

  // Skip for static files, images, etc.
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/static") ||
    pathname.includes(".") // Has file extension
  ) {
    return NextResponse.next();
  }

  // Skip if Redis not configured (development mode)
  if (!redis) {
    return NextResponse.next();
  }

  const ip = getClientIp(request);

  // Apply stricter rate limiting to API routes
  if (pathname.startsWith("/api")) {
    // Extra strict for sync/admin routes
    if (
      pathname.includes("/sync") ||
      pathname.includes("/admin")
    ) {
      // These routes have their own per-user rate limiting,
      // but we still apply global IP limit to prevent unauthenticated abuse
      const result = await globalLimiter!.limit(`ip:${ip}`);

      if (!result.success) {
        return new NextResponse(
          JSON.stringify({
            error: "Too many requests",
            message: "Rate limit exceeded. Please try again later.",
          }),
          {
            status: 429,
            headers: {
              "Content-Type": "application/json",
              "X-RateLimit-Limit": String(result.limit),
              "X-RateLimit-Remaining": String(result.remaining),
              "X-RateLimit-Reset": String(Math.ceil((result.reset - Date.now()) / 1000)),
              "Retry-After": String(Math.ceil((result.reset - Date.now()) / 1000)),
            },
          }
        );
      }
    } else {
      // Standard API routes
      const result = await apiLimiter!.limit(`ip:${ip}`);

      if (!result.success) {
        return new NextResponse(
          JSON.stringify({
            error: "Too many requests",
            message: "Rate limit exceeded. Please try again later.",
          }),
          {
            status: 429,
            headers: {
              "Content-Type": "application/json",
              "X-RateLimit-Limit": String(result.limit),
              "X-RateLimit-Remaining": String(result.remaining),
              "X-RateLimit-Reset": String(Math.ceil((result.reset - Date.now()) / 1000)),
              "Retry-After": String(Math.ceil((result.reset - Date.now()) / 1000)),
            },
          }
        );
      }
    }
  }

  return NextResponse.next();
}

// Configure which routes the middleware runs on
export const config = {
  matcher: [
    // Match all API routes
    "/api/:path*",
    // Optionally match page routes too (uncomment if needed)
    // "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
