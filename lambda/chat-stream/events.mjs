export const EVENT_DELIM = "\x00EVT\x00";

export const EVENT_KINDS = Object.freeze({
  TOOL_INVOCATION: "tool_invocation",
  TOOL_RESULT: "tool_result",
  DRAFT_ACTION: "draft_action",
  UI_BLOCK: "ui_block",
  MEMORY_UPDATE: "memory_update",
  GUARDRAIL: "guardrail",
});

export function emitEvent(responseStream, event) {
  if (!responseStream || typeof responseStream.write !== "function") {
    throw new Error("emitEvent: responseStream.write is required");
  }
  if (!event || typeof event.kind !== "string") {
    throw new Error("emitEvent: event.kind is required");
  }
  const payload = JSON.stringify(event);
  responseStream.write(EVENT_DELIM + payload + EVENT_DELIM);
}
