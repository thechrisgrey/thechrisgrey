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
  constructor(cloudwatchClient, namespace) {
    if (!cloudwatchClient) {
      throw new Error("MetricsCollector requires a cloudwatchClient");
    }
    if (!namespace) {
      throw new Error("MetricsCollector requires a namespace");
    }
    this.client = cloudwatchClient;
    this.namespace = namespace;
    this.buffer = [];
  }

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

    const batches = [];
    for (let i = 0; i < this.buffer.length; i += MAX_METRICS_PER_CALL) {
      batches.push(this.buffer.slice(i, i + MAX_METRICS_PER_CALL));
    }

    await Promise.all(
      batches.map((batch) =>
        this.client.send(new PutMetricDataCommand({ Namespace: this.namespace, MetricData: batch })).catch((err) =>
          createLogger(null, { service: "metrics-collector" }).error("metrics_flush_error", {
            error: err.name,
            message: err.message,
          }),
        ),
      ),
    );
  }
}
