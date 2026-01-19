/**
 * Local sync test - runs syncNFLVerseStats directly
 */
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { syncNFLVerseStats } from "../src/lib/nflverse/sync";

async function main() {
  console.log("Starting local sync test...\n");

  const result = await syncNFLVerseStats(2025);

  console.log("\n=== Sync Result ===");
  console.log(`Success: ${result.success}`);
  console.log(`Players Updated: ${result.playersUpdated}`);
  console.log(`Players Failed: ${result.playersFailed}`);
  console.log(`Duration: ${(result.duration / 1000).toFixed(1)}s`);

  if (result.errors.length > 0) {
    console.log(`\nErrors:`);
    result.errors.forEach(e => console.log(`  - ${e}`));
  }

  if (result.debug) {
    console.log("\n=== Debug Info ===");
    console.log(`DB Players: ${result.debug.dbPlayerCount}`);
    console.log(`GSIS→Sleeper mappings: ${result.debug.gsisToSleeperCount}`);
    console.log(`NFLverse stats rows: ${result.debug.statsCount}`);
    console.log(`Unmatched with >50 PPR: ${result.debug.unmatchedWithStats}`);

    if (result.debug.unmatchedPlayers && (result.debug.unmatchedPlayers as string[]).length > 0) {
      console.log("\nUnmatched Players (fantasy-relevant):");
      (result.debug.unmatchedPlayers as string[]).forEach((p: string) => console.log(`  - ${p}`));
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error("Error:", err);
    process.exit(1);
  });
