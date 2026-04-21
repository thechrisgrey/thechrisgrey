import { describe, it, expect } from 'vitest';
import { createChatStreamParser, EVT_DELIM, SYS_DELIM } from './chatEvents';

function wrapEvent(obj: unknown): string {
  return `${EVT_DELIM}${JSON.stringify(obj)}${EVT_DELIM}`;
}

describe('createChatStreamParser', () => {
  it('emits plain text chunks as text', () => {
    const p = createChatStreamParser();
    const out = p.push('Hello ');
    expect(out).toEqual([{ kind: 'text', text: 'Hello ' }]);
  });

  it('buffers and emits a complete event', () => {
    const p = createChatStreamParser();
    const payload = { kind: 'tool_invocation', tool: 'navigate_to' };
    const out = p.push(`before ${wrapEvent(payload)}after`);
    expect(out).toContainEqual({ kind: 'text', text: 'before ' });
    expect(out).toContainEqual({ kind: 'event', event: payload });
    expect(out).toContainEqual({ kind: 'text', text: 'after' });
  });

  it('holds an incomplete event across pushes', () => {
    const p = createChatStreamParser();
    const payload = { kind: 'tool_result', tool: 'navigate_to', status: 'success' };
    const encoded = wrapEvent(payload);
    const mid = Math.floor(encoded.length / 2);
    const first = p.push(`hello ${encoded.slice(0, mid)}`);
    expect(first).toEqual([{ kind: 'text', text: 'hello ' }]);
    const second = p.push(encoded.slice(mid));
    expect(second).toContainEqual({ kind: 'event', event: payload });
  });

  it('handles multiple events in one chunk', () => {
    const p = createChatStreamParser();
    const a = { kind: 'tool_invocation', tool: 'navigate_to' };
    const b = { kind: 'tool_result', tool: 'navigate_to', status: 'success' };
    const out = p.push(`${wrapEvent(a)}${wrapEvent(b)}done`);
    expect(out).toContainEqual({ kind: 'event', event: a });
    expect(out).toContainEqual({ kind: 'event', event: b });
    expect(out).toContainEqual({ kind: 'text', text: 'done' });
  });

  it('emits system message and stops text flow after SYS delim', () => {
    const p = createChatStreamParser();
    const out = p.push(`partial text ${SYS_DELIM}Rate limited.`);
    expect(out).toContainEqual({ kind: 'text', text: 'partial text ' });
    expect(out).toContainEqual({ kind: 'system', text: 'Rate limited.' });
  });

  it('handles draft_action contact event', () => {
    const p = createChatStreamParser();
    const payload = {
      kind: 'draft_action',
      action: 'contact',
      subject: 'Podcast invite',
      body: 'Long body',
      intent: 'podcast',
    };
    const out = p.push(wrapEvent(payload));
    expect(out).toContainEqual({ kind: 'event', event: payload });
  });

  it('falls back to text when event JSON is invalid', () => {
    const p = createChatStreamParser();
    const out = p.push(`${EVT_DELIM}not json${EVT_DELIM}`);
    expect(out).toContainEqual({ kind: 'text', text: 'not json' });
  });

  it('flush emits buffered tail text', () => {
    const p = createChatStreamParser();
    p.push(`leading ${EVT_DELIM}{"kind":"tool_invocation","tool":"x"}${EVT_DELIM}tail`);
    const tail = p.flush();
    expect(tail).toEqual([]);
  });

  it('flush emits system message from buffered partial', () => {
    const p = createChatStreamParser();
    p.push(`visible text`);
    p.push(`${SYS_DELIM}Error occurred`);
    const tail = p.flush();
    expect(tail).toEqual([]);
  });

  it('buffers a bare EVT start byte across pushes', () => {
    const p = createChatStreamParser();
    const first = p.push('visible');
    expect(first).toEqual([{ kind: 'text', text: 'visible' }]);
    const second = p.push(`\x00EV`);
    expect(second).toEqual([]);
    const third = p.push(`T\x00{"kind":"guardrail"}${EVT_DELIM}`);
    expect(third).toContainEqual({ kind: 'event', event: { kind: 'guardrail' } });
  });
});
