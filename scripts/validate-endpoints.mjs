/**
 * Build-time endpoint identity guardrail.
 *
 * Every VITE_*_ENDPOINT baked into the bundle must point at the Lambda that owns
 * it. A swap is invisible to presence-only checks (validate-env.js) and shipped a
 * broken /admin to production once: VITE_KB_BUILDER_ENDPOINT and
 * VITE_BLUEPRINT_ENDPOINT were set to each other's Function URL, so the admin
 * page called the blueprint Lambda, got a CORS-less 405, and the fetch failed.
 *
 * This closes that gap. For each endpoint whose Lambda exposes an unauthenticated
 * GET /health returning a `service` field, we fetch /health and assert the
 * reported service matches the expected one. A MISMATCH (reached the wrong
 * Lambda) fails the build — that is the swap. An UNREACHABLE endpoint only warns,
 * so a transient outage doesn't block a deploy, unless STRICT_ENDPOINT_VALIDATION
 * is 'true'. Set SKIP_ENDPOINT_VALIDATION='true' to bypass entirely (offline).
 *
 * Runs right after validate-env.js, in the same environment that holds the VITE_*
 * vars, so it verifies exactly what will be inlined into the bundle.
 *
 * Only the Lambdas with an identifying, unauthenticated /health are covered
 * (metrics /health is Cognito-auth'd; contact/newsletter/session-token expose
 * none). Notably this includes the two endpoints that were swapped.
 */
import { realpathSync } from 'fs';
import { pathToFileURL } from 'url';

/** Map each frontend endpoint env var to the `service` its /health must report. */
export const ENDPOINT_SERVICES = {
  VITE_KB_BUILDER_ENDPOINT: 'kb-builder',
  VITE_BLUEPRINT_ENDPOINT: 'blueprint',
  VITE_CHAT_ENDPOINT: 'chat-stream',
};

/**
 * Probe one endpoint's /health and classify the result.
 * @returns {Promise<{name: string, status: 'ok'|'mismatch'|'unreachable', service?: string, expected?: string, error?: string}>}
 */
export async function checkEndpoint(name, baseUrl, expected, { fetchImpl = fetch, timeoutMs = 8000 } = {}) {
  const url = `${baseUrl.replace(/\/$/, '')}/health`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let res;
  try {
    res = await fetchImpl(url, { signal: controller.signal, redirect: 'follow' });
  } catch (err) {
    return { name, status: 'unreachable', error: err && err.message ? err.message : String(err) };
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) return { name, status: 'unreachable', error: `HTTP ${res.status}` };
  let body;
  try {
    body = await res.json();
  } catch {
    return { name, status: 'unreachable', error: 'non-JSON /health response' };
  }
  const service = body.service || body.server;
  if (service === expected) return { name, status: 'ok', service };
  return { name, status: 'mismatch', expected, service };
}

/**
 * Run all endpoint checks. Returns a process exit code (0 pass, 1 fail).
 * @returns {Promise<number>}
 */
export async function run(env = process.env, opts = {}) {
  if (String(env.SKIP_ENDPOINT_VALIDATION).toLowerCase() === 'true') {
    console.log('[endpoints] SKIP_ENDPOINT_VALIDATION set — skipping endpoint identity checks.');
    return 0;
  }
  const strict = String(env.STRICT_ENDPOINT_VALIDATION).toLowerCase() === 'true';

  const results = await Promise.all(
    Object.entries(ENDPOINT_SERVICES)
      // Presence is validate-env.js's job; only check configured endpoints.
      .filter(([name]) => env[name])
      .map(([name, expected]) => checkEndpoint(name, env[name], expected, opts)),
  );

  for (const r of results) {
    if (r.status === 'ok') {
      console.log(`[endpoints] OK        ${r.name} -> "${r.service}"`);
    } else if (r.status === 'mismatch') {
      console.error(
        `[endpoints] MISMATCH  ${r.name}: expected "${r.expected}" but /health reports "${r.service ?? 'unknown'}"`,
      );
    } else {
      console.warn(`[endpoints] WARN      ${r.name} unreachable (${r.error}) — identity not verified`);
    }
  }

  const mismatches = results.filter((r) => r.status === 'mismatch');
  const unreachable = results.filter((r) => r.status === 'unreachable');

  if (mismatches.length > 0) {
    console.error(
      `\n[endpoints] ${mismatches.length} endpoint(s) point at the wrong Lambda — almost certainly a swapped ` +
        `VITE_*_ENDPOINT. Fix the environment variables (Amplify branch vars) and rebuild.`,
    );
    return 1;
  }
  if (strict && unreachable.length > 0) {
    console.error(`\n[endpoints] STRICT: ${unreachable.length} endpoint(s) unreachable and could not be verified.`);
    return 1;
  }

  console.log('[endpoints] Endpoint identity validation passed.');
  return 0;
}

// Run only when invoked directly (so the exports can be imported by a test).
const invokedDirectly = process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href;
if (invokedDirectly) {
  run()
    .then((code) => process.exit(code))
    .catch((err) => {
      // An unexpected crash in the guardrail itself should not silently pass a
      // build, but also should not be more disruptive than a mismatch: surface
      // it and fail closed.
      console.error('[endpoints] Endpoint validation crashed:', err && err.message ? err.message : err);
      process.exit(1);
    });
}
