import {
  Agent,
  BedrockModel,
  SlidingWindowConversationManager,
} from "@strands-agents/sdk";
import { emitEvent, EVENT_KINDS } from "./events.mjs";

export const DEFAULT_REGION = "us-east-1";
export const DEFAULT_MAX_TOKENS = 500;
export const DEFAULT_TEMPERATURE = 0.6;
export const DEFAULT_WINDOW_SIZE = 40;

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

export function buildAgent({
  model,
  tools = [],
  systemPrompt,
  messages = [],
  windowSize = DEFAULT_WINDOW_SIZE,
  name = "Alti",
} = {}) {
  if (!model) throw new Error("buildAgent: model is required");
  return new Agent({
    model,
    tools,
    systemPrompt,
    messages,
    conversationManager: new SlidingWindowConversationManager({ windowSize }),
    printer: false,
    name,
  });
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

export async function streamAgentResponse({
  agent,
  userMessage,
  responseStream,
  cancelSignal,
  metrics,
  onText,
} = {}) {
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
          responseStream.write(text);
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
