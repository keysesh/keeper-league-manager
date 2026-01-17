import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { routeSyncAction, SyncContext } from "@/lib/sync";
import { SyncRequestSchema, validateBody } from "@/lib/validations";
import { UnauthorizedError, createErrorResponse } from "@/lib/errors";
import {
  checkRateLimit,
  createRateLimitResponse,
  addRateLimitHeaders,
  RATE_LIMITS,
} from "@/lib/rate-limit";

// Extend timeout for sync operations (requires Vercel Pro for >10s)
export const maxDuration = 60;

/**
 * POST /api/sleeper/sync
 * Sync league data from Sleeper
 *
 * Supported actions:
 * - league: Sync a specific league by Sleeper ID
 * - user-leagues: Sync all leagues for the authenticated user
 * - quick: Quick sync (rosters only)
 * - populate-keepers: Create keeper records from draft picks
 * - recalculate-keeper-years: Recalculate yearsKept for all keepers
 * - sync-drafts-only: Lightweight draft sync
 * - sync-league-history: Sync historical drafts by following previous_league_id
 * - sync-league-chain: Sync drafts from multiple Sleeper league IDs
 * - sync-traded-picks: Sync traded picks from Sleeper
 * - debug-keepers: Debug keeper records
 * - check-sleeper-keepers: Check Sleeper API for keeper data
 * - debug-traded-picks: Debug traded picks
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      throw new UnauthorizedError();
    }

    // Apply rate limiting
    const rateLimit = await checkRateLimit(session.user.id, RATE_LIMITS.sync);
    if (!rateLimit.success) {
      return createRateLimitResponse(
        rateLimit.remaining,
        rateLimit.reset,
        rateLimit.limit
      );
    }

    const body = await request.json();
    const validated = validateBody(SyncRequestSchema, body);

    const context: SyncContext = {
      userId: session.user.id,
      leagueId: validated.leagueId,
      sleeperLeagueId: validated.sleeperLeagueId,
    };

    const response = await routeSyncAction(validated.action, context, body);
    return addRateLimitHeaders(
      response,
      rateLimit.remaining,
      rateLimit.reset,
      rateLimit.limit
    );
  } catch (error) {
    return createErrorResponse(error, { action: "sync" });
  }
}

/**
 * GET /api/sleeper/sync
 * Get sync status for a league
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      throw new UnauthorizedError();
    }

    const { searchParams } = new URL(request.url);
    const leagueId = searchParams.get("leagueId");

    if (!leagueId) {
      throw new (await import("@/lib/errors")).ValidationError(
        "leagueId is required",
        { leagueId: ["Required"] }
      );
    }

    const league = await prisma.league.findUnique({
      where: { id: leagueId },
      select: {
        id: true,
        name: true,
        lastSyncedAt: true,
        rosters: {
          select: { id: true },
        },
      },
    });

    if (!league) {
      throw new (await import("@/lib/errors")).NotFoundError("League", leagueId);
    }

    return NextResponse.json({
      leagueId: league.id,
      name: league.name,
      lastSyncedAt: league.lastSyncedAt,
      rosterCount: league.rosters.length,
      needsSync: !league.lastSyncedAt ||
        (new Date().getTime() - league.lastSyncedAt.getTime()) > 3600000, // 1 hour
    });
  } catch (error) {
    return createErrorResponse(error, { action: "get_sync_status" });
  }
}
