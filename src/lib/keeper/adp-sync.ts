import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { adpFormatForScoring, adpKey, fetchAdp, type AdpSample } from "./adp";

/**
 * Points per reception for a league, from Sleeper.
 *
 * Not from League.settings: that column stores Sleeper's `settings` object,
 * which carries roster and playoff config and no scoring at all. Reading `rec`
 * off it silently yields undefined, adpFormatForScoring reasonably answers
 * "standard", and a full-PPR league gets handed a standard-scoring board whose
 * first two rounds are different players. Verified the hard way: the first dry
 * run reported "Non-PPR" for a rec:1.0 league.
 */
export async function fetchReceptionPoints(sleeperLeagueId: string): Promise<number | null> {
  try {
    const res = await fetch(`https://api.sleeper.app/v1/league/${sleeperLeagueId}`, {
      headers: { accept: "application/json" },
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { scoring_settings?: { rec?: number } };
    const rec = body?.scoring_settings?.rec;
    return typeof rec === "number" ? rec : null;
  } catch {
    return null;
  }
}

export interface AdpSyncResult {
  format: string;
  totalDrafts: number;
  window: string;
  fetched: number;
  matched: number;
  written: number;
  ms: number;
}

/**
 * Pull real-world ADP and store it on Player.adp.
 *
 * Stored rather than fetched per request: the market number is read on nearly
 * every keeper screen, and putting a third-party HTTP call on that path buys
 * latency and an outage we do not control. This runs from the cron.
 *
 * Only writes matches. A partial or failed fetch must never blank the column —
 * a stale ADP is a far better answer than no ADP, and "everyone is undrafted"
 * would silently re-price every keeper in the league.
 */
export async function syncAdp(
  teams: number,
  receptionPoints: number | null | undefined,
  year: number
): Promise<AdpSyncResult> {
  const started = Date.now();
  const format = adpFormatForScoring(receptionPoints);
  const sample: AdpSample = await fetchAdp(teams, format, year);

  const players = await prisma.player.findMany({
    where: { position: { in: ["QB", "RB", "WR", "TE", "K", "DEF"] } },
    select: { id: true, fullName: true, position: true, team: true, sleeperId: true, adp: true },
  });

  let matched = 0;
  const updates: Array<{ id: string; adp: number }> = [];
  for (const p of players) {
    // A defense's club lives in sleeperId (Sleeper keys them "PIT", "SEA"),
    // and team is often null on those rows.
    const club = p.position === "DEF" ? (p.team ?? p.sleeperId) : p.team;
    const hit = sample.entries.get(adpKey(p.fullName, p.position ?? "", club));
    if (!hit) continue;
    matched++;
    if (p.adp !== hit.pick) updates.push({ id: p.id, adp: hit.pick });
  }

  for (const u of updates) {
    await prisma.player.update({ where: { id: u.id }, data: { adp: u.adp } });
  }

  const result: AdpSyncResult = {
    format: sample.format,
    totalDrafts: sample.totalDrafts,
    window: `${sample.startDate}..${sample.endDate}`,
    fetched: sample.entries.size,
    matched,
    written: updates.length,
    ms: Date.now() - started,
  };
  logger.info("Synced real-world ADP", { ...result });
  return result;
}
