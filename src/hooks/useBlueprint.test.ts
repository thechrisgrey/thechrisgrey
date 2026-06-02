import { describe, it, expect, vi, afterEach } from 'vitest';
import type { BlueprintInput, BlueprintOutput } from '../types/blueprint';

const ENDPOINT = 'https://blueprint.example.com';

const INPUT: BlueprintInput = { goal: 'Build a RAG system', category: 'rag' };

const OUTPUT: BlueprintOutput = {
  architecture_summary: 'A serverless RAG stack.',
  services: [{ service: 'Bedrock', purpose: 'LLM', rationale: 'managed', cost_signal: 'medium' }],
  diagram_mermaid: 'graph TD; A-->B',
  iac_scaffold: { tool: 'cdk', rationale: 'typed', snippet: 'new Stack()' },
  iam_highlights: ['least privilege'],
  cost_estimate: { monthly_low_usd: 10, monthly_high_usd: 50, assumptions: ['low traffic'] },
  claude_artifacts: [],
  next_steps: ['deploy'],
  caveats: ['estimate only'],
};

function fakeResponse(status: number, body: unknown, { jsonThrows = false } = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => {
      if (jsonThrows) throw new Error('not json');
      return body;
    },
  } as unknown as Response;
}

// Load the hook AND renderHook together after stubbing env + resetting modules, so
// both resolve the same (freshly-loaded) React instance — avoids "Invalid hook call".
async function setup(endpoint: string = ENDPOINT) {
  vi.resetModules();
  vi.stubEnv('VITE_BLUEPRINT_ENDPOINT', endpoint);
  vi.stubEnv('VITE_BLUEPRINT_SIGNING_KEY', ''); // signing disabled -> no headers
  const { renderHook, act } = await import('@testing-library/react');
  const { useBlueprint } = await import('./useBlueprint');
  const view = renderHook(() => useBlueprint());
  return { ...view, act };
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('useBlueprint', () => {
  it('errors with not_configured when the endpoint is missing (no fetch)', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const { result, act } = await setup('');
    await act(async () => {
      await result.current.generate(INPUT);
    });
    expect(result.current.error?.kind).toBe('not_configured');
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result.current.isGenerating).toBe(false);
  });

  it('stores output + meta on a successful response', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => fakeResponse(200, { ok: true, output: OUTPUT, meta: { tier: 'free', latency_ms: 1200 } })));
    const { result, act } = await setup();
    await act(async () => {
      await result.current.generate(INPUT);
    });
    expect(result.current.output).toEqual(OUTPUT);
    expect(result.current.meta).toEqual({ tier: 'free', latency_ms: 1200 });
    expect(result.current.error).toBeNull();
    expect(result.current.isGenerating).toBe(false);
  });

  it('sends a signed-by-default POST with spec + deviceId in the body', async () => {
    const fetchSpy = vi.fn(async () =>
      fakeResponse(200, { ok: true, output: OUTPUT, meta: {} })
    );
    vi.stubGlobal('fetch', fetchSpy);
    const { result, act } = await setup();
    await act(async () => {
      await result.current.generate(INPUT);
    });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(ENDPOINT);
    expect(init.method).toBe('POST');
    const parsedBody = JSON.parse(init.body as string);
    expect(parsedBody.spec).toEqual(INPUT);
    // deviceId is sourced from localStorage (null when storage is unavailable, as in jsdom);
    // the contract is that the key is always present in the request body.
    expect('deviceId' in parsedBody).toBe(true);
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/json');
  });

  const errorCases: Array<[number, unknown, string]> = [
    [429, { ok: false, error: 'rate_limited' }, 'rate_limited'],
    [401, { ok: false, error: 'unauthorized' }, 'unauthorized'],
    [400, { ok: false, error: 'invalid_device_id' }, 'invalid_device_id'],
    [400, { ok: false, error: 'validation', message: 'bad goal', details: { field: 'goal' } }, 'invalid_input'],
    [502, { ok: false, error: 'validation_failed' }, 'validation_failed'],
    [504, { ok: false, error: 'timeout' }, 'timeout'],
    [500, { ok: false, error: 'boom' }, 'generation_failed'],
  ];

  for (const [status, body, kind] of errorCases) {
    it(`classifies HTTP ${status} as ${kind}`, async () => {
      vi.stubGlobal('fetch', vi.fn(async () => fakeResponse(status, body)));
      const { result, act } = await setup();
      await act(async () => {
        await result.current.generate(INPUT);
      });
      expect(result.current.error?.kind).toBe(kind);
      expect(result.current.output).toBeNull();
    });
  }

  it('preserves validation details on a 400 invalid_input', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => fakeResponse(400, { ok: false, error: 'validation', message: 'bad', details: { field: 'goal' } })));
    const { result, act } = await setup();
    await act(async () => {
      await result.current.generate(INPUT);
    });
    expect(result.current.error?.details).toEqual({ field: 'goal' });
  });

  it('errors with unknown when an OK response is not ok-shaped', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => fakeResponse(200, { ok: false })));
    const { result, act } = await setup();
    await act(async () => {
      await result.current.generate(INPUT);
    });
    expect(result.current.error?.kind).toBe('unknown');
  });

  it('handles unparseable JSON on an error response without throwing', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => fakeResponse(500, null, { jsonThrows: true })));
    const { result, act } = await setup();
    await act(async () => {
      await result.current.generate(INPUT);
    });
    expect(result.current.error?.kind).toBe('generation_failed');
  });

  it('classifies a thrown network error as network', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('connection refused'); }));
    const { result, act } = await setup();
    await act(async () => {
      await result.current.generate(INPUT);
    });
    expect(result.current.error?.kind).toBe('network');
  });

  it('classifies an AbortError as timeout', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw Object.assign(new Error('aborted'), { name: 'AbortError' }); }));
    const { result, act } = await setup();
    await act(async () => {
      await result.current.generate(INPUT);
    });
    expect(result.current.error?.kind).toBe('timeout');
  });

  it('reset() clears output, meta, error and generating state', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => fakeResponse(200, { ok: true, output: OUTPUT, meta: {} })));
    const { result, act } = await setup();
    await act(async () => {
      await result.current.generate(INPUT);
    });
    expect(result.current.output).not.toBeNull();
    act(() => {
      result.current.reset();
    });
    expect(result.current.output).toBeNull();
    expect(result.current.meta).toBeNull();
    expect(result.current.error).toBeNull();
    expect(result.current.isGenerating).toBe(false);
  });
});
