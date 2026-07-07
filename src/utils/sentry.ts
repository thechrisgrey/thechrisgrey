import * as Sentry from '@sentry/react';

const DSN = import.meta.env.VITE_SENTRY_DSN;
const isInitialized = DSN && DSN.length > 0;

if (isInitialized) {
  Sentry.init({
    dsn: DSN,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        maskAllText: false,
        blockAllMedia: false,
      }),
    ],
    tracesSampleRate: 0.1,
    replaysSessionSampleRate: 0.0,
    replaysOnErrorSampleRate: 1.0,
    environment: import.meta.env.MODE,
    release: import.meta.env.VITE_SENTRY_RELEASE || undefined,
  });
}

export function captureError(error: Error, context?: Record<string, unknown>) {
  if (!isInitialized) {
    console.error('Uncaught error:', error, context);
    return;
  }
  Sentry.captureException(error, {
    contexts: context ? { custom: context } : undefined,
  });
}

export function captureMessage(message: string, level: Sentry.SeverityLevel = 'info') {
  if (!isInitialized) return;
  Sentry.captureMessage(message, level);
}

export function setUserContext(user: { id?: string; email?: string; username?: string }) {
  if (!isInitialized) return;
  Sentry.setUser(user);
}

export function addBreadcrumb(breadcrumb: Sentry.Breadcrumb) {
  if (!isInitialized) return;
  Sentry.addBreadcrumb(breadcrumb);
}

export { isInitialized as isSentryInitialized, Sentry };
