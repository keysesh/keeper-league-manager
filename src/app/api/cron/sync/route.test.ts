import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { NextRequest } from "next/server";

// The route reads CRON_SECRET at module load, so it must exist before import.
const mocks = vi.hoisted(() => {
  process.env.CRON_SECRET = "cron-test-secret";
  return {
    syncLeague: vi.fn(),
    rebuildAcquisitionChainIfChanged: vi.fn(),
    syncUserLeagues: vi.fn(),
    resyncKeeperBaseCosts: vi.fn(),
    getPlanningSeasonForLeague: vi.fn(),
  };
});

vi.mock("@/lib/prisma", () => ({
  prisma: {
    league: { findMany: vi.fn() },
    user: { findMany: vi.fn() },
  },
}));

vi.mock("@/lib/sleeper/sync", () => ({
  syncLeague: mocks.syncLeague,
  syncUserLeagues: mocks.syncUserLeagues,
}));

vi.mock("@/lib/sleeper/acquisition-chain-gate", () => ({
  rebuildAcquisitionChainIfChanged: mocks.rebuildAcquisitionChainIfChanged,
}));

vi.mock("@/lib/keeper/resync-base-costs", () => ({
  resyncKeeperBaseCosts: mocks.resyncKeeperBaseCosts,
}));

vi.mock("@/lib/keeper/planning-season-db", () => ({
  getPlanningSeasonForLeague: mocks.getPlanningSeasonForLeague,
}));

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { prisma } from "@/lib/prisma";
import { GET } from "./route";

function mockFn<T>(fn: T): ReturnType<typeof vi.fn> {
  return fn as ReturnType<typeof vi.fn>;
}

function makeRequest(authorization?: string): NextRequest {
  return {
    headers: { get: (name: string) => (name === "authorization" ? authorization ?? null : null) },
  } as unknown as NextRequest;
}

