// Fetch raw Sleeper data for George Pickens (8137)

async function fetchSleeper(url: string) {
  const res = await fetch("https://api.sleeper.app/v1" + url);
  return res.json();
}

async function main() {
  const PICKENS_ID = "8137";

  // League IDs from your chain
  const leagues = [
    { season: 2023, id: "991458482647871488" },
    { season: 2024, id: "1109261023418314752" },
    { season: 2025, id: "1256780766516359168" },
  ];

  console.log("=== RAW SLEEPER DATA FOR GEORGE PICKENS (8137) ===\n");

  for (const league of leagues) {
    console.log(`\n========== SEASON ${league.season} (League: ${league.id}) ==========\n`);

    // Get rosters FIRST to map roster_id to owner
    console.log("--- ROSTER MAPPING ---");
    const rosters = await fetchSleeper(`/league/${league.id}/rosters`);
    const rosterMap: Record<number, string> = {};
    if (rosters && Array.isArray(rosters)) {
      for (const r of rosters) {
        rosterMap[r.roster_id] = r.owner_id;
        console.log(`  roster_id ${r.roster_id} -> owner_id: ${r.owner_id}`);
      }
    }

    // Get all transactions for all weeks
    console.log("\n--- TRANSACTIONS ---");
    for (let week = 0; week <= 18; week++) {
      const txs = await fetchSleeper(`/league/${league.id}/transactions/${week}`);
      if (!txs || !Array.isArray(txs)) continue;

      for (const tx of txs) {
        // Check if Pickens is in adds or drops
        const inAdds = tx.adds && PICKENS_ID in tx.adds;
        const inDrops = tx.drops && PICKENS_ID in tx.drops;

        if (inAdds || inDrops) {
          const date = new Date(tx.created);
          console.log(`\nWeek ${week} | ${tx.type} | ${date.toISOString().split("T")[0]}`);
          console.log(`  transaction_id: ${tx.transaction_id}`);
          console.log(`  status: ${tx.status}`);
          console.log(`  roster_ids: ${JSON.stringify(tx.roster_ids)}`);

          if (tx.adds) {
            console.log(`  adds: ${JSON.stringify(tx.adds)}`);
            // Show who received Pickens
            if (tx.adds[PICKENS_ID]) {
              const toRoster = tx.adds[PICKENS_ID];
              console.log(`    -> Pickens TO roster_id ${toRoster} (owner: ${rosterMap[toRoster]})`);
            }
          }
          if (tx.drops) {
            console.log(`  drops: ${JSON.stringify(tx.drops)}`);
            // Show who dropped Pickens
            if (tx.drops[PICKENS_ID]) {
              const fromRoster = tx.drops[PICKENS_ID];
              console.log(`    -> Pickens FROM roster_id ${fromRoster} (owner: ${rosterMap[fromRoster]})`);
            }
          }
          if (tx.draft_picks && tx.draft_picks.length > 0) {
            console.log(`  draft_picks: ${JSON.stringify(tx.draft_picks, null, 4)}`);
          }
        }
      }
    }

    // Get drafts
    console.log("\n--- DRAFTS ---");
    const drafts = await fetchSleeper(`/league/${league.id}/drafts`);
    if (drafts && Array.isArray(drafts)) {
      for (const draft of drafts) {
        console.log(`\nDraft ID: ${draft.draft_id} | Type: ${draft.type} | Status: ${draft.status}`);

        const picks = await fetchSleeper(`/draft/${draft.draft_id}/picks`);
        if (picks && Array.isArray(picks)) {
          for (const pick of picks) {
            if (pick.player_id === PICKENS_ID) {
              console.log(`  Round ${pick.round} Pick ${pick.pick_no}`);
              console.log(`    roster_id: ${pick.roster_id} (owner: ${rosterMap[pick.roster_id]})`);
              console.log(`    is_keeper: ${pick.is_keeper}`);
              console.log(`    picked_by: ${pick.picked_by}`);
            }
          }
        }
      }
    }
  }
}

main().catch(console.error);
