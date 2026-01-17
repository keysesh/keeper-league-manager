/**
 * In-memory rate limiter for API routes
 *
 * For production with multiple server instances, consider using
 * Redis-based rate limiting (e.g., Upstash Rate Limit)
 */

import { NextResponse } from "next/server";

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

interface RateLimitConfig {
  /** Maximum number of requests allowed in the window */
  limit: number;
  /** Time window in seconds */
  windowSeconds: number;
  /** Identifier for the rate limit (e.g., "sync", "admin") */
  identifier: string;
}

// In-memory store for rate limit tracking
// Key format: `${identifier}:${userId}`
const rateLimitStore = new Map<string, RateLimitEntry>();

// Clean up expired entries periodically
const CLEANUP_INTERVAL_MS = 60000; // 1 minute
let lastCleanup = Date.now();

function cleanupExpiredEntries() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;

  lastCleanup = now;
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now > entry.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}

/**
 * Check if a request should be rate limited
 *
 * @returns Object with isLimited flag and remaining requests info
 */
export function checkRateLimit(
  userId: string,
  config: RateLimitConfig
): {
  isLimited: boolean;
  remaining: number;
  resetIn: number;
  limit: number;
} {
  cleanupExpiredEntries();

  const key = `${config.identifier}:${userId}`;
  const now = Date.now();
  const windowMs = config.windowSeconds * 1000;

  const entry = rateLimitStore.get(key);

  if (!entry || now > entry.resetTime) {
    // Create new window
    rateLimitStore.set(key, {
      count: 1,
      resetTime: now + windowMs,
    });
    return {
      isLimited: false,
      remaining: config.limit - 1,
      resetIn: config.windowSeconds,
      limit: config.limit,
    };
  }

  // Increment count in existing window
  entry.count++;
  const remaining = Math.max(0, config.limit - entry.count);
  const resetIn = Math.ceil((entry.resetTime - now) / 1000);

  return {
    isLimited: entry.count > config.limit,
    remaining,
    resetIn,
    limit: config.limit,
  };
}

/**
 * Create a rate limit error response with proper headers
 */
export function createRateLimitResponse(
  remaining: number,
  resetIn: number,
  limit: number
): NextResponse {
  const response = NextResponse.json(
    {
      error: "Too many requests",
      message: `Rate limit exceeded. Please try again in ${resetIn} seconds.`,
      retryAfter: resetIn,
    },
    { status: 429 }
  );

  response.headers.set("X-RateLimit-Limit", String(limit));
  response.headers.set("X-RateLimit-Remaining", String(remaining));
  response.headers.set("X-RateLimit-Reset", String(resetIn));
  response.headers.set("Retry-After", String(resetIn));

  return response;
}

/**
 * Add rate limit headers to a successful response
 */
export function addRateLimitHeaders(
  response: NextResponse,
  remaining: number,
  resetIn: number,
  limit: number
): NextResponse {
  response.headers.set("X-RateLimit-Limit", String(limit));
  response.headers.set("X-RateLimit-Remaining", String(remaining));
  response.headers.set("X-RateLimit-Reset", String(resetIn));
  return response;
}

// Predefined rate limit configs for different route types
export const RATE_LIMITS = {
  // Sync routes - expensive operations, limit more strictly
  sync: {
    limit: 10,
    windowSeconds: 60, // 10 requests per minute
    identifier: "sync",
  },
  // Admin routes - heavy operations
  admin: {
    limit: 5,
    windowSeconds: 60, // 5 requests per minute
    identifier: "admin",
  },
  // Player sync - very heavy, admin only
  playerSync: {
    limit: 2,
    windowSeconds: 300, // 2 requests per 5 minutes
    identifier: "player-sync",
  },
  // NFLverse sync - heavy, admin only
  nflverseSync: {
    limit: 3,
    windowSeconds: 300, // 3 requests per 5 minutes
    identifier: "nflverse-sync",
  },
} as const;
