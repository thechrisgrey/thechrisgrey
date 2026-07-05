/**
 * Validates that AGENTS.md stays consistent with the repository, so the
 * agent-facing instructions cannot silently rot as the code changes.
 *
 * Checks:
 *  1. Every `npm run <script>` (and `npm test`) referenced in AGENTS.md is a
 *     real script in package.json.
 *  2. Every inline-code file/dir path referenced in AGENTS.md is tracked in git
 *     (a link checker for the doc's references).
 *  3. The Node version documented in AGENTS.md matches .nvmrc.
 *
 * Run locally with `npm run validate:agents`; also runs in CI so a stale doc
 * fails the build. Exits non-zero (with an actionable report) on any drift.
 */
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (relPath) => readFileSync(join(repoRoot, relPath), 'utf8');

const agents = read('AGENTS.md');
const pkg = JSON.parse(read('package.json'));
const errors = [];

// 1. npm scripts referenced in the doc must exist in package.json.
const referencedScripts = new Set();
for (const match of agents.matchAll(/npm run ([a-z0-9:_-]+)/gi)) {
  referencedScripts.add(match[1]);
}
if (/\bnpm test\b/.test(agents)) referencedScripts.add('test');
const definedScripts = new Set(Object.keys(pkg.scripts ?? {}));
for (const name of [...referencedScripts].sort()) {
  if (!definedScripts.has(name)) {
    errors.push(`references \`npm run ${name}\` but package.json has no "${name}" script.`);
  }
}

// 2. Inline-code file/dir references must be tracked in git.
// Files legitimately documented but intentionally gitignored (developer-created).
const untrackedAllowlist = new Set(['.env', '.env.local']);
const trackedFiles = new Set(
  execSync('git ls-files', { cwd: repoRoot, encoding: 'utf8' })
    .split('\n')
    .filter(Boolean),
);
const trackedDirs = new Set();
for (const file of trackedFiles) {
  const parts = file.split('/');
  for (let i = 1; i < parts.length; i++) {
    trackedDirs.add(parts.slice(0, i).join('/') + '/');
  }
}

const knownExtension = /\.(ts|tsx|js|jsx|mjs|cjs|json|css|md|yml|yaml)$/;
const extensionOnly = /^\.(ts|tsx|js|jsx|mjs|cjs|json|css|md|yml|yaml)$/;
const forbidden = /[\s()<>'"@*=!?{},]/;
const dotfile = /^\.[\w.-]+$/;

const isPathLike = (token) => {
  // Leading-slash tokens are app routes / URLs (e.g. `/chat`), not repo paths.
  if (forbidden.test(token) || extensionOnly.test(token) || token.startsWith('/')) {
    return false;
  }
  return knownExtension.test(token) || token.endsWith('/') || dotfile.test(token);
};

// Strip fenced code blocks first: triple-backtick fences otherwise break
// inline-code pairing and pull in prose. Fenced examples (layout tree, command
// snippets) are descriptive; the authoritative references are inline.
const prose = agents.replace(/```[\s\S]*?```/g, '');
const inlineTokens = new Set();
for (const match of prose.matchAll(/`([^`]+)`/g)) inlineTokens.add(match[1].trim());

for (const token of [...inlineTokens].sort()) {
  if (!isPathLike(token) || untrackedAllowlist.has(token)) continue;
  const normalized = token.replace(/^\.\//, '');
  const exists = normalized.endsWith('/')
    ? trackedDirs.has(normalized)
    : trackedFiles.has(normalized);
  if (!exists) {
    errors.push(`references \`${token}\` which is not a tracked file/dir in git.`);
  }
}

// 3. Documented Node version must match .nvmrc.
const nvmrc = read('.nvmrc').trim();
if (!agents.includes(nvmrc)) {
  errors.push(`does not document the Node version pinned in .nvmrc ("${nvmrc}").`);
}

if (errors.length) {
  console.error('AGENTS.md validation FAILED:\n');
  for (const err of errors) console.error(`  - AGENTS.md ${err}`);
  console.error('\nUpdate AGENTS.md (or the code) so they agree, then re-run `npm run validate:agents`.');
  process.exit(1);
}

console.log('AGENTS.md validation passed: commands, file references, and Node version match the repo.');
