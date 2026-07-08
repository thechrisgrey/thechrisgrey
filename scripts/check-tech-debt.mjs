#!/usr/bin/env node

/**
 * CI gate: enforces that TODO/FIXME comments link to an issue.
 *
 * Scans source files for TODO and FIXME markers. Each marker must include
 * an issue reference in one of these formats:
 *   TODO(#123)          — GitHub issue number
 *   TODO(PROJ-123)      — Jira-style ticket
 *   FIXME(#456)         — same rules apply to FIXME
 *
 * Markers without an issue reference fail the check. This prevents
 * untracked tech debt from accumulating — every deferred item must
 * have a corresponding issue so it can be prioritized and followed up.
 *
 * Run via `node scripts/check-tech-debt.mjs` in CI.
 */

import { readdirSync, readFileSync, statSync } from 'fs';
import { join, extname, relative } from 'path';

const ROOT = process.cwd();
const SCAN_DIRS = ['src', 'lambda', 'scripts'];
const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'coverage',
  'test-results',
  '__fixtures__',
  'cypress',
  '.claude',
]);
const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.mjs', '.js', '.jsx']);

// Matches TODO or FIXME at the start of a comment line.
const MARKER_RE = /^\s*(\/\/|\/\*|\*)\s*(TODO|FIXME)\b/i;
// Matches an issue reference: (#123) or (PROJ-123) or [PROJ-123] etc.
const ISSUE_REF_RE = /\(?\s*#?\d+\s*\)?|\(?\s*[A-Z][A-Z0-9_]+-\d+\s*\)?/i;

const violations = [];
let totalMarkers = 0;

function scanDir(dir) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }

  for (const entry of entries) {
    if (SKIP_DIRS.has(entry)) continue;

    const full = join(dir, entry);
    let st;
    try {
      st = statSync(full);
    } catch {
      continue;
    }

    if (st.isDirectory()) {
      scanDir(full);
    } else if (st.isFile() && SOURCE_EXTENSIONS.has(extname(entry).toLowerCase())) {
      if (full === join(ROOT, 'scripts', 'check-tech-debt.mjs')) continue;
      scanFile(full);
    }
  }
}

function scanFile(file) {
  let content;
  try {
    content = readFileSync(file, 'utf-8');
  } catch {
    return;
  }

  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const markerMatch = line.match(MARKER_RE);
    if (!markerMatch) continue;

    totalMarkers++;
    const markerType = markerMatch[2].toUpperCase();

    // Check for an issue reference on the same line or the next line.
    const hasIssueRef = ISSUE_REF_RE.test(line) || (i + 1 < lines.length && ISSUE_REF_RE.test(lines[i + 1]));

    if (!hasIssueRef) {
      violations.push({
        file: relative(ROOT, file),
        line: i + 1,
        type: markerType,
        text: line.trim().slice(0, 120),
      });
    }
  }
}

for (const dir of SCAN_DIRS) {
  scanDir(join(ROOT, dir));
}

if (violations.length > 0) {
  console.error('=== Tech Debt Check FAILED ===\n');
  console.error(`${violations.length} TODO/FIXME marker(s) without issue reference:\n`);
  for (const v of violations) {
    console.error(`  ${v.file}:${v.line} [${v.type}] — ${v.text}`);
    console.error(`    Add an issue reference, e.g. ${v.type}(#123) or ${v.type}(PROJ-123)\n`);
  }
  console.error(`Total TODO/FIXME markers: ${totalMarkers}`);
  console.error(`Markers with issue references: ${totalMarkers - violations.length}`);
  console.error(`Markers without issue references: ${violations.length}`);
  process.exit(1);
} else {
  console.log(`Tech debt check passed: ${totalMarkers} TODO/FIXME marker(s) found, all have issue references.`);
}
