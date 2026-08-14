import { prisma } from "@/lib/prisma";

/**
 * Estimated market draft round per player.
 *
 * The league has no external market feed (ADP and ECR are unpopulated in
 * production), so the market round is derived from last season's scoring:
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
  return rounds;
}
