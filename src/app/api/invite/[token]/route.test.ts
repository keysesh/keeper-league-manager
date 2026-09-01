import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getUserById: vi.fn(),
  encode: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    leagueInvite: { findUnique: vi.fn(), update: vi.fn() },
    roster: { findUnique: vi.fn(), update: vi.fn() },
    user: { findUnique: vi.fn(), create: vi.fn() },
    teamMember: { upsert: vi.fn() },
    session: { create: vi.fn() },
  },
}));

vi.mock("next-auth/jwt", () => ({ encode: mocks.encode }));

vi.mock("@/lib/sleeper/client", () => ({
  SleeperClient: class {
    getUserById = mocks.getUserById;
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { prisma } from "@/lib/prisma";
import { POST } from "./route";

function mockFn<T>(fn: T): ReturnType<typeof vi.fn> {
  return fn as ReturnType<typeof vi.fn>;
}

function makeRequest(body: Record<string, unknown>): NextRequest {
  return { json: async () => body } as unknown as NextRequest;
}

const PARAMS = { params: Promise.resolve({ token: "tok-123" }) };
const FUTURE = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  vi.clearAllMocks();
  process.env.NEXTAUTH_SECRET = "test-secret";
  mockFn(prisma.leagueInvite.findUnique).mockResolvedValue({
    id: "inv-1",
    leagueId: "league-2026",
    rosterId: "roster-10",
    token: "tok-123",
    status: "PENDING",
    expiresAt: FUTURE,
  });
  mockFn(prisma.roster.findUnique).mockResolvedValue({
    sleeperId: "1000541309863559168",
    ownerId: "1000541309863559168",
    teamName: "My Njigba Jaxon",
  });
  mockFn(prisma.user.findUnique).mockResolvedValue(null);
  mockFn(prisma.user.create).mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
    id: "user-new",
    ...data,
  }));
  mockFn(prisma.teamMember.upsert).mockResolvedValue({});
  mockFn(prisma.roster.update).mockResolvedValue({});
  mockFn(prisma.leagueInvite.update).mockResolvedValue({});
  mockFn(prisma.session.create).mockResolvedValue({});
  mocks.encode.mockResolvedValue("encoded-jwt");
  mocks.getUserById.mockResolvedValue({
    user_id: "1000541309863559168",
    username: "ketsesh",
    display_name: "ketsesh",
    avatar: "d22e52781a5d7a94bcbf2aa70e748382",
  });
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("POST /api/invite/[token]", () => {
  it("sets the session cookie under the __Secure- name on an https deployment", async () => {
    process.env.NEXTAUTH_URL = "https://keeper-league-manager.vercel.app";

    const res = await POST(makeRequest({ email: "owner@example.com" }), PARAMS);

    expect(res.status).toBe(200);
    const secure = res.cookies.get("__Secure-next-auth.session-token");
    expect(secure?.value).toBe("encoded-jwt");
    expect(secure?.secure).toBe(true);
    expect(secure?.httpOnly).toBe(true);
    expect(res.cookies.get("next-auth.session-token")).toBeUndefined();
  });

  it("sets the plain cookie name on an http (local) deployment", async () => {
    process.env.NEXTAUTH_URL = "http://localhost:3000";

    const res = await POST(makeRequest({ email: "owner@example.com" }), PARAMS);

    expect(res.status).toBe(200);
    expect(res.cookies.get("next-auth.session-token")?.value).toBe("encoded-jwt");
    expect(res.cookies.get("__Secure-next-auth.session-token")).toBeUndefined();
  });

  it("creates the account with the roster owner's real Sleeper identity", async () => {
    process.env.NEXTAUTH_URL = "https://keeper-league-manager.vercel.app";

    await POST(makeRequest({ email: "Owner@Example.com" }), PARAMS);

    expect(mocks.getUserById).toHaveBeenCalledWith("1000541309863559168");
    const created = mockFn(prisma.user.create).mock.calls[0][0].data;
    expect(created).toMatchObject({
      sleeperId: "1000541309863559168",
      sleeperUsername: "ketsesh",
      displayName: "ketsesh",
      avatar: "d22e52781a5d7a94bcbf2aa70e748382",
      onboardingComplete: true,
    });
    // The signed token carries what the session callback reads
    expect(mocks.encode).toHaveBeenCalledWith(
      expect.objectContaining({
        token: expect.objectContaining({ sub: "user-new", sleeperId: "1000541309863559168", username: "ketsesh" }),
        secret: "test-secret",
      })
    );
  });

  it("falls back to the team name when Sleeper has no record for the owner", async () => {
    process.env.NEXTAUTH_URL = "https://keeper-league-manager.vercel.app";
    mocks.getUserById.mockResolvedValue(null);

    await POST(makeRequest({ email: "owner@example.com" }), PARAMS);

    const created = mockFn(prisma.user.create).mock.calls[0][0].data;
    expect(created.sleeperUsername).toBe("My Njigba Jaxon");
    expect(created.displayName).toBe("My Njigba Jaxon");
  });

  it("links the roster to the new member and marks the invite accepted", async () => {
    process.env.NEXTAUTH_URL = "https://keeper-league-manager.vercel.app";

    const res = await POST(makeRequest({ email: "owner@example.com" }), PARAMS);
    const body = await res.json();

    expect(body).toMatchObject({ success: true, leagueId: "league-2026", redirectUrl: "/league/league-2026" });
    expect(prisma.teamMember.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId_rosterId: { userId: "user-new", rosterId: "roster-10" } },
      })
    );
    expect(prisma.leagueInvite.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "inv-1" },
        data: expect.objectContaining({ status: "ACCEPTED", acceptedById: "user-new" }),
      })
    );
  });
});
