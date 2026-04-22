# Blueprint — Phase 5 Deployment Runbook

End-to-end AWS deployment of the Blueprint Lambda plus CSP and monitoring alarms.
Feature stays behind `VITE_BLUEPRINT_ENABLED` so the waitlist page keeps shipping
until you flip it. All commands assume `us-east-1` (Bedrock region) unless noted.

**Account:** 205930636302 &nbsp;•&nbsp; **Region:** us-east-1

---

## 0. Prereqs — one-time secrets and identifiers

Collect these values before running any `aws` command. Nothing below should be
committed to git.

| Variable | Where it comes from |
|---|---|
| `BLUEPRINT_SIGNING_KEY` | Generate once: `openssl rand -hex 32` — must match `VITE_BLUEPRINT_SIGNING_KEY` in Amplify |
| `SANITY_READ_TOKEN` | Sanity → API → Tokens (read-only, `production` dataset). Optional until Phase 4 golden examples exist |
| `SNS_TOPIC_ARN` | `arn:aws:sns:us-east-1:205930636302:thechrisgrey-site-alerts` (existing topic) |
| `CORS_ORIGIN` | `https://thechrisgrey.com` |

Set them in your shell for the commands below:

```bash
export BLUEPRINT_SIGNING_KEY="$(openssl rand -hex 32)"
export SANITY_READ_TOKEN="..."                  # or leave empty for now
export SNS_TOPIC_ARN="arn:aws:sns:us-east-1:205930636302:thechrisgrey-site-alerts"
export CORS_ORIGIN="https://thechrisgrey.com"
```

Save `BLUEPRINT_SIGNING_KEY` somewhere safe — the same value goes into Amplify
as `VITE_BLUEPRINT_SIGNING_KEY` in step 8.

---

## 1. Create IAM role + attach policy

```bash
# Trust policy for Lambda service
cat > /tmp/blueprint-trust-policy.json <<'EOF'
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": { "Service": "lambda.amazonaws.com" },
    "Action": "sts:AssumeRole"
  }]
}
EOF

aws iam create-role \
  --role-name thechrisgrey-blueprint-role \
  --assume-role-policy-document file:///tmp/blueprint-trust-policy.json \
  --description "Execution role for thechrisgrey-blueprint Lambda"

aws iam put-role-policy \
  --role-name thechrisgrey-blueprint-role \
  --policy-name thechrisgrey-blueprint-policy \
  --policy-document file://lambda/blueprint/iam-policy.json
```

The policy grants Bedrock invocation (Opus + Haiku, foundation models AND
inference profiles), DynamoDB access to the shared `thechrisgrey-chat-ratelimit`
table, CloudWatch Logs, and scoped CloudWatch metrics (`TheChrisGrey/Blueprint`
namespace only).

---

## 2. Create the Lambda function

The zip was built in `lambda/blueprint/function.zip` (8.5MB, already includes
`node_modules/lambda-shared`). Rebuild first if any `.mjs` changed:

```bash
cd lambda/blueprint
npm install      # ensure lambda-shared is symlinked/copied
rm -f function.zip
zip -r function.zip \
  index.mjs engine.mjs bedrock.mjs prompts.mjs schema.mjs \
  validation.mjs hmac.mjs metrics.mjs goldenExamples.mjs \
  package.json node_modules
```

Create the function (Node 20, 1024MB memory, 90s timeout — Opus can take ~30s):

```bash
aws lambda create-function \
  --function-name thechrisgrey-blueprint \
  --runtime nodejs20.x \
  --role arn:aws:iam::205930636302:role/thechrisgrey-blueprint-role \
  --handler index.handler \
  --zip-file fileb://lambda/blueprint/function.zip \
  --timeout 90 \
  --memory-size 1024 \
  --region us-east-1 \
  --description "Blueprint generator (Opus 4.6) — public rate-limited endpoint"
```

> **Note:** IAM role propagation takes ~10s. If `create-function` fails with
> `InvalidParameterValueException`, wait and retry.

---

## 3. Set environment variables

```bash
aws lambda update-function-configuration \
  --function-name thechrisgrey-blueprint \
  --region us-east-1 \
  --environment "Variables={
BLUEPRINT_SIGNING_KEY=$BLUEPRINT_SIGNING_KEY,
BLUEPRINT_RATE_LIMIT_TABLE=thechrisgrey-chat-ratelimit,
CORS_ORIGIN=$CORS_ORIGIN,
SANITY_PROJECT_ID=k5950b3w,
SANITY_DATASET=production,
SANITY_READ_TOKEN=$SANITY_READ_TOKEN,
BEDROCK_OPUS_MODEL_ID=us.anthropic.claude-opus-4-6-v1,
BEDROCK_HAIKU_MODEL_ID=us.anthropic.claude-haiku-4-5-20251001-v1:0
}"
```

