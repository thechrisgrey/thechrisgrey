#!/usr/bin/env node

/**
 * Upload source maps to S3 for CloudWatch RUM stack trace unminification.
 *
 * After the Vite build generates hidden sourcemaps in dist/, this script
 * uploads all .map files to S3 at s3://BUCKET/RELEASE_ID/*.map. The RUM
 * service retrieves them to unminify JavaScript error stack traces.
 *
 * Usage:
 *   node scripts/upload-sourcemaps.mjs
 *
 * Required env vars:
 *   AWS_COMMIT_ID (or git available) — used as the release ID
 *   RUM_SOURCEMAPS_BUCKET — S3 bucket name (defaults to thechrisgrey-rum-sourcemaps)
 *
 * Runs automatically as part of the Amplify build pipeline (amplify.yml).
 * Skips gracefully if the bucket is not configured or AWS credentials are absent.
 */

import { execSync } from 'child_process';
import { existsSync, readdirSync } from 'fs';
import { join } from 'path';

const DIST_DIR = join(process.cwd(), 'dist');
const BUCKET = process.env.RUM_SOURCEMAPS_BUCKET || 'thechrisgrey-rum-sourcemaps';

function getReleaseId() {
  if (process.env.AWS_COMMIT_ID) return process.env.AWS_COMMIT_ID.substring(0, 12);
  try {
    return execSync('git rev-parse --short HEAD').toString().trim();
  } catch {
    return null;
  }
}

function findMapFiles(dir) {
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...findMapFiles(full));
    } else if (entry.name.endsWith('.map')) {
      files.push(full);
    }
  }
  return files;
}

const releaseId = getReleaseId();

if (!releaseId) {
  console.log('[sourcemaps] No release ID available (no AWS_COMMIT_ID or git); skipping upload.');
  process.exit(0);
}

if (!existsSync(DIST_DIR)) {
  console.log('[sourcemaps] dist/ not found; skipping upload.');
  process.exit(0);
}

const mapFiles = findMapFiles(DIST_DIR);

if (mapFiles.length === 0) {
  console.log('[sourcemaps] No .map files found in dist/; skipping upload.');
  process.exit(0);
}

console.log(`[sourcemaps] Uploading ${mapFiles.length} source map(s) to s3://${BUCKET}/${releaseId}/`);

try {
  execSync(
    `aws s3 cp dist/ s3://${BUCKET}/${releaseId}/ --recursive --exclude "*" --include "*.map" --only-show-errors`,
    { stdio: 'inherit', cwd: process.cwd() },
  );
  console.log(`[sourcemaps] Upload complete (release: ${releaseId}).`);
} catch (err) {
  console.warn(`[sourcemaps] Upload failed (non-blocking): ${err.message}`);
}
