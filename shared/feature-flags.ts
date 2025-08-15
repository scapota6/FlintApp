/**
 * Feature Flags System
 * Centralized feature flag management for safe rollout of risky features
 */

export interface FeatureFlags {
  FF_TRADING: boolean;
  FF_ALERTS: boolean;
  FF_DEMO_MODE: boolean;
  [key: string]: boolean; // Allow for dynamic feature flags
}

// Server-side feature flags (using environment variables)
export function getServerFeatureFlags(): FeatureFlags {
  return {
    FF_TRADING: process.env.FF_TRADING === "true",
    FF_ALERTS: process.env.FF_ALERTS === "true",
    FF_DEMO_MODE: process.env.FF_DEMO_MODE === "true",
  };
}

// Client-side feature flags (passed from server via API)
export function getClientFeatureFlags(flags?: Partial<FeatureFlags>): FeatureFlags {
  const defaults: FeatureFlags = {
    FF_TRADING: false,
    FF_ALERTS: false,
    FF_DEMO_MODE: true,
  };

  if (!flags) return defaults;
  
  // Ensure all values are boolean, not undefined
  const mergedFlags: FeatureFlags = { ...defaults };
  Object.keys(flags).forEach((key) => {
    const value = flags[key];
    if (value !== undefined) {
      mergedFlags[key] = value;
    }
  });
  
  return mergedFlags;
}

// Helper to check if a feature is enabled
export function isFeatureEnabled(flagName: keyof FeatureFlags, flags: FeatureFlags): boolean {
  return flags[flagName] === true;
}

// Export flag names as constants for type safety
export const FLAGS = {
  TRADING: "FF_TRADING" as const,
  ALERTS: "FF_ALERTS" as const,
  DEMO_MODE: "FF_DEMO_MODE" as const,
} as const;