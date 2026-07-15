---
name: deploy-lambda
description: Deploy an AWS Lambda service from the thechrisgrey Lambda fleet using the verified deploy script. Includes dry-run verification, module graph validation, and post-deploy health checks.
---

# Deploy Lambda

Deploy a Lambda service from `lambda/` using the verified deploy script. Never hand-zip (the manual zip glob omits sibling modules and ships a crash-on-cold-start artifact).

## Steps

1. Run a dry-run first to verify the module graph resolves:

   ```bash
   npm run deploy:lambda -- <name> --dry-run
   ```

   This reinstalls from the lockfile, dereferences `lambda-shared` into a real copy, and runs a stubbed-`awslambda` import smoke check that aborts on any unresolved import.

2. If dry-run passes, deploy:

   ```bash
   npm run deploy:lambda -- <name>
   # Default region is us-east-1. Override with --region:
   npm run deploy:lambda -- <name> --region us-east-2
   ```

3. After deploy, run the post-deploy health check:

   ```bash
   ./scripts/post-deploy-check.sh
   ```

   This checks CloudWatch alarm states, Lambda health endpoints, frontend availability, and recent error rates across all services.

4. For a deeper check, run smoke tests:
   ```bash
   SMOKE_SESSION_ENDPOINT=https://... SMOKE_CHAT_ENDPOINT=https://... \
     node scripts/smoke-test-lambdas.mjs
   ```

## What the deploy script does

`scripts/deploy-lambda.sh`:

- Runs `npm ci --no-workspaces --ignore-scripts` in the Lambda directory
- Dereferences the `lambda-shared` symlink into a real, fresh copy (prevents stale snapshots)
- Removes `lambda-shared/node_modules` (shared resolves deps from the Lambda's node_modules at runtime)
- Verifies the entire module graph resolves with a stubbed `awslambda` global
- Zips the bundle (excluding tests, fixtures, and function.zip)
- Calls `aws lambda update-function-code`
- Records a deployment marker in CloudWatch (`TheChrisGrey/Deployments` namespace)

## Important notes

- The 7 deployable Lambdas are: `chat-stream`, `blueprint`, `kb-builder`, `kb-sync`, `metrics`, `mcp-server`, `session-token`
- `lambda/shared` is a library, not deployed alone
- If you added a new dependency to `lambda/shared/package.json`, you MUST also add it to each consuming Lambda's `package.json` (the deploy script removes shared's node_modules)
- Node 22 is required (pinned in `.nvmrc`)
- The deploy script is also available as: `bash scripts/deploy-lambda.sh <name> [--region <r>] [--dry-run]`

## Post-deploy verification

Check the CloudWatch dashboard for deploy impact:

```
https://console.aws.amazon.com/cloudwatch/home?region=us-east-1#dashboards:name=thechrisgrey
```

Watch for error spikes in the first 15 minutes. See `docs/deployment-observability.md` for per-service monitoring details.
