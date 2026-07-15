#!/usr/bin/env node

/**
 * Build performance trend analyzer.
 *
 * Compares the current build performance report with the previous one
 * (downloaded from CI artifacts) and generates a markdown summary that
 * highlights regressions and improvements.
 *
 * Usage:
 *   node scripts/compare-build-performance.mjs --current report.json
 *   node scripts/compare-build-performance.mjs --current report.json --previous prev.json
 *   node scripts/compare-build-performance.mjs --current report.json --previous prev.json --summary
 *
 * In CI, the `--summary` flag writes the markdown to `$GITHUB_STEP_SUMMARY`
 * so it appears in the GitHub Actions run page. Without `--previous`, only
 * the current report is summarized (first run or no previous artifact).
 *
 * Independently of the previous run, each step is also checked against the
 * committed absolute budgets in `build-performance-budgets.json`. Previous-run
 * artifacts expire (90-day retention) and are absent on first run, so the
 * budgets provide a stable, committed performance target that always applies.
 * Over-budget steps (and a blown total budget) are reported and cause a
 * non-zero exit, alongside regressions.
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const REGRESSION_THRESHOLD = 0.2; // 20% slower than previous = regression
const IMPROVEMENT_THRESHOLD = 0.1; // 10% faster = improvement worth noting

const DEFAULT_BUDGETS_PATH = join(dirname(dirname(fileURLToPath(import.meta.url))), 'build-performance-budgets.json');

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { current: null, previous: null, summary: false, budgets: DEFAULT_BUDGETS_PATH };
  const curIdx = args.indexOf('--current');
  if (curIdx !== -1 && args[curIdx + 1]) opts.current = args[curIdx + 1];
  const prevIdx = args.indexOf('--previous');
  if (prevIdx !== -1 && args[prevIdx + 1]) opts.previous = args[prevIdx + 1];
  const budgetIdx = args.indexOf('--budgets');
  if (budgetIdx !== -1 && args[budgetIdx + 1]) opts.budgets = args[budgetIdx + 1];
  opts.summary = args.includes('--summary');
  return opts;
}

function readBudgets(path) {
  if (!path || !existsSync(path)) return null;
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf-8'));
    return {
      totalBudgetMs: typeof parsed.totalBudgetMs === 'number' ? parsed.totalBudgetMs : null,
      steps: parsed.steps && typeof parsed.steps === 'object' ? parsed.steps : {},
    };
  } catch {
    return null;
  }
}

function applyBudgets(comparison, current, budgets) {
  if (!budgets) {
    return { steps: comparison.steps, totalOverBudget: false, hasBudgets: false };
  }
  const steps = comparison.steps.map((s) => {
    const budgetMs = typeof budgets.steps[s.name] === 'number' ? budgets.steps[s.name] : null;
    const overBudget = budgetMs !== null && s.durationMs > budgetMs;
    return { ...s, budgetMs, overBudget };
  });
  const totalOverBudget = budgets.totalBudgetMs !== null && current.totalDurationMs > budgets.totalBudgetMs;
  return {
    steps,
    totalOverBudget,
    totalBudgetMs: budgets.totalBudgetMs,
    hasBudgets: true,
  };
}

function readReport(path) {
  if (!path || !existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf-8'));
  } catch {
    return null;
  }
}

function formatDuration(ms) {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatDelta(deltaMs, pctChange) {
  const sign = deltaMs > 0 ? '+' : '';
  const pctSign = pctChange > 0 ? '+' : '';
  return `${sign}${formatDuration(Math.abs(deltaMs))} (${pctSign}${pctChange.toFixed(1)}%)`;
}

function compareReports(current, previous) {
  if (!previous) {
    return {
      steps: current.steps.map((s) => ({ ...s, deltaMs: null, pctChange: null, status: 'new' })),
      totalDeltaMs: null,
      totalPctChange: null,
      hasPrevious: false,
    };
  }

  const prevSteps = new Map(previous.steps.map((s) => [s.name, s]));
  const steps = current.steps.map((s) => {
    const prev = prevSteps.get(s.name);
    if (!prev) return { ...s, deltaMs: null, pctChange: null, status: 'new' };
    const deltaMs = s.durationMs - prev.durationMs;
    const pctChange = prev.durationMs > 0 ? (deltaMs / prev.durationMs) * 100 : 0;
    let status = 'same';
    const ratio = deltaMs / prev.durationMs;
    if (ratio > REGRESSION_THRESHOLD) status = 'regression';
    else if (ratio < -IMPROVEMENT_THRESHOLD) status = 'improvement';
    return { ...s, deltaMs, pctChange, status };
  });

  const totalDeltaMs = current.totalDurationMs - previous.totalDurationMs;
  const totalPctChange = previous.totalDurationMs > 0 ? (totalDeltaMs / previous.totalDurationMs) * 100 : 0;

  return { steps, totalDeltaMs, totalPctChange, hasPrevious: true };
}

// Header block: total build time, optional total budget, vs-previous delta, meta.
function renderSummary(current, comparison, budgetResult) {
  const lines = [];
  const { totalDeltaMs, totalPctChange, hasPrevious } = comparison;

  lines.push('## Build Performance Report');
  lines.push('');
  lines.push(`**Total build time:** ${formatDuration(current.totalDurationMs)}`);

  if (budgetResult?.hasBudgets && typeof budgetResult.totalBudgetMs === 'number') {
    const totalEmoji = budgetResult.totalOverBudget ? 'x' : 'white_check_mark';
    lines.push(`**Total budget:** ${formatDuration(budgetResult.totalBudgetMs)} :${totalEmoji}:`);
  }

  if (hasPrevious) {
    const totalSign = totalDeltaMs > 0 ? '+' : '';
    const totalPctSign = totalPctChange > 0 ? '+' : '';
    const totalStatus =
      totalPctChange > REGRESSION_THRESHOLD * 100
        ? 'regression'
        : totalPctChange < -IMPROVEMENT_THRESHOLD * 100
          ? 'improvement'
          : 'same';

    const emoji =
      totalStatus === 'regression' ? 'warning' : totalStatus === 'improvement' ? 'rocket' : 'white_check_mark';
    lines.push(
      `**vs previous:** ${totalSign}${formatDuration(Math.abs(totalDeltaMs))} (${totalPctSign}${totalPctChange.toFixed(1)}%) :${emoji}:`,
    );
  } else {
    lines.push('*No previous build to compare (first run or artifact expired).*');
  }

  lines.push('');
  lines.push(
    `**Node:** ${current.nodeVersion} | **Steps:** ${current.successCount}/${current.stepCount} passed | **Date:** ${current.startTime}`,
  );
  return lines;
}

// One row of the per-step table (duration, budget, delta, status).
function renderStepRow(step, budgetSteps) {
  const duration = formatDuration(step.durationMs);
  const budgetStep = budgetSteps.get(step.name);
  let budget = '-';
  if (budgetStep && typeof budgetStep.budgetMs === 'number') {
    budget = `${formatDuration(budgetStep.budgetMs)}${budgetStep.overBudget ? ' (over)' : ''}`;
  }
  let delta = '-';
  let status = '';

  if (step.deltaMs !== null) {
    delta = formatDelta(step.deltaMs, step.pctChange);
    if (step.status === 'regression') status = 'regression';
    else if (step.status === 'improvement') status = 'improvement';
    else status = 'same';
  } else if (step.status === 'new') {
    status = 'new';
  }

  if (budgetStep?.overBudget) status = status ? `${status}, over-budget` : 'over-budget';
  if (!step.success) status = 'failed';

  return `| ${step.name} | ${duration} | ${budget} | ${delta} | ${status} |`;
}

// Trailing detail sections: over-budget, regressions, improvements.
function renderDetailSections(current, steps, budgetResult) {
  const lines = [];

  const overBudget = (budgetResult?.steps ?? []).filter((s) => s.overBudget);
  if (overBudget.length > 0 || budgetResult?.totalOverBudget) {
    lines.push('');
    lines.push(`### Over budget (${overBudget.length}${budgetResult?.totalOverBudget ? ' + total' : ''})`);
    if (budgetResult?.totalOverBudget) {
      lines.push(
        `- **total**: ${formatDuration(current.totalDurationMs)} exceeds budget ${formatDuration(budgetResult.totalBudgetMs)}`,
      );
    }
    for (const s of overBudget) {
      lines.push(`- **${s.name}**: ${formatDuration(s.durationMs)} exceeds budget ${formatDuration(s.budgetMs)}`);
    }
  }

  const regressions = steps.filter((s) => s.status === 'regression');
  if (regressions.length > 0) {
    lines.push('');
    lines.push(`### Regressions (${regressions.length})`);
    for (const r of regressions) {
      lines.push(`- **${r.name}**: ${formatDelta(r.deltaMs, r.pctChange)} slower than previous`);
    }
  }

  const improvements = steps.filter((s) => s.status === 'improvement');
  if (improvements.length > 0) {
    lines.push('');
    lines.push(`### Improvements (${improvements.length})`);
    for (const i of improvements) {
      lines.push(`- **${i.name}**: ${formatDelta(i.deltaMs, i.pctChange)} faster than previous`);
    }
  }

  return lines;
}

function generateMarkdown(current, comparison, budgetResult) {
  const { steps } = comparison;
  const budgetSteps = new Map((budgetResult?.steps ?? []).map((s) => [s.name, s]));

  const lines = [
    ...renderSummary(current, comparison, budgetResult),
    '',
    '| Step | Duration | Budget | Delta | Status |',
    '|------|----------|--------|-------|--------|',
    ...steps.map((step) => renderStepRow(step, budgetSteps)),
    ...renderDetailSections(current, steps, budgetResult),
    '',
    '---',
    '*Build performance is tracked via `scripts/track-build-performance.mjs`, compared against the previous CI run, and checked against the absolute budgets in `build-performance-budgets.json`. Vite persistent cache is configured in `.github/workflows/ci.yml`.*',
  ];

  return lines.join('\n');
}

// ── Main ────────────────────────────────────────────────────────────────────

const opts = parseArgs();

if (!opts.current) {
  console.error(
    'Usage: node scripts/compare-build-performance.mjs --current <report.json> [--previous <prev.json>] [--summary]',
  );
  process.exit(1);
}

const current = readReport(opts.current);
if (!current) {
  console.error(`Could not read current report: ${opts.current}`);
  process.exit(1);
}

const previous = readReport(opts.previous);
const comparison = compareReports(current, previous);
const budgets = readBudgets(opts.budgets);
const budgetResult = applyBudgets(comparison, current, budgets);
const markdown = generateMarkdown(current, comparison, budgetResult);

if (opts.summary && process.env.GITHUB_STEP_SUMMARY) {
  writeFileSync(process.env.GITHUB_STEP_SUMMARY, markdown + '\n');
  console.log('Summary written to $GITHUB_STEP_SUMMARY');
} else {
  console.log(markdown);
}

const regressions = comparison.steps.filter((s) => s.status === 'regression');
const overBudget = budgetResult.steps.filter((s) => s.overBudget);
const problems = [];
if (regressions.length > 0) problems.push(`${regressions.length} regression(s)`);
if (overBudget.length > 0) problems.push(`${overBudget.length} step(s) over budget`);
if (budgetResult.totalOverBudget) problems.push('total over budget');

if (problems.length > 0) {
  console.error(`\nBuild performance problems: ${problems.join(', ')}.`);
  process.exit(1);
}
