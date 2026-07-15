#!/usr/bin/env node

/**
 * Changelog generator.
 *
 * Parses conventional commits from git log and generates a structured
 * CHANGELOG.md entry. Designed to run locally for preview or in CI when
 * a version tag is pushed.
 *
 * Conventional commit format:
 *   type(scope): description
 *
 * Supported types: feat, fix, docs, style, refactor, perf, test, chore, ci, build, security
 *
 * Usage:
 *   node scripts/generate-changelog.mjs                    # preview unreleased changes to stdout
 *   node scripts/generate-changelog.mjs --write            # update CHANGELOG.md in place
 *   node scripts/generate-changelog.mjs --from v1.0.0      # generate from a specific tag
 *   node scripts/generate-changelog.mjs --version 1.1.0    # specify version for the entry
 *
 * In CI, this script runs on tag push (v*.*.*) and commits the updated
 * CHANGELOG.md back to main, then creates a GitHub Release.
 */

import { execSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync } from 'fs';

const CHANGELOG_PATH = new URL('../CHANGELOG.md', import.meta.url).pathname;

const COMMIT_TYPES = {
  feat: { title: 'Features', priority: 1 },
  fix: { title: 'Bug Fixes', priority: 2 },
  perf: { title: 'Performance Improvements', priority: 3 },
  refactor: { title: 'Code Refactoring', priority: 4 },
  security: { title: 'Security', priority: 5 },
  docs: { title: 'Documentation', priority: 6 },
  test: { title: 'Tests', priority: 7 },
  ci: { title: 'CI/CD', priority: 8 },
  build: { title: 'Build System', priority: 9 },
  chore: { title: 'Chores & Maintenance', priority: 10 },
  style: { title: 'Code Style', priority: 11 },
};

const CONVENTIONAL_REGEX = /^(\w+)(?:\(([^)]+)\))?:\s*(.+)$/;

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {
    write: args.includes('--write'),
    from: null,
    version: null,
    help: args.includes('--help') || args.includes('-h'),
  };
  const fromIdx = args.indexOf('--from');
  if (fromIdx !== -1 && args[fromIdx + 1]) opts.from = args[fromIdx + 1];
  const verIdx = args.indexOf('--version');
  if (verIdx !== -1 && args[verIdx + 1]) opts.version = args[verIdx + 1];
  return opts;
}

function getLatestTag() {
  try {
    return execSync('git describe --tags --abbrev=0 2>/dev/null', { encoding: 'utf-8' }).trim();
  } catch {
    return null;
  }
}

function getCommits(fromRef) {
  const range = fromRef ? `${fromRef}..HEAD` : 'HEAD';
  const format = '%H%x1f%s%x1f%an%x1f%ad';
  const output = execSync(`git log ${range} --format='${format}' --date=short --no-merges`, {
    encoding: 'utf-8',
  }).trim();

  if (!output) return [];

  return output.split('\n').map((line) => {
    const [hash, subject, author, date] = line.split('\x1f');
    return { hash: hash.slice(0, 7), subject, author, date };
  });
}

function parseConventionalCommit(subject) {
  const match = subject.match(CONVENTIONAL_REGEX);
  if (!match) return null;
  const [, type, scope, description] = match;
  return { type: type.toLowerCase(), scope, description };
}

function groupCommits(commits) {
  const groups = {};
  const uncategorized = [];

  for (const commit of commits) {
    const parsed = parseConventionalCommit(commit.subject);
    if (!parsed) {
      uncategorized.push({ ...commit, parsed: null });
      continue;
    }
    if (!COMMIT_TYPES[parsed.type]) {
      uncategorized.push({ ...commit, parsed });
      continue;
    }
    if (!groups[parsed.type]) groups[parsed.type] = [];
    groups[parsed.type].push({ ...commit, parsed });
  }

  return { groups, uncategorized };
}

function formatEntry(version, date, commits) {
  const { groups, uncategorized } = groupCommits(commits);
  const lines = [`## [${version}] - ${date}`, ''];

  const sortedTypes = Object.keys(groups).sort((a, b) => COMMIT_TYPES[a].priority - COMMIT_TYPES[b].priority);

  for (const type of sortedTypes) {
    const config = COMMIT_TYPES[type];
    lines.push(`### ${config.title}`);
    lines.push('');
    for (const commit of groups[type]) {
      const scope = commit.parsed.scope ? `**${commit.parsed.scope}**: ` : '';
      lines.push(`- ${scope}${commit.parsed.description} (${commit.hash})`);
    }
    lines.push('');
  }

  if (uncategorized.length > 0) {
    lines.push('### Other Changes');
    lines.push('');
    for (const commit of uncategorized) {
      lines.push(`- ${commit.subject} (${commit.hash})`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

function readExistingChangelog() {
  if (!existsSync(CHANGELOG_PATH)) return '';
  return readFileSync(CHANGELOG_PATH, 'utf-8');
}

function updateChangelog(newEntry) {
  const existing = readExistingChangelog();
  const header =
    '# Changelog\n\nAll notable changes to this project are documented in this file.\n\nThe format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),\nand this project adheres to [Conventional Commits](https://conventionalcommits.org/).\n\n';

  if (!existing) {
    writeFileSync(CHANGELOG_PATH, header + newEntry + '\n');
    return;
  }

  // Find where existing entries start (after the header)
  const entryStart = existing.indexOf('## [');
  if (entryStart === -1) {
    // No existing entries, append after header
    const headerEnd = existing.indexOf(
      '\n\n',
      existing.indexOf('conventional') !== -1 ? existing.indexOf('conventional') : 0,
    );
    if (headerEnd === -1) {
      writeFileSync(CHANGELOG_PATH, header + newEntry + '\n');
    } else {
      writeFileSync(CHANGELOG_PATH, existing + '\n' + newEntry + '\n');
    }
  } else {
    // Insert new entry before existing entries
    const before = existing.slice(0, entryStart);
    const after = existing.slice(entryStart);
    writeFileSync(CHANGELOG_PATH, before + newEntry + '\n' + after);
  }
}

function getVersionFromTags() {
  const tag = getLatestTag();
  if (!tag) return 'Unreleased';
  // Strip leading 'v' from tag
  return tag.startsWith('v') ? tag.slice(1) : tag;
}

// ── Main ────────────────────────────────────────────────────────────────────

const opts = parseArgs();

if (opts.help) {
  console.log(`Usage: node scripts/generate-changelog.mjs [options]

Options:
  --write            Update CHANGELOG.md in place (default: preview to stdout)
  --from <ref>       Generate changelog from a specific git ref (tag/commit)
  --version <ver>    Version label for the entry (default: derived from latest tag or "Unreleased")
  -h, --help         Show this help message
`);
  process.exit(0);
}

const fromRef = opts.from || getLatestTag();
const commits = getCommits(fromRef);

if (commits.length === 0) {
  console.log('No commits found to generate changelog from.');
  process.exit(0);
}

const version = opts.version || getVersionFromTags();
const date = new Date().toISOString().slice(0, 10);
const entry = formatEntry(version, date, commits);

if (opts.write) {
  updateChangelog(entry);
  console.log(`CHANGELOG.md updated with ${commits.length} commits for version ${version}.`);
} else {
  console.log(entry);
}
