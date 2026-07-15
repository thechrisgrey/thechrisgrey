/**
 * Frontend resilience patterns: timeout, retry with exponential backoff, and
 * circuit breaker.
 *
 * Mirrors the Lambda fleet's `lambda/shared/timeout.mjs` pattern but adds
 * retry and circuit breaker capabilities needed for browser-side API calls
 * where network conditions are less reliable than within AWS.
 *
 * Usage:
 *   import { withTimeout, withRetry, CircuitBreaker } from '@/utils/resilience';
 *
 *   // Timeout a promise
 *   const data = await withTimeout(fetch(url), 5000, 'fetch posts');
 *
 *   // Retry with exponential backoff
 *   const data = await withRetry(() => fetch(url), { maxRetries: 3, baseDelay: 500 });
 *
 *   // Circuit breaker around an endpoint
 *   const breaker = new CircuitBreaker('newsletter', { threshold: 5, cooldown: 30_000 });
 *   const data = await breaker.execute(() => fetch(url));
 */

import { createLogger } from './logger';

const log = createLogger('Resilience');

/**
 * Bound how long we wait on a promise. Resolves/rejects with the wrapped
 * promise if it settles first; otherwise rejects with a TimeoutError after
 * `ms`. The underlying work is NOT cancelled (use AbortController for that).
 *
 * @template T
 * @param promise - the work to bound
 * @param ms - timeout in milliseconds
 * @param label - name used in the timeout error message
 */
export function withTimeout<T>(promise: Promise<T>, ms: number, label = 'operation'): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_resolve, reject) => {
    timeoutId = setTimeout(() => {
      const err = new Error(`${label} timed out after ${ms}ms`);
      err.name = 'TimeoutError';
      reject(err);
    }, ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timeoutId));
}

interface RetryOptions {
  maxRetries?: number;
  baseDelay?: number;
  maxDelay?: number;
  retryOn?: (error: unknown) => boolean;
}

const DEFAULT_RETRY_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  baseDelay: 500,
  maxDelay: 10_000,
  retryOn: (error: unknown) => {
    if (error instanceof Error) {
      // Retry on network errors and timeouts
      return error.name === 'TimeoutError' || error.name === 'TypeError';
    }
    return false;
  },
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry a function with exponential backoff and jitter.
 *
 * @template T
 * @param fn - function returning a promise (called on each attempt)
 * @param options - retry configuration
 */
export async function withRetry<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const opts = { ...DEFAULT_RETRY_OPTIONS, ...options };
  let lastError: unknown;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt >= opts.maxRetries || !opts.retryOn(error)) {
        throw error;
      }
      const delay = Math.min(opts.baseDelay * 2 ** attempt, opts.maxDelay);
      const jitter = delay * 0.5 * Math.random();
      const waitMs = Math.round(delay + jitter);
      log.warn('retry_scheduled', { attempt: attempt + 1, maxRetries: opts.maxRetries, waitMs });
      await sleep(waitMs);
    }
  }
  throw lastError;
}

type CircuitState = 'closed' | 'open' | 'half-open';

interface CircuitBreakerOptions {
  threshold?: number;
  cooldown?: number;
  resetTimeout?: number;
}

/**
 * Simple circuit breaker for external API calls.
 *
 * Tracks consecutive failures for a named endpoint. After `threshold`
 * consecutive failures, the circuit opens and subsequent calls fail fast
 * without hitting the network. After `cooldown` ms, the circuit enters
 * half-open state and allows one trial request. If it succeeds, the circuit
 * closes; if it fails, it re-opens.
 *
 * @example
 * const breaker = new CircuitBreaker('chat-api', { threshold: 5, cooldown: 30_000 });
 * try {
 *   const result = await breaker.execute(() => fetchChatApi(message));
 * } catch (error) {
 *   if (error instanceof CircuitOpenError) {
 *     // Show "service temporarily unavailable" UI
 *   }
 * }
 */
export class CircuitBreaker {
  private state: CircuitState = 'closed';
  private failureCount = 0;
  private lastFailureTime = 0;
  private readonly threshold: number;
  private readonly cooldown: number;

  constructor(
    private readonly name: string,
    options: CircuitBreakerOptions = {},
  ) {
    this.threshold = options.threshold ?? 5;
    this.cooldown = options.cooldown ?? options.resetTimeout ?? 30_000;
  }

  get currentState(): CircuitState {
    return this.state;
  }

  /**
   * Execute a function through the circuit breaker.
   * Throws CircuitOpenError if the circuit is open.
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      const elapsed = Date.now() - this.lastFailureTime;
      if (elapsed >= this.cooldown) {
        this.state = 'half-open';
        log.info('circuit_half_open', { name: this.name, elapsed });
      } else {
        const err = new CircuitOpenError(this.name, this.cooldown - elapsed);
        log.warn('circuit_open', { name: this.name, remainingCooldown: this.cooldown - elapsed });
        throw err;
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    if (this.state !== 'closed') {
      log.info('circuit_closed', { name: this.name, previousState: this.state });
    }
    this.failureCount = 0;
    this.state = 'closed';
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    if (this.failureCount >= this.threshold) {
      this.state = 'open';
      log.error('circuit_opened', {
        name: this.name,
        failureCount: this.failureCount,
        threshold: this.threshold,
      });
    }
  }

  reset(): void {
    this.failureCount = 0;
    this.state = 'closed';
    this.lastFailureTime = 0;
  }
}

export class CircuitOpenError extends Error {
  constructor(
    public readonly circuitName: string,
    public readonly remainingCooldown: number,
  ) {
    super(`Circuit "${circuitName}" is open. Retry in ${Math.ceil(remainingCooldown / 1000)}s.`);
    this.name = 'CircuitOpenError';
  }
}
