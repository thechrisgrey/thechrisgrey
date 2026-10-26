# shellcheck shell=bash
#
# Account pin for this repo's AWS shell scripts. Source this file, then call
# tcg_aws_preflight before the first AWS call (or tcg_aws_resolve for a dry run
# that makes no AWS call).
#
# Why: the site's home is Delta Centric 512880383078 (profile personal-dev, the
# 2026-09-03 migration target), but the original backend still exists in Altivum
# 205930636302 under identical resource names (thechrisgrey-<lambda>,
# thechrisgrey-site-alerts, ...). A script that follows the ambient credential
# chain acts on whichever account AWS_PROFILE happens to name in the caller's
# shell, so nothing here trusts it.
#
#   ./scripts/setup-alarms.sh     # runs as personal-dev, asserts 512880383078
#
# THECHRISGREY_AWS_PROFILE defaults to personal-dev, and no other value is
# accepted (altivum-og is refused). The profile is exported as AWS_PROFILE for
# this script and its children only, and the live caller account must be
# 512880383078. To allow another profile for that same account, add it to the
# case below.

TCG_DEFAULT_AWS_PROFILE='personal-dev'

tcg_aws_resolve() {
  local profile="${THECHRISGREY_AWS_PROFILE:-$TCG_DEFAULT_AWS_PROFILE}"
  case "$profile" in
    personal-dev) TCG_AWS_ACCOUNT=512880383078 ;;
    *)
      echo "AWS preflight: THECHRISGREY_AWS_PROFILE='$profile' is not this repo's home." >&2
      echo "  This repo runs only as personal-dev (Delta Centric 512880383078); unset the variable to use it." >&2
      exit 1
      ;;
  esac
  export THECHRISGREY_AWS_PROFILE="$profile" AWS_PROFILE="$profile" TCG_AWS_ACCOUNT
}

tcg_aws_preflight() {
  local actual
  tcg_aws_resolve
  if ! actual="$(command aws sts get-caller-identity --query Account --output text)"; then
    echo "AWS preflight: no working credentials for profile '$AWS_PROFILE'. Try: aws sso login --profile $AWS_PROFILE" >&2
    exit 1
  fi
  if [ "$actual" != "$TCG_AWS_ACCOUNT" ]; then
    echo "AWS preflight: profile '$AWS_PROFILE' resolved to account $actual, expected $TCG_AWS_ACCOUNT. Refusing to continue." >&2
    exit 1
  fi
  echo "AWS preflight: profile $AWS_PROFILE, account $actual" >&2
}