Defaults if omitted:
- `BLUEPRINT_RATE_LIMIT_TABLE` falls back to `CHAT_RATE_LIMIT_TABLE`, then to `thechrisgrey-chat-ratelimit`.
- Missing `SANITY_READ_TOKEN` disables golden-example injection but the engine still generates (with a warning).

---

## 4. Create the Function URL

```bash
aws lambda create-function-url-config \
  --function-name thechrisgrey-blueprint \
  --auth-type NONE \
  --cors "AllowOrigins=https://thechrisgrey.com,AllowMethods=POST,OPTIONS,AllowHeaders=Content-Type,x-blueprint-timestamp,x-blueprint-signature,MaxAge=3600" \
  --region us-east-1

# Allow public invocation (Function URL requires explicit resource policy)
aws lambda add-permission \
  --function-name thechrisgrey-blueprint \
  --statement-id blueprint-function-url-public \
  --action lambda:InvokeFunctionUrl \
  --principal "*" \
  --function-url-auth-type NONE \
  --region us-east-1
```

Capture the URL printed by `create-function-url-config` — you'll need it in
steps 7 and 8. Shape: `https://<hash>.lambda-url.us-east-1.on.aws/`.

Save it:

```bash
export BLUEPRINT_FN_URL="https://<hash>.lambda-url.us-east-1.on.aws/"
```

---

## 5. Smoke-test the Lambda (without the site)

A HMAC-signed request from the CLI:

```bash
BODY='{"spec":{"goal":"A simple static website on AWS with CloudFront and S3","category":"web_app","scale":"small","monthly_budget_usd":10},"deviceId":"cli-smoketest-1234"}'
TS=$(date +%s)
SIG=$(printf "%s.%s" "$TS" "$BODY" | openssl dgst -sha256 -hmac "$BLUEPRINT_SIGNING_KEY" -hex | awk '{print $2}')

curl -sS -X POST "$BLUEPRINT_FN_URL" \
  -H "Content-Type: application/json" \
  -H "x-blueprint-timestamp: $TS" \
  -H "x-blueprint-signature: $SIG" \
  -d "$BODY" | head -c 500
```

Expected: `{"ok":true,"output":{...}}` after ~20-40 seconds. A `401 unauthorized`
means the HMAC key doesn't match env; a `429` means the rate-limit table rejected
(expected on the second run — use a fresh `deviceId` or wait 30 days).

---

## 6. Create CloudWatch alarms (3) → SNS

All alarms publish to the existing `thechrisgrey-site-alerts` SNS topic.

### 6a. Opus cost alarm — $25/day

```bash
aws cloudwatch put-metric-alarm \
  --alarm-name thechrisgrey-blueprint-opus-cost \
  --alarm-description "Blueprint Opus 4.6 spend exceeds \$25/day (rough estimate: ~1.6M input + ~800K output tokens)" \
  --actions-enabled \
  --alarm-actions "$SNS_TOPIC_ARN" \
  --metric-name BlueprintOpusOutputTokens \
  --namespace TheChrisGrey/Blueprint \
  --statistic Sum \
  --period 86400 \
  --evaluation-periods 1 \
  --threshold 800000 \
  --comparison-operator GreaterThanThreshold \
  --treat-missing-data notBreaching \
  --region us-east-1
```

### 6b. Error rate alarm — >20% over 15 min

```bash
aws cloudwatch put-metric-alarm \
  --alarm-name thechrisgrey-blueprint-errors \
  --alarm-description "Blueprint handler errors or 5xx-generating failures spike above 20% over 15 min" \
  --actions-enabled \
  --alarm-actions "$SNS_TOPIC_ARN" \
  --metric-name BlueprintHandlerError \
  --namespace TheChrisGrey/Blueprint \
  --statistic Sum \
  --period 900 \
  --evaluation-periods 1 \
  --threshold 5 \
  --comparison-operator GreaterThanThreshold \
  --treat-missing-data notBreaching \
  --region us-east-1
```

### 6c. Haiku validation-failure alarm — >10% rejection

```bash
aws cloudwatch put-metric-alarm \
  --alarm-name thechrisgrey-blueprint-validation-failures \
  --alarm-description "Haiku 4.5 is rejecting >10% of blueprints — prompt/schema drift likely" \
  --actions-enabled \
  --alarm-actions "$SNS_TOPIC_ARN" \
  --metric-name BlueprintValidationFailure \
  --namespace TheChrisGrey/Blueprint \
  --statistic Sum \
  --period 900 \
  --evaluation-periods 1 \
  --threshold 3 \
  --comparison-operator GreaterThanThreshold \
  --treat-missing-data notBreaching \
  --region us-east-1
```

