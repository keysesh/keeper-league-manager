import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  // Find Marvin Harrison Jr
  const player = await prisma.player.findFirst({
    where: { fullName: { contains: 'Marvin Harrison' } },
    select: { id: true, sleeperId: true, fullName: true }
  });
  console.log('Player:', player);

  if (!player) return;

  // Find transactions involving this player
  const txPlayers = await prisma.transactionPlayer.findMany({
    where: { playerId: player.id },
    include: {
      transaction: true
    },
    orderBy: { transaction: { createdAt: 'desc' } }
  });

  // Get all roster IDs mentioned
  const rosterIds = new Set<string>();
  for (const tp of txPlayers) {
    if (tp.fromRosterId) rosterIds.add(tp.fromRosterId);
    if (tp.toRosterId) rosterIds.add(tp.toRosterId);
  }

  const rosters = await prisma.roster.findMany({
    where: { id: { in: Array.from(rosterIds) } },
    select: { id: true, teamName: true, sleeperId: true }
  });
  const rosterMap = new Map(rosters.map(r => [r.id, r]));

  console.log('\nTransactions involving Marvin Harrison:');
  for (const tp of txPlayers) {
    const fromRoster = tp.fromRosterId ? rosterMap.get(tp.fromRosterId) : null;
    const toRoster = tp.toRosterId ? rosterMap.get(tp.toRosterId) : null;
    
    console.log('\n---');
    console.log('Date:', tp.transaction.createdAt);
    console.log('Type:', tp.transaction.type);
    console.log('From:', fromRoster?.teamName, `(sleeperId: ${fromRoster?.sleeperId})`);
    console.log('To:', toRoster?.teamName, `(sleeperId: ${toRoster?.sleeperId})`);
    console.log('Metadata:', JSON.stringify(tp.transaction.metadata, null, 2));
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
