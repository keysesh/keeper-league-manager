/**
 * Dry-Run Base Cost Migration v2
 *
 * Rules for finding the TRUE original draft round:
 *
 * 2023 DRAFTS (league's first synced year):
 *   - Aug 25 draft (SNAKE, 115 picks, id: cmjudv09x00w7du6ftklc2u0n) = correct ROUNDS
 *   - Aug 27 draft (LINEAR, 186 picks, id: cmjudv02500w5du6fyzufotn8) = correct OWNERS
 *   - For each player: use Aug 27 to confirm owner, use Aug 25 round as original draft round
 *   - Exception: Kelce (original R3 predates synced data → needs baseCostOverride)
 *
 * 2024 DRAFTS (error + correction):
 *   - Aug 25 drafts (66 picks + 0 picks) = error drafts with wrong roster assignments
 *   - Aug 30 draft (186 picks, id: cmjudui9f00lmdu6f8979ce9e) = correction with correct owners
 *   - For players already drafted in 2023: original round comes from 2023 Aug 25 draft
 *   - For rookies drafted in 2024: use Aug 30 draft round (but these may also be cascade-adjusted)
 *
 * 2025 DRAFT (clean):
 *   - Single draft, no errors
 *
 * GENERAL RULES:
 *   - base_cost = max(1, original_round - (years_kept - 1))
 *   - Waiver/FA pickup = R8 (undrafted round)
 *   - Trade inherits original drafter's round (trace chain)
 *   - Post-deadline trade resets years but preserves round
 *   - Same-season waiver before deadline inherits previous owner's value
 *
 * Run: node scripts/dry-run-base-cost-migration.js
 */

const { Client } = require("pg");
const fs = require("fs");
const path = require("path");

const envPath = path.join(__dirname, "..", ".env.local");
const envContent = fs.readFileSync(envPath, "utf8");
const dbUrlMatch = envContent.match(/^DATABASE_URL="([^"]+)"/m);
if (!dbUrlMatch) {
  console.error("DATABASE_URL not found in .env.local");
  process.exit(1);
}

const UNDRAFTED_ROUND = 8;
const MIN_ROUND = 1;

// Known draft IDs
const DRAFT_2023_AUG25 = "cmjudv09x00w7du6ftklc2u0n"; // Correct rounds
const DRAFT_2023_AUG27 = "cmjudv02500w5du6fyzufotn8"; // Correct owners
const DRAFT_2024_AUG25_66 = "cmjuduim300lodu6fy5d7kbo5"; // Error draft
const DRAFT_2024_AUG25_0 = "cmjuduj1000lqdu6foy3y5p1f"; // Aborted
const DRAFT_2024_AUG30 = "cmjudui9f00lmdu6f8979ce9e"; // Correct owners
const DRAFT_2025 = "cmjuieh0k009da7gvsc3en367"; // Clean

const client = new Client({
  connectionString: dbUrlMatch[1],
  ssl: { rejectUnauthorized: false },
});

