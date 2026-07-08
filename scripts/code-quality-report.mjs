#!/usr/bin/env node

/**
 * Code quality report — complexity, file size, and tech-debt markers.
 *
 * Runs ESLint with the complexity rule (non-blocking), counts TODO/FIXME
 * comments, and flags oversized files. Outputs a structured report to stdout
 * and optionally writes JSON to a file for CI artifact upload.
 *
 * Usage:
 *   node scripts/code-quality-report.mjs [--json <path>]
 */

import { execSync } from 'child_process';
import { readFileSync, readdirSync, statSync, writeFileSync } from 'fs';
import { join, extname, relative } from 'path';

const ROOT = process.cwd();
const COMPLEXITY_THRESHOLD = 15;
const FILE_SIZE_LIMIT_KB = 500;
const MAX_LINES = 500;

const LINT_TARGETS = [
  { label: 'Frontend (src/)', pattern: 'src' },
  { label: 'Lambdas (lambda/)', pattern: 'lambda' },
];

function runEslintComplexity(target) {
  try {
    const output = execSync(
      `npx eslint ${target} --rule 'complexity: ["warn", ${COMPLEXITY_THRESHOLD}]' --format json --no-error-on-unmatched-pattern 2>/dev/null`,
      { encoding: 'utf-8', cwd: ROOT, timeout: 60000, stdio: ['pipe', 'pipe', 'pipe'] },
    );
    const results = JSON.parse(output);
    const violations = [];
    for (const file of results) {
      for (const msg of file.messages) {
        if (msg.ruleId === 'complexity') {
          violations.push({
            file: relative(ROOT, file.filePath),
            line: msg.line,
            column: msg.column,
            message: msg.message,
          });
        }
      }
    }
    return violations;
  } catch {
    return [];
  }
}

function countTodoFixme(dir) {
  const results = { todo: 0, fixme: 0, items: [] };
  function walk(d) {
    let entries;
    try {
      entries = readdirSync(d);
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = join(d, entry);
      if (
        entry === 'node_modules' ||
        entry === '.git' ||
        entry === 'dist' ||
        entry === 'coverage' ||
        entry === 'test-results'
      )
        continue;
      let st;
      try {
        st = statSync(full);
      } catch {
        continue;
      }
      if (st.isDirectory()) {
        walk(full);
      } else if (st.isFile()) {
        const ext = extname(entry);
        if (!['.ts', '.tsx', '.mjs', '.js', '.jsx'].includes(ext)) continue;
        let content;
        try {
          content = readFileSync(full, 'utf-8');
        } catch {
          continue;
        }
        const lines = content.split('\n');
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          const todoMatch = line.match(/^\s*(\/\/|\/\*|\*)\s*TODO\b/i);
          const fixmeMatch = line.match(/^\s*(\/\/|\/\*|\*)\s*FIXME\b/i);
          if (fixmeMatch) {
            results.fixme++;
            results.items.push({
              file: relative(ROOT, full),
              line: i + 1,
              type: 'FIXME',
              text: line.trim().slice(0, 120),
            });
          } else if (todoMatch) {
            results.todo++;
            results.items.push({
              file: relative(ROOT, full),
              line: i + 1,
              type: 'TODO',
              text: line.trim().slice(0, 120),
            });
          }
        }
      }
    }
  }
  walk(dir);
  return results;
}

