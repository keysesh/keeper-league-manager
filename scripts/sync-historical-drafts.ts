import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const LEAGUE_HISTORY = [
  { season: 2024, sleeperId: '1109261023418314752' },
  { season: 2023, sleeperId: '991458482647871488' },
];

interface SleeperDraft {
  draft_id: string;
  league_id: string;
  season: string;
  status: string;
  type: string;
  settings: {
    rounds: number;
    slots_wr: number;
    slots_rb: number;
    slots_qb: number;
    slots_te: number;
    slots_flex: number;
    slots_k: number;
    slots_def: number;
    slots_bn: number;
  };
}

interface SleeperDraftPick {
  round: number;
  roster_id: number;
  player_id: string;
  pick_no: number;
  draft_slot: number;
  is_keeper: boolean;
  metadata?: {
    years_exp?: string;
    team?: string;
    position?: string;
    first_name?: string;
    last_name?: string;
  };
}

async function syncHistoricalDraft(sleeperId: string, season: number) {
  console.log(`\n=== Syncing ${season} draft from league ${sleeperId} ===`);

  // Get current league ID
  const currentLeague = await prisma.league.findFirst({
    where: { sleeperId: '1256780766516359168' }
  });

  if (!currentLeague) {
    console.log('Current league not found!');
    return;
  }

  // Get drafts from Sleeper
  const draftsResponse = await fetch(`https://api.sleeper.app/v1/league/${sleeperId}/drafts`);
  const drafts: SleeperDraft[] = await draftsResponse.json();

  console.log(`Found ${drafts.length} drafts`);

  for (const draft of drafts) {
    console.log(`\nProcessing draft ${draft.draft_id} (${draft.type}, ${draft.status})`);

    // Check if draft already exists
    const existingDraft = await prisma.draft.findFirst({
      where: {
        sleeperId: draft.draft_id,
        leagueId: currentLeague.id
      }
    });

    if (existingDraft) {
      console.log('  Draft already exists, skipping...');
      continue;
    }

    // Get draft picks
    const picksResponse = await fetch(`https://api.sleeper.app/v1/draft/${draft.draft_id}/picks`);
    const picks: SleeperDraftPick[] = await picksResponse.json();

    console.log(`  Found ${picks.length} picks`);

    // Create draft record
    const newDraft = await prisma.draft.create({
      data: {
        sleeperId: draft.draft_id,
        leagueId: currentLeague.id,
        season: season,
        type: draft.type === 'snake' ? 'SNAKE' : 'LINEAR',
        status: draft.status === 'complete' ? 'COMPLETE' : 'PRE_DRAFT',
        rounds: draft.settings?.rounds || 16,
        settings: draft.settings as any
      }
    });

    console.log(`  Created draft record: ${newDraft.id}`);

    // Process picks
    let created = 0;
    let skipped = 0;

    for (const pick of picks) {
      if (!pick.player_id) {
        skipped++;
        continue;
      }

      // Find player
      const player = await prisma.player.findFirst({
        where: { sleeperId: pick.player_id }
      });

      if (!player) {
        skipped++;
        continue;
      }

      // Find roster by roster_id mapping (we may need to create a temporary mapping)
      // For historical drafts, we'll try to match by owner
      const roster = await prisma.roster.findFirst({
        where: { leagueId: currentLeague.id }
      });

      if (!roster) {
        skipped++;
        continue;
      }

      // Create draft pick
      await prisma.draftPick.create({
        data: {
          draftId: newDraft.id,
          rosterId: roster.id, // Note: This may not be correct mapping
          playerId: player.id,
          round: pick.round,
          pickNumber: pick.pick_no,
          draftSlot: pick.draft_slot,
          isKeeper: pick.is_keeper || false,
          metadata: pick.metadata as any
        }
      });

      created++;
    }

    console.log(`  Created ${created} picks, skipped ${skipped}`);
  }
}

async function main() {
  console.log('=== SYNCING HISTORICAL DRAFTS ===');

  // First, let's just fetch and display what's available
  for (const { season, sleeperId } of LEAGUE_HISTORY) {
    console.log(`\n--- ${season} League: ${sleeperId} ---`);

    // Get drafts
    const draftsResponse = await fetch(`https://api.sleeper.app/v1/league/${sleeperId}/drafts`);
    const drafts: SleeperDraft[] = await draftsResponse.json();

    for (const draft of drafts) {
      console.log(`\nDraft ${draft.draft_id} (${draft.type})`);

      const picksResponse = await fetch(`https://api.sleeper.app/v1/draft/${draft.draft_id}/picks`);
      const picks: SleeperDraftPick[] = await picksResponse.json();

      // Look for our problem players
      const problemPlayers = ['7543', '8137', '6994', '10232']; // Etienne, Pickens, Lamar, Wilson
      const problemNames: Record<string, string> = {
        '7543': 'Travis Etienne',
        '8137': 'George Pickens',
        '6994': 'Lamar Jackson',
        '10232': 'Michael Wilson'
      };

      for (const playerId of problemPlayers) {
        const pick = picks.find(p => p.player_id === playerId && !p.is_keeper);
        if (pick) {
          console.log(`  ✅ Found ${problemNames[playerId]}: Round ${pick.round}, Pick #${pick.pick_no}`);
        }
      }
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
