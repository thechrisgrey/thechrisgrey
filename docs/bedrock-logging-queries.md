# Bedrock Model Invocation Logging Queries

CloudWatch Logs Insights queries for analyzing `/chat` usage via the `/aws/bedrock/modelinvocations` log group.

## Log Group Details

- **Log Group:** `tcg-AI-chat`
- **Region:** us-east-1
- **IAM Role:** `thechrisgrey-bedrock-logging-role`

## Common Queries

### Recent User Questions

View the most recent questions asked to the chat.

```sql
fields @timestamp, input.inputBodyJson.messages.0.content.0.text as question
| filter ispresent(question)
| sort @timestamp desc
| limit 50
```

### Question and Response Pairs

Review full conversations for quality assessment.

```sql
fields @timestamp,
  input.inputBodyJson.messages.0.content.0.text as question,
  output.outputBodyJson.output.message.content.0.text as response
| filter ispresent(question)
| sort @timestamp desc
| limit 20
```

### Most Common Questions (FAQ Candidates)

Identify frequently asked questions to improve the Knowledge Base or add to FAQ.

```sql
fields input.inputBodyJson.messages.0.content.0.text as question
| filter ispresent(question)
| stats count(*) as frequency by question
| sort frequency desc
| limit 25
```

### Token Usage by Conversation

Analyze token consumption for cost optimization.

```sql
fields @timestamp,
  input.inputBodyJson.messages.0.content.0.text as question,
  output.outputBodyJson.usage.inputTokens as input_tokens,
  output.outputBodyJson.usage.outputTokens as output_tokens,
  (output.outputBodyJson.usage.inputTokens + output.outputBodyJson.usage.outputTokens) as total_tokens
| filter ispresent(question)
| sort @timestamp desc
| limit 50
```

### Daily Token Usage Summary

Track daily usage patterns.

```sql
fields @timestamp,
  output.outputBodyJson.usage.inputTokens as input_tokens,
  output.outputBodyJson.usage.outputTokens as output_tokens
| filter ispresent(input_tokens)
| stats sum(input_tokens) as total_input, sum(output_tokens) as total_output, count(*) as requests by bin(1d)
| sort @timestamp desc
```

### Hourly Request Volume

Identify peak usage times.

```sql
fields @timestamp
| filter @message like /ConverseStream/
| stats count(*) as requests by bin(1h)
| sort @timestamp desc
| limit 168
```

### Cost Estimation Query

Estimate costs based on token usage. Claude Haiku 4.5 pricing (as of Jan 2025):

- Input: $0.80 per 1M tokens
- Output: $4.00 per 1M tokens

```sql
fields @timestamp,
  output.outputBodyJson.usage.inputTokens as input_tokens,
  output.outputBodyJson.usage.outputTokens as output_tokens
| filter ispresent(input_tokens)
| stats sum(input_tokens) as total_input, sum(output_tokens) as total_output by bin(1d)
| display @timestamp,
  total_input,
  total_output,
  (total_input * 0.0000008) as input_cost_usd,
  (total_output * 0.000004) as output_cost_usd,
  ((total_input * 0.0000008) + (total_output * 0.000004)) as daily_cost_usd
```

### Long Response Detection

Find conversations that consumed many tokens (potential optimization targets).

```sql
fields @timestamp,
  input.inputBodyJson.messages.0.content.0.text as question,
  output.outputBodyJson.usage.outputTokens as output_tokens
| filter output_tokens > 300
| sort output_tokens desc
| limit 20
```

### Guardrail Interventions

Check if guardrails blocked any requests.

```sql
fields @timestamp,
  input.inputBodyJson.messages.0.content.0.text as question,
  output.outputBodyJson.stopReason as stop_reason
| filter stop_reason like /guardrail/
| sort @timestamp desc
| limit 50
```

### Questions by Day of Week

Understand usage patterns by day.

```sql
fields @timestamp,
  input.inputBodyJson.messages.0.content.0.text as question
| filter ispresent(question)
| stats count(*) as questions by datefloor(@timestamp, 1d)
| sort @timestamp desc
```

## How to Run Queries

1. Open CloudWatch Console: https://console.aws.amazon.com/cloudwatch/
2. Navigate to Logs > Logs Insights
3. Select log group: `tcg-AI-chat`
4. Set time range (default: last 1 hour)
5. Paste query and click "Run query"

## Notes

- Logs appear within 2-3 minutes of chat usage
- Text data logging must be enabled in Bedrock settings
- Token counts may vary slightly from actual billing due to system prompts
