import { buildAskAltiSystemPrompt } from "../prompts.mjs";

const INPUT_SCHEMA = {
  type: "object",
  properties: {
    question: {
      type: "string",
      minLength: 3,
      maxLength: 1000,
      description:
        "A question for Alti about Christian Perez, his work at Altivum, The Vector Podcast, " +
        "his book Beyond the Assessment, or his military / AI / cloud engineering background.",
    },
  },
  required: ["question"],
  additionalProperties: false,
};

const MAX_OUTPUT_TOKENS = 400;
const TEMPERATURE = 0.5;
const BEDROCK_TIMEOUT_MS = 12000;
const KB_RETRIEVAL_TIMEOUT_MS = 4000;

function cacheKey(question) {
  // Normalize for cache hits across minor whitespace / case differences.
  return question.trim().toLowerCase().replace(/\s+/g, " ");
}

async function retrieveKbContext({
  agentClient,
  RetrieveCommand,
  kbId,
  question,
  requestId,
  kbCache,
  metrics,
}) {
  if (!agentClient || !RetrieveCommand || !kbId) return null;

  const key = cacheKey(question);
  const cached = kbCache?.get(key);
  if (cached !== undefined && cached !== null) {
    metrics?.record("McpKbCacheHit");
    return cached;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), KB_RETRIEVAL_TIMEOUT_MS);
  const startedAt = Date.now();
  try {
    const cmd = new RetrieveCommand({
      knowledgeBaseId: kbId,
      retrievalQuery: { text: question },
      retrievalConfiguration: {
        vectorSearchConfiguration: { numberOfResults: 5 },
      },
    });
    const resp = await agentClient.send(cmd, { abortSignal: controller.signal });
    const chunks = Array.isArray(resp?.retrievalResults)
      ? resp.retrievalResults
          .map((r) => r?.content?.text)
          .filter((t) => typeof t === "string" && t.length > 0)
      : [];
    const joined = chunks.length > 0 ? chunks.join("\n\n---\n\n") : null;
    const latencyMs = Date.now() - startedAt;
    metrics?.record("McpKbLatency", latencyMs, "Milliseconds");
    metrics?.record("McpKbSuccess");
    kbCache?.set(key, joined);
    return joined;
  } catch (err) {
    if (err?.name === "AbortError") {
      metrics?.record("McpKbTimeout");
    } else {
      metrics?.record("McpKbFailure");
    }
    console.error(JSON.stringify({
      requestId,
      event: "mcp_kb_error",
      error: err?.name,
      message: err?.message,
    }));
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function invokeBedrock({
  bedrockClient,
  InvokeModelCommand,
  modelId,
  guardrailId,
  guardrailVersion,
  systemPrompt,
  question,
  requestId,
  metrics,
}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), BEDROCK_TIMEOUT_MS);
  const startedAt = Date.now();
  try {
    const payload = {
      anthropic_version: "bedrock-2023-05-31",
      max_tokens: MAX_OUTPUT_TOKENS,
      temperature: TEMPERATURE,
      system: systemPrompt,
      messages: [{ role: "user", content: question }],
    };
    const cmd = new InvokeModelCommand({
      modelId,
      contentType: "application/json",
      accept: "application/json",
      body: JSON.stringify(payload),
      ...(guardrailId && guardrailVersion
        ? { guardrailIdentifier: guardrailId, guardrailVersion }
        : {}),
    });
    const resp = await bedrockClient.send(cmd, { abortSignal: controller.signal });
    const bodyText = new TextDecoder().decode(resp.body);
    const parsed = JSON.parse(bodyText);
    const text = Array.isArray(parsed?.content)
      ? parsed.content.filter((c) => c?.type === "text").map((c) => c.text).join("")
      : "";

    const latencyMs = Date.now() - startedAt;
    metrics?.record("McpBedrockLatency", latencyMs, "Milliseconds");

    if (parsed?.stop_reason === "guardrail_intervened") {
      metrics?.record("McpGuardrailIntervention");
      return {
        blocked: true,
        text: "I can't answer that question. Ask me something about Christian's work, the podcast, or his writing.",
      };
    }

    metrics?.record("McpBedrockSuccess");
    return { text: text.trim() };
  } catch (err) {
    if (err?.name === "AbortError") {
      metrics?.record("McpBedrockTimeout");
      return {
        error: "That question took longer than expected. Try a simpler phrasing.",
      };
    }
    metrics?.record("McpBedrockFailure");
    console.error(JSON.stringify({
      requestId,
      event: "mcp_bedrock_error",
      error: err?.name,
      message: err?.message,
    }));
    return { error: "Alti is unavailable right now. Try again shortly." };
  } finally {
    clearTimeout(timeoutId);
  }
}

export function buildAskAltiMcpTool({
  bedrockClient,
  InvokeModelCommand,
  agentClient,
  RetrieveCommand,
  kbId,
  modelId,
  guardrailId,
  guardrailVersion,
  kbCache,
  metrics,
  requestId,
}) {
  return {
    name: "ask_alti",
    description:
      "Ask Alti, Christian Perez's AI agent, a single question about Christian — his work at Altivum, " +
      "The Vector Podcast, his book 'Beyond the Assessment', his military service as a Green Beret, " +
      "or his AWS / Applied AI engineering practice. Returns a concise 2-4 sentence reply grounded in " +
      "Christian's published writing and autobiography. Does NOT answer general knowledge questions.",
    inputSchema: INPUT_SCHEMA,
    handler: async ({ arguments: args }) => {
      const question = typeof args?.question === "string" ? args.question.trim() : "";
      if (question.length < 3 || question.length > 1000) {
        return {
          isError: true,
          content: [{ type: "text", text: "Question must be 3-1000 characters." }],
        };
      }
      if (!bedrockClient || !InvokeModelCommand || !modelId) {
        return {
          isError: true,
          content: [{ type: "text", text: "Alti is not configured on this endpoint." }],
        };
      }

      const retrievedContext = await retrieveKbContext({
        agentClient,
        RetrieveCommand,
        kbId,
        question,
        requestId,
        kbCache,
        metrics,
      });
      const systemPrompt = buildAskAltiSystemPrompt(retrievedContext);

      const outcome = await invokeBedrock({
        bedrockClient,
        InvokeModelCommand,
        modelId,
        guardrailId,
        guardrailVersion,
        systemPrompt,
        question,
        requestId,
        metrics,
      });

      if (outcome.error) {
        return {
          isError: true,
          content: [{ type: "text", text: outcome.error }],
        };
      }
      return {
        content: [{ type: "text", text: outcome.text || "I don't have anything useful to add on that." }],
      };
    },
  };
}
