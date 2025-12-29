import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("env validation", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("should validate required DATABASE_URL", async () => {
    process.env.DATABASE_URL = "";
    process.env.NEXTAUTH_URL = "http://localhost:3000";
    process.env.NEXTAUTH_SECRET = "a-very-long-secret-that-is-at-least-32-chars";

    const { validateEnv } = await import("./env");
    expect(() => validateEnv()).toThrow("DATABASE_URL");
  });

  it("should validate NEXTAUTH_SECRET minimum length", async () => {
    process.env.DATABASE_URL = "postgresql://localhost:5432/test";
    process.env.NEXTAUTH_URL = "http://localhost:3000";
    process.env.NEXTAUTH_SECRET = "short";

    const { validateEnv } = await import("./env");
    expect(() => validateEnv()).toThrow("NEXTAUTH_SECRET");
  });

  it("should pass with valid environment variables", async () => {
    process.env.DATABASE_URL = "postgresql://localhost:5432/test";
    process.env.NEXTAUTH_URL = "http://localhost:3000";
    process.env.NEXTAUTH_SECRET = "a-very-long-secret-that-is-at-least-32-chars";

    const { validateEnv } = await import("./env");
    const env = validateEnv();

    expect(env.DATABASE_URL).toBe("postgresql://localhost:5432/test");
    expect(env.NEXTAUTH_URL).toBe("http://localhost:3000");
  });

  it("should use default values for optional fields", async () => {
    process.env.DATABASE_URL = "postgresql://localhost:5432/test";
    process.env.NEXTAUTH_URL = "http://localhost:3000";
    process.env.NEXTAUTH_SECRET = "a-very-long-secret-that-is-at-least-32-chars";

    const { validateEnv } = await import("./env");
    const env = validateEnv();

    expect(env.SLEEPER_API_BASE_URL).toBe("https://api.sleeper.app/v1");
    expect(env.ENABLE_TRADE_ANALYZER).toBe(true);
    expect(env.ENABLE_HISTORICAL_ANALYTICS).toBe(true);
  });

  it("should correctly parse feature flags", async () => {
    process.env.DATABASE_URL = "postgresql://localhost:5432/test";
    process.env.NEXTAUTH_URL = "http://localhost:3000";
    process.env.NEXTAUTH_SECRET = "a-very-long-secret-that-is-at-least-32-chars";
    process.env.ENABLE_TRADE_ANALYZER = "false";
    process.env.ENABLE_HISTORICAL_ANALYTICS = "false";

    const { validateEnv } = await import("./env");
    const env = validateEnv();

    expect(env.ENABLE_TRADE_ANALYZER).toBe(false);
    expect(env.ENABLE_HISTORICAL_ANALYTICS).toBe(false);
  });
});
