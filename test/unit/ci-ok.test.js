// ci-ok is the one required status (DAN-885): a plain job named ci-ok that
// needs every other job of the only pull request workflow and passes only when
// each of them succeeded. The workflows are read with a real YAML parser, so
// quoting, escapes, flow style and anchors cannot hide a job or a trigger.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { parseDocument } from 'yaml';

const dir = new URL('../../.github/workflows/', import.meta.url);
const isMap = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);

// Parses one workflow; fails on any YAML error, duplicate key or a document
// that is not a mapping.
function workflowOf(text) {
  const doc = parseDocument(text, { uniqueKeys: true, merge: true });
  assert.equal(doc.errors.length, 0, doc.errors.map((e) => e.message).join('; '));
  const value = doc.toJS({ maxAliasCount: 100 });
  assert.ok(isMap(value), 'workflow is a mapping');
  return value;
}

// Event names of a workflow. `on` may also arrive as the key "true" (YAML 1.1
// reads on as a boolean); exactly one of the two must be present.
function eventsOf(wf) {
  const keys = ['on', 'true'].filter((k) => Object.hasOwn(wf, k));
  assert.equal(keys.length, 1, 'workflow has exactly one on key');
  const on = wf[keys[0]];
  if (typeof on === 'string') return [on];
  if (Array.isArray(on)) {
    assert.ok(on.length > 0 && on.every((e) => typeof e === 'string'), 'on list holds event names');
    return on;
  }
  assert.ok(isMap(on) && Object.keys(on).length > 0, 'on is a name, a list or a mapping');
  return Object.keys(on);
}

// Jobs of a workflow as a name -> job mapping.
function jobsOf(wf) {
  assert.ok(isMap(wf.jobs) && Object.keys(wf.jobs).length > 0, 'workflow has jobs');
  for (const [name, job] of Object.entries(wf.jobs)) assert.ok(isMap(job), `job ${name} is a mapping`);
  return wf.jobs;
}

const needsOf = (job) => (typeof job.needs === 'string' ? [job.needs] : job.needs ?? []);

// Events another workflow may have: the engineering gate callers and events
// that never run on a pull request. Anything else (pull_request, push,
// merge_group, pull_request_review, ...) would run jobs ci-ok cannot see.
const ALLOWED = new Set(['workflow_call', 'workflow_dispatch', 'schedule', 'pull_request_target', 'issue_comment']);
const strayEvents = (text) => eventsOf(workflowOf(text)).filter((e) => !ALLOWED.has(e));

const workflow = workflowOf(readFileSync(new URL('ci.yml', dir), 'utf8'));
const ciOk = jobsOf(workflow)['ci-ok'];
const script = ciOk?.steps?.find((s) => typeof s?.run === 'string' && s.run.includes('# ci-ok:begin'))?.run;

const run = (value) => {
  const r = spawnSync('bash', ['-c', script], { env: { PATH: process.env.PATH, NEEDS: value }, encoding: 'utf8' });
  return { code: r.status, out: r.stdout + r.stderr };
};
const needs = (o) => JSON.stringify(Object.fromEntries(Object.entries(o).map(([k, v]) => [k, { result: v, outputs: {} }])));

// A needs object with `changes` and its outputs: skipped jobs listed in `off`
// were switched off by changes, the others it wanted to run.
const withChanges = (results, outputs, changes = 'success') =>
  JSON.stringify({
    changes: { result: changes, outputs },
    ...Object.fromEntries(Object.entries(results).map(([k, v]) => [k, { result: v, outputs: {} }])),
  });

