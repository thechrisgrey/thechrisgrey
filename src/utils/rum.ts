/**
 * CloudWatch RUM (Real User Monitoring) initialization.
 *
 * Captures client-side JavaScript errors, page load timing, web vitals, and
 * HTTP request failures. Source maps are uploaded to S3 during the Amplify
 * build so stack traces are unminified in the RUM console.
 *
 * Opt-in: only active when VITE_RUM_APP_MONITOR_ID is set. Inactive otherwise
 * (no cookies, no Cognito auth, no telemetry).
 *
 * AWS resources (us-east-1):
 *   - App Monitor: thechrisgrey (ID from AWS console or CLI)
 *   - Cognito Identity Pool: thechrisgrey-rum (for anonymous auth)
 *   - S3 bucket: thechrisgrey-rum-sourcemaps (for source map resolution)
 */

import { AwsRum, type AwsRumConfig } from 'aws-rum-web';

const APP_MONITOR_ID = import.meta.env.VITE_RUM_APP_MONITOR_ID || '';
const IDENTITY_POOL_ID = import.meta.env.VITE_RUM_IDENTITY_POOL_ID || '';
const REGION = import.meta.env.VITE_RUM_REGION || 'us-east-1';
const RELEASE_ID = import.meta.env.VITE_RUM_RELEASE_ID || 'dev';

// Skip initialization in test environments to avoid Cognito network calls.
const isTestEnv = import.meta.env.MODE === 'test' || !!import.meta.env.VITEST;

const isInitialized = !isTestEnv && APP_MONITOR_ID.length > 0 && IDENTITY_POOL_ID.length > 0;

let awsRum: AwsRum | null = null;

if (isInitialized) {
  try {
    const config: AwsRumConfig = {
      allowCookies: true,
      identityPoolId: IDENTITY_POOL_ID,
      sessionSampleRate: 1,
      endpoint: `https://dataplane.rum.${REGION}.amazonaws.com`,
      telemetries: ['errors', 'performance', 'http'],
      releaseId: RELEASE_ID,
    };

    awsRum = new AwsRum(APP_MONITOR_ID, '1.0.0', REGION, config);
  } catch {
    // Ignore errors during RUM initialization — the app must still work.
  }
}

/**
 * Record an error event in RUM. Falls back to console.error when RUM is not configured.
 */
export function captureError(error: Error, context?: Record<string, unknown>) {
  if (!awsRum) {
    console.error('Uncaught error:', error, context);
    return;
  }
  awsRum.recordError(error);
}

/**
 * Record a custom event in RUM.
 */
export function recordEvent(eventType: string, eventData?: Record<string, unknown>) {
  if (!awsRum) return;
  awsRum.recordEvent(eventType, eventData || {});
}

/**
 * Record a page view manually (for client-side route changes).
 */
export function recordPageView(pageId?: string) {
  if (!awsRum) return;
  awsRum.recordPageView(pageId);
}

export { isInitialized as isRumInitialized };
