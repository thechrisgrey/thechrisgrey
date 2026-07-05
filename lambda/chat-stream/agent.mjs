import { Agent, BedrockModel, SlidingWindowConversationManager, BeforeModelCallEvent } from "@strands-agents/sdk";
import { emitEvent, EVENT_KINDS } from "./events.mjs";

export const DEFAULT_REGION = "us-east-1";
export const DEFAULT_MAX_TOKENS = 500;
export const DEFAULT_TEMPERATURE = 0.6;
export const DEFAULT_WINDOW_SIZE = 40;

// Strands SDK v1.0.0-rc.4 exposes NO declarative maxIterations/recursion config.
// We bound the agent loop programmatically: BeforeModelCallEvent fires once per
// loop cycle, so we count cycles and call agent.cancel() past the cap. 3 == the
// initial model call + up to 2 tool-driven follow-ups (matches the "at most
// twice" prompt rule in prompts.mjs). This is a hard ceiling on top of the 25s
// cancelSignal timeout wired in index.mjs.
export const DEFAULT_MAX_MODEL_CALLS = 3;

/**
 * @param {object} [opts]
 * @param {string} [opts.modelId]
 * @param {string} [opts.region]
 * @param {string} [opts.guardrailId]
 * @param {string} [opts.guardrailVersion]
 * @param {number} [opts.maxTokens]
 * @param {number} [opts.temperature]
 * @returns {import("@strands-agents/sdk").BedrockModel}
 */
export function buildBedrockModel({
  modelId,
  region = DEFAULT_REGION,
  guardrailId,
  guardrailVersion,
  maxTokens = DEFAULT_MAX_TOKENS,
  temperature = DEFAULT_TEMPERATURE,
} = {}) {
  if (!modelId) throw new Error("buildBedrockModel: modelId is required");

  const config = {
    modelId,
    region,
    stream: true,
    maxTokens,
    temperature,
  };

  if (guardrailId && guardrailVersion) {
    config.guardrailConfig = {
      guardrailIdentifier: guardrailId,
      guardrailVersion,
      streamProcessingMode: "async",
      trace: "enabled",
    };
  }

  return new BedrockModel(config);
}

/**
 * @param {object} [opts]
 * @param {any} [opts.model]
 * @param {any[]} [opts.tools]
 * @param {string} [opts.systemPrompt]
 * @param {any[]} [opts.messages]
 * @param {number} [opts.windowSize]
 * @param {string} [opts.name]
 * @param {number} [opts.maxModelCalls]
 * @param {any} [opts.AgentClass]
 * @returns {import("@strands-agents/sdk").Agent}
 */
export function buildAgent({
  model,
  tools = [],
  systemPrompt,
  messages = [],
  windowSize = DEFAULT_WINDOW_SIZE,
  name = "Alti",
  maxModelCalls = DEFAULT_MAX_MODEL_CALLS,
  AgentClass = Agent,
} = {}) {
  if (!model) throw new Error("buildAgent: model is required");
  const agent = new AgentClass({
    model,
    tools,
    systemPrompt,
    messages,
    conversationManager: new SlidingWindowConversationManager({ windowSize }),
    printer: false,
    name,
  });

  // Programmatic loop cap. BeforeModelCallEvent fires once per loop cycle; once
  // the count exceeds maxModelCalls we cancel the agent (idempotent — the SDK
  // returns stopReason 'cancelled' and any text already streamed is kept).
  let modelCalls = 0;
  agent.addHook(BeforeModelCallEvent, () => {
    modelCalls += 1;
    if (modelCalls > maxModelCalls) {
      agent.cancel();
    }
  });

  return agent;
}

function extractText(streamEvent) {
  const inner = streamEvent?.event;
  if (inner?.type !== "modelContentBlockDeltaEvent") return null;
  if (inner.delta?.type !== "textDelta") return null;
  return inner.delta.text || null;
}

function extractUsage(streamEvent) {
  const inner = streamEvent?.event;
  if (inner?.type === "modelMetadataEvent" && inner.usage) return inner.usage;
  return null;
}

function toolResultStatus(result) {
  if (!result) return "unknown";
  if (typeof result.status === "string") return result.status;
  return "success";
}

/**
 * @param {object} [opts]
 * @param {any} [opts.agent]
 * @param {string} [opts.userMessage]
 * @param {any} [opts.responseStream]
 * @param {AbortSignal} [opts.cancelSignal]
 * @param {any} [opts.metrics]
 * @param {(text: string) => void} [opts.onText]
 * @returns {Promise<{ hadText: boolean, usage: any, guardrailIntervened: boolean, stopReason: string|null }>}
 */
export async function streamAgentResponse({ agent, userMessage, responseStream, cancelSignal, metrics, onText } = {}) {
  if (!agent) throw new Error("streamAgentResponse: agent is required");
  if (!userMessage) throw new Error("streamAgentResponse: userMessage is required");
  if (!responseStream) throw new Error("streamAgentResponse: responseStream is required");

  let hadText = false;
  let usage = null;
  let guardrailIntervened = false;
  let stopReason = null;

  const options = cancelSignal ? { cancelSignal } : undefined;
  const generator = agent.stream(userMessage, options);

  let next = await generator.next();
  while (!next.done) {
    const event = next.value;

    switch (event?.type) {
      case "modelStreamUpdateEvent": {
        const text = extractText(event);
        if (text) {
          // Defense-in-depth: the wire protocol is NUL-framed (events.mjs \x00EVT\x00,
          // index.mjs \x00SYS\x00). A literal U+0000 in MODEL output could forge a frame,
          // so strip NUL from this model-text path only. Never strip the intentional
          // delimiter writes in events.mjs / index.mjs.
          // eslint-disable-next-line no-control-regex -- intentionally matching U+0000 to strip forged frame delimiters
          responseStream.write(text.replace(/\x00/g, ""));
          hadText = true;
          onText?.(text);
          break;
        }
        const maybeUsage = extractUsage(event);
        if (maybeUsage) usage = maybeUsage;
        if (event.event?.type === "modelRedactionEvent") {
          guardrailIntervened = true;
        }
        break;
      }
      case "beforeToolCallEvent": {
        const toolName = event.toolUse?.name ?? "unknown";
        metrics?.record(`AgentToolInvoked_${toolName}`);
        emitEvent(responseStream, {
          kind: EVENT_KINDS.TOOL_INVOCATION,
          tool: toolName,
          toolUseId: event.toolUse?.toolUseId,
        });
        break;
      }
      case "afterToolCallEvent": {
        emitEvent(responseStream, {
          kind: EVENT_KINDS.TOOL_RESULT,
          tool: event.toolUse?.name ?? "unknown",
          toolUseId: event.toolUse?.toolUseId,
          status: toolResultStatus(event.result),
        });
        break;
      }
      case "afterModelCallEvent": {
        if (event.stopData?.redaction) guardrailIntervened = true;
        break;
      }
      default:
        break;
    }

    next = await generator.next();
  }

  if (next.value) {
    stopReason = next.value.stopReason;
    const accumulated = next.value.metrics?.accumulatedUsage;
    if (accumulated) usage = accumulated;
  }

  return { hadText, usage, guardrailIntervened, stopReason };
}
