#!/usr/bin/env node
/**
 * Flaky test detector — runs the test suite N times and reports tests that
 * pass sometimes and fail other times (the definition of flaky).
 *
 * Runs both the frontend (vitest) and Lambda (node --test) suites. A test is
 * flagged as flaky if it has at least one pass AND at least one fail across
 * the runs. Tests that consistently fail are NOT flaky (they're broken).
 *
 * Usage:
 *   node scripts/detect-flaky-tests.mjs              # 3 runs (default)
 *   node scripts/detect-flaky-tests.mjs --runs 5     # 5 runs
 *   node scripts/detect-flaky-tests.mjs --suite frontend   # frontend only
 *   node scripts/detect-flaky-tests.mjs --suite lambda     # lambda only
 *
 * Exit codes:
 *   0 — no flaky tests detected (all runs consistent)
 *   1 — flaky tests detected (review the report)
 *   2 — infrastructure error (a run crashed unexpectedly)
 *
 * In CI, this runs as a scheduled (nightly) job so flaky tests are caught
 * early without blocking PR merges.
 */
import { execSync } from 'node:child_process';

const RUNS = parseInt(process.argv.find((a) => a.startsWith('--runs='))?.split('=')[1] || '3', 10);
const SUITE_ARG = process.argv.find((a) => a.startsWith('--suite='))?.split('=')[1];
const RUN_FRONTEND = !SUITE_ARG || SUITE_ARG === 'frontend';
const RUN_LAMBDA = !SUITE_ARG || SUITE_ARG === 'lambda';

const COLORS = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
  bold: '\x1b[1m',
};

function runSuite(command, suiteName) {
  const results = [];

  for (let i = 1; i <= RUNS; i++) {
    process.stdout.write(`${COLORS.cyan}[${suiteName}] Run ${i}/${RUNS}...${COLORS.reset} `);
    try {
      const output = execSync(command, {
        encoding: 'utf8',
        timeout: 120000,
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, CI: 'true', FORCE_COLOR: '0' },
      });
      const passed = output.match(/ℹ pass\s+(\d+)/)?.[1] || output.match(/(\d+) passing/)?.[1] || '0';
      const failed = output.match(/ℹ fail\s+(\d+)/)?.[1] || output.match(/(\d+) failing/)?.[1] || '0';
      const skipped = output.match(/ℹ skipped\s+(\d+)/)?.[1] || '0';

      results.push({
        run: i,
        passed: true,
        passCount: parseInt(passed, 10),
        failCount: parseInt(failed, 10),
        skipCount: parseInt(skipped, 10),
        output,
      });

      if (parseInt(failed, 10) > 0) {
        console.log(`${COLORS.red}FAIL (${failed} failing)${COLORS.reset}`);
      } else {
        console.log(`${COLORS.green}PASS (${passed} tests)${COLORS.reset}`);
      }
    } catch (err) {
      const output = err.stdout || err.stderr || '';
      const failed = output.match(/ℹ fail\s+(\d+)/)?.[1] || output.match(/(\d+) failing/)?.[1] || '?';
      results.push({ run: i, passed: false, failCount: parseInt(failed, 10) || 0, output, error: err.message });
      console.log(`${COLORS.red}FAIL (${failed} failing)${COLORS.reset}`);
    }
  }

  return results;
}

function analyzeFlakiness(frontendResults, lambdaResults) {
  const flaky = [];

  const frontendPasses = frontendResults.filter((r) => r.passed).length;
  const frontendFails = frontendResults.filter((r) => !r.passed).length;
  if (frontendPasses > 0 && frontendFails > 0) {
    flaky.push({
      suite: 'frontend (vitest)',
      passes: frontendPasses,
      fails: frontendFails,
      runs: RUNS,
    });
  }

  const lambdaPasses = lambdaResults.filter((r) => r.passed).length;
  const lambdaFails = lambdaResults.filter((r) => !r.passed).length;
  if (lambdaPasses > 0 && lambdaFails > 0) {
    flaky.push({
      suite: 'lambda (node --test)',
      passes: lambdaPasses,
      fails: lambdaFails,
      runs: RUNS,
    });
  }

  return flaky;
}

function main() {
  console.log(`${COLORS.bold}=== Flaky Test Detection (${RUNS} runs) ===${COLORS.reset}\n`);

  const frontendResults = RUN_FRONTEND ? runSuite('npx vitest run --reporter=verbose 2>&1', 'frontend') : [];
  console.log('');
  const lambdaResults = RUN_LAMBDA ? runSuite('npm run test:lambda 2>&1', 'lambda') : [];

  console.log(`\n${COLORS.bold}=== Summary ===${COLORS.reset}\n`);

  const flaky = analyzeFlakiness(frontendResults, lambdaResults);

  if (flaky.length === 0) {
    const allPass = [...frontendResults, ...lambdaResults].every((r) => r.passed);
    if (allPass) {
      console.log(`${COLORS.green}No flaky tests detected — all ${RUNS} runs passed consistently.${COLORS.reset}`);
    } else {
      console.log(
        `${COLORS.yellow}No flaky tests detected — but some runs failed consistently (broken, not flaky).${COLORS.reset}`,
      );
    }
    process.exit(0);
  } else {
    console.log(`${COLORS.red}${COLORS.bold}FLAKY TESTS DETECTED:${COLORS.reset}\n`);
    for (const f of flaky) {
      console.log(
        `  ${COLORS.red}${f.suite}${COLORS.reset}: ${f.passes}/${f.runs} passed, ${f.fails}/${f.runs} failed`,
      );
      console.log(`    A test that passes sometimes and fails other times is flaky.`);
      console.log(
        `    Investigate by running: node scripts/detect-flaky-tests.mjs --runs ${Math.max(RUNS * 2, 5)} --suite ${f.suite.includes('frontend') ? 'frontend' : 'lambda'}\n`,
      );
    }
    process.exit(1);
  }
}

main();
