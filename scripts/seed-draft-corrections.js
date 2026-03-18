/**
 * Seed Draft Corrections
 *
 * Inserts known draft error metadata into the draft_corrections table.
 * This tells the sync logic which drafts have correct rounds vs correct owners.
 *
 * Run: node scripts/seed-draft-corrections.js
 */

const { Client } = require("pg");
const fs = require("fs");
const path = require("path");

const envPath = path.join(__dirname, "..", ".env.local");
const url = fs.readFileSync(envPath, "utf8").match(/^DATABASE_URL="([^"]+)"/m)[1];
const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });

const corrections = [
  {
    season: 2023,
    draft_sleeper_id: "991458483092471808",
    role: "CORRECT_ROUNDS",
    pick_count: 115,
    notes: "Aug 24 2023 SNAKE draft — correct round numbers, wrong roster assignments",
  },
  {
    season: 2023,
    draft_sleeper_id: "1000550787006709760",
    role: "CORRECT_OWNERS",
    pick_count: 186,
    notes: "Aug 27 2023 LINEAR draft — correct owners/keepers, cascade-adjusted rounds",
  },
  {
    season: 2024,
    draft_sleeper_id: "1133482056543207424",
    role: "ERROR",
    pick_count: 66,
    notes: "Aug 25 2024 error draft — wrong roster assignments",
  },
  {
    season: 2024,
    draft_sleeper_id: "1109261023418314753",
    role: "ABORTED",
    pick_count: 0,
    notes: "Aug 25 2024 aborted draft — empty",
  },
  {
    season: 2024,
    draft_sleeper_id: "1133490967337836544",
    role: "CORRECT_OWNERS",
    pick_count: 186,
    notes: "Aug 30 2024 LINEAR draft — correct owners, correct rounds for 2024 rookies",
  },
  {
    season: 2025,
    draft_sleeper_id: "1256780766528929792",
    role: "CLEAN",
    pick_count: 160,
    notes: "Aug 16 2025 — clean draft, no errors",
  },
];

async function run() {
  await client.connect();
  console.log("Connected.\n");

  // Create table if it doesn't exist (for running before Prisma migration)
  await client.query(`
    DO $$ BEGIN
      CREATE TYPE "DraftCorrectionRole" AS ENUM ('CORRECT_ROUNDS', 'CORRECT_OWNERS', 'ERROR', 'ABORTED', 'CLEAN');
    EXCEPTION WHEN duplicate_object THEN null;
    END $$;

    CREATE TABLE IF NOT EXISTS draft_corrections (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      season INT NOT NULL,
      draft_sleeper_id TEXT UNIQUE NOT NULL,
      role "DraftCorrectionRole" NOT NULL,
      pick_count INT NOT NULL,
      notes TEXT
    );
  `);

  for (const c of corrections) {
    await client.query(
      `INSERT INTO draft_corrections (id, season, draft_sleeper_id, role, pick_count, notes)
       VALUES (gen_random_uuid()::text, $1, $2, $3::text::"DraftCorrectionRole", $4, $5)
       ON CONFLICT (draft_sleeper_id) DO UPDATE SET
         role = EXCLUDED.role,
         pick_count = EXCLUDED.pick_count,
         notes = EXCLUDED.notes`,
      [c.season, c.draft_sleeper_id, c.role, c.pick_count, c.notes]
    );
    console.log(`  ${c.season} ${c.role}: ${c.draft_sleeper_id} (${c.pick_count} picks)`);
  }

  console.log("\nSeeded " + corrections.length + " draft corrections.");
  await client.end();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