const cases = [
  ['skipped job that changes switched off', withChanges({ a: 'success', b: 'skipped' }, { a: 'true', b: 'false' }), 0],
  ['every job switched off', withChanges({ a: 'skipped', b: 'skipped' }, { a: 'false', b: 'false' }), 0],
  ['skipped job that changes wanted', withChanges({ a: 'success', b: 'skipped' }, { a: 'true', b: 'true' }), 1],
  ['skipped job with no changes output', withChanges({ a: 'success', b: 'skipped' }, { a: 'true' }), 1],
  ['skipped job, output not exactly false', withChanges({ b: 'skipped' }, { b: 'False' }), 1],
  ['skipped because changes itself failed', withChanges({ b: 'skipped' }, { b: 'false' }, 'failure'), 1],
  ['changes itself skipped', withChanges({ b: 'success' }, { b: 'true' }, 'skipped'), 1],
  ['switched-off job that failed anyway', withChanges({ b: 'failure' }, { b: 'false' }), 1],
  ['switched-off job cancelled', withChanges({ b: 'cancelled' }, { b: 'false' }), 1],

  ['one failure', needs({ a: 'success', b: 'failure' }), 1],
  ['cancelled', needs({ a: 'success', b: 'cancelled' }), 1],
  ['skipped', needs({ a: 'success', b: 'skipped' }), 1],
  ['unknown result', needs({ a: 'neutral' }), 1],
  ['job without result', JSON.stringify({ a: { outputs: {} } }), 1],
  ['result null', JSON.stringify({ a: { result: null } }), 1],
  ['job value is a string', JSON.stringify({ a: 'success' }), 1],
  ['result is a number', JSON.stringify({ a: { result: 1 } }), 1],
  ['result with a trailing space', needs({ a: 'success ' }), 1],
  ['empty needs', '{}', 1],
  ['empty string', '', 1],
  ['invalid JSON', '{a:', 1],
  ['array instead of object', '[]', 1],
  ['null', 'null', 1],
  ['failure with a space and quote in the name', needs({ 'x "y"': 'failure' }), 1],
  ['all success', needs({ a: 'success', b: 'success' }), 0],
  ['job name with a space and quote', needs({ 'x "y"': 'success' }), 0],
];

for (const [name, value, code] of cases) {
  test(`ci-ok ${code === 0 ? 'passes' : 'fails'}: ${name}`, () => {
    assert.equal(typeof script, 'string', 'ci-ok has a step with the ci-ok:begin block');
    const r = run(value);
    assert.equal(r.code, code, r.out);
  });
}

test('ci-ok names the failing job, not the good one', () => {
  const r = run(needs({ good: 'success', bad: 'failure' }));
  assert.match(r.out, /::error::job bad result: failure/);
  assert.doesNotMatch(r.out, /::error::.*good/);
});

test('ci-ok explains input that is not a non-empty object', () => {
  assert.match(run('null').out, /::error::needs must be a non-empty JSON object/);
});

// Workflows another PR could add: each must be refused by the trigger check.
const strays = [
  ['double-quoted on', '"on": pull_request\njobs: { x: { runs-on: u } }\n', ['pull_request']],
  ['single-quoted on with a list', "'on': [push]\njobs: { x: { runs-on: u } }\n", ['push']],
  ['escaped event name in a list', 'on: ["\\u0070ull_request"]\njobs: { x: { runs-on: u } }\n', ['pull_request']],
  ['escaped event name as a string', 'on: "pull\\u005frequest"\njobs: { x: { runs-on: u } }\n', ['pull_request']],
  ['true key (YAML 1.1 on)', 'true: push\njobs: { x: { runs-on: u } }\n', ['push']],
  ['mapping after jobs', 'jobs: { x: { runs-on: u } }\non:\n  merge_group: {}\n', ['merge_group']],
  ['review event', 'on: [pull_request_review]\njobs: { x: { runs-on: u } }\n', ['pull_request_review']],
  ['anchor and alias', 'x-ev: &ev pull_request\non: [*ev]\njobs: { x: { runs-on: u } }\n', ['pull_request']],
  ['gate callers stay allowed', 'on: [pull_request_target, issue_comment]\njobs: { x: { runs-on: u } }\n', []],
  ['reusable and scheduled stay allowed', 'on:\n  workflow_call: { inputs: {} }\n  schedule: [{ cron: "0 5 * * 1" }]\n  workflow_dispatch:\njobs: { x: { runs-on: u } }\n', []],
];
for (const [name, text, found] of strays) {
  test(`trigger check ${found.length ? 'refuses' : 'allows'}: ${name}`, () => {
    assert.deepEqual(strayEvents(text), found);
  });
}

