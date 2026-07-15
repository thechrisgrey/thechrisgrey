/**
 * Bound how long we wait on a promise. Resolves/rejects with the wrapped promise
 * if it settles first; otherwise rejects with a TimeoutError after `ms`.
 *
 * The underlying work is NOT cancelled (this is a Promise.race, not an
 * AbortController) — it's for dependencies that don't accept an abortSignal.
 * The point is to stop the handler from waiting on a hung dependency so a
 * single slow external call can't starve the request budget.
 *
 * For SDK calls that accept an abortSignal (e.g. Bedrock, DynamoDB), prefer
 * passing AbortController directly instead of wrapping with withTimeout.
 *
 * @template T
 * @param {Promise<T>} promise   the work to bound
 * @param {number}  ms        timeout in milliseconds
 * @param {string}  [label]   name used in the timeout error message
 * @returns {Promise<T>}
 */
export function withTimeout(promise, ms, label = "operation") {
  /** @type {ReturnType<typeof setTimeout> | undefined} */
  let timeoutId;
  const timeout = new Promise((_resolve, reject) => {
    timeoutId = setTimeout(() => {
      const err = new Error(`${label} timed out after ${ms}ms`);
      err.name = "TimeoutError";
      reject(err);
    }, ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timeoutId));
}
