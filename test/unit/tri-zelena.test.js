// Rule "3 zelena zaredom" (scripts/ci/tri-zelena.mjs): an attempt is green only
// when every chosen job succeeded, none was flaky, and after a re-run each chosen
// job ran in that very attempt.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hasFlaky, judgeAttempt, parseArgs } from '../../scripts/ci/tri-zelena.mjs';

const job = (name, conclusion = 'success', extra = {}) => ({ name, conclusion, run_attempt: 2, flaky: false, ...extra });
const whole = { pattern: '.*', attempt: 2, fresh: true, wholeRun: true };
const one = { pattern: '^app \\(2/3\\)$', attempt: 2, fresh: true, wholeRun: false };

test('every job green is green', () => {
  assert.deepEqual(judgeAttempt([job('changes'), job('app (1/3)'), job('ci-ok')], whole).problems, []);
});

test('a failed, cancelled or flaky job is red', () => {
  assert.equal(judgeAttempt([job('app (1/3)', 'failure'), job('ci-ok', 'failure')], whole).green, false);
  assert.equal(judgeAttempt([job('ui (behaviour)', 'cancelled')], whole).green, false);
  const flaky = judgeAttempt([job('app (1/3)', 'success', { flaky: true })], whole);
  assert.match(flaky.problems[0], /flaky/);
});

test('a path-filter skip is allowed only when the whole run is judged', () => {
  assert.equal(judgeAttempt([job('test', 'skipped'), job('ci-ok')], whole).green, true);
  assert.equal(judgeAttempt([job('app (2/3)', 'skipped')], one).green, false);
});

test('nothing matching, or nothing that succeeded, is red', () => {
  assert.equal(judgeAttempt([job('ui (checks)')], one).green, false);
  assert.equal(judgeAttempt([job('test', 'skipped')], whole).green, false);
});

test('after a re-run the chosen job must have run in this attempt', () => {
  const carried = [job('app (2/3)', 'success', { run_attempt: 1 }), job('ci-ok')];
  assert.match(judgeAttempt(carried, one).problems[0], /not run in attempt 2/);
  assert.equal(judgeAttempt(carried, { ...one, fresh: false }).green, true);
});

test('the Playwright flaky summary line is found, other lines are not', () => {
  assert.equal(hasFlaky('2026-11-23T00:53:36.2299257Z   1 flaky\n'), true);
  assert.equal(hasFlaky('2026-11-23T00:53:36.2299257Z \x1b[33m  2 flaky\x1b[39m\n'), true);
  assert.equal(hasFlaky('2026-11-23T00:53:36Z   53 passed (6.8m)\n'), false);
  assert.equal(hasFlaky('2026-11-23T00:53:36Z ✓ flaky helper is not a summary 1 flaky test\n'), false);
});

test('arguments: a numeric run id is required, unknown flags fail', () => {
  assert.equal(parseArgs(['--run', '45080624581', '--job', '^app']).job, '^app');
  assert.throws(() => parseArgs([]), /--run/);
  assert.throws(() => parseArgs(['--run', 'abc']), /--run/);
  assert.throws(() => parseArgs(['--run', '1', '--retries', '2']), /unknown/);
  assert.throws(() => parseArgs(['--run', '1', '--job', '(']), SyntaxError);
});
