#!/usr/bin/env bash
#
# CloudWatch alarm setup for thechrisgrey Lambda fleet.
#
# Creates metric alarms AND log-based metric filters for ALL services, including
# the three that previously lacked alerting: mcp-server, session-token, kb-builder.
#
# All alarms publish to the existing SNS topic: thechrisgrey-site-alerts.
#
# Usage:
#   ./scripts/setup-alarms.sh                    # create all alarms
#   ./scripts/setup-alarms.sh --dry-run          # print commands without executing
#   ./scripts/setup-alarms.sh --region us-east-1 # override region (default us-east-1)
#
# Prerequisites:
#   - AWS CLI v2 configured with cloudwatch:PutMetricAlarm,
#     logs:PutMetricFilter, logs:DescribeLogGroups permissions
#   - The SNS topic thechrisgrey-site-alerts must exist (created by the
#     infrastructure setup in docs/superpowers/plans/2026-03-23-differentiated-page-experiences.md)

set -euo pipefail

REGION="us-east-1"
DRY_RUN=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run) DRY_RUN=true; shift ;;
    --region) REGION="$2"; shift 2 ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

SNS_TOPIC_ARN="arn:aws:sns:${REGION}:205930636302:thechrisgrey-site-alerts"

# Wrap aws CLI so --dry-run prints instead of executing.
if $DRY_RUN; then
  aws() { echo "  aws $*"; }
fi

echo "=== Setting up CloudWatch alarms (region: ${REGION}) ==="
echo "    SNS topic: ${SNS_TOPIC_ARN}"
echo ""

# ─── Existing alarms (re-created to ensure consistency) ──────────────────────

echo "--- Frontend / Site Metrics ---"

aws cloudwatch put-metric-alarm \
  --region "$REGION" \
  --alarm-name "thechrisgrey-high-cls" \
  --alarm-description "CLS exceeds 0.25 in a 1-hour window" \
  --alarm-actions "$SNS_TOPIC_ARN" \
  --namespace "TheChrisGrey/SiteMetrics" \
  --metric-name "CLS" \
  --statistic "Average" \
  --period 3600 \
  --evaluation-periods 1 \
  --threshold 0.25 \
  --comparison-operator "GreaterThanThreshold" \
  --treat-missing-data "notBreaching"

aws cloudwatch put-metric-alarm \
  --region "$REGION" \
  --alarm-name "thechrisgrey-csp-violations" \
  --alarm-description "CSP violations exceed 20 in a 1-hour window" \
  --alarm-actions "$SNS_TOPIC_ARN" \
  --namespace "TheChrisGrey/SiteMetrics" \
  --metric-name "CSPViolation" \
  --statistic "Sum" \
  --period 3600 \
  --evaluation-periods 1 \
  --threshold 20 \
  --comparison-operator "GreaterThanThreshold" \
  --treat-missing-data "notBreaching"

echo ""
echo "--- Chat Stream ---"

aws cloudwatch put-metric-alarm \
  --region "$REGION" \
  --alarm-name "thechrisgrey-kb-failures" \
  --alarm-description "KB retrieval failures exceed 5 in a 1-hour window" \
  --alarm-actions "$SNS_TOPIC_ARN" \
  --namespace "TheChrisGrey/SiteMetrics" \
  --metric-name "KBRetrievalFailure" \
  --statistic "Sum" \
  --period 3600 \
  --evaluation-periods 1 \
  --threshold 5 \
  --comparison-operator "GreaterThanThreshold" \
  --treat-missing-data "notBreaching"

aws cloudwatch put-metric-alarm \
  --region "$REGION" \
  --alarm-name "thechrisgrey-rate-limit-surge" \
  --alarm-description "Rate limit rejections exceed 50 in a 1-hour window" \
  --alarm-actions "$SNS_TOPIC_ARN" \
  --namespace "TheChrisGrey/SiteMetrics" \
  --metric-name "RateLimitRejection" \
  --statistic "Sum" \
  --period 3600 \
  --evaluation-periods 1 \
  --threshold 50 \
  --comparison-operator "GreaterThanThreshold" \
  --treat-missing-data "notBreaching"

aws cloudwatch put-metric-alarm \
  --region "$REGION" \
  --alarm-name "thechrisgrey-bedrock-cost" \
  --alarm-description "Bedrock cost exceeds \$25/day (estimated from token metrics)" \
  --alarm-actions "$SNS_TOPIC_ARN" \
  --namespace "TheChrisGrey/SiteMetrics" \
  --metric-name "BedrockInputTokens" \
  --statistic "Sum" \
  --period 86400 \
  --evaluation-periods 1 \
  --threshold 1500000 \
  --comparison-operator "GreaterThanThreshold" \
  --treat-missing-data "notBreaching"

echo ""
echo "--- Blueprint ---"