async function run() {
  await client.connect();
  console.log("Connected to database.\n");

  // Fetch all data upfront
  const keepers = (await client.query(`
    SELECT k.id, k.player_id, k.roster_id, k.season, k.type,
           k.base_cost, k.final_cost, k.years_kept, k.notes,
           r.sleeper_id AS owner_sleeper_id, r.team_name, p.full_name
    FROM keepers k
    JOIN rosters r ON k.roster_id = r.id
    JOIN players p ON k.player_id = p.id
    ORDER BY p.full_name, k.season
  `)).rows;

  const allPicks = (await client.query(`
    SELECT dp.player_id, dp.round, dp.is_keeper, dp.draft_id,
           d.season, r.sleeper_id, r.team_name
    FROM draft_picks dp
    JOIN drafts d ON dp.draft_id = d.id
    JOIN rosters r ON dp.roster_id = r.id
    WHERE dp.player_id IS NOT NULL
    ORDER BY d.season ASC, dp.pick_number ASC
  `)).rows;

  const trades = (await client.query(`
    SELECT tp.player_id, tp.from_roster_id, tp.to_roster_id,
           t.type, t.created_at,
           rf.sleeper_id AS from_sleeper, rt.sleeper_id AS to_sleeper
    FROM transaction_players tp
    JOIN transactions t ON tp.transaction_id = t.id
    LEFT JOIN rosters rf ON tp.from_roster_id = rf.id
    LEFT JOIN rosters rt ON tp.to_roster_id = rt.id
    WHERE t.type = 'TRADE'
    ORDER BY t.created_at DESC
  `)).rows;

  // Build lookups
  const picksByPlayer = new Map();
  for (const p of allPicks) {
    if (!picksByPlayer.has(p.player_id)) picksByPlayer.set(p.player_id, []);
    picksByPlayer.get(p.player_id).push(p);
  }

  const tradesByPlayer = new Map();
  for (const t of trades) {
    if (!tradesByPlayer.has(t.player_id)) tradesByPlayer.set(t.player_id, []);
    tradesByPlayer.get(t.player_id).push(t);
  }

  /**
   * Find the TRUE original draft round for a player.
   *
   * Strategy:
   * 1. Check 2023 Aug 25 draft (SNAKE) for original non-keeper pick
   *    - This has the correct rounds for the league's first year
   * 2. If not found there (rookie drafted later), check 2024/2025 drafts
   * 3. For traded players, trace chain back to original drafter
   * 4. For waiver pickups with no draft history, return null (= R8)
   */
  function findTrueOriginalRound(playerId, ownerSleeperId, visited = new Set()) {
    if (visited.has(ownerSleeperId)) return null;
    visited.add(ownerSleeperId);

    const picks = picksByPlayer.get(playerId) || [];

    // Step 1: Check 2023 Aug 25 draft (correct rounds)
    // Look for ANY non-keeper pick in this draft (regardless of owner — owner may be wrong)
    const aug25_2023_pick = picks.find(
      (p) => p.draft_id === DRAFT_2023_AUG25 && !p.is_keeper
    );

    if (aug25_2023_pick) {
      // Verify this player belongs to this owner via Aug 27 draft
      const aug27_pick = picks.find(
        (p) => p.draft_id === DRAFT_2023_AUG27 && p.sleeper_id === ownerSleeperId
      );

      // Also check if owner has this player via trade from the Aug 25 drafter
      const playerTrades = tradesByPlayer.get(playerId) || [];
      const tradedToOwner = playerTrades.find((t) => t.to_sleeper === ownerSleeperId);

      if (aug27_pick || tradedToOwner) {
        return {
          round: aug25_2023_pick.round,
          season: 2023,
          source: "2023_aug25_draft",
        };
      }

      // If the Aug 25 drafter is a different owner who later traded to someone
      // who then traded to current owner, trace the chain
      if (!aug27_pick && !tradedToOwner) {
        // Check if original drafter traded to someone who traded to us
        const originalDrafterSleeper = aug25_2023_pick.sleeper_id;
        const chainTrade = playerTrades.find(
          (t) => t.from_sleeper === originalDrafterSleeper
        );
        if (chainTrade) {
          // Original drafter traded this player — the round is still the original
          return {
            round: aug25_2023_pick.round,
            season: 2023,
            source: "2023_aug25_trade_chain",
          };
        }
      }
    }

    // Step 2: Check owner's own non-keeper draft picks (2024, 2025)
    // Skip error drafts (Aug 25 2024 drafts)
    const ownerNonKeeperPicks = picks.filter(
      (p) =>
        p.sleeper_id === ownerSleeperId &&
        !p.is_keeper &&
        p.draft_id !== DRAFT_2024_AUG25_66 &&
        p.draft_id !== DRAFT_2024_AUG25_0
    );

    // For 2024+: if player was already drafted in 2023, prefer that round
    // Only use 2024/2025 round for TRUE first-time drafts (rookies)
    const nonErrorPicks = ownerNonKeeperPicks.filter(
      (p) => p.draft_id !== DRAFT_2023_AUG27 // Aug 27 picks are cascade-adjusted
    );

    if (nonErrorPicks.length > 0) {
      // Use earliest non-error, non-keeper pick
      const earliest = nonErrorPicks.sort((a, b) => a.season - b.season)[0];

      // But check: was this player ALSO in the 2023 Aug 25 draft by a different owner?
      // If so, the 2023 round is the original — this owner got them via trade
      if (aug25_2023_pick && earliest.season > 2023) {
        return {
          round: aug25_2023_pick.round,
          season: 2023,
          source: "2023_aug25_trade_inherited",
        };
      }

      return {
        round: earliest.round,
        season: earliest.season,
        source: "owner_draft",
      };
    }

    // Step 3: Check trade chain
    const playerTrades = tradesByPlayer.get(playerId) || [];
    const tradeToOwner = playerTrades.find((t) => t.to_sleeper === ownerSleeperId);

    if (tradeToOwner && tradeToOwner.from_sleeper) {
      const inherited = findTrueOriginalRound(
        playerId,
        tradeToOwner.from_sleeper,
        visited
      );
      if (inherited) {
        return { ...inherited, source: inherited.source + "_via_trade" };
      }
    }

    // Step 4: Check if player exists in 2023 Aug 25 draft at all (any owner)
    // This handles cases where the trade chain is incomplete
    if (aug25_2023_pick) {
      return {
        round: aug25_2023_pick.round,
        season: 2023,
        source: "2023_aug25_fallback",
      };
    }

    return null;
  }

  // Process each keeper record
  const results = [];
  for (const k of keepers) {
    const original = findTrueOriginalRound(k.player_id, k.owner_sleeper_id);

    let expectedBase;
    let reason;

    if (original) {
      expectedBase = Math.max(MIN_ROUND, original.round - (k.years_kept - 1));
      reason = `R${original.round} (${original.source}) - ${k.years_kept - 1}yr = R${expectedBase}`;
    } else {
      expectedBase = Math.max(MIN_ROUND, UNDRAFTED_ROUND - (k.years_kept - 1));
      reason = `R${UNDRAFTED_ROUND} (waiver/FA) - ${k.years_kept - 1}yr = R${expectedBase}`;
    }

    let status;
    if (k.base_cost === expectedBase) {
      status = "OK";
    } else if (!original) {
      status = "REVIEW";
    } else {
      status = "CHANGE";
    }

    results.push({
      player: k.full_name,
      season: k.season,
      type: k.type,
      team: k.team_name,
      stored_base: k.base_cost,
      expected_base: expectedBase,
      stored_final: k.final_cost,
      years_kept: k.years_kept,
      status,
      reason,
      keeper_id: k.id,
    });
  }

  // Output
  const changes = results.filter((r) => r.status === "CHANGE");
  const reviews = results.filter((r) => r.status === "REVIEW");
  const oks = results.filter((r) => r.status === "OK");

  console.log("═".repeat(80));
  console.log(`CHANGES NEEDED: ${changes.length} records across ${new Set(changes.map((r) => r.player)).size} players`);
  console.log("═".repeat(80));
  if (changes.length > 0) {
    console.table(
      changes.map((r) => ({
        player: r.player,
        season: r.season,
        stored: `R${r.stored_base}`,
        "→": "→",
        expected: `R${r.expected_base}`,
        years: r.years_kept,
        reason: r.reason,
        team: r.team,
      }))
    );
  }

  console.log("\n" + "═".repeat(80));
  console.log(`NEEDS REVIEW: ${reviews.length} records`);
  console.log("═".repeat(80));
  if (reviews.length > 0) {
    console.table(
      reviews.map((r) => ({
        player: r.player,
        season: r.season,
        stored: `R${r.stored_base}`,
        expected: `R${r.expected_base}`,
        years: r.years_kept,
        team: r.team,
      }))
    );
  }

  console.log("\n" + "═".repeat(80));
  console.log(`OK: ${oks.length} records`);
  console.log("═".repeat(80));

  console.log("\n=== SUMMARY ===");
  console.log(`Total keeper records: ${results.length}`);
  console.log(`Will change: ${changes.length}`);
  console.log(`Needs review: ${reviews.length}`);
  console.log(`Already correct: ${oks.length}`);

  // Generate SQL
  if (changes.length > 0) {
    console.log("\n" + "═".repeat(80));
    console.log("MIGRATION SQL (review before running):");
    console.log("═".repeat(80));
    console.log("BEGIN;\n");
    for (const c of changes) {
      console.log(`-- ${c.player} (${c.season}): R${c.stored_base} → R${c.expected_base} | ${c.reason}`);
      console.log(`UPDATE keepers SET base_cost = ${c.expected_base} WHERE id = '${c.keeper_id}';`);
    }
    console.log("\n-- COMMIT;  -- Uncomment to apply");
    console.log("ROLLBACK;  -- Safe by default");
  }

  // Orphan cleanup
  console.log("\n" + "═".repeat(80));
  console.log("ORPHAN CLEANUP:");
  console.log("═".repeat(80));

  const orphanLamar = await client.query(`
    SELECT k.id, p.full_name, k.season, r.team_name
    FROM keepers k JOIN players p ON k.player_id = p.id JOIN rosters r ON k.roster_id = r.id
    WHERE p.full_name = 'Lamar Jackson' AND r.sleeper_id = '1000541309863559168'
  `);
  if (orphanLamar.rows.length > 0) {
    console.log("Orphan Lamar Jackson keeper on Jaxon's My Njigba:");
    for (const row of orphanLamar.rows) {
      console.log(`  DELETE FROM keepers WHERE id = '${row.id}'; -- ${row.full_name} ${row.season} ${row.team_name}`);
    }
  }

  // Kelce override note
  console.log("\nMANUAL OVERRIDE NEEDED:");
  console.log("  Travis Kelce — original R3 predates synced data.");
  console.log("  After migration, set baseCostOverride = 3 via commissioner override endpoint.");

  await client.end();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
