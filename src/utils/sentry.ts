/**
 * Sentry error tracking initialization.
 *
 * Provides structured error capture with source maps, breadcrumbs, and user
 * context. Complements CloudWatch RUM (which focuses on performance monitoring)
 * with Sentry's superior error grouping, release tracking, and stack trace
 * resolution.
 *
 * Consent-gated: only initializes when VITE_SENTRY_DSN is set AND the visitor
 * has granted analytics consent. Sentry uses cookies/storage and (via
 * replayIntegration) session replay, so — like PostHog — it stays completely
 * dormant until opt-in. Without a DSN or without consent it makes no network
 * calls and captures nothing.
 *
 * Integration points:
 *  - ErrorBoundary.tsx: captures React component errors with component stack
 *  - App.tsx: calls enableSentry() on mount for already-consented visitors,
 *    sets user context, and forwards RUM breadcrumbs
 *  - ConsentBanner.tsx: calls enableSentry() when the visitor accepts
 *  - Privacy.tsx: calls disableSentry() when the visitor withdraws consent
 *  - vite.config.ts: @sentry/vite-plugin uploads source maps during build
 *  - rum.ts: breadcrumbs from RUM are forwarded to Sentry for double-coverage
 */

import * as Sentry from '@sentry/react';
import { getConsent } from './consent';

const DSN = import.meta.env.VITE_SENTRY_DSN || '';
const ENVIRONMENT = import.meta.env.MODE || 'production';
const RELEASE_ID = import.meta.env.VITE_RUM_RELEASE_ID || 'dev';

const isTestEnv = import.meta.env.MODE === 'test' || !!import.meta.env.VITEST;
const isConfigured = !isTestEnv && DSN.length > 0;

// Mutable: flipped by enableSentry()/disableSentry() as consent changes.
let initialized = false;

/**
 * Initialize Sentry. Idempotent and safe to call repeatedly. No-op unless Sentry
 * is configured (DSN set, not a test run) AND the visitor has granted consent —
 * so session replay never runs for a visitor who declined or hasn't chosen.
 */
export function enableSentry(): void {
  if (initialized || !isConfigured || getConsent() !== 'granted') return;

  Sentry.init({
    dsn: DSN,
    environment: ENVIRONMENT,
    release: RELEASE_ID,
    tracesSampleRate: 0,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        maskAllText: true,
        blockAllMedia: true,
      }),
    ],
  });
  initialized = true;
}

/**
 * Tear down Sentry when the visitor withdraws consent. Flushes and closes the
 * client so no further events or session replays are sent. No-op if not active.
 */
export function disableSentry(): void {
  if (!initialized) return;
  void Sentry.close();
  initialized = false;
}

/**
 * Check if Sentry is initialized and active.
 */
export function isSentryInitialized(): boolean {
  return initialized;
}

/**
 * Capture an error with optional context. When Sentry is not configured,
 * this is a no-op (the RUM module handles the console fallback).
 */
export function captureSentryError(error: Error, context?: Record<string, unknown>): void {
  if (!initialized) return;

  Sentry.captureException(error, {
    extra: context,
  });
}

/**
 * Set user context for error correlation. Uses the same anonymous device hash
 * as RUM, no PII.
 */
export function setSentryUserContext(context: Record<string, unknown>): void {
  if (!initialized) return;

  Sentry.setUser({
    id: context.deviceId as string,
    segment: ENVIRONMENT,
  });

  Sentry.setTags({
    environment: ENVIRONMENT,
    release: RELEASE_ID,
  });

  if (context.sessionStart) {
    Sentry.setContext('session', { start: context.sessionStart });
  }
}

/**
 * Add a breadcrumb to Sentry's breadcrumb buffer. This forwards breadcrumbs
 * from the RUM module so both services have the same user-action context.
 */
export function addSentryBreadcrumb(type: string, message: string, data?: Record<string, unknown>): void {
  if (!initialized) return;

  Sentry.addBreadcrumb({
    type,
    message,
    data,
    level: type === 'error' ? 'error' : 'info',
  });
}

/**
 * Sentry-enhanced ErrorBoundary wrapper. Use this instead of the base
 * ErrorBoundary when Sentry is active to get automatic error capture
 * with React component stack.
 */
export const SentryErrorBoundary = Sentry.ErrorBoundary;
