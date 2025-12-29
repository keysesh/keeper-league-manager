import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { logger } from "./logger";

describe("logger", () => {
  beforeEach(() => {
    vi.spyOn(console, "debug").mockImplementation(() => {});
    vi.spyOn(console, "info").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("debug", () => {
    it("should call console.debug with formatted message", () => {
      logger.debug("test message");
      expect(console.debug).toHaveBeenCalled();
      const call = (console.debug as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(call).toContain("[DEBUG]");
      expect(call).toContain("test message");
    });

    it("should include context in log message", () => {
      logger.debug("test message", { key: "value" });
      const call = (console.debug as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(call).toContain('"key":"value"');
    });
  });

  describe("info", () => {
    it("should call console.info with formatted message", () => {
      logger.info("info message");
      expect(console.info).toHaveBeenCalled();
      const call = (console.info as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(call).toContain("[INFO]");
      expect(call).toContain("info message");
    });
  });

  describe("warn", () => {
    it("should call console.warn with formatted message", () => {
      logger.warn("warning message");
      expect(console.warn).toHaveBeenCalled();
      const call = (console.warn as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(call).toContain("[WARN]");
      expect(call).toContain("warning message");
    });
  });

  describe("error", () => {
    it("should call console.error with formatted message", () => {
      logger.error("error message");
      expect(console.error).toHaveBeenCalled();
      const call = (console.error as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(call).toContain("[ERROR]");
      expect(call).toContain("error message");
    });

    it("should include error details when Error object is passed", () => {
      const error = new Error("test error");
      logger.error("error occurred", error);
      const call = (console.error as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(call).toContain("test error");
    });
  });

  describe("syncProgress", () => {
    it("should log progress with percentage", () => {
      logger.syncProgress("Test operation", 50, 100);
      expect(console.info).toHaveBeenCalled();
      const call = (console.info as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(call).toContain("50/100");
      expect(call).toContain("50%");
    });
  });

  describe("timing", () => {
    it("should log operation timing", () => {
      const startTime = Date.now() - 1000; // 1 second ago
      logger.timing("Test operation", startTime);
      expect(console.debug).toHaveBeenCalled();
      const call = (console.debug as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(call).toContain("Test operation completed");
      expect(call).toContain("durationMs");
    });
  });
});