---

## 7. Update `amplify.yml` CSP

Add the Function URL to `connect-src`. Edit the single `Content-Security-Policy`
line in `amplify.yml` (currently ~line 32) to append `$BLUEPRINT_FN_URL` before
the Cognito origin:

Before (fragment):

```
connect-src 'self' https://cloudflareinsights.com https://plausible.io https://vrs4egsi745nep54y6abvwlcwq0smqak.lambda-url.us-east-2.on.aws https://sf5bejshafrb6t7zbbfw5knu7a0axlyp.lambda-url.us-east-2.on.aws https://mrrpf6f34n7vpkolurdc24c5fu0jruad.lambda-url.us-east-1.on.aws https://*.sanity.io https://*.apicdn.sanity.io https://zk46cokyuwgtdtz2ocdlhtjcji0fnidk.lambda-url.us-east-1.on.aws https://dnsio2ypcuxamxgzjpxr7knwpe0ybbuq.lambda-url.us-east-1.on.aws https://cognito-idp.us-east-1.amazonaws.com;
```

After (append the blueprint URL as one more token; trim the wildcard hash to
match):

```
connect-src ... https://dnsio2ypcuxamxgzjpxr7knwpe0ybbuq.lambda-url.us-east-1.on.aws https://<BLUEPRINT_HASH>.lambda-url.us-east-1.on.aws https://cognito-idp.us-east-1.amazonaws.com;
```

Commit and push — Amplify will rebuild and pick up the header. The site itself
doesn't need to know the URL until `VITE_BLUEPRINT_ENDPOINT` is set in Amplify.

---

## 8. Amplify env vars + flip the flag

Set three Amplify env vars on the `main` branch. **Keep `VITE_BLUEPRINT_ENABLED`
unset or `false` until you're ready to go live** — that's what keeps the
waitlist page showing.

```bash
aws amplify update-branch \
  --app-id d3du8eg39a9peo \
  --branch-name main \
  --region us-east-2 \
  --environment-variables "
VITE_BLUEPRINT_ENDPOINT=$BLUEPRINT_FN_URL,
VITE_BLUEPRINT_SIGNING_KEY=$BLUEPRINT_SIGNING_KEY
"
```

> **Important:** `update-branch` **replaces** the entire `environment-variables`
> map. Use the AWS Console (Amplify → App → Environment variables) to add them
> incrementally, or read the current set first with `aws amplify get-branch` and
> merge manually.

Trigger a rebuild once the vars are saved:

```bash
aws amplify start-job \
  --app-id d3du8eg39a9peo \
  --branch-name main \
  --job-type RELEASE \
  --region us-east-2
```

---

## 9. Go-live checklist (once everything's wired)

- [ ] `VITE_BLUEPRINT_ENABLED=true` on Amplify
- [ ] At least one `architectureBlueprint` doc in Sanity marked `isActive: true` (Phase 4)
- [ ] Opus inference-profile access confirmed in Bedrock console (us-east-1)
- [ ] `thechrisgrey-chat-ratelimit` table has a `blueprint-<hash>` test entry after smoke test
- [ ] All 3 CloudWatch alarms show OK state
- [ ] Browser test at `https://thechrisgrey.com/blueprint`: submit a spec, see the result page render Mermaid + IaC + artifacts
- [ ] Network tab: request goes to the Function URL with `x-blueprint-timestamp` and `x-blueprint-signature` headers
- [ ] Re-submit immediately: UI shows rate-limited card with waitlist

---

## Rollback

If anything goes sideways after go-live:

```bash
# Fastest: flip the feature flag
aws amplify update-branch --app-id d3du8eg39a9peo --branch-name main --region us-east-2 \
  --environment-variables "VITE_BLUEPRINT_ENABLED=false,..."   # keep the others set

# Or: delete the Function URL (UI shows "not_configured" error, waitlist still shown if flag off)
aws lambda delete-function-url-config \
  --function-name thechrisgrey-blueprint --region us-east-1

# Full teardown (only if scrapping the feature)
aws lambda delete-function --function-name thechrisgrey-blueprint --region us-east-1
aws iam delete-role-policy --role-name thechrisgrey-blueprint-role --policy-name thechrisgrey-blueprint-policy
aws iam delete-role --role-name thechrisgrey-blueprint-role
aws cloudwatch delete-alarms --alarm-names thechrisgrey-blueprint-opus-cost thechrisgrey-blueprint-errors thechrisgrey-blueprint-validation-failures
```
