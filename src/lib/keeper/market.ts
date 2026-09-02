import { prisma } from "@/lib/prisma";
import { pickToRound } from "./adp";

/**
 * Market draft round per player.
 *
 * Real ADP first: Player.adp holds the average pick across thousands of real
 * drafts run this week (see adp-sync.ts), which is what a player actually
 * costs in the world. A pick number becomes a round using THIS league's team
 * count, because pick 11 is a second-rounder in a ten-team league and a
 * first-rounder in a twelve.
 *
 * Where no ADP exists — a player nobody in the sample drafted — the old
 * estimate stands as the fallback, and it is only ever a fallback now. It is
 * derived from last season's scoring:
 * value-over-replacement within each position, ranked into rounds of
 * `totalRosters` picks. It's an estimate and every surface that shows it
 * must say so — but it is deterministic, league-shaped (positional
 * replacement levels, not raw PPG, so a QB's inflated PPG doesn't crown him
 * R1 in a 1-QB league), and computed from data the app actually has.
 */

// Roughly how many players at each position are startable league-wide,
// per roster slot norms — sets the replacement baseline for VOR.
const STARTER_MULTIPLIER: Record<string, number> = {
  QB: 1,
  RB: 2.5,
  WR: 2.5,
  TE: 1,
};

export async function estimateMarketRounds(
  totalRosters: number,
  draftRounds: number
): Promise<Map<string, number>> {
  const pool = await prisma.player.findMany({
    where: {
      position: { in: Object.keys(STARTER_MULTIPLIER) },
      pointsPerGame: { gt: 0 },
      gamesPlayed: { gte: 6 },
    },
    select: { id: true, position: true, pointsPerGame: true },
  });

  // Replacement level per position: the PPG of the last starter-caliber player
  const byPosition = new Map<string, number[]>();
  for (const p of pool) {
    const list = byPosition.get(p.position!) ?? [];
    list.push(p.pointsPerGame!);
    byPosition.set(p.position!, list);
  }
  const replacement = new Map<string, number>();
  for (const [pos, ppgs] of byPosition) {
    ppgs.sort((a, b) => b - a);
    const starters = Math.round(totalRosters * (STARTER_MULTIPLIER[pos] ?? 1));
    replacement.set(pos, ppgs[Math.min(starters, ppgs.length) - 1] ?? 0);
  }

  const ranked = pool
    .map((p) => ({
      id: p.id,
      vor: p.pointsPerGame! - (replacement.get(p.position!) ?? 0),
    }))
    .sort((a, b) => b.vor - a.vor)
    .slice(0, totalRosters * draftRounds);

  const rounds = new Map<string, number>();
  ranked.forEach((p, idx) => {
    rounds.set(p.id, Math.min(draftRounds, Math.floor(idx / totalRosters) + 1));
  });

  // Real ADP overrides the estimate wherever it exists. Applied last so a
  // player who has both keeps the number the world actually drafted him at.
  const drafted = await prisma.player.findMany({
    where: { adp: { not: null, gt: 0 } },
    select: { id: true, adp: true },
  });
  for (const p of drafted) {
    rounds.set(p.id, pickToRound(p.adp!, totalRosters, draftRounds));
  }

  return rounds;
}