aws cloudwatch put-metric-alarm \
  --region "$REGION" \
  --alarm-name "thechrisgrey-blueprint-opus-cost" \
  --alarm-description "Blueprint Opus 4.6 spend exceeds \$25/day" \
  --alarm-actions "$SNS_TOPIC_ARN" \
  --namespace "TheChrisGrey/Blueprint" \
  --metric-name "BlueprintOpusInputTokens" \
  --statistic "Sum" \
  --period 86400 \
  --evaluation-periods 1 \
  --threshold 1600000 \
  --comparison-operator "GreaterThanThreshold" \
  --treat-missing-data "notBreaching"

aws cloudwatch put-metric-alarm \
  --region "$REGION" \
  --alarm-name "thechrisgrey-blueprint-errors" \
  --alarm-description "Blueprint handler errors exceed 20% over 15 min" \
  --alarm-actions "$SNS_TOPIC_ARN" \
  --namespace "TheChrisGrey/Blueprint" \
  --metric-name "BlueprintHandlerError" \
  --statistic "Sum" \
  --period 900 \
  --evaluation-periods 1 \
  --threshold 3 \
  --comparison-operator "GreaterThanThreshold" \
  --treat-missing-data "notBreaching"

aws cloudwatch put-metric-alarm \
  --region "$REGION" \
  --alarm-name "thechrisgrey-blueprint-validation-failures" \
  --alarm-description "Haiku 4.5 rejects >10% of blueprints — prompt/schema drift likely" \
  --alarm-actions "$SNS_TOPIC_ARN" \
  --namespace "TheChrisGrey/Blueprint" \
  --metric-name "BlueprintValidationFailure" \
  --statistic "Sum" \
  --period 3600 \
  --evaluation-periods 1 \
  --threshold 5 \
  --comparison-operator "GreaterThanThreshold" \
  --treat-missing-data "notBreaching"

echo ""
echo "--- KB Sync ---"

aws cloudwatch put-metric-alarm \
  --region "$REGION" \
  --alarm-name "thechrisgrey-kb-sync-failure" \
  --alarm-description "KB sync (S3 trigger -> Bedrock ingestion) failed" \
  --alarm-actions "$SNS_TOPIC_ARN" \
  --namespace "TheChrisGrey/SiteMetrics" \
  --metric-name "KBSyncFailure" \
  --statistic "Sum" \
  --period 300 \
  --evaluation-periods 1 \
  --threshold 0 \
  --comparison-operator "GreaterThanThreshold" \
  --treat-missing-data "notBreaching"

# ─── NEW: MCP Server alarms ──────────────────────────────────────────────────

echo ""
echo "--- MCP Server (NEW) ---"

# MCP rate limit rejections — sustained rate limiting indicates abuse or a
# misconfigured client hammering the endpoint.
aws cloudwatch put-metric-alarm \
  --region "$REGION" \
  --alarm-name "thechrisgrey-mcp-ratelimit-surge" \
  --alarm-description "MCP server rate limit rejections exceed 20 in a 1-hour window" \
  --alarm-actions "$SNS_TOPIC_ARN" \
  --namespace "TheChrisGrey/McpServer" \
  --metric-name "McpRateLimitRejection" \
  --statistic "Sum" \
  --period 3600 \
  --evaluation-periods 1 \
  --threshold 20 \
  --comparison-operator "GreaterThanThreshold" \
  --treat-missing-data "notBreaching"

# MCP errors — log-based metric filter catches handler errors that don't have
# a dedicated CloudWatch metric. The mcp-server logs structured JSON with
# level:"error" for any handler or rate-limit error.
MCP_LOG_GROUP="/aws/lambda/thechrisgrey-mcp-server"

# Check if the log group exists before creating the filter.
if aws logs describe-log-groups --region "$REGION" --log-group-name-prefix "$MCP_LOG_GROUP" 2>/dev/null | grep -q "$MCP_LOG_GROUP"; then
  aws logs put-metric-filter \
    --region "$REGION" \
    --log-group-name "$MCP_LOG_GROUP" \
    --filter-name "McpHandlerErrors" \
    --filter-pattern '{ $.level = "error" }' \
    --metric-transformations "metricName=McpHandlerError,metricNamespace=TheChrisGrey/McpServer,metricValue=1"

  aws cloudwatch put-metric-alarm \
    --region "$REGION" \
    --alarm-name "thechrisgrey-mcp-errors" \
    --alarm-description "MCP server handler errors exceed 10 in a 15-minute window" \
    --alarm-actions "$SNS_TOPIC_ARN" \
    --namespace "TheChrisGrey/McpServer" \
    --metric-name "McpHandlerError" \
    --statistic "Sum" \
    --period 900 \
    --evaluation-periods 1 \
    --threshold 10 \
    --comparison-operator "GreaterThanThreshold" \
    --treat-missing-data "notBreaching"
else
  echo "  (skipping MCP log filter: log group $MCP_LOG_GROUP not found)"
fi

