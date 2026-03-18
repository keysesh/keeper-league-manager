/**
 * Backfill Player Acquisitions v2
 *
 * Builds clean PlayerAcquisition records from existing data.
 *
 * ALGORITHM:
 * 1. For 2023: Cross-reference Aug 24 (correct rounds) + Aug 27 (correct owners)
 *    → one DRAFTED acquisition per player with correct round + correct owner
 * 2. For 2024: Use 2023 acquisitions as base. Only create new DRAFTED for
 *    players NOT already in the system (rookies). Skip error draft picks.
 * 3. For 2025: Clean draft, straightforward.
 * 4. Process ALL transactions chronologically across all seasons.
 *    Trades close old acquisition + create new (inheriting originalDraftRound).
 *    Waivers/FA create new records.
 * 5. Validate against keeper records.
 *
 * Run: node scripts/backfill-acquisitions.js [--dry-run]
 */

const { Client } = require("pg");
const fs = require("fs");
const path = require("path");

const envPath = path.join(__dirname, "..", ".env.local");
const url = fs.readFileSync(envPath, "utf8").match(/^DATABASE_URL="([^"]+)"/m)[1];
const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });

const UNDRAFTED_ROUND = 8;
const TRADE_DEADLINE_WEEK = 11;
const isDryRun = process.argv.includes("--dry-run");

function getSeasonFromDate(date) {
  const month = date.getMonth();
  return month < 2 ? date.getFullYear() - 1 : date.getFullYear();
}

function isAfterDeadline(tradeDate, season) {
  const month = tradeDate.getMonth();
  const year = tradeDate.getFullYear();
  const deadlineDay = 7 + (TRADE_DEADLINE_WEEK - 1) * 7;
  if (year === season) {
    if (month < 8) return false;
    if (month < 10) return false;
    if (month === 10) return tradeDate.getDate() > deadlineDay;
    return true;
  }
  if (year === season + 1) return month < 8;
  return false;
}

