import { track } from '@vercel/analytics/react';

// Define event names as constants to avoid typos
export const EVENTS = {
  // User Journey
  LOGIN: 'login',
  LOGOUT: 'logout',
  SIGNUP: 'signup',
  PAGE_VIEW: 'page_view', // Custom page view event if needed alongside auto-tracking

  // Subscription
  VIEW_SUBSCRIPTION_PAGE: 'view_subscription_page',
  SELECT_PLAN: 'select_plan',
  BEGIN_CHECKOUT: 'begin_checkout',
  MANAGE_SUBSCRIPTION: 'manage_subscription',

  // Credits
  VIEW_CREDITS_PAGE: 'view_credits_page',
  BEGIN_CREDIT_PURCHASE: 'begin_credit_purchase',
} as const;

type EventName = typeof EVENTS[keyof typeof EVENTS];

/**
 * Wrapper around Vercel Analytics track function for type safety and centralized logging.
 */
export function trackEvent(eventName: EventName, properties?: Record<string, string | number | boolean | null>) {
  // Filter out null/undefined properties before sending
  const cleanProperties = properties 
    ? Object.fromEntries(Object.entries(properties).filter(([_, v]) => v !== null && v !== undefined))
    : undefined;

  // Log to console in development for verification
  if (import.meta.env.DEV) {
    console.log(`[Analytics] Track: ${eventName}`, cleanProperties);
  }

  track(eventName, cleanProperties as Record<string, string | number | boolean>);

  // Track to Google Analytics
  if (typeof window !== 'undefined' && (window as any).gtag) {
    (window as any).gtag('event', eventName, cleanProperties);
  }
}
