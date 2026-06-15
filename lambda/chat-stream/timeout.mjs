/**
 * Bound how long we wait on a promise. Resolves/rejects with the wrapped promise
 * if it settles first; otherwise rejects with a TimeoutError after `ms`.
 *
 * The underlying work is NOT cancelled (this is a Promise.race, not an
 * AbortController) — it's for dependencies that don't accept an abortSignal here,
 * notably the DynamoDB DocumentClient write in `putFact`. The point is to stop the
 * agent from waiting on a hung dependency so a single slow tool can't starve the
 * 25s agent budget (see index.mjs). Tools that DO take an abortSignal (KB/podcast
 * retrieval) use AbortController directly instead.
 *
 * @param {Promise<T>} promise   the work to bound
 * @param {number}     ms        timeout in milliseconds
 * @param {string}     [label]   name used in the timeout error message
 * @returns {Promise<T>}
 * @template T
 */
export function withTimeout(promise, ms, label = "operation") {
  let timeoutId;
  const timeout = new Promise((_resolve, reject) => {
    timeoutId = setTimeout(() => {
      const err = new Error(`${label} timed out after ${ms}ms`);
      err.name = "TimeoutError";
      reject(err);
    }, ms);
  });
  // clearTimeout in finally so the timer never leaks, on any settle path.
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timeoutId));
}