# ─── NEW: Session Token alarms ───────────────────────────────────────────────

echo ""
echo "--- Session Token (NEW) ---"

# Session token issuance uses log-based metric filters since the handler does
# not publish CloudWatch metrics directly. The structured logger emits events
# like "turnstile_failed", "issuance_rate_limited", and "tokens_issued".
SESSION_LOG_GROUP="/aws/lambda/thechrisgrey-session-token"

if aws logs describe-log-groups --region "$REGION" --log-group-name-prefix "$SESSION_LOG_GROUP" 2>/dev/null | grep -q "$SESSION_LOG_GROUP"; then
  # Turnstile failures — a spike indicates bot attacks or Turnstile service issues.
  aws logs put-metric-filter \
    --region "$REGION" \
    --log-group-name "$SESSION_LOG_GROUP" \
    --filter-name "SessionTurnstileFailures" \
    --filter-pattern '{ $.event = "turnstile_failed" }' \
    --metric-transformations "metricName=SessionTurnstileFailure,metricNamespace=TheChrisGrey/SessionToken,metricValue=1"

  aws cloudwatch put-metric-alarm \
    --region "$REGION" \
    --alarm-name "thechrisgrey-session-turnstile-failures" \
    --alarm-description "Session token Turnstile failures exceed 30 in a 1-hour window (bot attack or Turnstile outage)" \
    --alarm-actions "$SNS_TOPIC_ARN" \
    --namespace "TheChrisGrey/SessionToken" \
    --metric-name "SessionTurnstileFailure" \
    --statistic "Sum" \
    --period 3600 \
    --evaluation-periods 1 \
    --threshold 30 \
    --comparison-operator "GreaterThanThreshold" \
    --treat-missing-data "notBreaching"

  # Rate limited issuance — sustained rate limiting on token issuance indicates
  # abuse or a client bug causing rapid re-requests.
  aws logs put-metric-filter \
    --region "$REGION" \
    --log-group-name "$SESSION_LOG_GROUP" \
    --filter-name "SessionRateLimited" \
    --filter-pattern '{ $.event = "issuance_rate_limited" }' \
    --metric-transformations "metricName=SessionRateLimited,metricNamespace=TheChrisGrey/SessionToken,metricValue=1"

  aws cloudwatch put-metric-alarm \
    --region "$REGION" \
    --alarm-name "thechrisgrey-session-ratelimit-surge" \
    --alarm-description "Session token issuance rate limiting exceeds 50 in a 1-hour window" \
    --alarm-actions "$SNS_TOPIC_ARN" \
    --namespace "TheChrisGrey/SessionToken" \
    --metric-name "SessionRateLimited" \
    --statistic "Sum" \
    --period 3600 \
    --evaluation-periods 1 \
    --threshold 50 \
    --comparison-operator "GreaterThanThreshold" \
    --treat-missing-data "notBreaching"
else
  echo "  (skipping session-token log filters: log group $SESSION_LOG_GROUP not found)"
fi

# ─── NEW: KB Builder alarms ──────────────────────────────────────────────────

echo ""
echo "--- KB Builder (NEW) ---"

# KB builder handler errors — log-based metric filter catches any handler_error
# event emitted by the structured logger. KB builder failures can leave the
# knowledge base in an inconsistent state.
KB_LOG_GROUP="/aws/lambda/thechrisgrey-kb-builder"

if aws logs describe-log-groups --region "$REGION" --log-group-name-prefix "$KB_LOG_GROUP" 2>/dev/null | grep -q "$KB_LOG_GROUP"; then
  aws logs put-metric-filter \
    --region "$REGION" \
    --log-group-name "$KB_LOG_GROUP" \
    --filter-name "KbBuilderErrors" \
    --filter-pattern '{ $.event = "handler_error" }' \
    --metric-transformations "metricName=KbBuilderError,metricNamespace=TheChrisGrey/KbBuilder,metricValue=1"

  aws cloudwatch put-metric-alarm \
    --region "$REGION" \
    --alarm-name "thechrisgrey-kb-builder-errors" \
    --alarm-description "KB builder handler errors exceed 5 in a 15-minute window" \
    --alarm-actions "$SNS_TOPIC_ARN" \
    --namespace "TheChrisGrey/KbBuilder" \
    --metric-name "KbBuilderError" \
    --statistic "Sum" \
    --period 900 \
    --evaluation-periods 1 \
    --threshold 5 \
    --comparison-operator "GreaterThanThreshold" \
    --treat-missing-data "notBreaching"
else
  echo "  (skipping kb-builder log filter: log group $KB_LOG_GROUP not found)"
fi

echo ""
echo "=== Alarm setup complete ==="
echo ""
echo "To verify all alarms:"
echo "  aws cloudwatch describe-alarms --region $REGION --alarm-name-prefix thechrisgrey- --query 'MetricAlarms[].[AlarmName,StateValue]' --output table"
