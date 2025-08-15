/**
 * Sentry Configuration for Server-Side Error Tracking
 * Includes PII redaction and environment-aware setup
 */

import * as Sentry from "@sentry/node";
import { logger } from "@shared/logger";

export function initSentry() {
  const dsn = process.env.SENTRY_DSN;
  const environment = process.env.SENTRY_ENVIRONMENT || "development";

  if (!dsn || environment === "development") {
    logger.info("Sentry is disabled in development or DSN not provided");
    return;
  }

  Sentry.init({
    dsn,
    environment,
    
    // Performance Monitoring
    tracesSampleRate: environment === "production" ? 0.1 : 1.0,
    
    // Before sending events, redact PII
    beforeSend(event) {
      // Redact user data
      if (event.user) {
        if (event.user.email) {
          event.user.email = "[REDACTED]";
        }
        if (event.user.ip_address) {
          event.user.ip_address = "[REDACTED]";
        }
      }
      
      // Redact sensitive data from request
      if (event.request) {
        // Redact headers
        if (event.request.headers) {
          const headers = event.request.headers as Record<string, string>;
          ["authorization", "cookie", "x-api-key"].forEach(header => {
            if (headers[header]) {
              headers[header] = "[REDACTED]";
            }
          });
        }
        
        // Redact cookies
        if (event.request.cookies) {
          event.request.cookies = { redacted: "[COOKIES_REDACTED]" };
        }
        
        // Redact sensitive data from request body
        if (event.request.data && typeof event.request.data === "object") {
          const data = event.request.data as Record<string, unknown>;
          ["password", "token", "apiKey", "secret", "creditCard", "ssn"].forEach(field => {
            if (data[field]) {
              data[field] = "[REDACTED]";
            }
          });
        }
      }
      
      // Redact sensitive data from extra context
      if (event.extra) {
        Object.keys(event.extra).forEach(key => {
          if (["password", "token", "apiKey", "secret"].some(field => 
            key.toLowerCase().includes(field)
          )) {
            event.extra![key] = "[REDACTED]";
          }
        });
      }
      
      return event;
    },
    
    integrations: [
      // Add request data to events
      Sentry.httpIntegration({
        tracing: true,
      }),
      // Express integration
      Sentry.expressIntegration({
        app: true,
      }),
    ],
  });
}

// Error handler middleware for Express
export const sentryErrorHandler = Sentry.expressErrorHandler();

export { Sentry };