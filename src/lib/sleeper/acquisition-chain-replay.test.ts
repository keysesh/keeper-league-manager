import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Replays the acquisition chain against an in-memory PlayerAcquisition table.
 * The scenarios are real ones from production (names changed):
 *  - Waddle: drafted, traded twice, dropped/re-added, then drafted by a new
 *    owner the next season. The old two-phase order closed the NEW owner's
 *    draft row as "traded" on a date a year before the pick.
 *  - Javonte: drafted, traded mid-season, then kept — the old order created a
 *    placeholder "keeper slot" row for the new owner that shadowed the trade.
 *  - Lamb: traded in the last week before the draft, then named as a keeper.
 */

type Row = Record<string, unknown> & {
  id: string;
  playerId: string;
  ownerSleeperId: string;
  leagueId: string;
  season: number;
  acquisitionDate: Date;
  dispositionType: string | null;
  dispositionDate: Date | null;
  baseCostOverride: number | null;
  updatedAt: Date;
  createdAt: Date;
};

const db = vi.hoisted(() => {
  const rows: Row[] = [];
  let seq = 0;
  const idIn = (where: Record<string, unknown>) => (where.id as { in: string[] }).in;
  return {
    rows,
    reset() { rows.length = 0; seq = 0; },
    seed(r: Partial<Row>) {
      const old = new Date("2026-03-18T12:00:00Z");
      rows.push({ id: `seed-${++seq}`, dispositionType: null, dispositionDate: null, baseCostOverride: null, createdAt: old, updatedAt: old, ...r } as Row);
    },
    playerAcquisition: {
      findMany: vi.fn(async ({ where }: { where: { leagueId: { in: string[] } } }) =>
        rows.filter((r) => where.leagueId.in.includes(r.leagueId))),
      createMany: vi.fn(async ({ data }: { data: Array<Record<string, unknown>> }) => {
        const now = new Date();
        for (const d of data) rows.push({ id: `row-${++seq}`, baseCostOverride: null, createdAt: now, updatedAt: now, ...d } as Row);
        return { count: data.length };
      }),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const row = rows.find((r) => r.id === where.id)!;
        Object.assign(row, data, { updatedAt: new Date() });
        return row;
      }),
      deleteMany: vi.fn(async ({ where }: { where: Record<string, unknown> }) => {
        const doomed = rows.filter((r) => idIn(where).includes(r.id));
        for (const d of doomed) rows.splice(rows.indexOf(d), 1);
        return { count: doomed.length };
      }),
    },
  };
});

const fixtures = vi.hoisted(() => ({
  leagues: [] as Array<{ id: string; sleeperId: string; previousLeagueId: string | null }>,
  draftPicks: [] as unknown[],
  transactions: [] as unknown[],
  rosters: [] as Array<{ id: string; sleeperId: string }>,
  corrections: [] as Array<{ draftSleeperId: string; role: string }>,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    league: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
        const l = fixtures.leagues.find((x) => x.id === where.id);
        return l ? { ...l, keeperSettings: null } : null;
      }),
      findFirst: vi.fn(async ({ where }: { where: { sleeperId: string } }) =>
        fixtures.leagues.find((x) => x.sleeperId === where.sleeperId) ?? null),
    },
    draftCorrection: { findMany: vi.fn(async () => fixtures.corrections) },
    draftPick: { findMany: vi.fn(async () => fixtures.draftPicks) },
    transactionPlayer: { findMany: vi.fn(async () => fixtures.transactions) },
    roster: { findMany: vi.fn(async () => fixtures.rosters) },
    playerAcquisition: db.playerAcquisition,
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { logger } from "@/lib/logger";
import { syncAcquisitionChain, STALE_ACQUISITION_MIN_CAP, acquisitionKey } from "./sync";

// Owners (sleeper ids) and their roster ids per season
const A = "owner-A", B = "owner-B", C = "owner-C", K = "owner-K";
const roster = (owner: string, season: number) => `r-${owner}-${season}`;