const unreadable = [
  ['no on key', 'jobs: { x: { runs-on: u } }\n'],
  ['both on and true', 'on: push\ntrue: push\njobs: { x: { runs-on: u } }\n'],
  ['duplicate on key', 'on: workflow_call\non: push\njobs: { x: { runs-on: u } }\n'],
  ['on is a number', 'on: 1\njobs: { x: { runs-on: u } }\n'],
  ['on list with a mapping', 'on: [{ push: {} }]\njobs: { x: { runs-on: u } }\n'],
  ['empty on mapping', 'on: {}\njobs: { x: { runs-on: u } }\n'],
  ['invalid YAML', 'on: [push\njobs: {}\n'],
  ['document is a list', '- on: push\n'],
];
for (const [name, text] of unreadable) {
  test(`trigger check fails closed: ${name}`, () => {
    assert.throws(() => strayEvents(text));
  });
}

// Jobs that a line-based reader missed are plain jobs to the parser.
test('jobs are read in any YAML spelling', () => {
  const wf = workflowOf("on: push\njobs:\n  a: { runs-on: u }\n  'qa-extra':\n    runs-on: u\n  \"b\": { runs-on: u, needs: a }\n  c: &c { runs-on: u }\n  d: *c\n");
  assert.deepEqual(Object.keys(jobsOf(wf)), ['a', 'qa-extra', 'b', 'c', 'd']);
  assert.deepEqual(needsOf(jobsOf(wf).b), ['a']);
  const crlf = workflowOf('on: push\r\njobs: # all\r\n  a: # first\r\n    runs-on: u\r\n  b:\r\n    needs:\r\n      - a\r\n');
  assert.deepEqual(Object.keys(jobsOf(crlf)), ['a', 'b']);
  assert.deepEqual(needsOf(jobsOf(crlf).b), ['a']);
  assert.throws(() => jobsOf(workflowOf('on: push\njobs:\n  a: { runs-on: u }\n  a: { runs-on: v }\n')));
  assert.throws(() => jobsOf(workflowOf('on: push\njobs:\n\ta: { runs-on: u }\n')));
  assert.throws(() => jobsOf(workflowOf('on: push\njobs:\n  a: run\n')));
});

// Jobs that only report and never block (ZEL-CI-WEB): the pixel baselines of
// the catalogue (Daniel, 22. 11. 2026, until VIZ-0). ci-ok does not need them,
// so it does not wait for them; the test below holds each to report only.
const REPORT_ONLY = ['ui-baselines'];

test('ci-ok is a plain job named ci-ok that runs always over every other job', () => {
  const jobs = jobsOf(workflow);
  assert.ok(isMap(ciOk), 'ci.yml has a ci-ok job');
  assert.equal(ciOk.name, 'ci-ok');
  assert.ok(ciOk['runs-on'], 'ci-ok runs on a runner');
  assert.equal(ciOk.uses, undefined, 'ci-ok is not a reusable workflow call');
  assert.ok(['always()', '${{ always() }}'].includes(ciOk.if), `ci-ok if: ${ciOk.if}`);
  const step = ciOk.steps.find((s) => s.run === script);
  assert.equal(step.env?.NEEDS, '${{ toJSON(needs) }}');
  const others = Object.keys(jobs).filter((j) => j !== 'ci-ok' && !REPORT_ONLY.includes(j));
  assert.ok(others.length > 0);
  assert.deepEqual([...needsOf(ciOk)].sort(), others.sort());
});

test('ci.yml itself runs on pull requests', () => {
  assert.ok(eventsOf(workflow).includes('pull_request'));
});

