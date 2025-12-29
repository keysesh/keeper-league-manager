import { describe, it, expect } from "vitest";
import {
  CuidSchema,
  PaginationSchema,
  SyncRequestSchema,
  CreateKeeperSchema,
  LeagueSettingsSchema,
  TradeVoteSchema,
  validateBody,
} from "./validations";
import { ValidationError } from "./errors";

describe("CuidSchema", () => {
  it("accepts valid CUID", () => {
    expect(CuidSchema.parse("clh1234567890abcdefghij")).toBe(
      "clh1234567890abcdefghij"
    );
  });

  it("rejects invalid CUID", () => {
    expect(() => CuidSchema.parse("invalid")).toThrow();
    expect(() => CuidSchema.parse("")).toThrow();
    expect(() => CuidSchema.parse(123)).toThrow();
  });
});

describe("PaginationSchema", () => {
  it("uses default values when not provided", () => {
    const result = PaginationSchema.parse({});
    expect(result.page).toBe(1);
    expect(result.limit).toBe(20);
  });

  it("parses string numbers correctly", () => {
    const result = PaginationSchema.parse({ page: "2", limit: "50" });
    expect(result.page).toBe(2);
    expect(result.limit).toBe(50);
  });

  it("enforces maximum limit", () => {
    expect(() => PaginationSchema.parse({ limit: 200 })).toThrow();
  });

  it("requires positive page number", () => {
    expect(() => PaginationSchema.parse({ page: 0 })).toThrow();
    expect(() => PaginationSchema.parse({ page: -1 })).toThrow();
  });
});

describe("SyncRequestSchema", () => {
  it("validates valid sync actions", () => {
    expect(SyncRequestSchema.parse({ action: "league" }).action).toBe("league");
    expect(SyncRequestSchema.parse({ action: "user-leagues" }).action).toBe(
      "user-leagues"
    );
    expect(SyncRequestSchema.parse({ action: "quick" }).action).toBe("quick");
  });

  it("rejects invalid sync actions", () => {
    expect(() => SyncRequestSchema.parse({ action: "invalid" })).toThrow();
  });

  it("accepts optional leagueId", () => {
    const result = SyncRequestSchema.parse({
      action: "league",
      leagueId: "clh1234567890abcdefghij",
    });
    expect(result.leagueId).toBe("clh1234567890abcdefghij");
  });

  it("accepts optional sleeperLeagueIds array", () => {
    const result = SyncRequestSchema.parse({
      action: "sync-league-chain",
      sleeperLeagueIds: ["123456", "789012"],
    });
    expect(result.sleeperLeagueIds).toEqual(["123456", "789012"]);
  });
});

describe("CreateKeeperSchema", () => {
  it("requires playerId", () => {
    expect(() => CreateKeeperSchema.parse({})).toThrow();
  });

  it("defaults type to REGULAR", () => {
    const result = CreateKeeperSchema.parse({
      playerId: "clh1234567890abcdefghij",
    });
    expect(result.type).toBe("REGULAR");
  });

  it("accepts FRANCHISE type", () => {
    const result = CreateKeeperSchema.parse({
      playerId: "clh1234567890abcdefghij",
      type: "FRANCHISE",
    });
    expect(result.type).toBe("FRANCHISE");
  });

  it("rejects invalid type", () => {
    expect(() =>
      CreateKeeperSchema.parse({
        playerId: "clh1234567890abcdefghij",
        type: "INVALID",
      })
    ).toThrow();
  });
});

describe("LeagueSettingsSchema", () => {
  it("accepts valid settings", () => {
    const result = LeagueSettingsSchema.parse({
      maxKeepers: 3,
      maxFranchiseTags: 1,
      franchiseTagEnabled: true,
    });
    expect(result.maxKeepers).toBe(3);
    expect(result.maxFranchiseTags).toBe(1);
    expect(result.franchiseTagEnabled).toBe(true);
  });

  it("enforces max keepers limit", () => {
    expect(() =>
      LeagueSettingsSchema.parse({ maxKeepers: 15 })
    ).toThrow();
  });

  it("enforces max franchise tags limit", () => {
    expect(() =>
      LeagueSettingsSchema.parse({ maxFranchiseTags: 5 })
    ).toThrow();
  });

  it("allows partial updates", () => {
    const result = LeagueSettingsSchema.parse({ maxKeepers: 5 });
    expect(result.maxKeepers).toBe(5);
    expect(result.maxFranchiseTags).toBeUndefined();
  });
});

describe("TradeVoteSchema", () => {
  it("accepts ACCEPT vote", () => {
    const result = TradeVoteSchema.parse({ vote: "ACCEPT" });
    expect(result.vote).toBe("ACCEPT");
  });

  it("accepts REJECT vote with reason", () => {
    const result = TradeVoteSchema.parse({
      vote: "REJECT",
      reason: "Not fair value",
    });
    expect(result.vote).toBe("REJECT");
    expect(result.reason).toBe("Not fair value");
  });

  it("rejects invalid vote", () => {
    expect(() => TradeVoteSchema.parse({ vote: "PENDING" })).toThrow();
  });

  it("enforces max reason length", () => {
    const longReason = "a".repeat(600);
    expect(() =>
      TradeVoteSchema.parse({ vote: "REJECT", reason: longReason })
    ).toThrow();
  });
});

describe("validateBody", () => {
  it("returns parsed data for valid input", () => {
    const result = validateBody(PaginationSchema, { page: 1, limit: 10 });
    expect(result).toEqual({ page: 1, limit: 10 });
  });

  it("throws ValidationError for invalid input", () => {
    expect(() => validateBody(PaginationSchema, { page: -1 })).toThrow(
      ValidationError
    );
  });

  it("includes field-level errors", () => {
    try {
      validateBody(PaginationSchema, { page: -1 });
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError);
      expect((error as ValidationError).errors).toBeDefined();
    }
  });
});