function findLargeFiles(dir) {
  const results = [];
  function walk(d) {
    let entries;
    try {
      entries = readdirSync(d);
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = join(d, entry);
      if (
        entry === 'node_modules' ||
        entry === '.git' ||
        entry === 'dist' ||
        entry === 'coverage' ||
        entry === 'test-results'
      )
        continue;
      let st;
      try {
        st = statSync(full);
      } catch {
        continue;
      }
      if (st.isDirectory()) {
        walk(full);
      } else if (st.isFile()) {
        const ext = extname(entry);
        if (!['.ts', '.tsx', '.mjs', '.js', '.jsx'].includes(ext)) continue;
        const sizeKb = st.size / 1024;
        let lineCount;
        try {
          lineCount = readFileSync(full, 'utf-8').split('\n').length;
        } catch {
          continue;
        }
        if (sizeKb > FILE_SIZE_LIMIT_KB || lineCount > MAX_LINES) {
          results.push({
            file: relative(ROOT, full),
            sizeKb: Math.round(sizeKb),
            lines: lineCount,
            reasons: [
              ...(sizeKb > FILE_SIZE_LIMIT_KB ? [`size ${Math.round(sizeKb)}KB > ${FILE_SIZE_LIMIT_KB}KB`] : []),
              ...(lineCount > MAX_LINES ? [`lines ${lineCount} > ${MAX_LINES}`] : []),
            ],
          });
        }
      }
    }
  }
  walk(dir);
  return results;
}

console.log('=== Code Quality Report ===\n');

const report = {
  generatedAt: new Date().toISOString(),
  complexityThreshold: COMPLEXITY_THRESHOLD,
  complexityViolations: [],
  techDebt: { todo: 0, fixme: 0, items: [] },
  largeFiles: [],
};

for (const target of LINT_TARGETS) {
  const violations = runEslintComplexity(target.pattern);
  if (violations.length > 0) {
    console.log(`--- Complexity Violations: ${target.label} ---`);
    for (const v of violations) {
      console.log(`  ${v.file}:${v.line}:${v.column} - ${v.message}`);
    }
    console.log(`  Total: ${violations.length} violations (threshold: ${COMPLEXITY_THRESHOLD})\n`);
  } else {
    console.log(`--- Complexity: ${target.label} - No violations ---\n`);
  }
  report.complexityViolations.push(...violations);
}

const dirs = ['src', 'lambda', 'scripts'];
for (const dir of dirs) {
  const todos = countTodoFixme(join(ROOT, dir));
  report.techDebt.todo += todos.todo;
  report.techDebt.fixme += todos.fixme;
  report.techDebt.items.push(...todos.items);
}

console.log(`--- Tech Debt Markers ---`);
console.log(`  TODO: ${report.techDebt.todo}`);
console.log(`  FIXME: ${report.techDebt.fixme}`);
if (report.techDebt.items.length > 0 && report.techDebt.items.length <= 20) {
  for (const item of report.techDebt.items) {
    console.log(`  [${item.type}] ${item.file}:${item.line} - ${item.text}`);
  }
} else if (report.techDebt.items.length > 20) {
  for (const item of report.techDebt.items.slice(0, 20)) {
    console.log(`  [${item.type}] ${item.file}:${item.line} - ${item.text}`);
  }
  console.log(`  ... and ${report.techDebt.items.length - 20} more`);
}
console.log();

for (const dir of dirs) {
  const large = findLargeFiles(join(ROOT, dir));
  report.largeFiles.push(...large);
}

console.log(`--- Large Files ---`);
if (report.largeFiles.length === 0) {
  console.log(`  No files exceed ${FILE_SIZE_LIMIT_KB}KB or ${MAX_LINES} lines`);
} else {
  for (const f of report.largeFiles) {
    console.log(`  ${f.file} - ${f.reasons.join(', ')}`);
  }
}
console.log();

console.log('=== Summary ===');
console.log(`  Complexity violations: ${report.complexityViolations.length}`);
console.log(`  TODO markers: ${report.techDebt.todo}`);
console.log(`  FIXME markers: ${report.techDebt.fixme}`);
console.log(`  Large files: ${report.largeFiles.length}`);

const jsonIdx = process.argv.indexOf('--json');
if (jsonIdx !== -1 && process.argv[jsonIdx + 1]) {
  const outPath = process.argv[jsonIdx + 1];
  writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log(`\nReport written to ${outPath}`);
}
