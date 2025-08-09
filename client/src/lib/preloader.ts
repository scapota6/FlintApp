// Preloader utility for critical routes and resources
import { lazy } from 'react';

// Preload critical components
const preloadComponents = {
  Dashboard: lazy(() => import("@/pages/dashboard")),
  Trading: lazy(() => import("@/pages/trading")),
  Watchlist: lazy(() => import("@/pages/watchlist")),
};

// Preload critical routes when user is authenticated
export function preloadCriticalRoutes() {
  // Preload most commonly used routes
  const criticalRoutes = [
    () => import("@/pages/dashboard"),
    () => import("@/pages/trading"),
    () => import("@/pages/watchlist"),
  ];

  // Use requestIdleCallback if available, otherwise setTimeout
  if (typeof requestIdleCallback !== 'undefined') {
    criticalRoutes.forEach((route, index) => {
      requestIdleCallback(() => route(), { timeout: 2000 + index * 500 });
    });
  } else {
    criticalRoutes.forEach((route, index) => {
      setTimeout(() => route(), 1000 + index * 500);
    });
  }
}

// Preload on user interaction (hover, focus)
export function preloadRoute(routeImport: () => Promise<any>) {
  // Debounce preloading to avoid unnecessary requests
  let timeoutId: NodeJS.Timeout;
  
  return () => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      routeImport();
    }, 150); // Short delay to avoid preloading on quick mouse movements
  };
}

// Critical resource preloading
export function preloadCriticalResources() {
  // Preload commonly used icons
  const iconImports = [
    () => import("@/lib/icons"),
  ];

  // Preload UI components that are used across multiple pages
  const uiImports = [
    () => import("@/components/ui/button"),
    () => import("@/components/ui/card"),
    () => import("@/components/ui/dialog"),
    () => import("@/components/ui/toast"),
  ];

  [...iconImports, ...uiImports].forEach((importFn, index) => {
    if (typeof requestIdleCallback !== 'undefined') {
      requestIdleCallback(() => importFn(), { timeout: 3000 + index * 200 });
    } else {
      setTimeout(() => importFn(), 1500 + index * 200);
    }
  });
}