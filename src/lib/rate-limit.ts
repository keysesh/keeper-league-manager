/**
 * Upstash Redis-based rate limiter
 *
 * Provides distributed rate limiting that works across all serverless instances.
 * Falls back to a permissive mode in development if Redis is not configured.
 */

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { NextResponse } from "next/server";

// Initialize Redis client (uses UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN env vars)
let redis: Redis | null = null;

try {
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
  }
} catch {
  console.warn("Failed to initialize Upstash Redis - rate limiting disabled");
}

/**
 * Rate limit configurations for different route types
 */
export const rateLimiters = {
  // General API routes - generous limit
  api: redis
    ? new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(100, "60 s"), // 100 requests per minute
        analytics: true,
        prefix: "ratelimit:api",
      })
    : null,

  // Sync routes - more restrictive
  sync: redis
    ? new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(10, "60 s"), // 10 requests per minute
        analytics: true,
        prefix: "ratelimit:sync",
      })
    : null,

  // Admin routes - moderate limit
  admin: redis
    ? new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(5, "60 s"), // 5 requests per minute
        analytics: true,
        prefix: "ratelimit:admin",
      })
    : null,

  // Heavy operations (player sync, NFLverse sync) - very restrictive
  heavy: redis
    ? new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(2, "300 s"), // 2 requests per 5 minutes
        analytics: true,
        prefix: "ratelimit:heavy",
      })
    : null,

  // Global rate limit by IP - catches unauthenticated abuse
  global: redis
    ? new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(200, "60 s"), // 200 requests per minute per IP
        analytics: true,
        prefix: "ratelimit:global",
      })
    : null,
};

export type RateLimitType = keyof typeof rateLimiters;

/**
 * Check rate limit for a given identifier
 *
 * @param identifier - User ID, IP address, or other unique identifier
 * @param type - Type of rate limit to apply
 * @returns Rate limit result with success flag and metadata
 */
export async function checkRateLimit(
  identifier: string,
  type: RateLimitType = "api"
): Promise<{
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
}> {
  const limiter = rateLimiters[type];

  // If Redis not configured, allow all requests (development mode)
  if (!limiter) {
    return {
      success: true,
      limit: 999,
      remaining: 999,
      reset: 0,
    };
  }

  const result = await limiter.limit(identifier);

  return {
    success: result.success,
    limit: result.limit,
    remaining: result.remaining,
    reset: Math.ceil((result.reset - Date.now()) / 1000), // seconds until reset
  };
}

/**
 * Create a rate limit error response with proper headers
 */
export function createRateLimitResponse(
  remaining: number,
  reset: number,
  limit: number
): NextResponse {
  const response = NextResponse.json(
    {
      error: "Too many requests",
      message: `Rate limit exceeded. Please try again in ${reset} seconds.`,
      retryAfter: reset,
    },
    { status: 429 }
  );

  response.headers.set("X-RateLimit-Limit", String(limit));
  response.headers.set("X-RateLimit-Remaining", String(remaining));
  response.headers.set("X-RateLimit-Reset", String(reset));
  response.headers.set("Retry-After", String(reset));

  return response;
}

/**
 * Add rate limit headers to a successful response
 */
export function addRateLimitHeaders(
  response: NextResponse,
  remaining: number,
  reset: number,
  limit: number
): NextResponse {
  response.headers.set("X-RateLimit-Limit", String(limit));
  response.headers.set("X-RateLimit-Remaining", String(remaining));
  response.headers.set("X-RateLimit-Reset", String(reset));
  return response;
}

/**
 * Helper to apply rate limiting in a route handler
 *
 * @example
 * ```ts
 * const rateLimitResult = await applyRateLimit(session.user.id, "sync");
 * if (rateLimitResult) return rateLimitResult; // Returns 429 response if limited
 * ```
 */
export async function applyRateLimit(
  identifier: string,
  type: RateLimitType = "api"
): Promise<NextResponse | null> {
  const result = await checkRateLimit(identifier, type);

  if (!result.success) {
    return createRateLimitResponse(result.remaining, result.reset, result.limit);
  }

  return null;
}

/**
 * Get client IP from request headers
 * Works with Vercel, Cloudflare, and standard proxies
 */
export function getClientIp(request: Request): string {
  // Vercel
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim();
  }

  // Cloudflare
  const cfConnectingIp = request.headers.get("cf-connecting-ip");
  if (cfConnectingIp) {
    return cfConnectingIp;
  }

  // Vercel Edge
  const realIp = request.headers.get("x-real-ip");
  if (realIp) {
    return realIp;
  }

  // Fallback
  return "unknown";
}

// Legacy exports for backwards compatibility with existing routes
export const RATE_LIMITS = {
  sync: "sync" as RateLimitType,
  admin: "admin" as RateLimitType,
  playerSync: "heavy" as RateLimitType,
  nflverseSync: "heavy" as RateLimitType,
};
