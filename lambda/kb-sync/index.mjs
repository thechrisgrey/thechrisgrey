/**
 * Lambda function triggered by S3 events (PUT/DELETE) on thechrisgrey-kb-source bucket.
 * Automatically syncs the Bedrock Knowledge Base when content changes.
 * Publishes CloudWatch metrics for observability.
 */

import { BedrockAgentClient, StartIngestionJobCommand } from "@aws-sdk/client-bedrock-agent";
import { CloudWatchClient, PutMetricDataCommand } from "@aws-sdk/client-cloudwatch";

const KNOWLEDGE_BASE_ID = "ARFYABW8HP";
const DATA_SOURCE_ID = "TXQTRAJOSD";
const NAMESPACE = "TheChrisGrey/SiteMetrics";

const client = new BedrockAgentClient({ region: "us-east-1" });
const cloudwatch = new CloudWatchClient({ region: "us-east-1" });

async function publishMetric(metricName, value = 1) {
  await cloudwatch.send(new PutMetricDataCommand({
    Namespace: NAMESPACE,
    MetricData: [{
      MetricName: metricName,
      Value: value,
      Unit: "Count",
      Timestamp: new Date(),
    }],
  })).catch(err => console.error("Metric publish failed:", err.name));
}

export const handler = async (event) => {
  // Extract event details for logging
  const records = event.Records || [];
  const eventSummary = records.map(r => ({
    eventName: r.eventName,
    key: r.s3?.object?.key,
    bucket: r.s3?.bucket?.name
  }));

  console.log(JSON.stringify({ event: "s3_trigger", changes: eventSummary }));

  try {
    const command = new StartIngestionJobCommand({
      knowledgeBaseId: KNOWLEDGE_BASE_ID,
      dataSourceId: DATA_SOURCE_ID,
    });

    const response = await client.send(command);

    console.log(JSON.stringify({
      event: "kb_sync_started",
      ingestionJobId: response.ingestionJob?.ingestionJobId,
      status: response.ingestionJob?.status,
    }));

    await publishMetric("KBSyncTriggered");

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "Knowledge Base sync triggered",
        ingestionJobId: response.ingestionJob?.ingestionJobId,
        triggeredBy: eventSummary
      })
    };
  } catch (error) {
    console.error(JSON.stringify({
      event: "kb_sync_failure",
      error: error.name,
      message: error.message,
    }));

    await publishMetric("KBSyncFailure");

    // Don't throw - we don't want S3 to retry on transient errors
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: "Failed to trigger Knowledge Base sync",
        error: error.message
      })
    };
  }
};
