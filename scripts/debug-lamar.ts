import { PrismaClient } from "@prisma/client";

// Use Railway DATABASE_URL
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
});

async function main() {
  // Find Lamar Jackson
  const lamar = await prisma.player.findFirst({
    where: { fullName: { contains: "Lamar Jackson" } },
  });

  if (!lamar) {
    console.log("Lamar Jackson not found");
    return;
  }

  console.log("=== LAMAR JACKSON DEBUG ===");
  console.log("Player ID:", lamar.id);
  console.log("Sleeper ID:", lamar.sleeperId);

  // Get all draft picks for Lamar
  const draftPicks = await prisma.draftPick.findMany({
    where: { playerId: lamar.id },
    include: {
      draft: true,
      roster: { select: { id: true, sleeperId: true, teamName: true } },
    },
    orderBy: { draft: { season: "asc" } },
  });

  console.log("\n=== DRAFT PICKS ===");
  for (const pick of draftPicks) {
    console.log(
      `  Season ${pick.draft.season} R${pick.round}.${pick.pickNumber}`,
      `| Roster: ${pick.roster?.teamName}`,
      `| SleeperId: ${pick.roster?.sleeperId}`
    );
  }

  // Get all transactions for Lamar
  const transactions = await prisma.transactionPlayer.findMany({
    where: { playerId: lamar.id },
    include: { transaction: true },
    orderBy: { transaction: { createdAt: "desc" } },
  });

  console.log("\n=== TRANSACTIONS ===");
  for (const tx of transactions) {
    console.log(
      ` ${tx.transaction.createdAt.toISOString().slice(0, 10)}`,
      `| ${tx.transaction.type}`,
      `| From: ${tx.fromRosterId?.slice(0, 8) || "null"}`,
      `| To: ${tx.toRosterId?.slice(0, 8) || "null"}`
    );
  }

  // Get current roster with Lamar
  const currentRosterPlayer = await prisma.rosterPlayer.findFirst({
    where: { playerId: lamar.id },
    include: {
      roster: {
        include: { league: true },
      },
    },
  });

  if (!currentRosterPlayer) {
    console.log("\nLamar not on any roster currently");
    return;
  }

  const currentRoster = currentRosterPlayer.roster;
  console.log("\n=== CURRENT ROSTER ===");
  console.log("Roster ID:", currentRoster.id);
  console.log("Sleeper ID:", currentRoster.sleeperId);
  console.log("Team Name:", currentRoster.teamName);
  console.log("League:", currentRoster.league.name, "Season:", currentRoster.league.season);

  // Check if Lamar was drafted by the current owner (by sleeperId)
  const draftedByCurrentOwner = draftPicks.find(
    (p) => p.roster?.sleeperId === currentRoster.sleeperId
  );

  console.log("\n=== ELIGIBILITY ANALYSIS ===");
  if (draftedByCurrentOwner) {
    console.log("Drafted by current owner (sleeperId match):", draftedByCurrentOwner.roster?.teamName);
    console.log("Draft season:", draftedByCurrentOwner.draft.season);
    const currentSeason = 2025;
    const yearsKept = currentSeason - draftedByCurrentOwner.draft.season;
    console.log("Years kept (0-indexed):", yearsKept);
    console.log("Display year:", yearsKept + 1);
    if (yearsKept >= 2) {
      console.log("STATUS: Year 3+ - FRANCHISE TAG REQUIRED");
    } else if (yearsKept === 1) {
      console.log("STATUS: Year 2 - Final regular keeper year");
    } else {
      console.log("STATUS: Year 1 - Draft year");
    }
  } else {
    console.log("NOT drafted by current owner");
    console.log("Current owner sleeperId:", currentRoster.sleeperId);
    console.log("Draft pick sleeperIds:", draftPicks.map(p => p.roster?.sleeperId));

    // Check transactions for acquisition
    const allRosters = await prisma.roster.findMany({
      where: { leagueId: currentRoster.leagueId },
      select: { id: true, sleeperId: true },
    });

    const rosterToSleeperMap = new Map<string, string>();
    for (const r of allRosters) {
      if (r.sleeperId) {
        rosterToSleeperMap.set(r.id, r.sleeperId);
      }
    }

    console.log("\n=== ROSTER ID -> SLEEPER ID MAP ===");
    console.log("Total rosters:", allRosters.length);

    // Find acquisition transaction
    const acquisition = transactions.find(
      (tx) =>
        tx.toRosterId &&
        rosterToSleeperMap.get(tx.toRosterId) === currentRoster.sleeperId
    );

    if (acquisition) {
      console.log("\nAcquisition found:");
      console.log("  Date:", acquisition.transaction.createdAt);
      console.log("  Type:", acquisition.transaction.type);
      console.log("  To Roster ID:", acquisition.toRosterId);
      console.log("  To Sleeper ID:", rosterToSleeperMap.get(acquisition.toRosterId!));
    } else {
      console.log("\nNo acquisition transaction found for current owner");
      console.log("Looking for toRosterId that maps to sleeperId:", currentRoster.sleeperId);

      // Debug: show what sleeper IDs the transactions map to
      console.log("\nTransaction toRosterId -> sleeperId mappings:");
      for (const tx of transactions.slice(0, 10)) {
        if (tx.toRosterId) {
          const mapped = rosterToSleeperMap.get(tx.toRosterId);
          console.log(`  ${tx.toRosterId.slice(0, 8)}... -> ${mapped || "NOT FOUND"}`);
        }
      }
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
