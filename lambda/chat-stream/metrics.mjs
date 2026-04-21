import { PutMetricDataCommand } from "@aws-sdk/client-cloudwatch";

export const NAMESPACE = "TheChrisGrey/SiteMetrics";
export const MAX_METRICS_PER_CALL = 20;

/**
 * Batched metrics collector. Accumulates metrics during a request and flushes
 * them in parallel PutMetricDataCommand calls at the end. The CloudWatch
 * client is injected so tests can stub it.
 */
export class MetricsCollector {
  constructor(cloudwatchClient) {
    if (!cloudwatchClient) {
      throw new Error("MetricsCollector requires a cloudwatchClient");
    }
    this.client = cloudwatchClient;
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
        this.client
          .send(new PutMetricDataCommand({ Namespace: NAMESPACE, MetricData: batch }))
          .catch((err) => console.error(JSON.stringify({
            event: "metrics_flush_error",
            error: err.name,
            message: err.message,
          })))
      )
    );
  }
}
