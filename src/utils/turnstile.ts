/**
 * Cloudflare Turnstile — invisible token acquisition.
 *
 * Loads the Turnstile script lazily (only when a token is first needed, e.g. the
 * first chat send or a blueprint generation — never on every page load), renders
 * an invisible widget, and resolves with a one-time token. The session-token
 * issuer Lambda verifies that token server-side before minting session tokens.
 *
 * Browser-only: all DOM/window access is inside the function bodies, so importing
 * this module is safe during SSR/prerender. The token logic that consumes this is
 * unit-tested separately by injecting a fake getTurnstileToken (see sessionToken.ts).
 */

interface TurnstileApi {
  render: (
    container: HTMLElement,
    opts: {
      sitekey: string;
      size?: 'invisible' | 'normal' | 'compact' | 'flexible';
      callback?: (token: string) => void;
      'error-callback'?: () => void;
      'timeout-callback'?: () => void;
    }
  ) => string;
  execute: (widgetId: string) => void;
  remove: (widgetId: string) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY || '';
const SCRIPT_URL =
  'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
// Hard ceiling on a single challenge. Without it, a widget that renders but whose
// callbacks never fire (Cloudflare degradation, frozen iframe) would hang the
// awaiting send/generate forever — the fetch AbortController never covers this.
const TOKEN_TIMEOUT_MS = 12000;

let scriptPromise: Promise<void> | null = null;

function loadScript(): Promise<void> {
  if (typeof window !== 'undefined' && window.turnstile) return Promise.resolve();
  if (!scriptPromise) {
    scriptPromise = new Promise<void>((resolve, reject) => {
      const s = document.createElement('script');
      s.src = SCRIPT_URL;
      s.async = true;
      s.defer = true;
      s.onload = () => resolve();
      s.onerror = () => {
        scriptPromise = null; // allow a later retry
        reject(new Error('turnstile script failed to load'));
      };
      document.head.appendChild(s);
    });
  }
  return scriptPromise;
}

async function waitForApi(timeoutMs = 5000): Promise<TurnstileApi> {
  const start = Date.now();
  while (!window.turnstile) {
    if (Date.now() - start > timeoutMs) throw new Error('turnstile api unavailable');
    await new Promise((r) => setTimeout(r, 50));
  }
  return window.turnstile;
}

/**
 * Resolve with a fresh, single-use Turnstile token. Returns "" if Turnstile is
 * not configured (no site key) so local/dev works without it.
 */
export async function getTurnstileToken(): Promise<string> {
  if (!SITE_KEY) return '';
  await loadScript();
  const api = await waitForApi();

  const container = document.createElement('div');
  container.style.display = 'none';
  document.body.appendChild(container);

  // Mutable holder (object props avoid the declare-then-assign / const churn).
  const ctl: { settled: boolean; timer?: ReturnType<typeof setTimeout>; widgetId?: string } = {
    settled: false,
  };

  return new Promise<string>((resolve, reject) => {
    const teardown = () => {
      if (ctl.timer) clearTimeout(ctl.timer);
      try { if (ctl.widgetId) api.remove(ctl.widgetId); } catch { /* noop */ }
      container.remove();
    };
    const succeed = (token: string) => {
      if (ctl.settled) return;
      ctl.settled = true;
      teardown();
      resolve(token);
    };
    const fail = (err: Error) => {
      if (ctl.settled) return;
      ctl.settled = true;
      teardown();
      reject(err);
    };

    // The callbacks fire after render() returns, so they safely read ctl.widgetId.
    ctl.widgetId = api.render(container, {
      sitekey: SITE_KEY,
      size: 'invisible',
      callback: (token: string) => succeed(token),
      'error-callback': () => fail(new Error('turnstile error')),
      'timeout-callback': () => fail(new Error('turnstile timeout')),
    });

    // Outer ceiling: if no callback ever fires, reject (and clean up) so callers
    // don't hang. sessionToken.getToken catches this and returns "".
    ctl.timer = setTimeout(() => fail(new Error('turnstile token timeout')), TOKEN_TIMEOUT_MS);

    // Invisible widgets run the challenge on demand.
    try { api.execute(ctl.widgetId); } catch { /* some modes auto-execute on render */ }
  });
}
