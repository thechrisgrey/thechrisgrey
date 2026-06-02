#!/usr/bin/env bash
#
# Build a verified deployment bundle for a Lambda and update its code.
#
# Usage:
#   bash scripts/deploy-lambda.sh <name> [--region us-east-1] [--dry-run]
#   npm run deploy:lambda -- <name> [--region us-east-1] [--dry-run]
#
# What it guarantees over the old hand-typed `zip` commands:
#   1. Installs from the committed lockfile (npm ci) when present.
#   2. Dereferences the lambda-shared symlink into a real, fresh copy so the
#      bundle can never ship a stale snapshot (the failure mode that left
#      sanityQueries.mjs out of a deployed chat-stream artifact).
#   3. Verifies the ENTIRE module graph resolves before upload — any missing
#      import aborts the deploy instead of crashing the Lambda on cold start.
#
set -euo pipefail

NAME="${1:?Usage: deploy-lambda.sh <lambda-name> [--region <r>] [--dry-run]}"; shift || true
REGION="us-east-1"; DRY_RUN=0
while [ $# -gt 0 ]; do
  case "$1" in
    --region) REGION="$2"; shift 2;;
    --dry-run) DRY_RUN=1; shift;;
    *) echo "Unknown arg: $1" >&2; exit 1;;
  esac
done

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DIR="$ROOT/lambda/$NAME"
[ -f "$DIR/index.mjs" ] || { echo "No deployable Lambda at $DIR" >&2; exit 1; }
cd "$DIR"

echo "==> [$NAME] Installing deps"
if [ -f package-lock.json ]; then
  npm ci --no-audit --no-fund
else
  npm install --no-audit --no-fund
fi

if [ -L node_modules/lambda-shared ]; then
  echo "==> [$NAME] Dereferencing lambda-shared (avoids stale snapshot)"
  rm -f node_modules/lambda-shared
  mkdir -p node_modules/lambda-shared
  cp -RL "$ROOT/lambda/shared/." node_modules/lambda-shared/
  # shared's own node_modules (used only for its standalone tests) must never ship —
  # at runtime, shared resolves its deps from this Lambda's node_modules.
  rm -rf node_modules/lambda-shared/node_modules
fi

echo "==> [$NAME] Verifying full module graph resolves"
# Stub the Lambda runtime global so streaming handlers can be imported off-Lambda.
# ESM static imports are hoisted and fully resolved/evaluated BEFORE the importing
# module's body runs, so reaching a NON-resolution error proves the graph resolved
# (e.g. a top-level env assertion). We abort the deploy only on true module-resolution
# error codes — this catches the missing-module failure mode without false-failing on
# runtime config that only exists in the deployed Lambda's environment.
node --input-type=module -e "
globalThis.awslambda = { streamifyResponse: (f) => f, HttpResponseStream: { from: (s) => s } };
const MODULE_ERRORS = new Set([
  'ERR_MODULE_NOT_FOUND', 'ERR_PACKAGE_PATH_NOT_EXPORTED',
  'ERR_UNSUPPORTED_DIR_IMPORT', 'ERR_PACKAGE_IMPORT_NOT_DEFINED',
]);
try {
  await import('./index.mjs');
  console.log('module graph OK');
} catch (err) {
  if (MODULE_ERRORS.has(err && err.code)) {
    console.error('MODULE RESOLUTION FAILED:', err.code, '-', err.message);
    process.exit(1);
  }
  console.log('module graph OK (top-level threw post-resolution: ' + ((err && (err.code || err.name)) || 'Error') + ' — expected without runtime env)');
}
" || { echo "FAILED: module graph did not resolve — aborting deploy" >&2; exit 1; }

echo "==> [$NAME] Zipping"
rm -f function.zip
zip -rq function.zip . \
  -x '__tests__/*' -x '__fixtures__/*' -x '*.test.mjs' \
  -x 'function.zip' -x '*.zip' -x 'README.md' \
  -x 'node_modules/lambda-shared/node_modules/*'

if [ "$DRY_RUN" -eq 1 ]; then
  echo "==> [$NAME] Dry run — built function.zip ($(du -h function.zip | cut -f1)); skipping upload."
  exit 0
fi

echo "==> [$NAME] Deploying thechrisgrey-$NAME ($REGION)"
aws lambda update-function-code \
  --function-name "thechrisgrey-$NAME" \
  --zip-file "fileb://function.zip" \
  --region "$REGION"
echo "==> [$NAME] Done."
