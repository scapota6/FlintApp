// Analytics tracking for connection health events
interface AnalyticsEvent {
  event: string;
  properties?: Record<string, any>;
}

/**
 * Track analytics events for connection health monitoring
 */
export function trackEvent(eventName: string, properties: Record<string, any> = {}) {
  if (typeof window === 'undefined') return;

  // In production, this would integrate with your analytics provider
  // For now, we'll log to console in development and prepare for production
  const event: AnalyticsEvent = {
    event: eventName,
    properties: {
      ...properties,
      timestamp: new Date().toISOString(),
      url: window.location.pathname,
      userAgent: navigator.userAgent
    }
  };

  if (process.env.NODE_ENV === 'development') {
    console.log('📊 Analytics:', event);
  }

  // TODO: Replace with your analytics provider (Mixpanel, Segment, etc.)
  try {
    // Example for Mixpanel:
    // window.mixpanel?.track(eventName, event.properties);
    
    // Example for Segment:
    // window.analytics?.track(eventName, event.properties);

    // Example for Google Analytics:
    // window.gtag?.('event', eventName, event.properties);
  } catch (error) {
    console.warn('Analytics tracking failed:', error);
  }
}

// Connection health specific events
export const ConnectionHealthEvents = {
  ACCOUNT_DISCONNECTED_SHOWN: 'account_disconnected_shown',
  RECONNECT_CLICKED: 'reconnect_clicked', 
  RECONNECT_SUCCESS: 'reconnect_success',
  RECONNECT_FAILED: 'reconnect_failed'
} as const;

export function trackAccountDisconnectedShown(accountId: string, provider: string) {
  trackEvent(ConnectionHealthEvents.ACCOUNT_DISCONNECTED_SHOWN, {
    account_id: accountId,
    provider
  });
}

export function trackReconnectClicked(accountId: string, provider: string) {
  trackEvent(ConnectionHealthEvents.RECONNECT_CLICKED, {
    account_id: accountId,
    provider
  });
}

export function trackReconnectSuccess(accountId: string, provider: string) {
  trackEvent(ConnectionHealthEvents.RECONNECT_SUCCESS, {
    account_id: accountId,
    provider
  });
}

export function trackReconnectFailed(accountId: string, provider: string, error: string) {
  trackEvent(ConnectionHealthEvents.RECONNECT_FAILED, {
    account_id: accountId,
    provider,
    error
  });
}