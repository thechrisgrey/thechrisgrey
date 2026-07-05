# Deployment Observability Reference

Where to check deploy impact for each service in the thechrisgrey stack.

## Quick Start

After any deployment, run the automated health check:

```bash
./scripts/post-deploy-check.sh
# Or with verbose output:
./scripts/post-deploy-check.sh --verbose
```

This checks CloudWatch alarm states, Lambda health endpoints, frontend
availability, and recent error rates across all 7 Lambda services.

For a deeper pre-promotion gate, also run the live smoke tests:

```bash
SMOKE_SESSION_ENDPOINT=https://... \
SMOKE_CHAT_ENDPOINT=https://... \
node scripts/smoke-test-lambdas.mjs
```

## Monitoring Architecture

```
Amplify (frontend) ──> Cloudflare (CDN/WAF) ──> thechrisgrey.com
                              │
                    Lambda Function URLs (7 services)
                              │
              CloudWatch (metrics, logs, alarms)
                              │
                    SNS: thechrisgrey-site-alerts
                              │
                    Email: chris@altivum.ai
```

## Per-Service Monitoring

### Frontend (Amplify)

| What                                  | Where                                                | How to check                                                       |
| ------------------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------ |
| Site availability                     | `https://thechrisgrey.com`                           | `curl -sI https://thechrisgrey.com`                                |
| Web Vitals (LCP, CLS, INP, FCP, TTFB) | CloudWatch `TheChrisGrey/SiteMetrics`                | Admin dashboard at `/admin` (useSiteHealth)                        |
| CSP violations                        | CloudWatch `TheChrisGrey/SiteMetrics` `CSPViolation` | Alarm: `thechrisgrey-csp-violations`                               |
| CLS regression                        | CloudWatch `TheChrisGrey/SiteMetrics` `CLS`          | Alarm: `thechrisgrey-high-cls`                                     |
| Build pipeline                        | Amplify console                                      | `aws amplify list-jobs --app-id d3du8eg39a9peo --branch-name main` |

### chat-stream Lambda

| What                    | Where                                                      | How to check                                                     |
| ----------------------- | ---------------------------------------------------------- | ---------------------------------------------------------------- |
| Health                  | No `/health` endpoint; use smoke test                      | `SMOKE_CHAT_ENDPOINT=... node scripts/smoke-test-lambdas.mjs`    |
| Log group               | `tcg-AI-chat` (7-day retention)                            | CloudWatch Logs Insights (see `docs/bedrock-logging-queries.md`) |
| Bedrock invocation logs | `/aws/bedrock/modelinvocations`                            | CloudWatch Logs Insights (see `docs/bedrock-logging-queries.md`) |
| KB retrieval failures   | CloudWatch `TheChrisGrey/SiteMetrics` `KBRetrievalFailure` | Alarm: `thechrisgrey-kb-failures`                                |
| Rate limit rejections   | CloudWatch `TheChrisGrey/SiteMetrics` `RateLimitRejection` | Alarm: `thechrisgrey-rate-limit-surge`                           |
| Bedrock cost            | CloudWatch `TheChrisGrey/SiteMetrics` `BedrockInputTokens` | Alarm: `thechrisgrey-bedrock-cost`                               |
| Structured logs         | CloudWatch `/aws/lambda/thechrisgrey-chat-stream`          | Filter: `{ $.level = "error" }`                                  |

### blueprint Lambda

| What                | Where                                                            | How to check                                        |
| ------------------- | ---------------------------------------------------------------- | --------------------------------------------------- |
| Health              | No `/health` endpoint; use NDJSON stream                         | Send a test spec and observe streaming response     |
| Opus cost           | CloudWatch `TheChrisGrey/Blueprint` `BlueprintOpusInputTokens`   | Alarm: `thechrisgrey-blueprint-opus-cost`           |
| Handler errors      | CloudWatch `TheChrisGrey/Blueprint` `BlueprintHandlerError`      | Alarm: `thechrisgrey-blueprint-errors`              |
| Validation failures | CloudWatch `TheChrisGrey/Blueprint` `BlueprintValidationFailure` | Alarm: `thechrisgrey-blueprint-validation-failures` |
| Structured logs     | CloudWatch `/aws/lambda/thechrisgrey-blueprint`                  | Filter: `{ $.level = "error" }`                     |
| Deploy runbook      | `docs/blueprint/phase-5-deployment-runbook.md`                   | Step-by-step deploy + alarm creation                |

### mcp-server Lambda

