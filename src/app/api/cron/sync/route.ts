/**
 * Cron Sync API Route
 * GET /api/cron/sync - Periodic sync of all users and leagues
 *
 * This endpoint is called by Vercel Cron to keep data in sync with Sleeper.
 * It syncs: rosters, transactions (trades, waivers, FA), draft picks, etc.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { syncLeague } from "@/lib/sleeper/sync";
import { rebuildAcquisitionChainIfChanged, type ChainRebuildResult } from "@/lib/sleeper/acquisition-chain-gate";
import { resyncKeeperBaseCosts, type ResyncResult } from "@/lib/keeper/resync-base-costs";
import { getPlanningSeasonForLeague } from "@/lib/keeper/planning-season-db";
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
        season: true,
        status: true,
      },
      orderBy: { season: "desc" },
    });

    const results = {
      leaguesSynced: 0,
      transactionsSynced: 0,
      acquisitionChain: null as null | (ChainRebuildResult & { ms: number }),
      keeperCosts: null as null | (ResyncResult & { ms: number }),
      errors: [] as string[],
    };

    // Sync each league's rosters and transactions
    for (const league of leagues) {
      try {
        // A COMPLETE season's transaction log and drafts are frozen on Sleeper —
        // re-pulling ~400 transactions per historical league every run cost
        // minutes of the 5-minute budget for nothing. Rosters/members still
        // sync (cheap). The live league syncs everything: trades change keeper
        // costs, and its draft row (start time + status) is what the keeper
        // deadline and planning season are derived from.
        const frozen = league.status === "COMPLETE";
        await syncLeague(league.sleeperId, {
          skipTransactions: frozen,
          skipDrafts: frozen,
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

    // Trades and pickups only change keeper COSTS once the acquisition chain
    // is rebuilt (it is what the cost engine reads). It walks the whole league
    // chain, so run it once, from the newest league that is still live — and
    // only when a draft pick, transaction, or correction actually changed: a
    // full rebuild costs ~220s of the 300s budget.
    const liveLeague = leagues.find((l) => l.status !== "COMPLETE");
    let chainOk = false;
    if (liveLeague) {
      const startedAt = Date.now();
      try {
        const chain = await rebuildAcquisitionChainIfChanged(liveLeague.id);
        results.acquisitionChain = { ...chain, ms: Date.now() - startedAt };
        chainOk = true;
        logger.info(chain.skipped ? "Acquisition chain unchanged, rebuild skipped" : "Rebuilt acquisition chain via cron", { ...results.acquisitionChain });
      } catch (err) {
        const errorMsg = `Failed to rebuild acquisition chain for ${liveLeague.name}: ${err instanceof Error ? err.message : err}`;
        results.errors.push(errorMsg);
        logger.error("Cron acquisition chain sync failed", err, { leagueId: liveLeague.id, ms: Date.now() - startedAt });
      }
    }

    // Rebuilding the chain changes what a keeper COSTS, but Keeper.baseCost is
    // written once when the keeper is saved and never recomputed — the cascade
    // only ever rewrites finalCost. Without this step a trade updates the
    // derivation and leaves every saved keeper showing its old price until
    // someone happens to re-save it by hand. Cheap and idempotent: it writes
    // only the rows that actually differ, and refuses a season whose draft has
    // already completed, whose rows are the record of what was drafted.
    //
    // Skipped when the chain rebuild threw, since a half-written chain would
    // price keepers off incomplete history.
    if (liveLeague && chainOk) {
      const startedAt = Date.now();
      try {
        const season = await getPlanningSeasonForLeague(liveLeague.id);
        const resync = await resyncKeeperBaseCosts(liveLeague.id, season, { apply: true });
        results.keeperCosts = { ...resync, ms: Date.now() - startedAt };
        results.errors.push(...resync.cascadeErrors);
        if (resync.written > 0) {
          logger.info("Re-derived keeper base costs via cron", { ...results.keeperCosts });
        }
      } catch (err) {
        const errorMsg = `Failed to re-derive keeper costs for ${liveLeague.name}: ${err instanceof Error ? err.message : err}`;
        results.errors.push(errorMsg);
        logger.error("Cron keeper cost resync failed", err, { leagueId: liveLeague.id, ms: Date.now() - startedAt });
      }
    }

    // Also sync any new users who may not have been synced during registration
    const unsyncedUsers = await prisma.user.findMany({
      where: {
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
