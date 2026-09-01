import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { getLeagueChain } from "@/lib/services/league-chain";
import { syncAcquisitionChain } from "./sync";

export const ACQUISITION_CHAIN_AUDIT_ACTION = "ACQUISITION_CHAIN_REBUILT";

export interface ChainRebuildResult {
  leagueId: string;
  fingerprint: string;
  skipped: boolean;
  created?: number;
  updated?: number;
  deleted?: number;
}

/**
 * A cheap summary of everything the acquisition chain is derived from. If it
 * has not changed since the last rebuild, the rebuild would write the same
 * rows again. A full rebuild takes ~220s on production (sequential upserts
 * over ~2,700 rows) against the cron's 300s budget, so the cron only pays for
 * it when a draft pick, transaction, or draft correction actually changed.
 */
export async function acquisitionChainFingerprint(leagueIds: string[]): Promise<string> {
  const [drafts, picks, txPlayers, corrections, latestTx] = await Promise.all([
    prisma.draft.count({ where: { leagueId: { in: leagueIds } } }),
    prisma.draftPick.count({ where: { draft: { leagueId: { in: leagueIds } } } }),
    prisma.transactionPlayer.count({ where: { transaction: { leagueId: { in: leagueIds } } } }),
    prisma.draftCorrection.count(),
    prisma.transaction.aggregate({
      _max: { createdAt: true },
      where: { leagueId: { in: leagueIds } },
    }),
  ]);
  return [
    `leagues:${leagueIds.length}`,
    `drafts:${drafts}`,
    `picks:${picks}`,
    `tx:${txPlayers}`,
    `corr:${corrections}`,
    `lastTx:${latestTx._max.createdAt?.toISOString() ?? "-"}`,
  ].join("|");
}

/**
 * Rebuild the acquisition chain for a league unless nothing it depends on has
 * changed since the last recorded rebuild. Every rebuild is audit-logged
 * (userId null = system) with the fingerprint it was built from.
 */
export async function rebuildAcquisitionChainIfChanged(leagueId: string): Promise<ChainRebuildResult> {
  const leagueIds = await getLeagueChain(leagueId);
  const fingerprint = await acquisitionChainFingerprint(leagueIds);

  const last = await prisma.auditLog.findFirst({
    where: { action: ACQUISITION_CHAIN_AUDIT_ACTION, entity: "League", entityId: leagueId },
    orderBy: { createdAt: "desc" },
    select: { newValue: true },
  });
  const lastFingerprint = (last?.newValue as { fingerprint?: string } | null)?.fingerprint;

  if (lastFingerprint === fingerprint) {
    logger.info("Acquisition chain unchanged since last rebuild, skipping", { leagueId, fingerprint });
    return { leagueId, fingerprint, skipped: true };
  }

  const result = await syncAcquisitionChain(leagueId);
  await prisma.auditLog.create({
    data: {
      userId: null,
      action: ACQUISITION_CHAIN_AUDIT_ACTION,
      entity: "League",
      entityId: leagueId,
      oldValue: lastFingerprint ? { fingerprint: lastFingerprint } : undefined,
      newValue: { fingerprint, ...result },
    },
  });
  return { leagueId, fingerprint, skipped: false, ...result };
}
