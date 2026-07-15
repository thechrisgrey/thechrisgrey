import { PutMetricDataCommand } from "@aws-sdk/client-cloudwatch";
import { createLogger } from "./logger.mjs";

export const MAX_METRICS_PER_CALL = 20;

/**
 * Batched metrics collector shared across the Lambda fleet. Accumulates metrics
 * during a request and flushes them in parallel PutMetricDataCommand calls at the
 * end. The CloudWatch namespace is a constructor arg so each service can alarm on
 * its own metrics in isolation (e.g. "TheChrisGrey/SiteMetrics" vs
 * "TheChrisGrey/Blueprint"). The CloudWatch client is injected so tests can stub it.
 */
export class MetricsCollector {
  /**
   * @param {{ send: any }} cloudwatchClient - Injected CloudWatchClient
   * @param {string} namespace - CloudWatch metric namespace
   */
  constructor(cloudwatchClient, namespace) {
    if (!cloudwatchClient) {
      throw new Error("MetricsCollector requires a cloudwatchClient");
    }
    if (!namespace) {
      throw new Error("MetricsCollector requires a namespace");
    }
    this.client = cloudwatchClient;
    this.namespace = namespace;
    /** @type {{ MetricName: string, Value: number, Unit: string, Timestamp: Date }[]} */
    this.buffer = [];
  }

  /**
   * @param {string} metricName
   * @param {number} [value=1]
   * @param {string} [unit="Count"]
   */
  record(metricName, value = 1, unit = "Count") {
    this.buffer.push({
      MetricName: metricName,
      Value: value,
      Unit: unit,
      Timestamp: new Date(),
    });
  }

  async flush() {
    if (this.buffer.length === 0) return;

    // Snapshot then clear the buffer up front, so a collector that is reused
    // across warm invocations (e.g. a module-scoped singleton like the one in
    // session-token) does not re-emit already-flushed metrics on the next
    // request. A Node Lambda runs one invocation at a time per container, so
    // there is no concurrent flush racing this reassignment.
    const pending = this.buffer;
    this.buffer = [];

    const batches = [];
    for (let i = 0; i < pending.length; i += MAX_METRICS_PER_CALL) {
      batches.push(pending.slice(i, i + MAX_METRICS_PER_CALL));
    }

    await Promise.all(
      batches.map((batch) =>
        this.client
          .send(new PutMetricDataCommand({ Namespace: this.namespace, MetricData: /** @type {any} */ (batch) }))
          .catch((/** @type {unknown} */ err) =>
            createLogger(null, { service: "metrics-collector" }).error("metrics_flush_error", {
              error: err instanceof Error ? err.name : String(err),
              message: err instanceof Error ? err.message : "",
            }),
          ),
      ),
    );
  }
}
