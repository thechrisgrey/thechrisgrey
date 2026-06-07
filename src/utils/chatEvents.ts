export const SYS_DELIM = '\x00SYS\x00';
export const EVT_DELIM = '\x00EVT\x00';

export type DraftActionNavigate = {
  kind: 'draft_action';
  action: 'navigate';
  path: string;
  reason: string;
};

export type DraftActionContact = {
  kind: 'draft_action';
  action: 'contact';
  subject: string;
  body: string;
  intent: 'speaking' | 'podcast' | 'consulting' | 'collaboration' | 'media' | 'general';
};

export type DraftActionNewsletter = {
  kind: 'draft_action';
  action: 'newsletter';
  pitch: string;
};

export type DraftActionCitation = {
  kind: 'draft_action';
  action: 'citation';
  slug: string;
  title: string;
  excerpt: string;
  url: string;
};

export type BlogSearchResult = {
  slug: string;
  title: string;
  excerpt: string;
  url: string;
};

export type DraftActionBlogSearchResults = {
  kind: 'draft_action';
  action: 'blog_search_results';
  query: string;
  results: BlogSearchResult[];
};

export type DraftActionPodcastCitation = {
  kind: 'draft_action';
  action: 'podcast_citation';
  videoId: string;
  startSeconds: number;
  episodeTitle: string;
  quote: string;
  timestampLabel: string;
  url: string;
};

export type ToolInvocationEvent = {
  kind: 'tool_invocation';
  tool: string;
  toolUseId?: string;
};

export type ToolResultEvent = {
  kind: 'tool_result';
  tool: string;
  toolUseId?: string;
  status: string;
};

export type MemoryUpdateEvent = {
  kind: 'memory_update';
  action: 'remembered' | 'forgotten';
  content?: string;
  factId?: string;
};

export type GuardrailEvent = {
  kind: 'guardrail';
  reason?: string;
  stopReason?: string;
};

export type DraftAction =
  | DraftActionNavigate
  | DraftActionContact
  | DraftActionNewsletter
  | DraftActionCitation
  | DraftActionBlogSearchResults
  | DraftActionPodcastCitation;

export type ChatEvent =
  | DraftAction
  | ToolInvocationEvent
  | ToolResultEvent
  | MemoryUpdateEvent
  | GuardrailEvent;

export type ParsedChunk =
  | { kind: 'text'; text: string }
  | { kind: 'system'; text: string }
  | { kind: 'event'; event: ChatEvent };

type ParseState = {
  buffer: string;
};

export function createChatStreamParser(): {
  push: (chunk: string) => ParsedChunk[];
  flush: () => ParsedChunk[];
} {
  const state: ParseState = { buffer: '' };

  const drainEvents = (raw: string): { remainder: string; emitted: ParsedChunk[] } => {
    const emitted: ParsedChunk[] = [];
    let working = raw;

    for (;;) {
      const start = working.indexOf(EVT_DELIM);
      if (start === -1) break;
      if (start > 0) {
        emitted.push(...splitTextAndSystem(working.slice(0, start)));
      }
      const afterStart = start + EVT_DELIM.length;
      const end = working.indexOf(EVT_DELIM, afterStart);
      if (end === -1) {
        working = working.slice(start);
        return { remainder: working, emitted };
      }
      const payload = working.slice(afterStart, end);
      try {
        const parsed = JSON.parse(payload) as ChatEvent;
        emitted.push({ kind: 'event', event: parsed });
      } catch {
        emitted.push({ kind: 'text', text: payload });
      }
      working = working.slice(end + EVT_DELIM.length);
    }

    return { remainder: working, emitted };
  };

  return {
    push(chunk: string): ParsedChunk[] {
      state.buffer += chunk;
      const { remainder, emitted } = drainEvents(state.buffer);
      state.buffer = remainder;

      const systemIdx = state.buffer.indexOf(SYS_DELIM);
      if (systemIdx !== -1) {
        if (systemIdx > 0) emitted.push({ kind: 'text', text: state.buffer.slice(0, systemIdx) });
        emitted.push({ kind: 'system', text: state.buffer.slice(systemIdx + SYS_DELIM.length) });
        state.buffer = '';
        return emitted;
      }

      if (!state.buffer.includes(EVT_DELIM[0]) && !state.buffer.includes(SYS_DELIM[0])) {
        if (state.buffer) emitted.push({ kind: 'text', text: state.buffer });
        state.buffer = '';
      }

      return emitted;
    },
    flush(): ParsedChunk[] {
      if (!state.buffer) return [];
      const systemIdx = state.buffer.indexOf(SYS_DELIM);
      let out: ParsedChunk[];
      if (systemIdx !== -1) {
        out = [];
        if (systemIdx > 0) out.push({ kind: 'text', text: state.buffer.slice(0, systemIdx) });
        out.push({ kind: 'system', text: state.buffer.slice(systemIdx + SYS_DELIM.length) });
      } else {
        out = [{ kind: 'text', text: state.buffer }];
      }
      state.buffer = '';
      return out;
    },
  };
}

function splitTextAndSystem(raw: string): ParsedChunk[] {
  const idx = raw.indexOf(SYS_DELIM);
  if (idx === -1) return raw ? [{ kind: 'text', text: raw }] : [];
  const before = raw.slice(0, idx);
  const after = raw.slice(idx + SYS_DELIM.length);
  const out: ParsedChunk[] = [];
  if (before) out.push({ kind: 'text', text: before });
  out.push({ kind: 'system', text: after });
  return out;
}
