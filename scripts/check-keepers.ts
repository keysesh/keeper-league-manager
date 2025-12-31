import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("=== KEEPER DIAGNOSTIC REPORT ===\n");

  // Get keepers by season across all leagues
  const keepers = await prisma.keeper.groupBy({
    by: ["season"],
    _count: { id: true },
    orderBy: { season: "desc" },
  });
  console.log("Keepers by season (all leagues):");
  for (const k of keepers) {
    console.log(`  ${k.season}: ${k._count.id} keepers`);
  }

  // Get the main league
  const league = await prisma.league.findFirst({
    where: { sleeperId: "1256780766516359168" },
    select: { id: true, name: true },
  });

  if (!league) {
    console.log("\nLeague not found!");
    await prisma.$disconnect();
    return;
  }

  console.log(`\n=== ${league.name} ===`);

  // Get keepers for both 2025 and 2026
  for (const season of [2026, 2025]) {
    const seasonKeepers = await prisma.keeper.findMany({
      where: { season, roster: { leagueId: league.id } },
      include: {
        player: { select: { fullName: true } },
        roster: { select: { id: true, teamName: true } },
      },
      orderBy: [{ roster: { teamName: "asc" } }, { finalCost: "asc" }],
    });

    console.log(`\n--- Season ${season}: ${seasonKeepers.length} total keepers ---`);

    const byTeam: Record<string, Array<{ name: string; cost: number; type: string }>> = {};
    seasonKeepers.forEach((k) => {
      const team = k.roster.teamName || "Unknown";
      if (!byTeam[team]) byTeam[team] = [];
      byTeam[team].push({
        name: k.player.fullName,
        cost: k.finalCost,
        type: k.type,
      });
    });

    for (const [team, players] of Object.entries(byTeam)) {
      console.log(`  ${team}: ${players.length} keepers`);
      for (const p of players) {
        const typeLabel = p.type === "FRANCHISE" ? " [FT]" : "";
        console.log(`    R${p.cost}: ${p.name}${typeLabel}`);
      }
    }
  }

  // Show planning season calculation
  const now = new Date();
  const month = now.getMonth();
  const year = now.getFullYear();
  const planningSeason = month >= 8 ? year + 1 : month < 2 ? year : year;
  console.log(`\n=== SEASON CONTEXT ===`);
  console.log(`Current date: ${now.toLocaleDateString()}`);
  console.log(`Current month: ${month} (0-indexed)`);
  console.log(`Keeper planning season: ${planningSeason}`);
  console.log(`  - Manage Keepers page uses: ${planningSeason}`);
  console.log(`  - Draft Board uses: ${planningSeason}`);

  await prisma.$disconnect();
}

main().catch(console.error);
