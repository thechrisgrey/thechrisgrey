#!/usr/bin/env bash
#
# Deploy or update the thechrisgrey CloudWatch dashboard.
#
# The dashboard visualizes key metrics across all 8 services (frontend + 7
# Lambdas) and includes deployment markers so you can correlate deploys with
# error spikes, latency changes, or cost shifts.
#
# Usage:
#   ./scripts/setup-dashboard.sh                    # deploy dashboard
#   ./scripts/setup-dashboard.sh --region us-east-1 # override region
#
# Prerequisites:
#   - AWS CLI v2 configured with cloudwatch:PutDashboard permission
#
# After deploying, view the dashboard at:
#   https://console.aws.amazon.com/cloudwatch/home?region=us-east-1#dashboards:name=thechrisgrey

set -euo pipefail

REGION="us-east-1"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --region) REGION="$2"; shift 2 ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "==> Deploying CloudWatch dashboard 'thechrisgrey' to ${REGION}"

aws cloudwatch put-dashboard \
  --region "$REGION" \
  --dashboard-name "thechrisgrey" \
  --dashboard-body "file://${ROOT}/scripts/cloudwatch-dashboard.json"

echo "==> Dashboard deployed."
echo ""
echo "View at: https://console.aws.amazon.com/cloudwatch/home?region=${REGION}#dashboards:name=thechrisgrey"
echo ""
echo "Note: Deployment markers appear when scripts/deploy-lambda.sh runs."
echo "Run 'node scripts/mark-deployment.mjs frontend' to mark Amplify deploys."