const DRAFTS: Record<number, { sleeperId: string; leagueId: string; startTime: Date }> = {
  2023: { sleeperId: "d23", leagueId: "L2023", startTime: new Date("2023-08-28T00:00:00Z") },
  2024: { sleeperId: "d24", leagueId: "L2024", startTime: new Date("2024-08-30T01:30:00Z") },
  2025: { sleeperId: "d25", leagueId: "L2025", startTime: new Date("2025-08-16T19:19:00Z") },
  2026: { sleeperId: "d26", leagueId: "L2026", startTime: new Date("2026-09-04T00:30:00Z") },
};

function pick(season: number, owner: string, playerId: string, round: number, isKeeper = false) {
  const d = DRAFTS[season];
  return {
    playerId, round, isKeeper,
    draft: { season, sleeperId: d.sleeperId, leagueId: d.leagueId, startTime: d.startTime },
    roster: { sleeperId: owner },
  };
}

function pickInDraft(
  draft: { season: number; sleeperId: string; leagueId: string; startTime: Date },
  owner: string, playerId: string, round: number, isKeeper = false
) {
  return { playerId, round, isKeeper, draft, roster: { sleeperId: owner } };
}

function tx(type: "TRADE" | "FREE_AGENT" | "WAIVER", when: string, playerId: string, from: string | null, to: string | null) {
  const createdAt = new Date(when);
  const season = createdAt.getUTCMonth() < 2 ? createdAt.getUTCFullYear() - 1 : createdAt.getUTCFullYear();
  return {
    playerId,
    fromRosterId: from ? roster(from, season) : null,
    toRosterId: to ? roster(to, season) : null,
    transaction: { type, createdAt, sleeperId: `tx-${when}-${playerId}`, leagueId: `L${season}` },
  };
}

function rosterRows() {
  const out: Array<{ id: string; sleeperId: string }> = [];
  for (const o of [A, B, C, K]) for (const s of [2023, 2024, 2025, 2026]) out.push({ id: roster(o, s), sleeperId: o });
  return out;
}

const rowsFor = (playerId: string) =>
  db.rows
    .filter((r) => r.playerId === playerId)
    .sort((a, b) => a.acquisitionDate.getTime() - b.acquisitionDate.getTime())
    .map((r) => ({
      season: r.season, owner: r.ownerSleeperId, type: r.acquisitionType, round: r.originalDraftRound,
      disposition: r.dispositionType, dispositionDate: r.dispositionDate ? (r.dispositionDate as Date).toISOString().slice(0, 10) : null,
      date: r.acquisitionDate.toISOString().slice(0, 10),
    }));

beforeEach(() => {
  vi.clearAllMocks();
  db.reset();
  fixtures.leagues = [
    { id: "L2026", sleeperId: "s26", previousLeagueId: "s25" },
    { id: "L2025", sleeperId: "s25", previousLeagueId: "s24" },
    { id: "L2024", sleeperId: "s24", previousLeagueId: "s23" },
    { id: "L2023", sleeperId: "s23", previousLeagueId: null },
  ];
  fixtures.rosters = rosterRows();
  fixtures.draftPicks = [];
  fixtures.transactions = [];
  fixtures.corrections = [];
});