// needs cannot see another workflow, so ci.yml is the only one that runs on a
// pull request, push or merge queue.
test('no other workflow runs jobs that ci-ok cannot see', () => {
  for (const file of readdirSync(dir).filter((f) => /\.ya?ml$/i.test(f) && f !== 'ci.yml')) {
    assert.deepEqual(strayEvents(readFileSync(new URL(file, dir), 'utf8')), [], file);
  }
});

// The `changes` job decides which jobs a change needs. Its script runs here in
// a throwaway git repository, so a wrong path rule shows up as a failing case.
const changesScript = jobsOf(workflow).changes?.steps?.find((s) => typeof s?.run === 'string' && s.run.includes('# changes:begin'))?.run;

function changesFor(files, { event = 'pull_request', base = true } = {}) {
  const repo = mkdtempSync(join(tmpdir(), 'changes-'));
  try {
    const git = (...a) => spawnSync('git', a, { cwd: repo, encoding: 'utf8' });
    git('init', '-q');
    git('config', 'user.email', 'a@example.invalid');
    git('config', 'user.name', 'a');
    writeFileSync(join(repo, 'seed.md'), 'x');
    git('add', '.');
    git('commit', '-q', '-m', 'base');
    const baseSha = git('rev-parse', 'HEAD').stdout.trim();
    for (const f of files) {
      mkdirSync(join(repo, dirname(f)), { recursive: true });
      writeFileSync(join(repo, f), 'y');
    }
    git('add', '.');
    git('commit', '-q', '--allow-empty', '-m', 'change');
    const out = join(repo, '..', `out-${process.pid}-${Math.random()}`);
    writeFileSync(out, '');
    const r = spawnSync('bash', ['-c', changesScript], {
      cwd: repo,
      encoding: 'utf8',
      env: { PATH: process.env.PATH, EVENT: event, BASE: base ? baseSha : '', GITHUB_OUTPUT: out },
    });
    assert.equal(r.status, 0, r.stdout + r.stderr);
    return Object.fromEntries(readFileSync(out, 'utf8').trim().split('\n').map((l) => l.split('=')));
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
}
const JOBS = ['test', 'client', 'ui', 'app'];
const on = (o) => JOBS.filter((k) => o[k] === 'true').sort().join(',');

const pathCases = [
  [['docs/x.md'], ''],
  [['README.md'], ''],
  [['packages/app/src/host/a.tsx'], 'app,ui'],
  [['packages/ui/src/a.tsx'], 'app,ui'],
  [['catalog/a.ts'], 'ui'],
  [['packages/editor-core/src/a.ts'], 'app,client,ui'],
  [['src/client/api.ts'], 'app,client,ui'],
  [['src/components/a.tsx'], 'app,test,ui'],
  [['test/unit/a.test.js'], 'test'],
  [['e2e/a.spec.ts'], 'test'],
  [['package.json'], 'app,client,test,ui'],
  [['pnpm-lock.yaml'], 'app,client,test,ui'],
  [['pnpm-workspace.yaml'], 'app,client,test,ui'],
  [['.github/workflows/ci.yml'], 'app,client,test,ui'],
  [['docs/x.md', 'package.json'], 'app,client,test,ui'],
];
for (const [files, expected] of pathCases) {
  test(`changes: ${files.join(', ')} runs [${expected}]`, () => {
    assert.equal(typeof changesScript, 'string', 'changes has the changes:begin block');
    assert.equal(on(changesFor(files)), expected);
  });
}
test('changes: a push runs every job', () => {
  assert.equal(on(changesFor(['docs/x.md'], { event: 'push' })), 'app,client,test,ui');
});
test('changes: no base sha runs every job', () => {
  assert.equal(on(changesFor(['docs/x.md'], { base: false })), 'app,client,test,ui');
});

// ZEL-CI-RED: app-build always follows app, and the checks of src/client run
// inside the ui part `checks`, so every change that turns client on turns ui
// on too (otherwise they would run nowhere).
test('changes: app-build equals app and client implies ui, for every case', () => {
  const runs = [...pathCases.map(([files]) => changesFor(files)), changesFor(['docs/x.md'], { event: 'push' }), changesFor(['docs/x.md'], { base: false })];
  for (const o of runs) {
    assert.ok(['true', 'false'].includes(o.app), JSON.stringify(o));
    assert.equal(o['app-build'], o.app, JSON.stringify(o));
    if (o.client === 'true') assert.equal(o.ui, 'true', JSON.stringify(o));
  }
});

// CI-BRZINA (Daniel 25. 11. 2026): the report-only pixel baselines run on a
// push, by hand and on the schedule (main only); never on a pull request,
// whatever it changes, so its runners go to the checks ci-ok waits for.
const baselineCases = [
  [['catalog/a.ts'], 'pull_request', 'false'],
  [['packages/ui/src/a.tsx'], 'pull_request', 'false'],
  [['packages/ui/src/a.module.css'], 'pull_request', 'false'],
  [['packages/editor-core/src/a.ts'], 'pull_request', 'false'],
  [['packages/app/src/host/a.tsx'], 'pull_request', 'false'],
  [['docs/x.md'], 'pull_request', 'false'],
  [['.github/workflows/ci.yml'], 'pull_request', 'false'],
  [['pnpm-lock.yaml'], 'pull_request', 'false'],
  [['catalog/a.ts'], 'push', 'true'],
  [['docs/x.md'], 'schedule', 'true'],
  [['docs/x.md'], 'workflow_dispatch', 'true'],
];
for (const [files, event, expected] of baselineCases) {
  test(`changes: baselines ${expected === 'true' ? 'on' : 'off'} for ${event} ${files.join(', ')}`, () => {
    assert.equal(changesFor(files, { event }).baselines, expected);
  });
}
// Checks that read the whole repository run as steps of `changes`, which has
// no `if` and no `needs` (ZEL-W20a; a step of changes since ZEL-CI-RED, one
// runner less per run): nothing can switch them off or skip them.
test('every job except changes is gated by changes and needs it', () => {
  for (const [name, job] of Object.entries(jobsOf(workflow))) {
    if (name === 'changes' || REPORT_ONLY.includes(name)) continue;
    assert.ok(needsOf(job).includes('changes'), `${name} needs changes`);
    if (name !== 'ci-ok') assert.equal(job.if, `\${{ needs.changes.outputs.${name} == 'true' }}`, name);
  }
});

// The CRLF check of the index (DAN-952) runs on EVERY pull request (ZEL-W20a,
// review of #435): before, it ran only in the job `test`, which a change to
// docs/, packages/, catalog/ or a .md file switches off. Since ZEL-CI-RED it
// is a step of `changes`, so a CRLF file fails `changes` and with it ci-ok.
const lineEndings = jobsOf(workflow).changes;
const lineEndingsScript = lineEndings?.steps?.find((s) => typeof s?.run === 'string' && s.run.includes('# line-endings:begin'))?.run;

test('the CRLF check runs always: a step of changes, which has no if, no needs and is required by ci-ok', () => {
  assert.equal(jobsOf(workflow)['line-endings'], undefined, 'no separate line-endings job');
  assert.equal(lineEndings.if, undefined, 'changes has no if');
  assert.deepEqual(needsOf(lineEndings), [], 'changes needs nothing');
  assert.equal(lineEndings.strategy, undefined, 'changes is one job, not a matrix');
  assert.ok(needsOf(ciOk).includes('changes'), 'ci-ok needs changes');
  assert.equal(typeof lineEndingsScript, 'string', 'changes has the line-endings:begin block');
  assert.match(lineEndingsScript, /^\s*set -euo pipefail$/m);
  assert.match(lineEndingsScript, /^\s*node --test test\/unit\/gitattributes\.test\.js$/m);
  const step = lineEndings.steps.find((s) => s.run === lineEndingsScript);
  assert.equal(step.if, undefined, 'the check step has no if');
  assert.notEqual(step['continue-on-error'], true, 'the check step blocks');
  assert.ok(!lineEndings.steps.some((s) => s['continue-on-error']), 'no step of changes is report-only');
  assert.equal(lineEndings['continue-on-error'], undefined);
});

// A pull request that changes only docs/x.md or packages/ui/a.css: `changes`
// switches test off (docs: every job off), yet the CRLF check still runs in
// `changes`, and a failed check fails `changes` and so ci-ok.
for (const [file, expected] of [['docs/x.md', ''], ['packages/ui/a.css', 'app,ui']]) {
  test(`changes: ${file} only still runs the CRLF check`, () => {
    const outputs = changesFor([file]);
    assert.equal(on(outputs), expected);
    assert.equal(outputs.test, 'false', 'the job test is off, so only line-endings checks CRLF');
    const results = Object.fromEntries(['test', 'ui', 'app-build', 'app'].map((j) => [j, outputs[j] === 'true' ? 'success' : 'skipped']));
    assert.equal(run(withChanges(results, outputs)).code, 0, 'green with the check passing');
    const skippedAll = Object.fromEntries(Object.keys(results).map((j) => [j, 'skipped']));
    for (const r of ['failure', 'cancelled']) {
      const out = run(withChanges(skippedAll, outputs, r));
      assert.equal(out.code, 1, `changes ${r} (the check failed) fails ci-ok`);
      assert.match(out.out, new RegExp(`::error::job changes result: ${r}`));
    }
  });
}

// The check step itself, in a throwaway repository: a CRLF file stored in
// packages/ fails it (so ci-ok is red), the same tree with LF passes.
function lineEndingsIn(path, crlf) {
  const repo = mkdtempSync(join(tmpdir(), 'line-endings-'));
  const home = mkdtempSync(join(tmpdir(), 'line-endings-home-'));
  try {
    const env = { PATH: process.env.PATH, HOME: home, XDG_CONFIG_HOME: home, GIT_CONFIG_NOSYSTEM: '1' };
    const git = (args, input) => {
      const r = spawnSync('git', ['-c', 'core.autocrlf=false', ...args], { cwd: repo, encoding: 'utf8', input, env });
      assert.equal(r.status, 0, `git ${args.join(' ')}: ${r.stderr}`);
      return r.stdout.trim();
    };
    git(['init', '-q']);
    git(['config', 'user.email', 'a@example.invalid']);
    git(['config', 'user.name', 'a']);
    mkdirSync(join(repo, 'test', 'unit'), { recursive: true });
    for (const f of ['.gitattributes', 'test/unit/gitattributes.test.js']) {
      writeFileSync(join(repo, f), readFileSync(new URL(`../../${f}`, import.meta.url)));
    }
    git(['add', '.']);
    // .gitattributes would turn CRLF into LF on add, so the blob goes into
    // the index unfiltered, as a client without the file would store it.
    const body = crlf ? 'a { color: red; }\r\nb { color: blue; }\r\n' : 'a { color: red; }\nb { color: blue; }\n';
    const blob = git(['hash-object', '-w', '--no-filters', '--stdin'], body);
    git(['update-index', '--add', '--cacheinfo', `100644,${blob},${path}`]);
    git(['commit', '-q', '-m', 'change']);
    git(['checkout', '-q', '--', '.']);
    const r = spawnSync('bash', ['-c', lineEndingsScript], { cwd: repo, encoding: 'utf8', env });
    return { code: r.status, out: r.stdout + r.stderr };
  } finally {
    rmSync(repo, { recursive: true, force: true });
    rmSync(home, { recursive: true, force: true });
  }
}

test('line-endings: CRLF in packages/ fails the check, LF passes', () => {
  assert.equal(typeof lineEndingsScript, 'string', 'changes has the line-endings:begin block');
  const bad = lineEndingsIn('packages/ui/a.css', true);
  assert.notEqual(bad.code, 0, bad.out);
  assert.match(bad.out, /packages\/ui\/a\.css/, 'the failure names the CRLF file');
  const good = lineEndingsIn('packages/ui/a.css', false);
  assert.equal(good.code, 0, good.out);
});

test('line-endings: CRLF in docs/ and a root .md file fails the check too', () => {
  for (const path of ['docs/x.md', 'README.md', 'catalog/a.ts']) {
    const r = lineEndingsIn(path, true);
    assert.notEqual(r.code, 0, `${path}: ${r.out}`);
  }
});

// ZEL-CI-WEB: the ui checks run as two parts of the matrix `ui`, `checks`
// (typecheck and the coverage check) and `unit` (every package's unit tests).
// ci-ok needs `ui`, so it needs both: a failure in either part fails `ui`.
// CI-BRZINA: `unit` runs in two legs whose pnpm filters are each other's
// complement, so every workspace package runs in exactly one leg.
const ui = jobsOf(workflow).ui;
const uiStep = (pattern) => ui.steps.filter((s) => typeof s.run === 'string' && pattern.test(s.run));

test('ui runs typecheck and unit tests in two blocking parts of its matrix', () => {
  const parts = ui.strategy.matrix.include.map((p) => p.part);
  assert.ok(parts.includes('checks') && parts.includes('unit'), parts.join(','));
  assert.ok(needsOf(ciOk).includes('ui'), 'ci-ok needs ui');
  assert.equal(ui.strategy['fail-fast'], false);
  const [typecheck] = uiStep(/^pnpm -r run typecheck$/);
  const [unit] = uiStep(/^pnpm -r --filter "\$PACKAGES" --filter "!\{\.\}" run test$/);
  assert.equal(unit?.env?.PACKAGES, '${{ matrix.packages }}');
  const legs = ui.strategy.matrix.include.filter((p) => p.part === 'unit');
  assert.deepEqual(legs.map((p) => p.packages), ['./src/**', '!./src/**'], 'unit legs are src/ and its complement');
  assert.deepEqual(legs.map((p) => `${p.leg}/${p.of}`), ['1/2', '2/2']);
  assert.equal(typecheck?.if, "matrix.part == 'checks'");
  assert.equal(unit?.if, "matrix.part == 'unit'");
  // CI-BRZINA: both axe shells run in one part; the light shell runs also
  // when the dark one failed, and nothing else may skip them.
  assert.deepEqual(ui.strategy.matrix.include.filter((p) => p.part.startsWith('axe')).map((p) => p.part), ['axe']);
  const [dark] = uiStep(/--grep "\$AXE_DARK"$/);
  const [light] = uiStep(/--grep "\$AXE_LIGHT"$/);
  assert.equal(dark?.if, "matrix.part == 'axe'");
  assert.equal(light?.if, "always() && matrix.part == 'axe'");
  const [coverage] = uiStep(/the ui parts do not cover every catalogue test exactly once/);
  assert.equal(coverage?.if, "matrix.part == 'checks'");
  assert.ok(!ui.steps.some((s) => s['continue-on-error']), 'no step of ui is report-only');
  assert.equal(ui['continue-on-error'], undefined);
  // Only the browser parts install a browser; checks and unit need none.
  for (const p of ui.strategy.matrix.include) {
    assert.equal(Boolean(p.browser), !['checks', 'unit'].includes(p.part), `${p.part} browser`);
  }
});

test('report-only jobs run only the catalogue baselines, when changes says baselines, outside ci-ok', () => {
  const jobs = jobsOf(workflow);
  for (const name of REPORT_ONLY) {
    const job = jobs[name];
    assert.ok(isMap(job), `${name} exists`);
    assert.ok(!needsOf(ciOk).includes(name), `ci-ok does not need ${name}`);
    assert.equal(job.if, "${{ needs.changes.outputs.baselines == 'true' }}", `${name} runs when changes says baselines`);
    assert.deepEqual(needsOf(job), ['changes'], `${name} needs changes only`);
    assert.equal(job.env?.BASELINES, ui.env.BASELINES, 'the same baseline filter as ui');
    const tests = job.steps.filter((s) => typeof s.run === 'string' && /playwright test|test:visual/.test(s.run));
    assert.equal(tests.length, 1, `${name} runs one test step`);
    assert.equal(tests[0]['continue-on-error'], true, 'the step only reports');
    assert.match(tests[0].run, /^pnpm --filter @ductura\/catalog run test:visual --grep "\$BASELINES" --shard="\$\{\{ matrix\.shard \}\}"$/);
    assert.deepEqual(job.strategy.matrix.shard, ['1/3', '2/3', '3/3']);
  }
});

// The baselines run in the report-only job only: no blocking job greps them in,
// and ui still filters them out of every part (its coverage check counts them out).
test('no blocking job runs the baselines', () => {
  for (const [name, job] of Object.entries(jobsOf(workflow))) {
    if (REPORT_ONLY.includes(name)) continue;
    for (const s of job.steps ?? []) {
      if (typeof s.run !== 'string') continue;
      assert.doesNotMatch(s.run, /--grep "\$BASELINES"/, `${name}: ${s.name ?? s.run}`);
    }
  }
});

// ZEL-CI-RED: the checks of src/client run in the ui part `checks`, only when
// `changes` says client, and the read-only package token reaches its install
// step only.
test('the client checks run in the ui part checks when changes says client', () => {
  const when = "matrix.part == 'checks' && needs.changes.outputs.client == 'true'";
  const [typecheck] = uiStep(/^pnpm run typecheck$/);
  const [tests] = uiStep(/^pnpm run test$/);
  for (const s of [typecheck, tests]) {
    assert.equal(s?.if, when, s?.name);
    assert.equal(s['working-directory'], 'src/client', s.name);
  }
  const withToken = ui.steps.filter((s) => s.env?.NODE_AUTH_TOKEN);
  assert.equal(withToken.length, 1);
  assert.equal(withToken[0].if, "matrix.part == 'checks'");
  assert.equal(ui.permissions?.packages, 'read');
  assert.equal(jobsOf(workflow).client, undefined, 'no separate client job');
});

// ZEL-CI-RED: the host is built once in app-build and every app shard starts
// that build; no shard builds again.
test('app shards download the one build of app-build', () => {
  const jobs = jobsOf(workflow);
  const build = jobs['app-build'];
  const app = jobs.app;
  assert.deepEqual([...needsOf(app)].sort(), ['app-build', 'changes']);
  const step = build.steps.find((s) => s.run === 'pnpm run build');
  assert.equal(step?.env?.INSTITUTION_SERVER_URL, 'http://127.0.0.1:9');
  const upload = build.steps.find((s) => String(s.uses).startsWith('actions/upload-artifact@'));
  assert.equal(upload.with.name, 'app-build');
  assert.equal(upload.with['include-hidden-files'], true);
  assert.equal(upload.with['if-no-files-found'], 'error');
  const download = app.steps.findIndex((s) => String(s.uses).startsWith('actions/download-artifact@'));
  const e2e = app.steps.findIndex((s) => typeof s.run === 'string' && s.run.includes('test:e2e'));
  assert.ok(download >= 0 && download < e2e, 'the shard downloads the build before the e2e');
  assert.equal(app.steps[download].with.path, 'packages/app/.next');
  assert.ok(!app.steps.some((s) => typeof s.run === 'string' && /\bbuild\b/.test(s.run)), 'no shard builds');
});

// ZEL-CI-RED: a newer push to the migration base cancels the older run, as a
// newer push to a pull request does; a push to main never.
test('concurrency cancels older pull request and base runs, never main', () => {
  const { group, 'cancel-in-progress': cancel } = workflow.concurrency;
  assert.match(group, /github\.event\.pull_request\.number/);
  assert.match(group, /github\.event_name/);
  assert.match(cancel, /github\.event_name == 'pull_request'/);
  assert.match(cancel, /github\.ref == 'refs\/heads\/migracija\/kopija-ductus-front'/);
  assert.doesNotMatch(cancel, /refs\/heads\/main/);
});