const LEAGUES = [
  { id: "l-2026", sleeperId: "s-2026", name: "EPGD 2026", season: 2026, status: "PRE_DRAFT" },
  { id: "l-2025", sleeperId: "s-2025", name: "EPGD 2025", season: 2025, status: "COMPLETE" },
  { id: "l-2024", sleeperId: "s-2024", name: "EPGD 2024", season: 2024, status: "COMPLETE" },
];

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NODE_ENV", "production");
  mockFn(prisma.league.findMany).mockResolvedValue(LEAGUES);
  mockFn(prisma.user.findMany).mockResolvedValue([]);
  mocks.syncLeague.mockResolvedValue({ league: {}, rosters: 12, players: 200, draftPicks: 0 });
  mocks.rebuildAcquisitionChainIfChanged.mockResolvedValue({
    leagueId: "l-2026", fingerprint: "fp-1", skipped: false, created: 3, updated: 1, deleted: 0,
  });
  mocks.getPlanningSeasonForLeague.mockResolvedValue(2026);
  mocks.resyncKeeperBaseCosts.mockResolvedValue({
    leagueId: "l-2026", season: 2026, changes: [], written: 0, cascadeErrors: [],
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("GET /api/cron/sync", () => {
  it("rejects requests without the cron bearer secret in production", async () => {
    const res = await GET(makeRequest("Bearer wrong"));
    expect(res.status).toBe(401);
    expect(mocks.syncLeague).not.toHaveBeenCalled();
  });

  it("syncs transactions AND drafts for the live league, neither for frozen seasons", async () => {
    const res = await GET(makeRequest("Bearer cron-test-secret"));
    expect(res.status).toBe(200);

    // Live league: the draft row drives the keeper deadline + planning season
    expect(mocks.syncLeague).toHaveBeenCalledWith("s-2026", {
      skipTransactions: false,
      skipDrafts: false,
    });
    // Completed seasons: history is frozen on Sleeper, skip the expensive pulls
    expect(mocks.syncLeague).toHaveBeenCalledWith("s-2025", {
      skipTransactions: true,
      skipDrafts: true,
    });
    expect(mocks.syncLeague).toHaveBeenCalledWith("s-2024", {
      skipTransactions: true,
      skipDrafts: true,
    });
    expect(mocks.syncLeague).toHaveBeenCalledTimes(3);
  });

  it("rebuilds the acquisition chain once, from the live league, through the change gate", async () => {
    const res = await GET(makeRequest("Bearer cron-test-secret"));
    const body = await res.json();

    expect(mocks.rebuildAcquisitionChainIfChanged).toHaveBeenCalledTimes(1);
    expect(mocks.rebuildAcquisitionChainIfChanged).toHaveBeenCalledWith("l-2026");
    expect(body.acquisitionChain).toMatchObject({
      leagueId: "l-2026", skipped: false, created: 3, updated: 1, deleted: 0,
    });
    expect(body.leaguesSynced).toBe(3);
    expect(body.errors).toEqual([]);
  });

  it("reports a skipped rebuild when nothing the chain depends on changed", async () => {
    mocks.rebuildAcquisitionChainIfChanged.mockResolvedValue({ leagueId: "l-2026", fingerprint: "fp-1", skipped: true });

    const res = await GET(makeRequest("Bearer cron-test-secret"));
    const body = await res.json();

    expect(body.acquisitionChain).toMatchObject({ leagueId: "l-2026", skipped: true });
    expect(body.errors).toEqual([]);
  });

  it("reports a chain rebuild failure without failing the whole run", async () => {
    mocks.rebuildAcquisitionChainIfChanged.mockRejectedValue(new Error("chain exploded"));

    const res = await GET(makeRequest("Bearer cron-test-secret"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.leaguesSynced).toBe(3);
    expect(body.errors).toEqual([expect.stringContaining("chain exploded")]);
  });

  it("re-derives keeper base costs for the live league's planning season", async () => {
    // Keeper.baseCost is written once at save time, so a trade that changes a
    // price leaves saved rows stale unless the cron re-derives them.
    mocks.resyncKeeperBaseCosts.mockResolvedValue({
      leagueId: "l-2026",
      season: 2026,
      changes: [{ keeperId: "k1", playerName: "Kyle Monangai", teamName: "T", from: 7, to: 8, breakdown: "Waiver/FA R8 = R8" }],
      written: 1,
      cascadeErrors: [],
    });

    const res = await GET(makeRequest("Bearer cron-test-secret"));
    const body = await res.json();

    expect(mocks.resyncKeeperBaseCosts).toHaveBeenCalledWith("l-2026", 2026, { apply: true });
    expect(body.keeperCosts).toMatchObject({ written: 1 });
    expect(body.errors).toEqual([]);
  });

  it("does not re-derive keeper costs off a half-written chain", async () => {
    mocks.rebuildAcquisitionChainIfChanged.mockRejectedValue(new Error("chain exploded"));

    const res = await GET(makeRequest("Bearer cron-test-secret"));
    const body = await res.json();

    expect(mocks.resyncKeeperBaseCosts).not.toHaveBeenCalled();
    expect(body.keeperCosts).toBeNull();
  });

  it("reports a keeper resync failure without failing the whole run", async () => {
    mocks.resyncKeeperBaseCosts.mockRejectedValue(new Error("resync exploded"));

    const res = await GET(makeRequest("Bearer cron-test-secret"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.leaguesSynced).toBe(3);
    expect(body.errors).toEqual([expect.stringContaining("resync exploded")]);
  });

  it("skips the chain rebuild when every league is complete", async () => {
    mockFn(prisma.league.findMany).mockResolvedValue(LEAGUES.filter((l) => l.status === "COMPLETE"));

    const res = await GET(makeRequest("Bearer cron-test-secret"));
    const body = await res.json();

    expect(mocks.rebuildAcquisitionChainIfChanged).not.toHaveBeenCalled();
    expect(mocks.resyncKeeperBaseCosts).not.toHaveBeenCalled();
    expect(body.acquisitionChain).toBeNull();
    expect(body.keeperCosts).toBeNull();
  });
});
