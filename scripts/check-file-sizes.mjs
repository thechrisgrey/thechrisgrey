#!/usr/bin/env node

/**
 * CI gate: flags tracked files that exceed size thresholds.
 *
 * Prevents accidentally committing oversized source files or binaries.
 * Run via `node scripts/check-file-sizes.mjs` in CI.
 *
 * Thresholds:
 *   - Source code (.ts, .tsx, .mjs, .js, .jsx, .css, .yml, .yaml): 500 KB
 *   - All other files (images, PDFs, 3D models, etc.): 10 MB
 */

import { execSync } from 'child_process';
import { statSync } from 'fs';

const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.mjs', '.js', '.jsx', '.css', '.yml', '.yaml', '.json', '.md']);
const SOURCE_LIMIT_KB = 500;
const BINARY_LIMIT_KB = 10 * 1024; // 10 MB

const files = execSync('git ls-files', { encoding: 'utf-8' })
  .trim()
  .split('\n')
  .filter((f) => f.length > 0);

const violations = [];

for (const file of files) {
  let size;
  try {
    size = statSync(file).size;
  } catch {
    continue;
  }

  const sizeKb = size / 1024;
  const ext = file.substring(file.lastIndexOf('.')).toLowerCase();
  const isSource = SOURCE_EXTENSIONS.has(ext);
  const limit = isSource ? SOURCE_LIMIT_KB : BINARY_LIMIT_KB;

  if (sizeKb > limit) {
    violations.push({
      file,
      sizeKb: Math.round(sizeKb),
      limitKb: limit,
      type: isSource ? 'source' : 'binary',
    });
  }
}

if (violations.length > 0) {
  console.error('=== File Size Check FAILED ===\n');
  for (const v of violations) {
    console.error(`  ${v.file} — ${v.sizeKb}KB exceeds ${v.limitKb}KB limit (${v.type})`);
  }
  console.error(`\n${violations.length} file(s) exceed size thresholds.`);
  console.error('Consider splitting large source files or using Git LFS for large binaries.');
  process.exit(1);
} else {
  console.log(`File size check passed: ${files.length} files checked, all within limits.`);
}
