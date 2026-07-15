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

For a visual overview of deploy impact, open the CloudWatch dashboard:

```bash
./scripts/setup-dashboard.sh    # deploy the dashboard (one-time)
```

Then view it at:
`https://console.aws.amazon.com/cloudwatch/home?region=us-east-1#dashboards:name=thechrisgrey`

The dashboard shows error rates, invocations, Web Vitals, Bedrock cost, and
deployment markers side-by-side, so you can correlate a deploy with any
metric shift across all services.

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

## CloudWatch Dashboard

A unified dashboard visualizes deploy impact across all services in real-time.
Deploy it once with:

```bash
./scripts/setup-dashboard.sh
```

The dashboard (`scripts/cloudwatch-dashboard.json`) includes:

| Widget                            | Metrics                                                               | Purpose                                          |
| --------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------ |
| Lambda Error Rate (all services)  | Per-function `Errors` metric for all 7 Lambdas                        | Spot error spikes after a deploy                 |
| Lambda Invocations (all services) | Per-function `Invocations` for all 7 Lambdas                          | Verify traffic patterns are normal post-deploy   |
| chat-stream: Key Metrics          | KB retrieval failures, rate limits, guardrail interventions, timeouts | Deep dive on chat health                         |
| blueprint: Key Metrics            | Opus cost, handler errors, validation failures, opus timeouts         | Deep dive on blueprint health                    |
| Bedrock Token Usage               | Input/output tokens across all Bedrock calls                          | Cost tracking and anomaly detection              |
| mcp-server: Key Metrics           | Rate limit rejections, handler errors, request completions            | Verify MCP server is processing requests         |
| session-token: Key Metrics        | Turnstile failures, rate limited issuance, tokens issued              | Verify token issuance pipeline is healthy        |
| metrics + kb-builder + kb-sync    | CSP violations, sync failures/triggers, kb-builder errors             | Supporting service health                        |
| Frontend Web Vitals               | LCP, CLS, INP averages                                                | Detect frontend regressions from Amplify deploys |
| Deployment Markers                | Per-service deploy events                                             | Correlate deploys with metric changes            |
| Lambda Duration (p95)             | p95 latency for chat-stream, mcp-server, session-token, metrics       | Detect latency regressions post-deploy           |

## Deployment Markers

Every Lambda deploy via `scripts/deploy-lambda.sh` automatically records a
deployment marker in CloudWatch (`TheChrisGrey/Deployments` namespace). This
creates a visible spike in the dashboard's "Deployment Markers" widget, making
it easy to correlate a deploy with subsequent error spikes or latency changes.

For Amplify (frontend) deploys, mark manually:

```bash
node scripts/mark-deployment.mjs frontend --region us-east-2
```

Markers are best-effort: if CloudWatch is unavailable, the deploy still
succeeds. The marker records the service name, environment, and timestamp.

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

| What                    | Where                                                      | How to check                                                        |
| ----------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------- |
| Health                  | `GET /health` (no auth)                                    | `curl https://thechrisgrey-chat.lambda-url.us-east-1.on.aws/health` |
| Log group               | `tcg-AI-chat` (7-day retention)                            | CloudWatch Logs Insights (see `docs/bedrock-logging-queries.md`)    |
| Bedrock invocation logs | `/aws/bedrock/modelinvocations`                            | CloudWatch Logs Insights (see `docs/bedrock-logging-queries.md`)    |
| KB retrieval failures   | CloudWatch `TheChrisGrey/SiteMetrics` `KBRetrievalFailure` | Alarm: `thechrisgrey-kb-failures`                                   |
| Rate limit rejections   | CloudWatch `TheChrisGrey/SiteMetrics` `RateLimitRejection` | Alarm: `thechrisgrey-rate-limit-surge`                              |
| Bedrock cost            | CloudWatch `TheChrisGrey/SiteMetrics` `BedrockInputTokens` | Alarm: `thechrisgrey-bedrock-cost`                                  |
| Agent timeouts          | CloudWatch `TheChrisGrey/SiteMetrics` `AgentTimeout`       | Alarm: `thechrisgrey-chat-agent-timeout`                            |
| Structured logs         | CloudWatch `/aws/lambda/thechrisgrey-chat-stream`          | Filter: `{ $.level = "error" }`                                     |