async function run() {
  await client.connect();
  console.log("Connected.\n");

  // Ensure table exists
  await client.query(`
    DO $$ BEGIN
      CREATE TYPE "DispositionType" AS ENUM ('DROPPED', 'TRADED', 'SEASON_END');
    EXCEPTION WHEN duplicate_object THEN null; END $$;
    CREATE TABLE IF NOT EXISTS player_acquisitions (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
      owner_sleeper_id TEXT NOT NULL, league_id TEXT NOT NULL, season INT NOT NULL,
      acquisition_type "AcquisitionType" NOT NULL, acquisition_date TIMESTAMP NOT NULL,
      original_draft_round INT, original_draft_season INT,
      original_drafter_sleeper_id TEXT, from_owner_sleeper_id TEXT,
      is_pre_deadline BOOLEAN, sleeper_transaction_id TEXT, sleeper_draft_id TEXT,
      disposition_type "DispositionType", disposition_date TIMESTAMP,
      base_cost_override INT, notes TEXT,
      created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(player_id, owner_sleeper_id, season, acquisition_date)
    );
  `);

  // Load draft corrections
  const corrections = (await client.query(`
    SELECT dc.season, dc.role, d.id AS draft_db_id, d.sleeper_id AS draft_sleeper_id
    FROM draft_corrections dc
    JOIN drafts d ON d.sleeper_id = dc.draft_sleeper_id
    ORDER BY dc.season
  `)).rows;

  const getDraft = (season, role) => corrections.find(c => c.season === season && c.role === role);

  // Load ALL draft picks
  const allPicks = (await client.query(`
    SELECT dp.player_id, dp.round, dp.is_keeper, dp.pick_number,
           d.id AS draft_db_id, d.sleeper_id AS draft_sleeper_id,
           d.season, d.league_id,
           r.sleeper_id AS owner_sleeper_id
    FROM draft_picks dp
    JOIN drafts d ON dp.draft_id = d.id
    JOIN rosters r ON dp.roster_id = r.id
    WHERE dp.player_id IS NOT NULL
    ORDER BY d.season ASC, dp.pick_number ASC
  `)).rows;

  // Load ALL transactions chronologically
  const allTx = (await client.query(`
    SELECT tp.player_id, tp.from_roster_id, tp.to_roster_id,
           t.type, t.created_at, t.sleeper_id AS tx_sleeper_id, t.league_id,
           rf.sleeper_id AS from_sleeper, rt.sleeper_id AS to_sleeper
    FROM transaction_players tp
    JOIN transactions t ON tp.transaction_id = t.id
    LEFT JOIN rosters rf ON tp.from_roster_id = rf.id
    LEFT JOIN rosters rt ON tp.to_roster_id = rt.id
    ORDER BY t.created_at ASC
  `)).rows;

  // ===== Acquisition chain state =====
  // player_id -> { owner, originalDraftRound, originalDraftSeason, originalDrafter, open: bool }
  const currentState = new Map();
  const insertQueue = [];

  function addAcq(record) {
    insertQueue.push(record);
    // Update current state
    currentState.set(record.player_id, {
      owner: record.owner_sleeper_id,
      originalDraftRound: record.original_draft_round,
      originalDraftSeason: record.original_draft_season,
      originalDrafter: record.original_drafter_sleeper_id,
      open: !record.disposition_type,
      league_id: record.league_id,
    });
  }

  function closeCurrentOwner(playerId, dispositionType, dispositionDate) {
    const state = currentState.get(playerId);
    if (state && state.open) {
      // Find the open record in insertQueue and close it
      for (let i = insertQueue.length - 1; i >= 0; i--) {
        if (insertQueue[i].player_id === playerId && !insertQueue[i].disposition_type) {
          insertQueue[i].disposition_type = dispositionType;
          insertQueue[i].disposition_date = dispositionDate;
          break;
        }
      }
      state.open = false;
      return state; // Return for inheritance
    }
    return null;
  }

  // ===== PHASE 1: Process 2023 draft (cross-reference) =====
  console.log("Phase 1: Processing 2023 drafts...");
  const rounds2023 = getDraft(2023, "CORRECT_ROUNDS");
  const owners2023 = getDraft(2023, "CORRECT_OWNERS");

  if (rounds2023 && owners2023) {
    // Build: player_id -> correct round from Aug 24 draft
    const roundsByPlayer = new Map();
    for (const p of allPicks) {
      if (p.draft_db_id === rounds2023.draft_db_id && !p.is_keeper) {
        if (!roundsByPlayer.has(p.player_id)) {
          roundsByPlayer.set(p.player_id, { round: p.round, owner: p.owner_sleeper_id });
        }
      }
    }

    // Build: player_id -> correct owner from Aug 27 draft
    const ownersByPlayer = new Map();
    for (const p of allPicks) {
      if (p.draft_db_id === owners2023.draft_db_id) {
        if (!ownersByPlayer.has(p.player_id)) {
          ownersByPlayer.set(p.player_id, {
            owner: p.owner_sleeper_id,
            isKeeper: p.is_keeper,
            round: p.round,
            league_id: p.league_id,
          });
        }
      }
    }

    // Cross-reference: for each player in the owners draft, get the true round
    const processedPlayers = new Set();
    for (const [playerId, ownerInfo] of ownersByPlayer) {
      if (processedPlayers.has(playerId)) continue;
      processedPlayers.add(playerId);

      const roundInfo = roundsByPlayer.get(playerId);
      // Use Aug 24 round if available (correct rounds draft), otherwise fall back
      // to Aug 27 round. Aug 24 only has 74 players; Aug 27 has 160.
      // For keepers from pre-synced data, Aug 27 round is cascade-adjusted — will
      // need baseCostOverride. For freshly drafted players, Aug 27 round is correct.
      const trueRound = roundInfo ? roundInfo.round : (ownerInfo.isKeeper ? null : ownerInfo.round);

      addAcq({
        player_id: playerId,
        owner_sleeper_id: ownerInfo.owner,
        league_id: ownerInfo.league_id,
        season: 2023,
        acquisition_type: "DRAFTED",
        acquisition_date: new Date("2023-08-27"),
        original_draft_round: trueRound,
        original_draft_season: trueRound ? 2023 : null,
        original_drafter_sleeper_id: trueRound ? ownerInfo.owner : null,
        sleeper_draft_id: owners2023.draft_sleeper_id,
        notes: ownerInfo.isKeeper ? "Keeper from pre-synced season" : null,
      });
    }

    // Also process players in the rounds draft but NOT in the owners draft
    for (const [playerId, roundInfo] of roundsByPlayer) {
      if (processedPlayers.has(playerId)) continue;
      processedPlayers.add(playerId);
      addAcq({
        player_id: playerId,
        owner_sleeper_id: roundInfo.owner,
        league_id: rounds2023.draft_db_id, // fallback
        season: 2023,
        acquisition_type: "DRAFTED",
        acquisition_date: new Date("2023-08-24"),
        original_draft_round: roundInfo.round,
        original_draft_season: 2023,
        original_drafter_sleeper_id: roundInfo.owner,
        sleeper_draft_id: rounds2023.draft_sleeper_id,
        notes: "From rounds draft only (not in owners draft)",
      });
    }
    console.log(`  Created ${processedPlayers.size} draft acquisitions for 2023`);

    // PHASE 1b: Handle keeper records whose owner doesn't match the Aug 27 draft owner.
    // The keeper table may have stored the wrong (Aug 24) owner. Create acquisitions for
    // the keeper table's owner too so validation can find them.
    const keepers2023 = (await client.query(`
      SELECT k.player_id, r.sleeper_id AS keeper_owner, r.team_name, k.base_cost
      FROM keepers k JOIN rosters r ON k.roster_id = r.id
      WHERE k.season = 2023
    `)).rows;

    let ownerFixups = 0;
    for (const kp of keepers2023) {
      const existingAcq = currentState.get(kp.player_id);
      if (existingAcq && existingAcq.owner !== kp.keeper_owner) {
        // Keeper table has different owner than Aug 27 draft — create acquisition
        // for the keeper table's owner too (so validation can match)
        const roundInfo = roundsByPlayer.get(kp.player_id);
        const aug27Info = ownersByPlayer.get(kp.player_id);
        const trueRound = roundInfo ? roundInfo.round : (aug27Info && !aug27Info.isKeeper ? aug27Info.round : null);

        addAcq({
          player_id: kp.player_id,
          owner_sleeper_id: kp.keeper_owner,
          league_id: existingAcq.league_id,
          season: 2023,
          acquisition_type: "DRAFTED",
          acquisition_date: new Date("2023-08-24"), // Use Aug 24 date to distinguish
          original_draft_round: trueRound,
          original_draft_season: trueRound ? 2023 : null,
          original_drafter_sleeper_id: kp.keeper_owner,
          notes: "Owner mismatch: keeper table has this owner, Aug 27 draft has different owner",
        });
        ownerFixups++;
      }
    }
    if (ownerFixups > 0) {
      console.log(`  Created ${ownerFixups} owner-fixup acquisitions for 2023 keeper mismatches`);
    }
  }

  // ===== PHASE 2: Process 2024 draft (only NEW players / rookies) =====
  console.log("Phase 2: Processing 2024 drafts...");
  const owners2024 = getDraft(2024, "CORRECT_OWNERS");
  const errorDrafts2024 = corrections.filter(c => c.season === 2024 && (c.role === "ERROR" || c.role === "ABORTED"));
  const errorDraftIds = new Set(errorDrafts2024.map(e => e.draft_db_id));

  if (owners2024) {
    const draftPicks2024 = allPicks.filter(
      p => p.draft_db_id === owners2024.draft_db_id && !p.is_keeper
    );

    let newDrafts = 0;
    let skippedKeepers = 0;
    for (const pick of draftPicks2024) {
      const existing = currentState.get(pick.player_id);

      if (existing && existing.open) {
        // Player already owned from prior season — this is a correction pick, NOT a new draft
        // DON'T create a new acquisition. The existing one is correct.
        skippedKeepers++;
        continue;
      }

      // New player (rookie or re-drafted after being dropped)
      addAcq({
        player_id: pick.player_id,
        owner_sleeper_id: pick.owner_sleeper_id,
        league_id: pick.league_id,
        season: 2024,
        acquisition_type: "DRAFTED",
        acquisition_date: new Date("2024-08-30"),
        original_draft_round: pick.round,
        original_draft_season: 2024,
        original_drafter_sleeper_id: pick.owner_sleeper_id,
        sleeper_draft_id: owners2024.draft_sleeper_id,
      });
      newDrafts++;
    }
    console.log(`  Created ${newDrafts} new draft acquisitions, skipped ${skippedKeepers} existing keepers`);
  }

  // ===== PHASE 3: Process 2025 draft =====
  console.log("Phase 3: Processing 2025 draft...");
  const clean2025 = getDraft(2025, "CLEAN");

  if (clean2025) {
    const draftPicks2025 = allPicks.filter(
      p => p.draft_db_id === clean2025.draft_db_id && !p.is_keeper
    );

    let newDrafts = 0;
    for (const pick of draftPicks2025) {
      const existing = currentState.get(pick.player_id);

      if (existing && existing.open) {
        // Already owned — keeper carry-forward, skip
        continue;
      }

      addAcq({
        player_id: pick.player_id,
        owner_sleeper_id: pick.owner_sleeper_id,
        league_id: pick.league_id,
        season: 2025,
        acquisition_type: "DRAFTED",
        acquisition_date: new Date("2025-08-16"),
        original_draft_round: pick.round,
        original_draft_season: 2025,
        original_drafter_sleeper_id: pick.owner_sleeper_id,
        sleeper_draft_id: clean2025.draft_sleeper_id,
      });
      newDrafts++;
    }
    console.log(`  Created ${newDrafts} new draft acquisitions for 2025`);
  }

  // ===== PHASE 4: Process ALL transactions chronologically =====
  console.log("Phase 4: Processing transactions...");
  let tradeCount = 0, waiverCount = 0, dropCount = 0;

  for (const tx of allTx) {
    const txDate = new Date(tx.created_at);
    const txSeason = getSeasonFromDate(txDate);
    const postDeadline = isAfterDeadline(txDate, txSeason);

    if (tx.type === "TRADE") {
      if (!tx.to_sleeper || !tx.from_sleeper) continue;

      // Close old owner's record
      const closed = closeCurrentOwner(tx.player_id, "TRADED", txDate);

      // Inherit original draft info
      const inheritedRound = closed?.originalDraftRound || null;
      const inheritedSeason = closed?.originalDraftSeason || null;
      const inheritedDrafter = closed?.originalDrafter || null;

      addAcq({
        player_id: tx.player_id,
        owner_sleeper_id: tx.to_sleeper,
        league_id: tx.league_id,
        season: txSeason,
        acquisition_type: "TRADE",
        acquisition_date: txDate,
        original_draft_round: inheritedRound,
        original_draft_season: inheritedSeason,
        original_drafter_sleeper_id: inheritedDrafter,
        from_owner_sleeper_id: tx.from_sleeper,
        is_pre_deadline: !postDeadline,
        sleeper_transaction_id: tx.tx_sleeper_id,
      });
      tradeCount++;

    } else if (tx.type === "WAIVER" || tx.type === "FREE_AGENT") {
      if (tx.to_sleeper) {
        // Player added
        const closed = tx.from_sleeper ? closeCurrentOwner(tx.player_id, "DROPPED", txDate) : null;

        // Before deadline: inherit from previous owner
        let inheritedRound = null, inheritedSeason = null, inheritedDrafter = null;
        if (closed && !postDeadline) {
          inheritedRound = closed.originalDraftRound;
          inheritedSeason = closed.originalDraftSeason;
          inheritedDrafter = closed.originalDrafter;
        }

        addAcq({
          player_id: tx.player_id,
          owner_sleeper_id: tx.to_sleeper,
          league_id: tx.league_id,
          season: txSeason,
          acquisition_type: tx.type === "WAIVER" ? "WAIVER" : "FREE_AGENT",
          acquisition_date: txDate,
          original_draft_round: inheritedRound,
          original_draft_season: inheritedSeason,
          original_drafter_sleeper_id: inheritedDrafter,
          from_owner_sleeper_id: tx.from_sleeper || null,
          is_pre_deadline: !postDeadline,
          sleeper_transaction_id: tx.tx_sleeper_id,
        });
        waiverCount++;

      } else if (tx.from_sleeper) {
        closeCurrentOwner(tx.player_id, "DROPPED", txDate);
        dropCount++;
      }
    }
  }
  console.log(`  Trades: ${tradeCount}, Waivers/FA: ${waiverCount}, Drops: ${dropCount}`);

  // ===== PHASE 5: Insert =====
  console.log(`\nTotal: ${insertQueue.length} acquisition records for ${currentState.size} players.`);

  if (!isDryRun) {
    console.log("Clearing existing player_acquisitions...");
    await client.query("DELETE FROM player_acquisitions");

    console.log("Inserting records...");
    let inserted = 0;
    for (const a of insertQueue) {
      try {
        await client.query(
          `INSERT INTO player_acquisitions
           (id, player_id, owner_sleeper_id, league_id, season, acquisition_type,
            acquisition_date, original_draft_round, original_draft_season,
            original_drafter_sleeper_id, from_owner_sleeper_id, is_pre_deadline,
            sleeper_transaction_id, sleeper_draft_id, disposition_type, disposition_date,
            base_cost_override, notes)
           VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5::text::"AcquisitionType",
                   $6, $7, $8, $9, $10, $11, $12, $13,
                   $14::text::"DispositionType", $15, $16, $17)`,
          [
            a.player_id, a.owner_sleeper_id, a.league_id, a.season, a.acquisition_type,
            a.acquisition_date, a.original_draft_round, a.original_draft_season,
            a.original_drafter_sleeper_id, a.from_owner_sleeper_id, a.is_pre_deadline,
            a.sleeper_transaction_id, a.sleeper_draft_id || null,
            a.disposition_type || null, a.disposition_date || null,
            a.base_cost_override || null, a.notes || null,
          ]
        );
        inserted++;
      } catch (e) {
        if (!e.message.includes("duplicate")) {
          console.error(`  Error: ${e.message.slice(0, 100)}`);
        }
      }
    }
    console.log(`Inserted ${inserted} records.\n`);
  }

  // ===== VALIDATION =====
  console.log("═".repeat(70));
  console.log("VALIDATING against keeper records...");
  console.log("═".repeat(70));

  const keepers = (await client.query(`
    SELECT k.id, k.player_id, k.season, k.base_cost, k.final_cost,
           k.years_kept, k.type, r.sleeper_id AS keeper_owner, r.team_name,
           p.full_name
    FROM keepers k
    JOIN rosters r ON k.roster_id = r.id
    JOIN players p ON k.player_id = p.id
    ORDER BY p.full_name, k.season
  `)).rows;

  // For validation, use the insertQueue (in-memory) if dry-run, or query DB
  const acqSource = isDryRun ? insertQueue : (await client.query(`
    SELECT player_id, owner_sleeper_id, season, acquisition_type,
           original_draft_round, base_cost_override, disposition_type
    FROM player_acquisitions
    ORDER BY acquisition_date DESC
  `)).rows;

  // Build lookup: for each player+owner, find the MOST RECENT acquisition
  // (the one with no disposition, or the latest one if all closed)
  const acqByPlayerOwner = new Map();
  for (const a of acqSource) {
    const key = `${a.player_id}_${a.owner_sleeper_id}`;
    const existing = acqByPlayerOwner.get(key);
    if (!existing || (!a.disposition_type && existing.disposition_type)) {
      acqByPlayerOwner.set(key, a);
    }
  }

  let correct = 0, wrong = 0, missing = 0;
  const wrongRecords = [];
  const missingRecords = [];

  for (const k of keepers) {
    const key = `${k.player_id}_${k.keeper_owner}`;
    const acq = acqByPlayerOwner.get(key);

    if (!acq) {
      missing++;
      missingRecords.push({
        player: k.full_name, season: k.season, stored: `R${k.base_cost}`,
        years: k.years_kept, team: k.team_name, owner: k.keeper_owner.slice(0, 10) + "...",
      });
      continue;
    }

    const origRound = acq.base_cost_override || acq.original_draft_round || UNDRAFTED_ROUND;
    const expectedBase = Math.max(1, origRound - (k.years_kept - 1));

    if (k.base_cost === expectedBase) {
      correct++;
    } else {
      wrong++;
      wrongRecords.push({
        player: k.full_name, season: k.season,
        stored: `R${k.base_cost}`, expected: `R${expectedBase}`,
        origR: `R${origRound}`, source: acq.acquisition_type,
        years: k.years_kept, team: k.team_name,
      });
    }
  }

  if (wrongRecords.length > 0) {
    console.log(`\nWRONG (${wrong}):`);
    console.table(wrongRecords);
  }
  if (missingRecords.length > 0) {
    console.log(`\nMISSING (${missing}):`);
    console.table(missingRecords);
  }

  console.log(`\n=== SUMMARY ===`);
  console.log(`Total: ${keepers.length} | Correct: ${correct} | Wrong: ${wrong} | Missing: ${missing}`);

  await client.end();
}

run().catch((e) => { console.error(e); process.exit(1); });
