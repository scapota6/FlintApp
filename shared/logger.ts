/**
 * Structured Logging System
 * Centralized logging with PII redaction and environment-aware output
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

export interface LogContext {
  userId?: string;
  sessionId?: string;
  action?: string;
  metadata?: Record<string, unknown>;
  error?: Error;
}

class Logger {
  private logLevel: LogLevel;
  private isDevelopment: boolean;

  constructor() {
    this.isDevelopment = process.env.NODE_ENV === "development";
    this.logLevel = this.isDevelopment ? LogLevel.DEBUG : LogLevel.INFO;
  }

  /**
   * Redact sensitive information from log data
   */
  private redactPII(data: unknown): unknown {
    if (typeof data === "string") {
      // Redact email addresses
      let redactedString = data.replace(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/gi, "[REDACTED_EMAIL]");
      // Redact SSN-like patterns
      redactedString = redactedString.replace(/\b\d{3}-\d{2}-\d{4}\b/g, "[REDACTED_SSN]");
      // Redact credit card-like patterns
      redactedString = redactedString.replace(/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, "[REDACTED_CC]");
      // Redact API keys (common patterns)
      redactedString = redactedString.replace(/([a-zA-Z0-9]{32,})/g, "[REDACTED_KEY]");
      return redactedString;
    }

    if (typeof data === "object" && data !== null) {
      const redacted: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(data)) {
        // Redact sensitive field names
        if (["password", "token", "secret", "apiKey", "creditCard", "ssn", "email"].some(
          sensitive => key.toLowerCase().includes(sensitive)
        )) {
          redacted[key] = "[REDACTED]";
        } else {
          redacted[key] = this.redactPII(value);
        }
      }
      return redacted;
    }

    return data;
  }

  /**
   * Format log message with structured data
   */
  private formatLog(level: string, message: string, context?: LogContext): string {
    const timestamp = new Date().toISOString();
    const redactedContext = context ? this.redactPII(context) : {};
    const logData = {
      timestamp,
      level,
      message,
      ...(typeof redactedContext === 'object' && redactedContext !== null ? redactedContext : {}),
    };

    if (this.isDevelopment) {
      // Pretty print in development
      return `[${timestamp}] ${level}: ${message} ${context ? JSON.stringify(logData, null, 2) : ""}`;
    }

    // Structured JSON for production
    return JSON.stringify(logData);
  }

  debug(message: string, context?: LogContext): void {
    if (this.logLevel <= LogLevel.DEBUG) {
      console.log(this.formatLog("DEBUG", message, context));
    }
  }

  info(message: string, context?: LogContext): void {
    if (this.logLevel <= LogLevel.INFO) {
      console.log(this.formatLog("INFO", message, context));
    }
  }

  warn(message: string, context?: LogContext): void {
    if (this.logLevel <= LogLevel.WARN) {
      console.warn(this.formatLog("WARN", message, context));
    }
  }

  error(message: string, context?: LogContext): void {
    if (this.logLevel <= LogLevel.ERROR) {
      console.error(this.formatLog("ERROR", message, context));
    }
  }

  /**
   * Log API calls with redacted sensitive data
   */
  logApiCall(method: string, endpoint: string, statusCode: number, duration: number, context?: LogContext): void {
    this.info("API Call", {
      ...context,
      metadata: {
        method,
        endpoint: this.redactPII(endpoint),
        statusCode,
        duration,
        ...context?.metadata,
      },
    });
  }

  /**
   * Log user actions for audit trail
   */
  logUserAction(action: string, userId: string, details?: Record<string, unknown>): void {
    this.info("User Action", {
      userId,
      action,
      metadata: this.redactPII(details) as Record<string, unknown>,
    });
  }
}

// Export singleton instance
export const logger = new Logger();