### blueprint Lambda

| What                | Where                                                            | How to check                                                             |
| ------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Health              | `GET /health` (no auth)                                          | `curl https://thechrisgrey-blueprint.lambda-url.us-east-1.on.aws/health` |
| Opus cost           | CloudWatch `TheChrisGrey/Blueprint` `BlueprintOpusInputTokens`   | Alarm: `thechrisgrey-blueprint-opus-cost`                                |
| Handler errors      | CloudWatch `TheChrisGrey/Blueprint` `BlueprintHandlerError`      | Alarm: `thechrisgrey-blueprint-errors`                                   |
| Validation failures | CloudWatch `TheChrisGrey/Blueprint` `BlueprintValidationFailure` | Alarm: `thechrisgrey-blueprint-validation-failures`                      |
| Opus timeouts       | CloudWatch `TheChrisGrey/Blueprint` `BlueprintOpusTimeout`       | Alarm: `thechrisgrey-blueprint-opus-timeout`                             |
| Generation errors   | CloudWatch `TheChrisGrey/Blueprint` `BlueprintGenerationError`   | Alarm: `thechrisgrey-blueprint-generation-errors`                        |
| Structured logs     | CloudWatch `/aws/lambda/thechrisgrey-blueprint`                  | Filter: `{ $.level = "error" }`                                          |
| Deploy runbook      | `docs/blueprint/phase-5-deployment-runbook.md`                   | Step-by-step deploy + alarm creation                                     |

### mcp-server Lambda

| What                  | Where                                                              | How to check                                                       |
| --------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------ |
| Health                | `GET /health` (public)                                             | `curl https://thechrisgrey-mcp.lambda-url.us-east-1.on.aws/health` |
| Rate limit rejections | CloudWatch `TheChrisGrey/McpServer` `McpRateLimitRejection`        | Alarm: `thechrisgrey-mcp-ratelimit-surge`                          |
| Handler errors        | CloudWatch `TheChrisGrey/McpServer` `McpHandlerError` (log filter) | Alarm: `thechrisgrey-mcp-errors`                                   |
| Request completions   | CloudWatch `TheChrisGrey/McpServer` `McpRequestComplete`           | Dashboard widget: mcp-server key metrics                           |
| Lambda duration       | CloudWatch `/aws/lambda/thechrisgrey-mcp-server` `Duration`        | Dashboard widget: Lambda Duration (p95)                            |
| Structured logs       | CloudWatch `/aws/lambda/thechrisgrey-mcp-server`                   | Filter: `{ $.level = "error" }`                                    |

**Post-deploy verification:**

1. Check health: `curl -s https://thechrisgrey-mcp.lambda-url.us-east-1.on.aws/health`
2. Send a test MCP `initialize` request and verify a valid JSON-RPC response
3. Watch the dashboard for error spikes in the first 15 minutes
4. Verify `McpRequestComplete` metric is increasing (requests are being processed)

### session-token Lambda

