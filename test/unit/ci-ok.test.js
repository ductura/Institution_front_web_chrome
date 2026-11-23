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

test('ci-ok is a plain job named ci-ok that runs always over every other job', () => {
  const jobs = jobsOf(workflow);
  assert.ok(isMap(ciOk), 'ci.yml has a ci-ok job');
  assert.equal(ciOk.name, 'ci-ok');
  assert.ok(ciOk['runs-on'], 'ci-ok runs on a runner');
  assert.equal(ciOk.uses, undefined, 'ci-ok is not a reusable workflow call');
  assert.ok(['always()', '${{ always() }}'].includes(ciOk.if), `ci-ok if: ${ciOk.if}`);
  const step = ciOk.steps.find((s) => s.run === script);
  assert.equal(step.env?.NEEDS, '${{ toJSON(needs) }}');
  const others = Object.keys(jobs).filter((j) => j !== 'ci-ok');
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
const on = (o) => Object.keys(o).filter((k) => o[k] === 'true').sort().join(',');

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
// Jobs that read the whole repository and so run on every pull request, with
// no `if` and no `needs` (ZEL-W20a): `changes` cannot switch them off and a
// failed `changes` cannot skip them. A new one is added here on purpose.
const ALWAYS_ON = ['line-endings'];

test('every job except changes and the always-on jobs is gated by changes and needs it', () => {
  for (const [name, job] of Object.entries(jobsOf(workflow))) {
    if (name === 'changes' || ALWAYS_ON.includes(name)) continue;
    assert.ok(needsOf(job).includes('changes'), `${name} needs changes`);
    if (name !== 'ci-ok') assert.equal(job.if, `\${{ needs.changes.outputs.${name} == 'true' }}`, name);
  }
});

// The CRLF check of the index (DAN-952) runs on EVERY pull request (ZEL-W20a,
// review of #435): before, it ran only in the job `test`, which a change to
// docs/, packages/, catalog/ or a .md file switches off.
const lineEndings = jobsOf(workflow)['line-endings'];
const lineEndingsScript = lineEndings?.steps?.find((s) => typeof s?.run === 'string' && s.run.includes('# line-endings:begin'))?.run;

test('line-endings runs always: no if, no needs, required by ci-ok, never a changes output', () => {
  assert.deepEqual(Object.keys(jobsOf(workflow)).filter((j) => ALWAYS_ON.includes(j)), ALWAYS_ON);
  for (const name of ALWAYS_ON) {
    const job = jobsOf(workflow)[name];
    assert.equal(job.if, undefined, `${name} has no if`);
    assert.deepEqual(needsOf(job), [], `${name} needs nothing, so a failed changes cannot skip it`);
    assert.equal(job.strategy, undefined, `${name} is one job, not a matrix`);
    assert.ok(needsOf(ciOk).includes(name), `ci-ok needs ${name}`);
    assert.equal(jobsOf(workflow).changes.outputs?.[name], undefined, `changes has no output for ${name}`);
  }
  assert.equal(typeof lineEndingsScript, 'string', 'line-endings has the line-endings:begin block');
  assert.match(lineEndingsScript, /^\s*set -euo pipefail$/m);
  assert.match(lineEndingsScript, /^\s*node --test test\/unit\/gitattributes\.test\.js$/m);
  const step = lineEndings.steps.find((s) => s.run === lineEndingsScript);
  assert.equal(step.if, undefined, 'the check step has no if');
  assert.notEqual(step['continue-on-error'], true, 'the check step blocks');
  assert.ok(!lineEndings.steps.some((s) => s['continue-on-error']), 'no step of line-endings is report-only');
});

// A pull request that changes only docs/x.md or packages/ui/a.css: `changes`
// switches test off (docs: every job off), yet line-endings still runs and
// ci-ok requires its success.
for (const [file, expected] of [['docs/x.md', ''], ['packages/ui/a.css', 'app,ui']]) {
  test(`changes: ${file} only still runs the CRLF check`, () => {
    const outputs = changesFor([file]);
    assert.equal(on(outputs), expected);
    assert.equal(outputs.test, 'false', 'the job test is off, so only line-endings checks CRLF');
    const results = Object.fromEntries(['test', 'client', 'ui', 'app'].map((j) => [j, outputs[j] === 'true' ? 'success' : 'skipped']));
    assert.equal(run(withChanges({ ...results, 'line-endings': 'success' }, outputs)).code, 0, 'green with the check passing');
    for (const r of ['failure', 'skipped', 'cancelled']) {
      const out = run(withChanges({ ...results, 'line-endings': r }, outputs));
      assert.equal(out.code, 1, `line-endings ${r} fails ci-ok`);
      assert.match(out.out, new RegExp(`::error::job line-endings result: ${r}`));
    }
    assert.equal(run(withChanges(results, outputs)).code, 0, 'control: without line-endings the rest is green');
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
  assert.equal(typeof lineEndingsScript, 'string', 'line-endings has the line-endings:begin block');
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
