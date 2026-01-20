import { NextResponse } from "next/server";
import { SyncContext, SyncHandler, createSyncError, createSyncResponse } from "./types";
import { syncService } from "@/lib/services/sync";

// Legacy handlers (kept for backward compatibility during migration)
import {
  handleLeagueSync,
  handleUserLeaguesSync,
  handleQuickSync,
  handleFullSync,
} from "./handlers/league";

// Keeper management handlers
import {
  handlePopulateKeepers,
  handleRecalculateKeeperYears,
} from "./handlers/keepers";

// Draft sync handlers
import {
  handleSyncDraftsOnly,
  handleSyncLeagueHistory,
  handleSyncLeagueChain,
} from "./handlers/drafts";

// Traded picks handlers
import { handleSyncTradedPicks } from "./handlers/traded-picks";

// Transaction sync (lightweight)
import { handleSyncTransactions } from "./handlers/transactions";

// Debug handlers
import {
  handleDebugKeepers,
  handleCheckSleeperKeepers,
  handleDebugTradedPicks,
} from "./handlers/debug";

// ============================================
// NEW UNIFIED SYNC HANDLERS
// ============================================

/**
 * Refresh - Quick roster update (2-5s)
 * Use case: Daily use, check current roster
 */
const handleRefresh: SyncHandler = async (context, body) => {
  const { leagueId } = body;

  if (!leagueId || typeof leagueId !== "string") {
    return createSyncError("leagueId is required for refresh", 400);
  }

  try {
    const result = await syncService.refresh(leagueId, context.userId);
    return createSyncResponse({
      success: true,
      message: result.message,
      data: result,
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "League not found") {
        return createSyncError("League not found", 404);
      }
      if (error.message.includes("access")) {
        return createSyncError(error.message, 403);
      }
    }
    throw error;
  }
};

/**
 * Sync - Standard full sync (10-20s)
 * Use case: After draft, after trades
 */
const handleSync: SyncHandler = async (context, body) => {
  const { leagueId } = body;

  if (!leagueId || typeof leagueId !== "string") {
    return createSyncError("leagueId is required for sync", 400);
  }

  try {
    const result = await syncService.sync(leagueId, context.userId);
    return createSyncResponse({
      success: true,
      message: result.message,
      data: result,
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "League not found") {
        return createSyncError("League not found", 404);
      }
      if (error.message.includes("access")) {
        return createSyncError(error.message, 403);
      }
    }
    throw error;
  }
};

/**
 * Sync History - All historical seasons (30-50s)
 * Use case: First-time setup, troubleshooting keeper costs
 */
const handleSyncHistory: SyncHandler = async (context, body) => {
  const { leagueId, maxSeasons = 5 } = body;

  if (!leagueId || typeof leagueId !== "string") {
    return createSyncError("leagueId is required for sync-history", 400);
  }

  try {
    const result = await syncService.syncHistory(
      leagueId,
      context.userId,
      typeof maxSeasons === "number" ? maxSeasons : 5
    );
    return createSyncResponse({
      success: true,
      message: result.message,
      data: result,
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "League not found") {
        return createSyncError("League not found", 404);
      }
      if (error.message.includes("access")) {
        return createSyncError(error.message, 403);
      }
    }
    throw error;
  }
};

/**
 * Sync Drafts - Sync all historical drafts (60-120s)
 * Use case: First-time setup, get draft pick history for keeper costs
 */
const handleSyncDrafts: SyncHandler = async (context, body) => {
  const { leagueId, maxSeasons = 5 } = body;

  if (!leagueId || typeof leagueId !== "string") {
    return createSyncError("leagueId is required for sync-drafts", 400);
  }

  try {
    const result = await syncService.syncDrafts(
      leagueId,
      context.userId,
      typeof maxSeasons === "number" ? maxSeasons : 5
    );
    return createSyncResponse({
      success: true,
      message: result.message,
      data: result,
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "League not found") {
        return createSyncError("League not found", 404);
      }
      if (error.message.includes("access")) {
        return createSyncError(error.message, 403);
      }
    }
    throw error;
  }
};

