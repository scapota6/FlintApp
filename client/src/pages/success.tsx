/**
 * Success page for checkout completions
 * Route: /success?plan=PLAN_NAME
 */

import React, { useEffect } from 'react';
import { Button } from "@/components/ui/button";

// Analytics tracking
const trackEvent = (eventName: string, properties: Record<string, any> = {}) => {
  console.log('Analytics Event:', eventName, properties);
  if (typeof window !== 'undefined' && (window as any).gtag) {
    (window as any).gtag('event', eventName, properties);
  }
};

export default function SuccessPage() {
  const urlParams = new URLSearchParams(window.location.search);
  const plan = urlParams.get('plan') || 'your plan';
  
  useEffect(() => {
    trackEvent('purchase_complete', { plan });
  }, [plan]);
  
  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center">
      <div className="max-w-md mx-auto text-center space-y-6 px-4">
        <div className="text-6xl">🎉</div>
        <h1 className="text-3xl font-bold">Welcome to Flint!</h1>
        <p className="text-gray-300">
          Thank you for choosing <strong>{plan}</strong>. Check your email for next steps.
        </p>
        <div className="space-y-4">
          <Button 
            className="w-full bg-purple-600 hover:bg-purple-700"
            onClick={() => window.location.href = '/app'}
          >
            Go to Dashboard
          </Button>
          <Button 
            variant="outline"
            className="w-full border-gray-600 text-gray-300 hover:bg-gray-800"
            onClick={() => window.location.href = '/'}
          >
            Back to Homepage
          </Button>
        </div>
        
        <div className="text-xs text-gray-500 space-y-1">
          <p>Order ID: {urlParams.get('session_id') || 'N/A'}</p>
          <p>Need help? Contact support@flint.com</p>
        </div>
      </div>
    </div>
  );
}