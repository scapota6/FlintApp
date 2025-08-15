/**
 * Sentry Configuration for Client-Side Error Tracking
 * Includes PII redaction and environment-aware setup
 */

import * as Sentry from "@sentry/react";

export function initSentry() {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  const environment = import.meta.env.VITE_SENTRY_ENVIRONMENT || "development";

  if (!dsn || environment === "development") {
    console.log("Sentry is disabled in development or DSN not provided");
    return;
  }

  Sentry.init({
    dsn,
    environment,
    integrations: [
      Sentry.replayIntegration({
        maskAllText: true, // Mask all text content for privacy
        blockAllMedia: true, // Block media to prevent PII exposure
      }),
    ],
    // Performance Monitoring
    tracesSampleRate: environment === "production" ? 0.1 : 1.0,
    
    // Session Replay
    replaysSessionSampleRate: 0.1, // 10% of sessions
    replaysOnErrorSampleRate: 1.0, // 100% when errors occur
    
    // Before sending events, redact PII
    beforeSend(event) {
      // Redact user email if present
      if (event.user?.email) {
        event.user.email = "[REDACTED]";
      }
      
      // Redact sensitive data from breadcrumbs
      if (event.breadcrumbs) {
        event.breadcrumbs = event.breadcrumbs.map(breadcrumb => {
          if (breadcrumb.data) {
            // Redact sensitive fields
            const sensitiveFields = ["password", "token", "apiKey", "secret", "creditCard"];
            Object.keys(breadcrumb.data).forEach(key => {
              if (sensitiveFields.some(field => key.toLowerCase().includes(field))) {
                breadcrumb.data![key] = "[REDACTED]";
              }
            });
          }
          return breadcrumb;
        });
      }
      
      // Redact sensitive data from request
      if (event.request) {
        if (event.request.cookies) {
          event.request.cookies = { redacted: "[COOKIES_REDACTED]" };
        }
        if (event.request.data && typeof event.request.data === "object") {
          const data = event.request.data as Record<string, unknown>;
          Object.keys(data).forEach(key => {
            if (["password", "token", "apiKey", "secret"].some(field => 
              key.toLowerCase().includes(field)
            )) {
              data[key] = "[REDACTED]";
            }
          });
        }
      }
      
      return event;
    },
  });
}

export { Sentry };