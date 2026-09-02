/**
 * Pull real-world ADP for a league and store it on Player.adp.
 *
 * Usage: npx tsx scripts/sync-adp.ts <season> [--apply]
 * Dry run by default — it reports what it would match without writing.
 */
import { config } from "dotenv";
config({ path: "../.env.local" });
config({ path: ".env.local" });
if (process.env.DATABASE_URL) {
  process.env.DATABASE_URL = process.env.DATABASE_URL.trim();
}

import { prisma } from "../src/lib/prisma";
import { fetchReceptionPoints, syncAdp } from "../src/lib/keeper/adp-sync";
import { adpFormatForScoring, adpKey, fetchAdp } from "../src/lib/keeper/adp";

async function main() {
  const season = Number(process.argv[2]);
  const apply = process.argv.includes("--apply");
  if (!Number.isInteger(season)) {
    console.error("Usage: npx tsx scripts/sync-adp.ts <season> [--apply]");
    process.exit(1);
  }

  const league = await prisma.league.findFirst({ where: { season } });
  if (!league) throw new Error(`no league for ${season}`);

  const rec = await fetchReceptionPoints(league.sleeperId);
  const teams = league.totalRosters;
  console.log(`league scoring: rec=${rec} -> ${adpFormatForScoring(rec)} ADP`);

  if (apply) {
    const r = await syncAdp(teams, rec, season);
    console.log(JSON.stringify(r, null, 2));
  } else {
    const sample = await fetchAdp(teams, adpFormatForScoring(rec), season);
    const players = await prisma.player.findMany({
      where: { position: { in: ["QB", "RB", "WR", "TE", "K", "DEF"] } },
      select: { id: true, fullName: true, position: true, team: true, sleeperId: true },
    });
    let matched = 0;
    for (const p of players) {
      const club = p.position === "DEF" ? (p.team ?? p.sleeperId) : p.team;
      if (sample.entries.get(adpKey(p.fullName, p.position ?? "", club))) matched++;
    }
    console.log(`DRY RUN — ${sample.format}, ${teams} teams, ${sample.totalDrafts} drafts (${sample.startDate}..${sample.endDate})`);
    console.log(`  ADP rows ${sample.entries.size}; would match ${matched} players. Re-run with --apply to write.`);
  }
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