| What                  | Where                                                                         | How to check                                                              |
| --------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Health                | `GET /` returns `{ ok: true, service: "session-token" }`                      | `curl -s https://thechrisgrey-session-token.lambda-url.us-east-1.on.aws/` |
| Turnstile failures    | CloudWatch `TheChrisGrey/SessionToken` `SessionTurnstileFailure` (log filter) | Alarm: `thechrisgrey-session-turnstile-failures`                          |
| Rate limited issuance | CloudWatch `TheChrisGrey/SessionToken` `SessionRateLimited` (log filter)      | Alarm: `thechrisgrey-session-ratelimit-surge`                             |
| Tokens issued         | CloudWatch `TheChrisGrey/SessionToken` `TokensIssued`                         | Dashboard widget: session-token key metrics                               |
| Lambda duration       | CloudWatch `/aws/lambda/thechrisgrey-session-token` `Duration`                | Dashboard widget: Lambda Duration (p95)                                   |
| Structured logs       | CloudWatch `/aws/lambda/thechrisgrey-session-token`                           | Filter: `{ $.event = "turnstile_failed" }`                                |

**Post-deploy verification:**

1. Check health: `curl -s https://thechrisgrey-session-token.lambda-url.us-east-1.on.aws/`
2. Test the full token issuance flow from the frontend (or a signed curl with a valid Turnstile token)
3. Verify `TokensIssued` metric is increasing (tokens are being minted)
4. Watch for `SessionTurnstileFailure` spikes (could indicate a Turnstile config mismatch)

### kb-builder Lambda

| What            | Where                                                             | How to check                                                              |
| --------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Health          | `GET /health` (no auth)                                           | `curl https://thechrisgrey-kb-builder.lambda-url.us-east-1.on.aws/health` |
| Handler errors  | CloudWatch `TheChrisGrey/KBBuilder` `KbBuilderError` (log filter) | Alarm: `thechrisgrey-kb-builder-errors`                                   |
| Structured logs | CloudWatch `/aws/lambda/thechrisgrey-kb-builder`                  | Filter: `{ $.event = "handler_error" }`                                   |

### kb-sync Lambda

| What            | Where                                                   | How to check                                                                     |
| --------------- | ------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Health          | No `/health` endpoint; S3-event-triggered               | Upload a test file to `s3://thechrisgrey-kb-source/` and watch for ingestion job |
| Sync failures   | CloudWatch `TheChrisGrey/SiteMetrics` `KBSyncFailure`   | Alarm: `thechrisgrey-kb-sync-failure`                                            |
| Sync triggers   | CloudWatch `TheChrisGrey/SiteMetrics` `KBSyncTriggered` | No alarm (informational)                                                         |
| Structured logs | CloudWatch `/aws/lambda/thechrisgrey-kb-sync`           | Filter: `{ $.event = "kb_sync_failure" }`                                        |

### metrics Lambda

| What                 | Where                                                                    | How to check                                                      |
| -------------------- | ------------------------------------------------------------------------ | ----------------------------------------------------------------- |
| Health               | `GET /health` (Cognito-auth'd)                                           | `curl -H "Authorization: Bearer $TOKEN" $METRICS_ENDPOINT/health` |
| Web Vitals ingestion | CloudWatch `TheChrisGrey/SiteMetrics`                                    | Admin dashboard at `/admin`                                       |
| CSP report ingestion | CloudWatch `TheChrisGrey/SiteMetrics` `CSPViolation`                     | Alarm: `thechrisgrey-csp-violations`                              |
| Handler errors       | CloudWatch `TheChrisGrey/SiteMetrics` `MetricsHandlerError` (log filter) | Alarm: `thechrisgrey-metrics-errors`                              |
| Lambda duration      | CloudWatch `/aws/lambda/thechrisgrey-metrics` `Duration`                 | Dashboard widget: Lambda Duration (p95)                           |
| Structured logs      | CloudWatch `/aws/lambda/thechrisgrey-metrics`                            | Filter: `{ $.level = "error" }`                                   |

**Post-deploy verification:**

1. Check health (Cognito-auth'd): `curl -H "Authorization: Bearer $TOKEN" $METRICS_ENDPOINT/health`
2. Send a test Web Vitals event from the browser and verify it appears in CloudWatch
3. Verify the admin dashboard at `/admin` loads and shows fresh metrics
4. Watch for `MetricsHandlerError` spikes (could indicate a CloudWatch API change)

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