/**
 * Update Keepers - Recalculate keeper records from DB (5-15s)
 * Use case: Fix keeper eligibility/costs
 */
const handleUpdateKeepers: SyncHandler = async (context, body) => {
  const { leagueId, includeHistory = true } = body;

  if (!leagueId || typeof leagueId !== "string") {
    return createSyncError("leagueId is required for update-keepers", 400);
  }

  try {
    const result = await syncService.updateKeepers(
      leagueId,
      context.userId,
      includeHistory === true
    );
    return createSyncResponse({
      success: true,
      message: result.message,
      data: result,
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "League not found") {
        return createSyncError("League not found", 404);
      }
      if (error.message.includes("access")) {
        return createSyncError(error.message, 403);
      }
    }
    throw error;
  }
};

/**
 * Sync Players - Update all NFL players (Admin only, 10-30s)
 */
const handleSyncPlayers: SyncHandler = async () => {
  try {
    const result = await syncService.syncPlayers();
    return createSyncResponse({
      success: true,
      message: result.message,
      data: result,
    });
  } catch (error) {
    throw error;
  }
};

/**
 * Action handler map
 *
 * New unified actions (preferred):
 * - refresh: Quick roster update
 * - sync: Standard full sync
 * - sync-history: All historical seasons
 * - update-keepers: Recalculate keeper records
 * - sync-players: Update all NFL players (Admin)
 *
 * Legacy actions (backward compatible):
 * - league → sync
 * - user-leagues → (loops sync per league)
 * - quick → refresh
 * - full-sync → sync-history + update-keepers
 * - populate-keepers → update-keepers
 * - recalculate-keeper-years → update-keepers
 * - sync-transactions → part of sync
 * - sync-traded-picks → part of sync
 */
const actionHandlers: Record<string, SyncHandler> = {
  // ============================================
  // NEW UNIFIED ACTIONS (preferred)
  // ============================================
  refresh: handleRefresh,
  sync: handleSync,
  "sync-history": handleSyncHistory,
  "sync-drafts": handleSyncDrafts,
  "update-keepers": handleUpdateKeepers,
  "sync-players": handleSyncPlayers,

  // ============================================
  // LEGACY ACTIONS (backward compatible)
  // Keep these for one release cycle
  // ============================================

  // League sync (legacy)
  league: handleLeagueSync,
  "user-leagues": handleUserLeaguesSync,
  quick: handleQuickSync, // Maps to refresh
  "full-sync": handleFullSync, // Maps to sync-history + update-keepers

  // Keeper management (legacy)
  "populate-keepers": handlePopulateKeepers, // Maps to update-keepers
  "recalculate-keeper-years": handleRecalculateKeeperYears, // Maps to update-keepers

  // Draft sync (legacy - specialized)
  "sync-drafts-only": handleSyncDraftsOnly,
  "sync-league-history": handleSyncLeagueHistory,
  "sync-league-chain": handleSyncLeagueChain,

  // Traded picks (legacy - now part of sync)
  "sync-traded-picks": handleSyncTradedPicks,

  // Transactions (legacy - now part of sync)
  "sync-transactions": handleSyncTransactions,

  // Debug utilities (keep as-is)
  "debug-keepers": handleDebugKeepers,
  "check-sleeper-keepers": handleCheckSleeperKeepers,
  "debug-traded-picks": handleDebugTradedPicks,
};

/**
 * Route sync action to appropriate handler
 */
export async function routeSyncAction(
  action: string,
  context: SyncContext,
  body: Record<string, unknown>
): Promise<NextResponse> {
  const handler = actionHandlers[action];

  if (!handler) {
    const validActions = Object.keys(actionHandlers).join(", ");
    return createSyncError(
      `Invalid action. Valid actions: ${validActions}`,
      400
    );
  }

  return handler(context, body);
}

// Re-export types
export * from "./types";
