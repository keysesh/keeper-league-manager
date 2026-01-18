/**
 * Sync NFLverse Stats
 *
 * Simple CLI wrapper that calls the /api/nflverse/sync endpoint.
 * This ensures consistent behavior with the web app.
 *
 * Usage: npx ts-node scripts/sync-nflverse-stats.ts [season]
 * Example: npx ts-node scripts/sync-nflverse-stats.ts 2025
 *
 * Environment:
 *   ADMIN_API_KEY - Required for authentication
 *   API_BASE_URL - Optional, defaults to production
 */

import "dotenv/config";

const API_BASE_URL =
  process.env.API_BASE_URL || "https://keeper-league-manager.vercel.app";
const ADMIN_API_KEY = process.env.ADMIN_API_KEY;

interface SyncResult {
  success: boolean;
  season: number;
  type: string;
  result: {
    stats?: {
      success: boolean;
      playersUpdated: number;
      playersFailed: number;
      errors: string[];
      duration: number;
    };
  };
}

async function syncStats(season: number) {
  if (!ADMIN_API_KEY) {
    console.error("Error: ADMIN_API_KEY environment variable is required");
    process.exit(1);
  }

  console.log(`\n=== Syncing NFLverse Stats for ${season} ===\n`);
  console.log(`API: ${API_BASE_URL}`);

  const url = `${API_BASE_URL}/api/nflverse/sync?type=stats&season=${season}`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "x-admin-key": ADMIN_API_KEY,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`API request failed: ${response.status} - ${text}`);
  }

  const data: SyncResult = await response.json();

  if (!data.success || !data.result.stats?.success) {
    console.error("Sync failed:", data.result.stats?.errors || "Unknown error");
    process.exit(1);
  }

  const stats = data.result.stats;
  console.log(`\n=== Sync Complete ===`);
  console.log(`Players updated: ${stats.playersUpdated}`);
  console.log(`Players failed: ${stats.playersFailed}`);
  console.log(`Duration: ${(stats.duration / 1000).toFixed(1)}s`);

  if (stats.errors.length > 0) {
    console.log(`\nWarnings:`);
    stats.errors.forEach((err) => console.log(`  - ${err}`));
  }
}

// Main
const season = parseInt(process.argv[2]) || new Date().getFullYear() - 1;

syncStats(season)
  .then(() => {
    console.log("\nDone!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Error syncing stats:", error.message);
    process.exit(1);
  });
