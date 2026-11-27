// pnpm ci:local (WEB-CI-LOKALNO): the jobs a change needs come from .github/workflows/ci.yml itself, the
// shared list of known and flaky tests only informs, and only *.session.test.ts may retry, once.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

import { FLAKY_LIST, ROOT, WORKFLOW, decide, evaluate, flakyRows, plan, readWorkflow } from '../../scripts/ci-local.mjs';

const workflowText = readFileSync(new URL(`../../${WORKFLOW}`, import.meta.url), 'utf8');
const wf = readWorkflow(workflowText);
const running = (w, files) => plan(w, decide(w, files)).filter((j) => j.on).map((j) => j.id).sort().join(',');

// Three kinds of change, as in the PR body.
const cases = [
  [['docs/x.md'], 'changes'],
  [['src/components/editor/a.tsx'], 'app,app-build,changes,test,ui'],
  [['catalog/src/a.ts'], 'changes,ui,ui-baselines'],
  [['src/client/api.ts'], 'app,app-build,changes,ui'],
];
for (const [files, expected] of cases) {
  test(`ci:local: ${files.join(', ')} runs [${expected}]`, () => {
    assert.equal(running(wf, files), expected);
  });
}

test('ci:local reads the rules from ci.yml: a changed rule in the workflow changes the plan', () => {
  const changed = readWorkflow(workflowText.replace("u=\"$(hit '^(packages/|catalog/|", "u=\"$(hit '^(packages/|"));
  assert.notEqual(changed, wf);
  assert.equal(running(changed, ['catalog/src/a.ts']), 'changes,ui-baselines');
});

test('ci:local: with no change list every job runs, as on a push', () => {
  const jobs = plan(wf, decide(wf, ['any'], { event: 'workflow_dispatch' }));
  assert.deepEqual(jobs.filter((j) => !j.on).map((j) => j.id), []);
  assert.ok(!jobs.some((j) => j.id === 'ci-ok'), 'ci-ok only adds up the others');
});

test('ci:local: every check step of a needed job is in the plan; only runner setup is not run', () => {
  const jobs = plan(wf, decide(wf, ['any'], { event: 'workflow_dispatch' }));
  const ui = jobs.find((j) => j.id === 'ui');
  const names = ui.runs.flatMap((r) => r.steps.filter((s) => s.kind === 'check').map((s) => `${r.name} > ${s.name}`));
  for (const want of ['ui (checks) > Typecheck', 'ui (unit 1/2) > Unit tests', 'ui (unit 2/2) > Unit tests', 'ui (behaviour 3/3) > Behaviour tests', 'ui (axe) > Axe tests of the catalogue (dark shell)', 'ui (axe) > Axe tests of the catalogue (light shell)']) {
    assert.ok(names.some((n) => n.startsWith(want)), want);
  }
  const setup = jobs.flatMap((j) => j.runs.flatMap((r) => r.steps.filter((s) => s.kind === 'setup').map((s) => s.name)));
  assert.ok(setup.length > 0);
  for (const s of setup) assert.doesNotMatch(s, /\btests?\b|typecheck|lint|axe|\bbuild\b|provjer/i, `${s} is a check, not setup`);
  const app = jobs.find((j) => j.id === 'app');
  assert.equal(app.runs.length, 1);
  assert.match(app.runs[0].steps.find((s) => s.kind === 'check').run, /--shard=1\/1$/);
  assert.equal(jobs.find((j) => j.id === 'ui-baselines').required, false, 'outside ci-ok only reports');
});

test('ci:local: GitHub expressions of the workflow', () => {
  const ctx = { needs: { changes: { outputs: { ui: 'true', client: 'false' } } }, matrix: { part: 'checks', leg: 2 }, github: { event_name: 'pull_request' } };
  assert.equal(evaluate("${{ needs.changes.outputs.ui == 'true' }}", ctx), true);
  assert.equal(evaluate("matrix.part == 'checks' && needs.changes.outputs.client == 'true'", ctx), false);
  assert.equal(evaluate("matrix.leg && format(' {0}/3', matrix.leg) || ''", ctx), ' 2/3');
  assert.equal(evaluate("github.event_name != 'pull_request'", ctx), false);
  assert.equal(evaluate('!matrix.browser', ctx), true);
  assert.throws(() => evaluate('matrix.part === 1', ctx));
});

test('the list of known and flaky tests has its columns and exempts nothing', () => {
  const text = readFileSync(new URL(`../../${FLAKY_LIST}`, import.meta.url), 'utf8');
  assert.match(text, /^\| Test \| Vlasnik \| Datum \| Razlog \|$/m);
  const rows = flakyRows(text);
  assert.ok(rows.length > 0);
  for (const r of rows) {
    assert.ok(r.test && r.owner && r.reason, JSON.stringify(r));
    assert.match(r.date, /^\d{4}-\d{2}-\d{2}$/);
  }
  assert.ok(!workflowText.includes('nestabilni-testovi'), 'CI does not read the list');
});

test('only *.session.test.ts retry, once, through session-retry.ts', () => {
  const files = spawnSync('git', ['ls-files', '*.test.ts', '*.test.tsx', '*.spec.ts', '*vitest*.ts', '*playwright*.ts'], { cwd: ROOT, encoding: 'utf8' }).stdout.split('\n').filter(Boolean);
  const session = files.filter((f) => /\.session\.test\.ts$/.test(f));
  assert.ok(session.length > 0);
  for (const f of files) {
    const text = readFileSync(new URL(`../../${f}`, import.meta.url), 'utf8');
    if (session.includes(f)) {
      assert.match(text, /from "@\/components\/session-retry"/, f);
      assert.match(text, /^printAttempts\(beforeEach\);$/m, f);
      const tops = text.match(/^describe\(.*$/gm) ?? [];
      assert.ok(tops.length > 0 && tops.every((l) => l.includes('SESSION_RETRY, ')), f);
    } else {
      assert.ok(!/SESSION_RETRY|session-retry/.test(text), `${f} is not a session test`);
      if (/vitest/.test(f)) assert.ok(!/\bretry\s*:/.test(text), `${f} sets no retry`);
    }
  }
  assert.match(readFileSync(new URL('../../src/components/session-retry.ts', import.meta.url), 'utf8'), /retry: 1 \}/);
});
