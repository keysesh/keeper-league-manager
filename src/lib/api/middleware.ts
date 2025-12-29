/**
 * API Route Middleware
 * Reusable wrappers for authentication, error handling, and response formatting
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession, Session } from "next-auth";
import { authOptions } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";

// ============================================
// TYPES
// ============================================

export interface AuthenticatedRequest extends NextRequest {
  session: Session;
  userId: string;
}

export type RouteHandler<T = unknown> = (
  req: NextRequest,
  context: { params: Promise<Record<string, string>> }
) => Promise<NextResponse<T>>;

export type AuthenticatedRouteHandler<T = unknown> = (
  req: AuthenticatedRequest,
  context: { params: Promise<Record<string, string>> }
) => Promise<NextResponse<T>>;

export type AdminRouteHandler<T = unknown> = (
  req: AuthenticatedRequest,
  context: { params: Promise<Record<string, string>> }
) => Promise<NextResponse<T>>;

// ============================================
// AUTH MIDDLEWARE
// ============================================

/**
 * Wrap a route handler to require authentication
 */
export function withAuth<T>(
  handler: AuthenticatedRouteHandler<T>
): RouteHandler<T | { error: string }> {
  return async (req, context) => {
    try {
      const session = await getServerSession(authOptions);

      if (!session?.user?.id) {
        return NextResponse.json(
          { error: "Unauthorized" },
          { status: 401 }
        ) as NextResponse<T | { error: string }>;
      }

      // Extend request with session info
      const authReq = req as AuthenticatedRequest;
      authReq.session = session;
      authReq.userId = session.user.id;

      return handler(authReq, context);
    } catch (error) {
      logger.error("Auth middleware error", error);
      return NextResponse.json(
        { error: "Authentication failed" },
        { status: 401 }
      ) as NextResponse<T | { error: string }>;
    }
  };
}

/**
 * Wrap a route handler to require admin privileges
 */
export function withAdmin<T>(
  handler: AdminRouteHandler<T>
): RouteHandler<T | { error: string }> {
  return withAuth(async (req, context) => {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { isAdmin: true },
    });

    if (!user?.isAdmin) {
      return NextResponse.json(
        { error: "Forbidden - Admin access required" },
        { status: 403 }
      ) as NextResponse<T | { error: string }>;
    }

    return handler(req, context);
  });
}

/**
 * Wrap a route handler to require league membership
 */
export function withLeagueAccess<T>(
  handler: AuthenticatedRouteHandler<T>
): RouteHandler<T | { error: string }> {
  return withAuth(async (req, context) => {
    const params = await context.params;
    const leagueId = params.leagueId;

    if (!leagueId) {
      return NextResponse.json(
        { error: "League ID required" },
        { status: 400 }
      ) as NextResponse<T | { error: string }>;
    }

    // Check if user is a member of this league
    const membership = await prisma.teamMember.findFirst({
      where: {
        userId: req.userId,
        roster: { leagueId },
      },
    });

    // Also check if user is commissioner
    const league = await prisma.league.findUnique({
      where: { id: leagueId },
      select: { commissionerId: true },
    });

    if (!membership && league?.commissionerId !== req.userId) {
      return NextResponse.json(
        { error: "Forbidden - Not a league member" },
        { status: 403 }
      ) as NextResponse<T | { error: string }>;
    }

    return handler(req, context);
  });
}

/**
 * Wrap a route handler to require commissioner access
 */
export function withCommissionerAccess<T>(
  handler: AuthenticatedRouteHandler<T>
): RouteHandler<T | { error: string }> {
  return withAuth(async (req, context) => {
    const params = await context.params;
    const leagueId = params.leagueId;

    if (!leagueId) {
      return NextResponse.json(
        { error: "League ID required" },
        { status: 400 }
      ) as NextResponse<T | { error: string }>;
    }

    const league = await prisma.league.findUnique({
      where: { id: leagueId },
      select: { commissionerId: true },
    });

    if (!league) {
      return NextResponse.json(
        { error: "League not found" },
        { status: 404 }
      ) as NextResponse<T | { error: string }>;
    }

    if (league.commissionerId !== req.userId) {
      // Check if user is admin (admins can access all leagues)
      const user = await prisma.user.findUnique({
        where: { id: req.userId },
        select: { isAdmin: true },
      });

      if (!user?.isAdmin) {
        return NextResponse.json(
          { error: "Forbidden - Commissioner access required" },
          { status: 403 }
        ) as NextResponse<T | { error: string }>;
      }
    }

    return handler(req, context);
  });
}

// ============================================
// ERROR HANDLING
// ============================================

/**
 * Wrap a route handler with error handling
 */
export function withErrorHandling<T>(
  handler: RouteHandler<T>
): RouteHandler<T | { error: string }> {
  return async (req, context) => {
    try {
      return await handler(req, context);
    } catch (error) {
      logger.error("API route error", error, {
        path: req.nextUrl.pathname,
        method: req.method,
      });

      if (error instanceof Error) {
        // Don't expose internal errors in production
        const message = process.env.NODE_ENV === "production"
          ? "Internal server error"
          : error.message;

        return NextResponse.json(
          { error: message },
          { status: 500 }
        ) as NextResponse<T | { error: string }>;
      }

      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      ) as NextResponse<T | { error: string }>;
    }
  };
}

// ============================================
// RESPONSE HELPERS
// ============================================

/**
 * Create a success response with optional cache headers
 */
export function successResponse<T>(
  data: T,
  options?: {
    status?: number;
    cache?: {
      maxAge?: number;
      staleWhileRevalidate?: number;
      private?: boolean;
    };
  }
): NextResponse<T> {
  const response = NextResponse.json(data, { status: options?.status ?? 200 });

  if (options?.cache) {
    const { maxAge = 0, staleWhileRevalidate = 60, private: isPrivate = true } = options.cache;
    const cacheControl = [
      isPrivate ? "private" : "public",
      `s-maxage=${maxAge}`,
      `stale-while-revalidate=${staleWhileRevalidate}`,
    ].join(", ");
    response.headers.set("Cache-Control", cacheControl);
  }

  return response;
}

/**
 * Create an error response
 */
export function errorResponse(
  message: string,
  status: number = 400
): NextResponse<{ error: string }> {
  return NextResponse.json({ error: message }, { status });
}
