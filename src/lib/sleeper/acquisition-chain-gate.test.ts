import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  syncAcquisitionChain: vi.fn(),
  getLeagueChain: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    draft: { count: vi.fn() },
    draftPick: { findMany: vi.fn() },
    transactionPlayer: { count: vi.fn() },
    draftCorrection: { count: vi.fn() },
    transaction: { aggregate: vi.fn() },
    auditLog: { findFirst: vi.fn(), create: vi.fn() },
  },
}));
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/services/league-chain", () => ({ getLeagueChain: mocks.getLeagueChain }));
vi.mock("./sync", () => ({ syncAcquisitionChain: mocks.syncAcquisitionChain, ACQUISITION_REPLAY_VERSION: 3 }));

import { prisma } from "@/lib/prisma";
import {
  ACQUISITION_CHAIN_AUDIT_ACTION,
  acquisitionChainFingerprint,
  rebuildAcquisitionChainIfChanged,
} from "./acquisition-chain-gate";

function mockFn<T>(fn: T): ReturnType<typeof vi.fn> {
  return fn as ReturnType<typeof vi.fn>;
}

const LAST_TX = new Date("2026-08-29T15:00:00Z");

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getLeagueChain.mockResolvedValue(["l-2026", "l-2025", "l-2024", "l-2023"]);
  mockFn(prisma.draft.count).mockResolvedValue(7);
  mockFn(prisma.draftPick.findMany).mockResolvedValue(
    Array.from({ length: 651 }, (_, i) => ({
      draftId: "d1", round: (i % 16) + 1, draftSlot: (i % 10) + 1, playerId: `p${i}`, isKeeper: false,
    }))
  );
  mockFn(prisma.transactionPlayer.count).mockResolvedValue(2210);
  mockFn(prisma.draftCorrection.count).mockResolvedValue(3);
  mockFn(prisma.transaction.aggregate).mockResolvedValue({ _max: { createdAt: LAST_TX } });
  mockFn(prisma.auditLog.findFirst).mockResolvedValue(null);
  mockFn(prisma.auditLog.create).mockResolvedValue({});
  mocks.syncAcquisitionChain.mockResolvedValue({ created: 10, updated: 5, deleted: 2 });
});

describe("acquisitionChainFingerprint", () => {
  it("summarises every input the chain is derived from, scoped to the league chain", async () => {
    const fp = await acquisitionChainFingerprint(["l-2026", "l-2025"]);
    expect(fp).toMatch(
      /^replay:3\|leagues:2\|drafts:7\|picks:651\/[0-9a-f]{12}\|tx:2210\|corr:3\|lastTx:2026-08-29T15:00:00\.000Z$/
    );
    expect(prisma.draftPick.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { draft: { leagueId: { in: ["l-2026", "l-2025"] } } } })
    );
    expect(prisma.transactionPlayer.count).toHaveBeenCalledWith({
      where: { transaction: { leagueId: { in: ["l-2026", "l-2025"] } } },
    });
  });

  it("changes when a new transaction lands, even if counts are unchanged elsewhere", async () => {
    const before = await acquisitionChainFingerprint(["l-2026"]);
    mockFn(prisma.transactionPlayer.count).mockResolvedValue(2212);
    mockFn(prisma.transaction.aggregate).mockResolvedValue({ _max: { createdAt: new Date("2026-09-02T01:00:00Z") } });
    const after = await acquisitionChainFingerprint(["l-2026"]);
    expect(after).not.toBe(before);
  });

  it("REGRESSION: changes when a keeper moves slots, with the pick COUNT unchanged", async () => {
    // A commissioner reassigning a keeper to a different round leaves the pick
    // count identical. A count-only fingerprint skipped the rebuild entirely.
    const before = await acquisitionChainFingerprint(["l-2026"]);
    mockFn(prisma.draftPick.findMany).mockResolvedValue(
      Array.from({ length: 651 }, (_, i) => ({
        draftId: "d1",
        round: i === 0 ? 9 : (i % 16) + 1, // one keeper moved to a different round
        draftSlot: (i % 10) + 1,
        playerId: `p${i}`,
        isKeeper: false,
      }))
    );
    const after = await acquisitionChainFingerprint(["l-2026"]);
    expect(after).not.toBe(before);
  });

  it("is stable when the same picks come back in a different order", async () => {
    const before = await acquisitionChainFingerprint(["l-2026"]);
    const rows = Array.from({ length: 651 }, (_, i) => ({
      draftId: "d1", round: (i % 16) + 1, draftSlot: (i % 10) + 1, playerId: `p${i}`, isKeeper: false,
    }));
    mockFn(prisma.draftPick.findMany).mockResolvedValue([...rows].reverse());
    expect(await acquisitionChainFingerprint(["l-2026"])).toBe(before);
  });
});

describe("rebuildAcquisitionChainIfChanged", () => {
  it("rebuilds and audit-logs the fingerprint when there is no prior rebuild", async () => {
    const result = await rebuildAcquisitionChainIfChanged("l-2026");

    expect(mocks.syncAcquisitionChain).toHaveBeenCalledWith("l-2026");
    expect(result).toMatchObject({ leagueId: "l-2026", skipped: false, created: 10, updated: 5, deleted: 2 });
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: null,
        action: ACQUISITION_CHAIN_AUDIT_ACTION,
        entity: "League",
        entityId: "l-2026",
        newValue: expect.objectContaining({ fingerprint: result.fingerprint, created: 10, updated: 5, deleted: 2 }),
      }),
    });
  });

  it("SKIPS the rebuild when the fingerprint matches the last audit row", async () => {
    const fp = await acquisitionChainFingerprint(["l-2026", "l-2025", "l-2024", "l-2023"]);
    mockFn(prisma.auditLog.findFirst).mockResolvedValue({ newValue: { fingerprint: fp, created: 1 } });

    const result = await rebuildAcquisitionChainIfChanged("l-2026");

    expect(result).toEqual({ leagueId: "l-2026", fingerprint: fp, skipped: true });
    expect(mocks.syncAcquisitionChain).not.toHaveBeenCalled();
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });

  it("rebuilds when the fingerprint differs from the last audit row", async () => {
    mockFn(prisma.auditLog.findFirst).mockResolvedValue({ newValue: { fingerprint: "stale-fingerprint" } });

    const result = await rebuildAcquisitionChainIfChanged("l-2026");

    expect(result.skipped).toBe(false);
    expect(mocks.syncAcquisitionChain).toHaveBeenCalledTimes(1);
    const audit = mockFn(prisma.auditLog.create).mock.calls[0][0].data;
    expect(audit.oldValue).toEqual({ fingerprint: "stale-fingerprint" });
  });

  it("does not write an audit row if the rebuild throws", async () => {
    mocks.syncAcquisitionChain.mockRejectedValue(new Error("boom"));
    await expect(rebuildAcquisitionChainIfChanged("l-2026")).rejects.toThrow("boom");
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });
});
