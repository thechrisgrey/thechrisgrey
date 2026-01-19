/**
 * Lambda function triggered by S3 events (PUT/DELETE) on thechrisgrey-kb-source bucket.
 * Automatically syncs the Bedrock Knowledge Base when content changes.
 */

import { BedrockAgentClient, StartIngestionJobCommand } from "@aws-sdk/client-bedrock-agent";

const KNOWLEDGE_BASE_ID = "ARFYABW8HP";
const DATA_SOURCE_ID = "TXQTRAJOSD";

const client = new BedrockAgentClient({ region: "us-east-1" });

export const handler = async (event) => {
  console.log("S3 Event received:", JSON.stringify(event, null, 2));

  // Extract event details for logging
  const records = event.Records || [];
  const eventSummary = records.map(r => ({
    eventName: r.eventName,
    key: r.s3?.object?.key,
    bucket: r.s3?.bucket?.name
  }));

  console.log("Processing changes:", JSON.stringify(eventSummary, null, 2));

  try {
    const command = new StartIngestionJobCommand({
      knowledgeBaseId: KNOWLEDGE_BASE_ID,
      dataSourceId: DATA_SOURCE_ID,
    });

    const response = await client.send(command);

    console.log("Ingestion job started:", JSON.stringify({
      ingestionJobId: response.ingestionJob?.ingestionJobId,
      status: response.ingestionJob?.status,
      startedAt: response.ingestionJob?.startedAt
    }, null, 2));

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "Knowledge Base sync triggered",
        ingestionJobId: response.ingestionJob?.ingestionJobId,
        triggeredBy: eventSummary
      })
    };
  } catch (error) {
    console.error("Error starting ingestion job:", error);

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
