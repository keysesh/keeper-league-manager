import { NextResponse } from "next/server";
import { SyncContext, SyncHandler, createSyncError } from "./types";

// League sync handlers
import {
  handleLeagueSync,
  handleUserLeaguesSync,
  handleQuickSync,
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

// Debug handlers
import {
  handleDebugKeepers,
  handleCheckSleeperKeepers,
  handleDebugTradedPicks,
} from "./handlers/debug";

/**
 * Action handler map
 */
const actionHandlers: Record<string, SyncHandler> = {
  // League sync
  league: handleLeagueSync,
  "user-leagues": handleUserLeaguesSync,
  quick: handleQuickSync,

  // Keeper management
  "populate-keepers": handlePopulateKeepers,
  "recalculate-keeper-years": handleRecalculateKeeperYears,

  // Draft sync
  "sync-drafts-only": handleSyncDraftsOnly,
  "sync-league-history": handleSyncLeagueHistory,
  "sync-league-chain": handleSyncLeagueChain,

  // Traded picks
  "sync-traded-picks": handleSyncTradedPicks,

  // Debug utilities
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
