# Golden Examples Template — thechrisgrey Blueprint

These examples seed the `generateBlueprint` engine's system prompt. For each user
request, the prompt builder selects 2–3 relevant examples by category match and
injects them so Opus 4.6 produces output of comparable depth and style. We target
**8–10 total** — at least one per category plus 1–2 extras for variety.

Each example is stored in Sanity as an `architectureBlueprint` document matching
`lambda/blueprint/schema.mjs` → `GoldenExampleSchema`. This template is the local
fill-in format; once written, entries are published to Sanity via the
`blueprint-builder` Lambda admin UI or Sanity Studio.

## Authoring Rules

1. **Real workloads only.** Pick architectures Christian has actually built or would
   confidently recommend on a client engagement. No speculative designs.
2. **Cost honesty.** `monthly_low_usd` is steady state; `monthly_high_usd` includes
   reasonable burst. Both ≥ 0 and ≤ 100,000. Assumptions must explain the delta.
3. **IaC must run.** The `iac_scaffold.snippet` should compile with
   `cdk synth` / `sam build` / `terraform plan` when dropped into a fresh project
   with standard scaffolding.
4. **Artifacts must be useful.** A skill body should be invokable as-is. A slash
   command should be copy-paste-ready. A subagent prompt should produce coherent
   output on first try. An MCP tool should have a complete inputSchema.
5. **Mermaid only for diagrams.** `flowchart TD` or `graph LR`. Avoid sequence
   diagrams unless the temporal dimension is load-bearing.
6. **No emojis** (project convention).
7. **Name artifacts specifically.** `deploy-to-s3-cloudfront` beats `deploy-helper`.

## Categories (one example minimum each)

- `ai-agent` — Agents with tool use (Strands, Bedrock AgentCore, LangGraph)
- `rag` — Retrieval-augmented generation (Bedrock KB, Pinecone, OpenSearch Serverless)
- `data-pipeline` — Streaming or batch data processing (Kinesis, Kafka/MSK, DynamoDB Streams)
- `realtime-app` — WebSockets, pub/sub (AppSync, IoT Core, API Gateway WebSocket)
- `batch-etl` — Scheduled transforms (Step Functions, Glue, EMR, Batch)
- `web-api` — REST / GraphQL backends (API Gateway, AppSync, ALB + ECS)
- `iot-ingest` — Device data ingestion (IoT Core, Kinesis, Timestream)
- `ml-training` — Model training pipelines (SageMaker, Bedrock custom models, EC2 P5)

## Entry Template

Copy this block per example. Field lengths must satisfy
`lambda/blueprint/schema.mjs` → `GoldenExampleSchema`.

```yaml
title: "<short descriptive title, e.g. 'Streaming RAG chat on a $50/mo budget'>"
slug: '<url-safe kebab-case slug>'
category: '<one of the 8 categories>'

spec:
  goal: '<20–500 chars: what the user asked for in their own words>'
  category: '<must match top-level category>'
  scale:
    traffic: "<optional, ≤200 chars: e.g. '1k req/day'>"
    data_volume: "<optional, ≤200 chars: e.g. '500MB of docs'>"
    latency_budget: "<optional, ≤200 chars: e.g. 'first token <2s'>"
  constraints:
    monthly_budget_usd: <optional integer, 1–100000>
    compliance: [<optional array subset of: hipaa, pci, soc2, fedramp, gdpr, ccpa>]
    region_restriction: '<optional, ≤50 chars>'
    team_size: <optional integer, 1–1000>
  preferred_languages: [<optional subset of: typescript, javascript, python, go, rust, java>]
  integrations: [<optional array, each ≤50 chars, max 20 total>]

output:
  architecture_summary: |
    <100–2000 chars. Prose, not bullets. Describe the end-to-end flow and the
    key service choices with their "why". Principal-engineer whiteboard voice —
    not a product pitch, not a tutorial.>

  services:
    # 2–15 entries
    - service: '<AWS or third-party service name, 2–80 chars>'
      purpose: '<10–300 chars: its role in this architecture>'
      rationale: '<10–400 chars: why this service over alternatives>'
      cost_signal: '<free-tier | low | medium | high>'

  diagram_mermaid: |
    flowchart TD
      <mermaid source, 50–4000 chars>

  iac_scaffold:
    tool: '<cdk | sam | terraform>'
    rationale: '<20–400 chars: why this IaC tool for this workload>'
    snippet: |
      <50–4000 chars. Real, runnable IaC. No pseudo-code, no '...' elisions
      in critical paths.>

  iam_highlights:
    # 1–10 bullets
    - '<10–300 chars: critical IAM policy note — least-privilege scope, risky permission to avoid, etc.>'

  cost_estimate:
    monthly_low_usd: <number ≥ 0, ≤ 100000>
    monthly_high_usd: <number ≥ 0, ≤ 100000>
    assumptions:
      # 1–8 entries
      - '<10–400 chars: assumption that drives the cost>'

  claude_artifacts:
    # 1–4 entries
    - kind: '<skill | slash_command | subagent | mcp_tool>'
      name: '<3–80 chars, kebab-case>'
      description: '<20–300 chars>'
      body: |
        <100–8000 chars. For a skill: a real skill markdown file. For a slash
        command: the full slash command body. For a subagent: the full system
        prompt + example I/O. For an MCP tool: the inputSchema JSON + handler
        pseudocode.>

  next_steps:
    # 3–10 ordered items
    - '<10–300 chars: concrete next action for the user>'

  caveats:
    # 0–6 entries
    - "<10–300 chars: limitation or assumption — e.g. 'assumes us-east-1; add cross-region for DR'>"

notes: |
  <Optional, ≤2000 chars. Christian's authorial commentary — why this is a
  good example, what variation exists, common mistakes to flag. Not shown
  to end users; used for prompt-engineering context and future tuning.>

isActive: true
sortOrder: <integer ≥ 0. Lower = earlier in the prompt. Use gaps (10, 20, 30…)
  to allow insertion later.>
```

## Progress Checklist

Target 8–10 examples. Cover all 8 categories; add variety picks last.

- [ ] 1. `ai-agent` — _fill_
- [ ] 2. `rag` — _fill_
- [ ] 3. `data-pipeline` — _fill_
- [ ] 4. `realtime-app` — _fill_
- [ ] 5. `batch-etl` — _fill_
- [ ] 6. `web-api` — _fill_
- [ ] 7. `iot-ingest` — _fill_
- [ ] 8. `ml-training` — _fill_
- [ ] 9. (variety pick, optional) — _fill_
- [ ] 10. (variety pick, optional) — _fill_

## Related Files

- `lambda/blueprint/schema.mjs` — canonical Zod schemas these examples must satisfy
- `lambda/blueprint/goldenExamples.mjs` — runtime fetcher (Sanity GROQ + 10-min cache)
- `lambda/blueprint/prompts.mjs` — selects 2–3 examples by category match and injects them
- `docs/blueprint/system-prompt-principles.md` — Christian's opinionated architecture principles (authored separately)
