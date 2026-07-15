#!/usr/bin/env node

// Dead feature flag detection.
//
// Parses src/utils/featureFlags.ts to extract all defined flag keys, then
// searches the codebase for references to each flag. Flags that are defined
// but never referenced outside the definition file and tests are reported as
// dead flags. Flag keys referenced in code but not defined are reported as
// orphaned references.
//
// Usage:
//   node scripts/check-dead-feature-flags.mjs
//
// Exit codes:
//   0 - all flags are used, no orphaned references
//   1 - dead flags found (defined but never used)
//
// The flag lifecycle is documented in AGENTS.md. When a feature is fully
// launched and the flag is no longer needed, remove the flag definition from
// featureFlags.ts and remove all references. Run this script to verify the
// cleanup is complete.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const FLAGS_FILE = join(ROOT, 'src', 'utils', 'featureFlags.ts');
const EXCLUDE_FILES = [
  join(ROOT, 'src', 'utils', 'featureFlags.ts'),
  join(ROOT, 'src', 'utils', 'featureFlags.test.ts'),
  join(ROOT, 'src', 'hooks', 'useFeatureFlag.test.ts'),
];
const EXCLUDE_PATTERNS = [/\.test\.(ts|tsx)$/, /\.d\.ts$/];
const SOURCE_EXTENSIONS = ['.ts', '.tsx'];

// Extract flag keys from the FLAGS object in featureFlags.ts
function extractFlagKeys(filePath) {
  const content = readFileSync(filePath, 'utf-8');
  const keys = new Set();

  // Match lines like:  flagName: {
  // within the FLAGS = { ... } block
  const flagsBlockMatch = content.match(/const\s+FLAGS\s*=\s*\{([\s\S]*?)\}\s*satisfies/);
  if (!flagsBlockMatch) {
    console.error('Could not find FLAGS object in featureFlags.ts');
    process.exit(1);
  }

  const block = flagsBlockMatch[1];
  // Each flag definition starts with:  keyName: {
  const flagRegex = /^\s*(\w+)\s*:\s*\{/gm;
  let match;
  while ((match = flagRegex.exec(block)) !== null) {
    keys.add(match[1]);
  }

  return keys;
}

// Recursively collect all source files
function collectSourceFiles(dir, files = []) {
  const entries = readdirSync(dir);
  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      // Skip node_modules, __tests__, dist
      if (entry === 'node_modules' || entry === '__tests__' || entry === 'dist') continue;
      collectSourceFiles(fullPath, files);
    } else if (SOURCE_EXTENSIONS.includes(extname(fullPath))) {
      if (EXCLUDE_PATTERNS.some((p) => p.test(fullPath))) continue;
      if (EXCLUDE_FILES.includes(fullPath)) continue;
      files.push(fullPath);
    }
  }
  return files;
}

// Search for references to a flag key in source files
function findFlagReferences(flagKey, files) {
  const references = [];
  // Match the flag key as a string literal: 'flagKey' or "flagKey"
  const patterns = [new RegExp(`['"]${flagKey}['"]`, 'g')];

  for (const file of files) {
    const content = readFileSync(file, 'utf-8');
    for (const pattern of patterns) {
      pattern.lastIndex = 0;
      if (pattern.test(content)) {
        references.push(relative(ROOT, file));
        break; // one reference per file is enough
      }
    }
  }
  return references;
}

// Main
console.log('Checking for dead feature flags...\n');

const flagKeys = extractFlagKeys(FLAGS_FILE);
const sourceFiles = collectSourceFiles(join(ROOT, 'src'));

// Also include .env.example in the search
const envExamplePath = join(ROOT, '.env.example');
let allFiles = [...sourceFiles];
try {
  readFileSync(envExamplePath, 'utf-8');
  allFiles.push(envExamplePath);
} catch {
  // .env.example might not exist
}

console.log(`Found ${flagKeys.size} flag definitions: ${[...flagKeys].join(', ')}`);
console.log(`Searching ${sourceFiles.length} source files + .env.example\n`);

let deadFlags = 0;
let orphanedRefs = 0;

console.log('─'.repeat(60));

for (const flagKey of flagKeys) {
  const refs = findFlagReferences(flagKey, allFiles);
  const status = refs.length > 0 ? 'USED' : 'DEAD';
  const icon = refs.length > 0 ? '[OK]' : '[DEAD]';

  console.log(`${icon} ${flagKey.padEnd(20)} ${status} (${refs.length} ref${refs.length !== 1 ? 's' : ''})`);
  if (refs.length > 0) {
    for (const ref of refs.slice(0, 5)) {
      console.log(`       -> ${ref}`);
    }
    if (refs.length > 5) {
      console.log(`       ... and ${refs.length - 5} more`);
    }
  } else {
    deadFlags++;
    console.log(`       No references found outside definition and tests.`);
  }
}

// Check for orphaned references (flag keys used in code but not defined)
// Look for string literals that look like flag keys in isFeatureEnabled/getFeatureFlag calls
console.log('\n' + '─'.repeat(60));
console.log('Checking for orphaned flag references...\n');

const allContent = sourceFiles.map((f) => readFileSync(f, 'utf-8'));

// Find all isFeatureEnabled('...') / getFeatureFlag('...') / useFeatureFlag('...') calls
const usagePattern =
  /(?:isFeatureEnabled|getFeatureFlag|useFeatureFlag|useIsFeatureEnabled|setFeatureFlagOverride)\s*\(\s*['"](\w+)['"]/g;
const usedKeys = new Set();
for (const content of allContent) {
  let match;
  usagePattern.lastIndex = 0;
  while ((match = usagePattern.exec(content)) !== null) {
    usedKeys.add(match[1]);
  }
}

for (const usedKey of usedKeys) {
  if (!flagKeys.has(usedKey)) {
    orphanedRefs++;
    console.log(`[ORPHAN] '${usedKey}' is used in code but not defined in FLAGS`);
  }
}

if (orphanedRefs === 0) {
  console.log('[OK] No orphaned flag references found.');
}

// Summary
console.log('\n' + '─'.repeat(60));
console.log(`\nSummary: ${flagKeys.size} flags, ${deadFlags} dead, ${orphanedRefs} orphaned\n`);

if (deadFlags > 0) {
  console.log('FAIL: Dead feature flags detected.');
  console.log('Either remove the flag definition from src/utils/featureFlags.ts');
  console.log('or add usage in the codebase. See AGENTS.md for the flag lifecycle.\n');
  process.exit(1);
}

console.log('All feature flags are in use. No dead or orphaned flags detected.\n');
process.exit(0);