| What                  | Where                                                              | How to check                                                       |
| --------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------ |
| Health                | `GET /health` (public)                                             | `curl https://thechrisgrey-mcp.lambda-url.us-east-1.on.aws/health` |
| Rate limit rejections | CloudWatch `TheChrisGrey/McpServer` `McpRateLimitRejection`        | Alarm: `thechrisgrey-mcp-ratelimit-surge`                          |
| Handler errors        | CloudWatch `TheChrisGrey/McpServer` `McpHandlerError` (log filter) | Alarm: `thechrisgrey-mcp-errors`                                   |
| Structured logs       | CloudWatch `/aws/lambda/thechrisgrey-mcp-server`                   | Filter: `{ $.level = "error" }`                                    |

### session-token Lambda

| What                  | Where                                                                         | How to check                                                     |
| --------------------- | ----------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Health                | No `/health` endpoint; use smoke test                                         | `SMOKE_SESSION_ENDPOINT=... node scripts/smoke-test-lambdas.mjs` |
| Turnstile failures    | CloudWatch `TheChrisGrey/SessionToken` `SessionTurnstileFailure` (log filter) | Alarm: `thechrisgrey-session-turnstile-failures`                 |
| Rate limited issuance | CloudWatch `TheChrisGrey/SessionToken` `SessionRateLimited` (log filter)      | Alarm: `thechrisgrey-session-ratelimit-surge`                    |
| Structured logs       | CloudWatch `/aws/lambda/thechrisgrey-session-token`                           | Filter: `{ $.event = "turnstile_failed" }`                       |

### kb-builder Lambda

| What            | Where                                                             | How to check                            |
| --------------- | ----------------------------------------------------------------- | --------------------------------------- |
| Health          | No `/health` endpoint; Cognito-auth'd CRUD                        | Test via admin UI at `/admin`           |
| Handler errors  | CloudWatch `TheChrisGrey/KbBuilder` `KbBuilderError` (log filter) | Alarm: `thechrisgrey-kb-builder-errors` |
| Structured logs | CloudWatch `/aws/lambda/thechrisgrey-kb-builder`                  | Filter: `{ $.event = "handler_error" }` |

### kb-sync Lambda

| What            | Where                                                   | How to check                                                                     |
| --------------- | ------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Health          | No `/health` endpoint; S3-event-triggered               | Upload a test file to `s3://thechrisgrey-kb-source/` and watch for ingestion job |
| Sync failures   | CloudWatch `TheChrisGrey/SiteMetrics` `KBSyncFailure`   | Alarm: `thechrisgrey-kb-sync-failure`                                            |
| Sync triggers   | CloudWatch `TheChrisGrey/SiteMetrics` `KBSyncTriggered` | No alarm (informational)                                                         |
| Structured logs | CloudWatch `/aws/lambda/thechrisgrey-kb-sync`           | Filter: `{ $.event = "kb_sync_failure" }`                                        |

### metrics Lambda

| What                 | Where                                                | How to check                                                      |
| -------------------- | ---------------------------------------------------- | ----------------------------------------------------------------- |
| Health               | `GET /health` (Cognito-auth'd)                       | `curl -H "Authorization: Bearer $TOKEN" $METRICS_ENDPOINT/health` |
| Web Vitals ingestion | CloudWatch `TheChrisGrey/SiteMetrics`                | Admin dashboard at `/admin`                                       |
| CSP report ingestion | CloudWatch `TheChrisGrey/SiteMetrics` `CSPViolation` | Alarm: `thechrisgrey-csp-violations`                              |
| Structured logs      | CloudWatch `/aws/lambda/thechrisgrey-metrics`        | Filter: `{ $.level = "error" }`                                   |

## Admin Dashboard

The `/admin` page (Cognito-protected) shows a live Site Health panel powered by
`useSiteHealth.ts`. It aggregates the last 24 hours of CloudWatch metrics from
the metrics Lambda's `/health` endpoint:

- Web Vitals: LCP, CLS, INP, FCP, TTFB averages
- Chat: KB success rate, KB failures, guardrail interventions, rate limit rejections
- Performance: KB retrieval latency, Bedrock invocation latency, total request latency
- Costs: Bedrock input/output tokens, malformed requests
- Security: CSP violations

## Alarm Setup

All alarms are defined in `scripts/setup-alarms.sh`. Run it to create or update
the full alarm set:

```bash
./scripts/setup-alarms.sh              # create all alarms
./scripts/setup-alarms.sh --dry-run    # preview without executing
```

All alarms publish to SNS topic `thechrisgrey-site-alerts` which emails
`chris@altivum.ai`.

## CloudWatch Logs Insights

For analyzing chat-stream usage via Bedrock model invocation logs, see
`docs/bedrock-logging-queries.md` for pre-built queries:

- Recent user questions
- Question/response pairs
- Token usage by conversation
- Daily token usage summary
- Cost estimation
- Guardrail interventions
