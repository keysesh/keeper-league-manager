import { prisma } from "@/lib/prisma";
import { KeeperType, AcquisitionType } from "@prisma/client";
import { sleeperClient } from "@/lib/sleeper/client";
import { logger } from "@/lib/logger";
import { getPlanningSeasonForLeague } from "@/lib/keeper/planning-season-db";
import { recalculateAndApplyCascade } from "@/lib/keeper/cascade";
import { computeKeeperCost } from "@/lib/keeper/cost";
import { planLockImport, type LockRoster } from "@/lib/keeper/import-locks";

export interface ImportedKeeper {
  team: string | null;
  player: string;
  baseCost: number;
  finalCost: number;
}

export interface ImportLocksResult {
  season: number;
  applied: boolean;
  created: ImportedKeeper[];
  blocked: Array<{ team: string | null; player: string; reason: string }>;
  /** In the plan, not locked on Sleeper — reported, never removed. */
  extra: Array<{ team: string | null; player: string }>;
  unchanged: number;
  /** Locked on Sleeper but unknown here — a player we have never synced. */
  unknownPlayers: string[];
}

/**
 * Reads Sleeper's keeper locks and adds the ones the plan is missing.
 *
 * Costs come from the engine on the way in, exactly as they do when a manager
 * adds a keeper by hand, and the cascade runs once at the end — an imported
 * keeper that lands on an occupied round has to move something, and doing that
 * per row would settle conflicts in the order Sleeper happened to list them.
 *
 * Pass `apply: false` to see what it would do.
 */
export async function importKeeperLocks(
  leagueId: string,
  { apply }: { apply: boolean }
): Promise<ImportLocksResult> {
  const league = await prisma.league.findUnique({
    where: { id: leagueId },
    include: {
      keeperSettings: true,
      rosters: { select: { id: true, sleeperId: true, ownerId: true, teamName: true } },
    },
  });
  if (!league) throw new Error("League not found");
  if (!league.keeperSettings) throw new Error("League keeper settings not configured");

  const season = await getPlanningSeasonForLeague(leagueId);
  const sleeperRosters = await sleeperClient.getRosters(league.sleeperId);

  const lockedSleeperIds = new Set<string>();
  for (const r of sleeperRosters) {
    for (const id of r.keepers ?? []) lockedSleeperIds.add(String(id));
  }

  const players = await prisma.player.findMany({
    where: { sleeperId: { in: [...lockedSleeperIds] } },
    select: { id: true, sleeperId: true, fullName: true },
  });
  const playerBySleeperId = new Map(players.map((p) => [p.sleeperId, p]));
  const playerById = new Map(players.map((p) => [p.id, p]));

  const existing = await prisma.keeper.findMany({
    where: { roster: { leagueId }, season },
    select: { rosterId: true, playerId: true, type: true, player: { select: { fullName: true } } },
  });

  // A roster's Sleeper id here is the OWNER's id, which is what Sleeper's
  // roster rows are keyed by for our purposes.
  const rosterByOwner = new Map(
    league.rosters.flatMap((r) => {
      const keys = [r.sleeperId, r.ownerId].filter((k): k is string => !!k);
      return keys.map((k) => [k, r] as const);
    })
  );
  const teamOf = new Map(league.rosters.map((r) => [r.id, r.teamName]));

  const unknownPlayers: string[] = [];
  const lockRosters: LockRoster[] = [];
  for (const sr of sleeperRosters) {
    const roster = rosterByOwner.get(sr.owner_id);
    if (!roster) continue;
    const locks: string[] = [];
    for (const raw of sr.keepers ?? []) {
      const player = playerBySleeperId.get(String(raw));
      if (!player) {
        unknownPlayers.push(String(raw));
        continue;
      }
      locks.push(player.id);
    }
    lockRosters.push({
      rosterId: roster.id,
      locks,
      existing: existing
        .filter((k) => k.rosterId === roster.id)
        .map((k) => ({ playerId: k.playerId, type: k.type as "FRANCHISE" | "REGULAR" })),
    });
  }

  const plan = planLockImport(lockRosters, {
    maxKeepers: league.keeperSettings.maxKeepers,
    maxRegularKeepers: league.keeperSettings.maxRegularKeepers,
    maxFranchiseTags: league.keeperSettings.maxFranchiseTags,
  });

  const nameOfPlayer = (id: string) =>
    playerById.get(id)?.fullName ??
    existing.find((k) => k.playerId === id)?.player.fullName ??
    id;

  const result: ImportLocksResult = {
    season,
    applied: apply,
    created: [],
    blocked: plan.blocked.map((b) => ({
      team: teamOf.get(b.rosterId) ?? null,
      player: nameOfPlayer(b.playerId),
      reason: b.reason,
    })),
    extra: plan.extra.map((e) => ({
      team: teamOf.get(e.rosterId) ?? null,
      player: nameOfPlayer(e.playerId),
    })),
    unchanged: plan.unchanged,
    unknownPlayers,
  };

  for (const row of plan.create) {
    const roster = league.rosters.find((r) => r.id === row.rosterId);
    if (!roster) continue;
    const cost = await computeKeeperCost(
      row.playerId,
      roster.sleeperId,
      season,
      league.keeperSettings
    );
    result.created.push({
      team: roster.teamName,
      player: nameOfPlayer(row.playerId),
      baseCost: cost.effectiveCost,
      finalCost: cost.effectiveCost,
    });
    if (!apply) continue;

    await prisma.keeper.create({
      data: {
        rosterId: row.rosterId,
        playerId: row.playerId,
        season,
        type: row.type === "FRANCHISE" ? KeeperType.FRANCHISE : KeeperType.REGULAR,
        baseCost: cost.effectiveCost,
        finalCost: cost.effectiveCost,
        yearsKept: cost.yearsKept,
        acquisitionType: AcquisitionType.DRAFTED,
        notes: "Imported from Sleeper's keeper slots",
      },
    });
  }

  if (apply && result.created.length > 0) {
    const cascade = await recalculateAndApplyCascade(leagueId, season);
    if (cascade.errors.length > 0) {
      logger.warn("Cascade warnings after importing keeper locks", { errors: cascade.errors });
    }
    const settled = await prisma.keeper.findMany({
      where: { roster: { leagueId }, season },
      select: { finalCost: true, player: { select: { fullName: true } } },
    });
    for (const c of result.created) {
      const row = settled.find((s) => s.player.fullName === c.player);
      if (row) c.finalCost = row.finalCost;
    }
  }

  return result;
}
