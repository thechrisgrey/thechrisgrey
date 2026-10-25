/**
 * Account pin for this repo's Node scripts that shell out to the AWS CLI.
 * Mirrors scripts/lib/aws-preflight.sh: the site's home is Delta Centric
 * 512880383078 (profile personal-dev), but the original backend still exists in
 * Altivum 205930636302 under identical resource names, so the ambient
 * AWS_PROFILE is never used. THECHRISGREY_AWS_PROFILE defaults to personal-dev
 * and no other value is accepted.
 */
import { execFileSync } from 'node:child_process';

const DEFAULT_PROFILE = 'personal-dev';

// Podcast KB identifiers for the home account, from the Phase 2 table in
// docs/migration-execution-plan.md.
const HOMES = {
  'personal-dev': {
    account: '512880383078',
    podcastKbId: 'AFLBVXFPUZ',
    podcastDataSourceId: 'UG78ZHKEUN',
    podcastSourceBucket: 'thechrisgrey-kb-podcast-source-512880383078',
  },
};

/**
 * Resolve THECHRISGREY_AWS_PROFILE (default personal-dev), export it as
 * AWS_PROFILE for this process and every child `aws` call, and exit 1 unless the
 * live caller account is 512880383078. Returns that account's identifiers.
 */
export function pinAwsAccount() {
  const profile = process.env.THECHRISGREY_AWS_PROFILE || DEFAULT_PROFILE;
  const home = Object.hasOwn(HOMES, profile) ? HOMES[profile] : undefined;
  if (!home) {
    console.error(`AWS preflight: THECHRISGREY_AWS_PROFILE='${profile}' is not this repo's home.`);
    console.error('  This repo runs only as personal-dev (Delta Centric 512880383078); unset the variable to use it.');
    process.exit(1);
  }
  process.env.THECHRISGREY_AWS_PROFILE = profile;
  process.env.AWS_PROFILE = profile;
  let actual;
  try {
    actual = execFileSync('aws', ['sts', 'get-caller-identity', '--query', 'Account', '--output', 'text'], {
      encoding: 'utf8',
    }).trim();
  } catch {
    console.error(
      `AWS preflight: no working credentials for profile '${profile}'. Try: aws sso login --profile ${profile}`,
    );
    process.exit(1);
  }
  if (actual !== home.account) {
    console.error(
      `AWS preflight: profile '${profile}' resolved to account ${actual}, expected ${home.account}. Refusing to continue.`,
    );
    process.exit(1);
  }
  console.error(`AWS preflight: profile ${profile}, account ${actual}`);
  return { profile, ...home };
}
