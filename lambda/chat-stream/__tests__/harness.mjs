import { createHmac } from "crypto";

export function makeEvent({ body = "", headers = {}, method = "POST", ip = "1.2.3.4" } = {}) {
  return {
    body,
    headers,
    requestContext: { http: { method, sourceIp: ip } },
  };
}

export function signEvent(body, key, { offsetSeconds = 0 } = {}) {
  const ts = String(Math.floor(Date.now() / 1000) + offsetSeconds);
  const sig = createHmac("sha256", key).update(`${ts}.${body}`).digest("hex");
  return {
    "x-chat-timestamp": ts,
    "x-chat-signature": sig,
  };
}

export function recordingMetrics() {
  const records = [];
  return {
    records,
    record(name, value = 1, unit = "Count") {
      records.push({ name, value, unit });
    },
    async flush() {},
  };
}

export function fakeSendResolver(value) {
  return {
    send: async () => value,
  };
}

export function fakeSendRejector(error) {
  return {
    send: async () => {
      throw error;
    },
  };
}
