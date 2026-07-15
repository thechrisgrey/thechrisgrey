#!/usr/bin/env node

/**
 * Minimum dependency release age checker.
 *
 * Enforces a policy that dependency updates must target versions published at
 * least MIN_AGE_DAYS days ago. This mitigates supply chain attacks by ensuring
 * new releases have a cooling period before adoption.
 *
 * Runs in two modes:
 *   1. CI (GitHub Actions): compares package.json files between the PR base
 *      and head, queries the npm registry for each updated dependency's publish
 *      date, and fails if any target version is too new.
 *   2. Local: pass --from <ref> --to <ref> to check any revision range.
 *
 * Usage:
 *   node scripts/check-dependency-age.mjs                    # CI mode (uses GITHUB env)
 *   node scripts/check-dependency-age.mjs --from main --to HEAD
 *   node scripts/check-dependency-age.mjs --from main --to HEAD --min-age 14
 */

import { execSync } from 'child_process';

const MIN_AGE_DAYS = 7;
const NPM_REGISTRY = 'https://registry.npmjs.org';

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { from: null, to: 'HEAD', minAge: MIN_AGE_DAYS };
  const fromIdx = args.indexOf('--from');
  if (fromIdx !== -1 && args[fromIdx + 1]) opts.from = args[fromIdx + 1];
  const toIdx = args.indexOf('--to');
  if (toIdx !== -1 && args[toIdx + 1]) opts.to = args[toIdx + 1];
  const ageIdx = args.indexOf('--min-age');
  if (ageIdx !== -1 && args[ageIdx + 1]) opts.minAge = parseInt(args[ageIdx + 1], 10);
  return opts;
}

function getBaseRef() {
  if (process.env.GITHUB_BASE_REF) return `origin/${process.env.GITHUB_BASE_REF}`;
  return 'origin/main';
}

function getChangedPackageFiles(fromRef, toRef) {
  try {
    const output = execSync(`git diff --name-only ${fromRef}..${toRef}`, {
      encoding: 'utf-8',
    }).trim();
    if (!output) return [];
    return output.split('\n').filter((f) => f.endsWith('package.json') && !f.includes('node_modules'));
  } catch {
    return [];
  }
}

function parsePackageJson(filePath, ref) {
  try {
    const content = execSync(`git show ${ref}:${filePath}`, { encoding: 'utf-8' });
    return JSON.parse(content);
  } catch {
    return null;
  }
}

function getDependencyChanges(fromRef, toRef, changedFiles) {
  const changes = [];

  for (const file of changedFiles) {
    const fromPkg = parsePackageJson(file, fromRef);
    const toPkg = parsePackageJson(file, toRef);
    if (!fromPkg || !toPkg) continue;

    const depTypes = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'];

    for (const depType of depTypes) {
      const fromDeps = fromPkg[depType] || {};
      const toDeps = toPkg[depType] || {};

      for (const [name, newVersion] of Object.entries(toDeps)) {
        // Skip workspace-local packages (file: specifiers)
        if (newVersion.startsWith('file:')) continue;

        const oldVersion = fromDeps[name];
        if (!oldVersion || oldVersion === newVersion) continue;
        if (oldVersion.startsWith('file:')) continue;

        // Strip semver range operators to get the base version
        const cleanNew = newVersion.replace(/^[~^>=<]+/, '').split(' ')[0];
        const cleanOld = oldVersion.replace(/^[~^>=<]+/, '').split(' ')[0];

        if (cleanNew === cleanOld) continue;

        changes.push({
          file,
          depType,
          name,
          oldVersion,
          newVersion,
          cleanNew,
        });
      }
    }
  }

  return changes;
}

async function getPublishDate(packageName, version) {
  try {
    const url = `${NPM_REGISTRY}/${encodeURIComponent(packageName).replace('%40', '@')}`;
    const response = await fetch(url);
    if (!response.ok) return null;
    const data = await response.json();
    const time = data.time;
    if (!time || !time[version]) return null;
    return new Date(time[version]);
  } catch {
    return null;
  }
}

async function main() {
  const opts = parseArgs();
  const fromRef = opts.from || getBaseRef();

  console.log(`Checking dependency release ages (minimum: ${opts.minAge} days)`);
  console.log(`  Base: ${fromRef}`);
  console.log(`  Head: ${opts.to}`);
  console.log('');

  const changedFiles = getChangedPackageFiles(fromRef, opts.to);
  if (changedFiles.length === 0) {
    console.log('No package.json files changed. Skipping.');
    process.exit(0);
  }

  console.log(`Changed package files: ${changedFiles.join(', ')}`);
  console.log('');

  const changes = getDependencyChanges(fromRef, opts.to, changedFiles);
  if (changes.length === 0) {
    console.log('No dependency version changes detected.');
    process.exit(0);
  }

  const minAgeMs = opts.minAge * 24 * 60 * 60 * 1000;
  const now = Date.now();
  const violations = [];

  for (const change of changes) {
    const publishDate = await getPublishDate(change.name, change.cleanNew);
    if (!publishDate) {
      console.log(`  WARN  ${change.name}: could not determine publish date for ${change.cleanNew} (skipping)`);
      continue;
    }

    const ageMs = now - publishDate.getTime();
    const ageDays = Math.floor(ageMs / (24 * 60 * 60 * 1000));

    if (ageMs < minAgeMs) {
      console.log(
        `  FAIL  ${change.name}: ${change.oldVersion} -> ${change.newVersion} (published ${ageDays}d ago, need ${opts.minAge}d)`,
      );
      violations.push({ ...change, publishDate: publishDate.toISOString(), ageDays });
    } else {
      console.log(`  OK    ${change.name}: ${change.oldVersion} -> ${change.newVersion} (published ${ageDays}d ago)`);
    }
  }

  console.log('');

  if (violations.length > 0) {
    console.error(
      `\u2717 ${violations.length} dependency update(s) violate the ${opts.minAge}-day minimum release age policy.`,
    );
    console.error('  These updates should be held until the cooling period passes.');
    for (const v of violations) {
      console.error(`    - ${v.name} ${v.oldVersion} -> ${v.newVersion} in ${v.file} (published ${v.ageDays}d ago)`);
    }
    process.exit(1);
  }

  console.log(`\u2713 All dependency updates satisfy the ${opts.minAge}-day minimum release age policy.`);
  process.exit(0);
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
