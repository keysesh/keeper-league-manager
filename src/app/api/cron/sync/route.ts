/**
 * Cron Sync API Route
 * GET /api/cron/sync - Periodic sync of all users and leagues
 *
 * This endpoint is called by Vercel Cron to keep data in sync with Sleeper.
 * It syncs: rosters, transactions (trades, waivers, FA), draft picks, etc.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { syncLeague, syncTransactions } from "@/lib/sleeper/sync";
import { logger } from "@/lib/logger";

// Vercel Cron sends this header to authenticate
const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(request: NextRequest) {
  try {
    // Verify the request is from Vercel Cron (or allow in development)
    const authHeader = request.headers.get("authorization");
    if (process.env.NODE_ENV === "production") {
      if (!CRON_SECRET) {
        logger.error("CRON_SECRET not configured");
        return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
      }
      if (authHeader !== `Bearer ${CRON_SECRET}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    logger.info("Starting scheduled sync");

    // Get all leagues that have been synced before
    const leagues = await prisma.league.findMany({
      where: {
        lastSyncedAt: { not: null },
      },
      select: {
        id: true,
        sleeperId: true,
        name: true,
      },
    });

    const results = {
      leaguesSynced: 0,
      transactionsSynced: 0,
      errors: [] as string[],
    };

    // Sync each league's rosters and transactions
    for (const league of leagues) {
      try {
        // Quick sync - just rosters (fast)
        await syncLeague(league.sleeperId, {
          skipTransactions: false, // Include transactions to catch trades
          skipDrafts: true, // Skip drafts for speed (they don't change often)
        });
        results.leaguesSynced++;

        logger.info("Synced league via cron", {
          leagueId: league.id,
          name: league.name
        });
      } catch (err) {
        const errorMsg = `Failed to sync league ${league.name}: ${err instanceof Error ? err.message : err}`;
        results.errors.push(errorMsg);
        logger.error("Cron sync failed for league", err, { leagueId: league.id });
      }
    }

    // Also sync any new users who may not have been synced during registration
    const unsyncedUsers = await prisma.user.findMany({
      where: {
        sleeperId: { not: null },
        teamMemberships: { none: {} }, // Users with no team memberships
      },
      select: {
        id: true,
        sleeperId: true,
        sleeperUsername: true,
      },
    });

    if (unsyncedUsers.length > 0) {
      logger.info("Found unsynced users", { count: unsyncedUsers.length });

      // Import dynamically to avoid circular dependency
      const { syncUserLeagues } = await import("@/lib/sleeper/sync");

      for (const user of unsyncedUsers) {
        try {
          await syncUserLeagues(user.id);
          logger.info("Synced unsynced user", {
            userId: user.id,
            username: user.sleeperUsername
          });
        } catch (err) {
          logger.error("Failed to sync user", err, { userId: user.id });
        }
      }
    }

    logger.info("Scheduled sync complete", results);

    return NextResponse.json({
      success: true,
      ...results,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("Cron sync failed", error);
    return NextResponse.json(
      { error: "Sync failed", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

// Vercel Cron requires this config
export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 minutes max for Pro plan
