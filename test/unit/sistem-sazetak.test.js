// INT-08: the PROLAZ/PAD table must never call a scenario PROLAZ unless every
// one of its tests really passed in the Playwright JSON report.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { SCENARIOS, renderMarkdown, summarize } from '../../e2e/sistem/sazetak.mjs';

const spec = (file, title, statuses) => ({
  file,
  title,
  tests: [{ results: statuses.map((status) => ({ status })) }],
});
const report = (...specs) => ({ suites: [{ file: 'x', specs: [], suites: specs.map((s) => ({ file: s.file, specs: [s] })) }] });
const allPassing = () => SCENARIOS.map((sc) => spec(sc.file, sc.id, ['passed']));

test('every scenario passing gives PROLAZ everywhere', () => {
  assert.deepEqual(summarize(report(...allPassing())).map((r) => r.verdict), ['PROLAZ', 'PROLAZ', 'PROLAZ', 'PROLAZ']);
});

test('a missing report makes every scenario PAD', () => {
  const rows = summarize(null);
  assert.equal(rows.length, 4);
  assert.ok(rows.every((r) => r.verdict === 'PAD' && r.tests.length === 0));
});

test('a skipped test is not PROLAZ', () => {
  const specs = allPassing();
  specs[1] = spec(SCENARIOS[1].file, 'predaja', ['skipped']);
  const rows = summarize(report(...specs));
  assert.equal(rows[1].verdict, 'PAD');
  assert.equal(rows[1].tests[0].status, 'skipped');
});

test('a scenario file absent from the report is PAD', () => {
  const rows = summarize(report(...allPassing().slice(0, 3)));
  assert.equal(rows[3].id, 'INT-05');
  assert.equal(rows[3].verdict, 'PAD');
});

test('the last attempt decides and the first error line is the note', () => {
  const failing = spec(SCENARIOS[1].file, 'predaja', ['failed']);
  failing.tests[0].results[0].error = { message: '\u001b[31mError: commit 503\u001b[39m\n  at x' };
  const rows = summarize(report(...allPassing().slice(0, 1), failing));
  assert.equal(rows[1].verdict, 'PAD');
  assert.equal(rows[1].note, 'Error: commit 503');
  const md = renderMarkdown(rows, { web: 'a', srv: 'b', runUrl: null });
  assert.match(md, /\| INT-02 \|.*✅ PROLAZ/);
  assert.match(md, /\| INT-03 \|.*❌ PAD \| 0\/1 \| Error: commit 503 \|/);
});
