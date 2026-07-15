import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('./logger', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    child: vi.fn(() => ({
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    })),
  }),
}));

import { withTimeout, withRetry, CircuitBreaker, CircuitOpenError } from './resilience';

describe('withTimeout', () => {
  it('resolves with the value when the promise settles before the timeout', async () => {
    const result = await withTimeout(Promise.resolve(42), 1000, 'test');
    expect(result).toBe(42);
  });

  it('rejects with a TimeoutError when the promise takes too long', async () => {
    const slow = new Promise((resolve) => setTimeout(resolve, 200));
    await expect(withTimeout(slow, 50, 'slow operation')).rejects.toThrow('slow operation timed out after 50ms');
  });

  it('preserves the original rejection error', async () => {
    const failing = Promise.reject(new Error('api error'));
    await expect(withTimeout(failing, 1000, 'api')).rejects.toThrow('api error');
  });

  it('clears the timeout timer when the promise resolves first', async () => {
    const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout');
    await withTimeout(Promise.resolve('ok'), 1000, 'test');
    expect(clearTimeoutSpy).toHaveBeenCalled();
    clearTimeoutSpy.mockRestore();
  });
});

describe('withRetry', () => {
  // Use real timers with very short delays to avoid fake-timer/microtask
  // interaction issues with unhandled promise rejections.
  it('returns the result on first success without retrying', async () => {
    const fn = vi.fn().mockResolvedValue('success');
    const result = await withRetry(fn, { maxRetries: 3, baseDelay: 1 });
    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries on failure and succeeds on a later attempt', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('network error'))
      .mockRejectedValueOnce(new TypeError('network error'))
      .mockResolvedValueOnce('success');

    const result = await withRetry(fn, { maxRetries: 3, baseDelay: 1, maxDelay: 5 });

    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('throws after max retries are exhausted', async () => {
    const error = new TypeError('persistent network error');
    const fn = vi.fn().mockRejectedValue(error);

    await expect(withRetry(fn, { maxRetries: 2, baseDelay: 1, maxDelay: 5 })).rejects.toThrow(
      'persistent network error',
    );
    expect(fn).toHaveBeenCalledTimes(3); // initial + 2 retries
  });

  it('does not retry on non-retryable errors', async () => {
    const error = new Error('bad request');
    error.name = 'AbortError';
    const fn = vi.fn().mockRejectedValue(error);

    await expect(withRetry(fn, { maxRetries: 3 })).rejects.toThrow('bad request');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('uses custom retryOn predicate', async () => {
    const fn = vi.fn().mockRejectedValueOnce(new Error('retry me')).mockResolvedValueOnce('ok');

    const result = await withRetry(fn, {
      maxRetries: 2,
      baseDelay: 1,
      retryOn: (err) => err instanceof Error && err.message === 'retry me',
    });

    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('applies exponential backoff with increasing delays', async () => {
    const fn = vi.fn().mockRejectedValue(new TypeError('network error'));
    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');

    await expect(withRetry(fn, { maxRetries: 2, baseDelay: 1, maxDelay: 100 })).rejects.toThrow();

    // First call: immediate, then delays at ~1, ~2ms (plus jitter)
    const delays = setTimeoutSpy.mock.calls.map((call) => call[1] as number);
    expect(delays.length).toBeGreaterThanOrEqual(2);
    expect(delays[0]).toBeGreaterThanOrEqual(1);
    expect(delays[1]).toBeGreaterThanOrEqual(2);

    setTimeoutSpy.mockRestore();
  });
});

describe('CircuitBreaker', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('starts in closed state and executes functions normally', async () => {
    const breaker = new CircuitBreaker('test', { threshold: 3, cooldown: 1000 });
    expect(breaker.currentState).toBe('closed');

    const result = await breaker.execute(() => Promise.resolve('ok'));
    expect(result).toBe('ok');
    expect(breaker.currentState).toBe('closed');
  });

  it('opens after threshold consecutive failures', async () => {
    const breaker = new CircuitBreaker('test', { threshold: 3, cooldown: 1000 });
    const failingFn = () => Promise.reject(new Error('fail'));

    await expect(breaker.execute(failingFn)).rejects.toThrow('fail');
    await expect(breaker.execute(failingFn)).rejects.toThrow('fail');
    await expect(breaker.execute(failingFn)).rejects.toThrow('fail');

    expect(breaker.currentState).toBe('open');
  });

  it('throws CircuitOpenError when circuit is open', async () => {
    const breaker = new CircuitBreaker('test', { threshold: 1, cooldown: 5000 });
    await expect(breaker.execute(() => Promise.reject(new Error('fail')))).rejects.toThrow('fail');

    expect(breaker.currentState).toBe('open');
    await expect(breaker.execute(() => Promise.resolve('ok'))).rejects.toThrow(CircuitOpenError);
  });

  it('transitions to half-open after cooldown period', async () => {
    const breaker = new CircuitBreaker('test', { threshold: 1, cooldown: 1000 });
    await expect(breaker.execute(() => Promise.reject(new Error('fail')))).rejects.toThrow('fail');
    expect(breaker.currentState).toBe('open');

    // Advance past cooldown
    await vi.advanceTimersByTimeAsync(1001);

    // Next call should be allowed (half-open)
    const result = await breaker.execute(() => Promise.resolve('recovered'));
    expect(result).toBe('recovered');
    expect(breaker.currentState).toBe('closed');
  });

  it('re-opens if the half-open trial fails', async () => {
    const breaker = new CircuitBreaker('test', { threshold: 1, cooldown: 1000 });
    await expect(breaker.execute(() => Promise.reject(new Error('fail')))).rejects.toThrow('fail');

    await vi.advanceTimersByTimeAsync(1001);
    expect(breaker.execute(() => Promise.resolve('ok'))).toBeInstanceOf(Promise);

    // Force another failure to re-open
    await expect(breaker.execute(() => Promise.reject(new Error('still failing')))).rejects.toThrow();

    // After the half-open failure, the circuit should be open again
    // (failureCount = 2 >= threshold = 1)
    expect(breaker.currentState).toBe('open');
  });

  it('resets failure count on success', async () => {
    const breaker = new CircuitBreaker('test', { threshold: 3, cooldown: 1000 });

    await expect(breaker.execute(() => Promise.reject(new Error('fail')))).rejects.toThrow();
    await expect(breaker.execute(() => Promise.reject(new Error('fail')))).rejects.toThrow();

    // A success should reset the failure count
    await breaker.execute(() => Promise.resolve('ok'));
    expect(breaker.currentState).toBe('closed');

    // Now we need 3 more failures to open again
    await expect(breaker.execute(() => Promise.reject(new Error('fail')))).rejects.toThrow();
    expect(breaker.currentState).toBe('closed');
  });

  it('reset() forces the circuit back to closed', async () => {
    const breaker = new CircuitBreaker('test', { threshold: 1, cooldown: 10_000 });
    await expect(breaker.execute(() => Promise.reject(new Error('fail')))).rejects.toThrow();
    expect(breaker.currentState).toBe('open');

    breaker.reset();
    expect(breaker.currentState).toBe('closed');

    const result = await breaker.execute(() => Promise.resolve('ok'));
    expect(result).toBe('ok');
  });

  it('CircuitOpenError contains circuit name and remaining cooldown', () => {
    const error = new CircuitOpenError('my-service', 5000);
    expect(error.circuitName).toBe('my-service');
    expect(error.remainingCooldown).toBe(5000);
    expect(error.name).toBe('CircuitOpenError');
    expect(error.message).toContain('my-service');
    expect(error.message).toContain('5s');
  });
});