describe("syncAcquisitionChain — chronological replay", () => {
  it("Waddle: a later-season draft never gets closed by an earlier-season trade", async () => {
    fixtures.draftPicks = [
      pick(2023, A, "waddle", 1),
      pick(2025, K, "waddle", 2),
    ];
    fixtures.transactions = [
      tx("TRADE", "2024-08-14T16:54:00Z", "waddle", A, B),
      tx("TRADE", "2024-10-03T00:20:00Z", "waddle", B, C),
      tx("FREE_AGENT", "2024-12-20T23:08:00Z", "waddle", C, null),
      tx("FREE_AGENT", "2024-12-20T23:09:00Z", "waddle", null, C),
    ];

    const result = await syncAcquisitionChain("L2026");

    expect(rowsFor("waddle")).toEqual([
      { season: 2023, owner: A, type: "DRAFTED", round: 1, disposition: "TRADED", dispositionDate: "2024-08-14", date: "2023-08-15" },
      { season: 2024, owner: B, type: "TRADE", round: 1, disposition: "TRADED", dispositionDate: "2024-10-03", date: "2024-08-14" },
      { season: 2024, owner: C, type: "TRADE", round: 1, disposition: "DROPPED", dispositionDate: "2024-12-20", date: "2024-10-03" },
      // The re-add carries the round he was drafted at as PROVENANCE — the
      // replay no longer drops it at the deadline. It buys him nothing here:
      // that round is from 2023 and this claim is in 2024, and only a
      // same-season round is a live contract, so the cost engine prices him
      // off the flat undrafted round (see calculator.test.ts, "drops the draft
      // round when a player is re-added in a later season").
      { season: 2024, owner: C, type: "FREE_AGENT", round: 1, disposition: "SEASON_END", dispositionDate: "2025-08-16", date: "2024-12-20" },
      { season: 2025, owner: K, type: "DRAFTED", round: 2, disposition: null, dispositionDate: null, date: "2025-08-15" },
    ]);
    // The invariant the old order violated on 153 production rows
    for (const r of db.rows) {
      if (r.dispositionDate) expect(r.dispositionDate.getTime()).toBeGreaterThanOrEqual(r.acquisitionDate.getTime());
    }
    expect(result.deleted).toBe(0);
  });

  it("Godwin: a same-season re-add keeps the draft round, new owner and past the deadline", async () => {
    // Drafted R4 in 2025 by A, dropped 19 Nov, claimed by B on 6 Dec. Both
    // dates are past the 2025 trade deadline (11 Nov) and B never owned him
    // before — neither matters. The rule is tied to the season: he is still
    // carrying that R4, so B keeps him for a 3rd in 2026 rather than the flat
    // undrafted 8th. Two bugs used to sink this: the drop deleted the round,
    // and the claim only inherited before the deadline.
    fixtures.draftPicks = [pick(2025, A, "godwin", 4)];
    fixtures.transactions = [
      tx("WAIVER", "2025-11-19T14:00:00Z", "godwin", A, null),
      tx("FREE_AGENT", "2025-12-06T14:00:00Z", "godwin", null, B),
    ];

    await syncAcquisitionChain("L2026");

    expect(rowsFor("godwin")).toEqual([
      { season: 2025, owner: A, type: "DRAFTED", round: 4, disposition: "DROPPED", dispositionDate: "2025-11-19", date: "2025-08-15" },
      { season: 2025, owner: B, type: "FREE_AGENT", round: 4, disposition: null, dispositionDate: null, date: "2025-12-06" },
    ]);
    const claim = db.rows.find((r) => r.playerId === "godwin" && r.ownerSleeperId === B)!;
    // The season on the row is what makes the round a live contract rather
    // than history, so the engine's same-season test can see it.
    expect(claim.originalDraftSeason).toBe(2025);
    expect(claim.season).toBe(2025);
    // Still recorded as the post-deadline claim it was — the deadline is real
    // provenance, it just does not decide whether the round carries.
    expect(claim.isPreDeadline).toBe(false);
  });

  it("Godwin, next season: the same claim a season later carries the round as history only", async () => {
    // Identical drop, claimed 2 Sep 2026 instead of 6 Dec 2025. The round
    // still rides along for the player page, but originalDraftSeason (2025)
    // no longer matches the claim season (2026), so the engine prices him at
    // the undrafted round.
    fixtures.draftPicks = [pick(2025, A, "godwin", 4)];
    fixtures.transactions = [
      tx("WAIVER", "2025-11-19T14:00:00Z", "godwin", A, null),
      tx("FREE_AGENT", "2026-09-02T14:00:00Z", "godwin", null, B),
    ];

    await syncAcquisitionChain("L2026");

    const claim = db.rows.find((r) => r.playerId === "godwin" && r.ownerSleeperId === B)!;
    expect(claim.originalDraftRound).toBe(4);
    expect(claim.originalDraftSeason).toBe(2025);
    expect(claim.season).toBe(2026);
  });

  it("Javonte: a keeper slot after a mid-season trade does not create a placeholder", async () => {
    fixtures.draftPicks = [
      pick(2025, A, "javonte", 10),
      pick(2026, B, "javonte", 9, true), // Sleeper keeper slot, pre-draft
    ];
    fixtures.transactions = [tx("TRADE", "2025-09-30T15:00:00Z", "javonte", A, B)];

    await syncAcquisitionChain("L2026");

    expect(rowsFor("javonte")).toEqual([
      { season: 2025, owner: A, type: "DRAFTED", round: 10, disposition: "TRADED", dispositionDate: "2025-09-30", date: "2025-08-15" },
      { season: 2025, owner: B, type: "TRADE", round: 10, disposition: null, dispositionDate: null, date: "2025-09-30" },
    ]);
    // B's latest acquisition (what the cost engine reads) is the trade, inheriting R10
    expect(db.rows.filter((r) => r.playerId === "javonte" && r.ownerSleeperId === B)).toHaveLength(1);
  });

  it("Lamb: a trade in the last week before the draft is applied before the keeper slot", async () => {
    fixtures.draftPicks = [
      pick(2025, A, "lamb", 2),
      pick(2026, B, "lamb", 4, true),
    ];
    fixtures.transactions = [tx("TRADE", "2026-08-26T18:00:00Z", "lamb", A, B)];

    await syncAcquisitionChain("L2026");

    expect(rowsFor("lamb")).toEqual([
      { season: 2025, owner: A, type: "DRAFTED", round: 2, disposition: "TRADED", dispositionDate: "2026-08-26", date: "2025-08-15" },
      { season: 2026, owner: B, type: "TRADE", round: 2, disposition: null, dispositionDate: null, date: "2026-08-26" },
    ]);
  });

  it("a keeper slot with no synced acquisition still gets a placeholder (data gap, not a bug)", async () => {
    fixtures.draftPicks = [pick(2026, B, "mystery", 6, true)];

    await syncAcquisitionChain("L2026");

    expect(rowsFor("mystery")).toEqual([
      { season: 2026, owner: B, type: "DRAFTED", round: null, disposition: null, dispositionDate: null, date: "2026-08-01" },
    ]);
  });

  it("keys rows on the full unique tuple, including acquisitionDate", () => {
    const a = acquisitionKey({ playerId: "p", ownerSleeperId: "o", season: 2024, acquisitionDate: new Date("2024-12-18T10:00:00Z") });
    const b = acquisitionKey({ playerId: "p", ownerSleeperId: "o", season: 2024, acquisitionDate: new Date("2024-12-18T13:00:00Z") });
    expect(a).not.toBe(b);
  });

  it("prunes rows an earlier run left behind, but never a commissioner override", async () => {
    fixtures.draftPicks = [pick(2025, A, "javonte", 10), pick(2026, B, "javonte", 9, true)];
    fixtures.transactions = [tx("TRADE", "2025-09-30T15:00:00Z", "javonte", A, B)];
    // Leftover placeholder from the two-phase era (shadowed the trade in the cost engine)
    db.seed({ playerId: "javonte", ownerSleeperId: B, leagueId: "L2026", season: 2026, acquisitionType: "DRAFTED", originalDraftRound: null, acquisitionDate: new Date("2026-08-01"), dispositionType: "TRADED", dispositionDate: new Date("2025-09-30") });
    // A commissioner-overridden row that no event reproduces
    db.seed({ playerId: "legacy", ownerSleeperId: A, leagueId: "L2024", season: 2024, acquisitionType: "WAIVER", originalDraftRound: null, acquisitionDate: new Date("2024-10-01"), baseCostOverride: 5 });
    // A row from a league outside this chain
    db.seed({ playerId: "other", ownerSleeperId: A, leagueId: "L-other", season: 2024, acquisitionType: "WAIVER", originalDraftRound: null, acquisitionDate: new Date("2024-10-01") });

    const result = await syncAcquisitionChain("L2026");

    expect(result.deleted).toBe(1);
    expect(db.rows.filter((r) => r.playerId === "javonte" && r.ownerSleeperId === B)).toHaveLength(1);
    expect(db.rows.find((r) => r.playerId === "legacy")?.baseCostOverride).toBe(5);
    expect(db.rows.find((r) => r.playerId === "other")).toBeDefined();
  });

  it("re-derives dispositions each run: a wrongly closed row from an earlier run is reopened", async () => {
    fixtures.draftPicks = [pick(2025, K, "waddle", 2)];
    db.seed({ playerId: "waddle", ownerSleeperId: K, leagueId: "L2025", season: 2025, acquisitionType: "DRAFTED", originalDraftRound: 2, acquisitionDate: new Date("2025-08-15"), dispositionType: "TRADED", dispositionDate: new Date("2024-08-14") });

    await syncAcquisitionChain("L2026");

    const row = db.rows.find((r) => r.playerId === "waddle")!;
    expect(row.id).toBe("seed-1"); // updated in place, not re-created
    expect(row.dispositionType).toBeNull();
    expect(row.dispositionDate).toBeNull();
    expect(db.rows.filter((r) => r.playerId === "waddle")).toHaveLength(1);
    expect(db.playerAcquisition.update).toHaveBeenCalledTimes(1);
  });

  it("an owner who acquires the same player twice in a season gets two rows (the old upsert collided here)", async () => {
    fixtures.transactions = [
      tx("WAIVER", "2024-12-18T10:00:00Z", "penix", null, A),
      tx("FREE_AGENT", "2024-12-18T12:00:00Z", "penix", A, null),
      tx("FREE_AGENT", "2024-12-18T13:00:00Z", "penix", null, A),
    ];

    await syncAcquisitionChain("L2026");

    expect(rowsFor("penix")).toEqual([
      { season: 2024, owner: A, type: "WAIVER", round: null, disposition: "DROPPED", dispositionDate: "2024-12-18", date: "2024-12-18" },
      { season: 2024, owner: A, type: "FREE_AGENT", round: null, disposition: null, dispositionDate: null, date: "2024-12-18" },
    ]);
  });

  it("is idempotent: a second run with the same inputs writes nothing", async () => {
    fixtures.draftPicks = [pick(2023, A, "waddle", 1), pick(2025, K, "waddle", 2), pick(2026, B, "javonte", 9, true), pick(2025, A, "javonte", 10)];
    fixtures.transactions = [
      tx("TRADE", "2024-08-14T16:54:00Z", "waddle", A, B),
      tx("TRADE", "2025-09-30T15:00:00Z", "javonte", A, B),
    ];

    const first = await syncAcquisitionChain("L2026");
    expect(first.created).toBeGreaterThan(0);
    vi.clearAllMocks();

    const second = await syncAcquisitionChain("L2026");

    expect(second).toEqual({ created: 0, updated: 0, deleted: 0 });
    expect(db.playerAcquisition.createMany).not.toHaveBeenCalled();
    expect(db.playerAcquisition.update).not.toHaveBeenCalled();
    expect(db.playerAcquisition.deleteMany).not.toHaveBeenCalled();
  });

  it("clean draft: traded in before the draft, then drafted by the same owner = a fresh draft acquisition", async () => {
    // Nico Collins / Trey McBride: BlckMessiah acquired them by trade on Aug 11 2025,
    // then took them again in the clean Aug 16 draft (the roster reset released them).
    fixtures.draftPicks = [pick(2024, A, "nico", 10), pick(2025, B, "nico", 14)];
    fixtures.transactions = [tx("TRADE", "2025-08-11T12:00:00Z", "nico", A, B)];
    fixtures.corrections = [{ draftSleeperId: "d25", role: "CLEAN" }];

    await syncAcquisitionChain("L2026");

    expect(rowsFor("nico")).toEqual([
      { season: 2024, owner: A, type: "DRAFTED", round: 10, disposition: "TRADED", dispositionDate: "2025-08-11", date: "2024-08-15" },
      { season: 2025, owner: B, type: "TRADE", round: 10, disposition: "SEASON_END", dispositionDate: "2025-08-16", date: "2025-08-11" },
      { season: 2025, owner: B, type: "DRAFTED", round: 14, disposition: null, dispositionDate: null, date: "2025-08-15" },
    ]);
    for (const r of db.rows) {
      if (r.dispositionDate) expect(r.dispositionDate.getTime()).toBeGreaterThanOrEqual(r.acquisitionDate.getTime());
    }
  });

  it("reconstructed draft (CORRECT_OWNERS): a same-owner non-keeper pick is the keeper representation, not a new row", async () => {
    // 2024: Waddle traded to RyanRus on Aug 14, then listed as RyanRus's R1 pick in the
    // commissioner-rebuilt Aug 30 draft. That pick IS the keeper, not a re-draft.
    fixtures.draftPicks = [pick(2023, A, "waddle", 1), pick(2024, B, "waddle", 1)];
    fixtures.transactions = [tx("TRADE", "2024-08-14T16:54:00Z", "waddle", A, B)];
    fixtures.corrections = [{ draftSleeperId: "d24", role: "CORRECT_OWNERS" }];

    await syncAcquisitionChain("L2026");

    expect(rowsFor("waddle")).toEqual([
      { season: 2023, owner: A, type: "DRAFTED", round: 1, disposition: "TRADED", dispositionDate: "2024-08-14", date: "2023-08-15" },
      { season: 2024, owner: B, type: "TRADE", round: 1, disposition: null, dispositionDate: null, date: "2024-08-14" },
    ]);
  });

  it("CORRECT_ROUNDS drafts supply rounds only, never ownership", async () => {
    // 2023 had a snake draft with correct rounds but wrong roster assignments, then a
    // linear re-draft with correct owners. Ownership must come from the second only.
    const roundsDraft = { season: 2023, sleeperId: "d23-rounds", leagueId: "L2023", startTime: new Date("2023-08-24T21:25:00Z") };
    const ownersDraft = { season: 2023, sleeperId: "d23-owners", leagueId: "L2023", startTime: new Date("2023-08-28T00:00:00Z") };
    fixtures.draftPicks = [
      pickInDraft(roundsDraft, B, "lamb", 8),          // wrong owner, right round
      pickInDraft(ownersDraft, A, "lamb", 3, true),    // right owner, keeper slot (cascade-adjusted round)
    ];
    fixtures.corrections = [
      { draftSleeperId: "d23-rounds", role: "CORRECT_ROUNDS" },
      { draftSleeperId: "d23-owners", role: "CORRECT_OWNERS" },
    ];

    await syncAcquisitionChain("L2026");

    expect(rowsFor("lamb")).toEqual([
      { season: 2023, owner: A, type: "DRAFTED", round: 8, disposition: null, dispositionDate: null, date: "2023-08-01" },
    ]);
    expect(db.rows.some((r) => r.ownerSleeperId === B)).toBe(false);
  });

  it("SAFETY: refuses a mass prune that would only happen if the source data failed to load", async () => {
    fixtures.draftPicks = [pick(2025, K, "waddle", 2)];
    for (let i = 0; i < STALE_ACQUISITION_MIN_CAP + 5; i++) {
      db.seed({ playerId: `p${i}`, ownerSleeperId: A, leagueId: "L2024", season: 2024, acquisitionType: "WAIVER", originalDraftRound: null, acquisitionDate: new Date("2024-10-01") });
    }

    const result = await syncAcquisitionChain("L2026");

    expect(result.deleted).toBe(0);
    expect(db.playerAcquisition.deleteMany).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining("Refusing to prune"),
      undefined,
      expect.objectContaining({ staleCount: STALE_ACQUISITION_MIN_CAP + 5 })
    );
  });
});
