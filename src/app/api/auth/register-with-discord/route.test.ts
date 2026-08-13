import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  ensureLeagueMembership: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
  },
}));

vi.mock("@/lib/sleeper/client", () => ({
  SleeperClient: class {
    getUser = mocks.getUser;
  },
}));

vi.mock("@/lib/sleeper/membership", () => ({
  ensureLeagueMembership: mocks.ensureLeagueMembership,
}));

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { prisma } from "@/lib/prisma";
import { POST } from "./route";

function makeRequest(body: Record<string, unknown>): NextRequest {
  return { json: async () => body } as unknown as NextRequest;
}

const VALID_BODY = {
  sleeperUsername: "newuser",
  email: "new@example.com",
  discordId: "discord-1",
  discordUsername: "newuser#1",
};

const SLEEPER_USER = {
  user_id: "sleeper-500",
  username: "newuser",
  display_name: "NewUser",
  avatar: null,
};

const CREATED_USER = { id: "user-500", sleeperId: "sleeper-500" };

function mockFn<T>(fn: T): ReturnType<typeof vi.fn> {
  return fn as ReturnType<typeof vi.fn>;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getUser.mockResolvedValue(SLEEPER_USER);
  mockFn(prisma.user.findUnique).mockResolvedValue(null);
  mockFn(prisma.user.upsert).mockResolvedValue(CREATED_USER);
  mocks.ensureLeagueMembership.mockResolvedValue({
    status: "linked",
    leagueId: "db-league-2026",
    leagueName: "E Pluribus Gridiron Dynasty",
    season: 2026,
  });
});

describe("POST /api/auth/register-with-discord", () => {
  it("awaits membership resolution and reports it in the response", async () => {
    const response = await POST(makeRequest(VALID_BODY));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    // The sync is awaited server-side — the account is linked to its league
    // BEFORE the client proceeds, not via fire-and-forget.
    expect(mocks.ensureLeagueMembership).toHaveBeenCalledWith("user-500");
    expect(data.membership).toMatchObject({ status: "linked" });
    expect(data.membershipError).toBe(false);
  });

  it("preserves the account and reports truthfully when the Sleeper sync fails", async () => {
    mocks.ensureLeagueMembership.mockRejectedValue(new Error("Sleeper down"));

    const response = await POST(makeRequest(VALID_BODY));
    const data = await response.json();

    // Registration itself succeeded; the failure is surfaced, not hidden and
    // not fatal — the dashboard recovery flow can retry without creating a
    // duplicate account.
    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.membership).toBeNull();
    expect(data.membershipError).toBe(true);
    expect(prisma.user.upsert).toHaveBeenCalledTimes(1);
  });

  it("rejects an unknown Sleeper username", async () => {
    mocks.getUser.mockResolvedValue(null);

    const response = await POST(makeRequest(VALID_BODY));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("INVALID_USERNAME");
    expect(mocks.ensureLeagueMembership).not.toHaveBeenCalled();
  });

  it("rejects a re-registration of an already-claimed account (no duplicates)", async () => {
    mockFn(prisma.user.findUnique).mockImplementation(
      async (args: { where: Record<string, unknown> }) =>
        args.where.sleeperId ? { id: "user-500", email: "new@example.com" } : null
    );

    const response = await POST(makeRequest(VALID_BODY));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("USERNAME_CLAIMED");
    expect(prisma.user.upsert).not.toHaveBeenCalled();
  });
});
