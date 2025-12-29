/**
 * Centralized Logger
 * Replaces scattered console.log statements with structured, configurable logging
 */

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogContext {
  [key: string]: unknown;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

// Get log level from environment, default to 'info' in production, 'debug' in development
const getMinLogLevel = (): LogLevel => {
  const envLevel = process.env.LOG_LEVEL as LogLevel | undefined;
  if (envLevel && LOG_LEVELS[envLevel] !== undefined) {
    return envLevel;
  }
  return process.env.NODE_ENV === "production" ? "info" : "debug";
};

const minLevel = getMinLogLevel();

const shouldLog = (level: LogLevel): boolean => {
  return LOG_LEVELS[level] >= LOG_LEVELS[minLevel];
};

const formatMessage = (
  level: LogLevel,
  message: string,
  context?: LogContext
): string => {
  const timestamp = new Date().toISOString();
  const contextStr = context ? ` ${JSON.stringify(context)}` : "";
  return `[${timestamp}] [${level.toUpperCase()}] ${message}${contextStr}`;
};

/**
 * Logger utility with configurable log levels
 */
export const logger = {
  debug(message: string, context?: LogContext): void {
    if (shouldLog("debug")) {
      console.debug(formatMessage("debug", message, context));
    }
  },

  info(message: string, context?: LogContext): void {
    if (shouldLog("info")) {
      console.info(formatMessage("info", message, context));
    }
  },

  warn(message: string, context?: LogContext): void {
    if (shouldLog("warn")) {
      console.warn(formatMessage("warn", message, context));
    }
  },

  error(message: string, error?: Error | unknown, context?: LogContext): void {
    if (shouldLog("error")) {
      const errorContext = error instanceof Error
        ? { ...context, error: error.message, stack: error.stack }
        : { ...context, error };
      console.error(formatMessage("error", message, errorContext));
    }
  },

  /**
   * Log sync progress for large operations
   */
  syncProgress(operation: string, current: number, total: number): void {
    if (shouldLog("info")) {
      const percentage = Math.round((current / total) * 100);
      console.info(formatMessage("info", `${operation}: ${current}/${total} (${percentage}%)`));
    }
  },

  /**
   * Log operation timing
   */
  timing(operation: string, startTime: number): void {
    if (shouldLog("debug")) {
      const duration = Date.now() - startTime;
      console.debug(formatMessage("debug", `${operation} completed`, { durationMs: duration }));
    }
  },
};

export default logger;
