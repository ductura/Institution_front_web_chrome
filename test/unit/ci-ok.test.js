// ci-ok is the one required status (DAN-885): a plain job named ci-ok that
// needs every other job of the only pull request workflow and passes only when
// each of them succeeded. The tests read the workflow and run its shell block.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';

const dir = new URL('../../.github/workflows/', import.meta.url);
const workflow = readFileSync(new URL('ci.yml', dir), 'utf8');

// Job blocks: keys indented by exactly two spaces under `jobs:`.
function jobBlocks(text) {
  const lines = text.split(/\r\n|\r|\n/).map((l) => l.replace(/\s+#.*$/, ''));
  const start = lines.indexOf('jobs:');
  assert.ok(start >= 0, 'workflow has jobs:');
  const blocks = new Map();
  let name;
  for (const line of lines.slice(start + 1)) {
    const key = /^ {2}([A-Za-z0-9_-]+):\s*$/.exec(line)?.[1];
    if (key) blocks.set((name = key), []);
    else if (/^\S/.test(line)) break;
    else if (name) blocks.get(name).push(line);
  }
  return new Map([...blocks].map(([k, v]) => [k, v.join('\n')]));
}

// `needs: [a, b]` on one line or `needs:` followed by `- a` lines.
function needsOf(block) {
  const inline = /^ {4}needs:\s*\[([^\]]*)\]/m.exec(block);
  if (inline) return inline[1].split(',').map((s) => s.trim()).filter(Boolean);
  const list = /^ {4}needs:\s*\n((?: {6}- .*\n?)+)/m.exec(block);
  return list ? list[1].split('\n').map((l) => l.replace(/^\s*- /, '').trim()).filter(Boolean) : [];
}

// The shell lines between `# ci-ok:begin` and `# ci-ok:end`, dedented.
function ciOkScript(text) {
  const lines = text.split(/\r\n|\r|\n/);
  const begin = lines.findIndex((l) => l.trim() === '# ci-ok:begin');
  const end = lines.findIndex((l) => l.trim() === '# ci-ok:end');
  assert.ok(begin >= 0 && end > begin + 1, 'one ci-ok:begin..end block');
  const body = lines.slice(begin + 1, end);
  const indent = Math.min(...body.filter((l) => l.trim()).map((l) => /^ */.exec(l)[0].length));
  return body.map((l) => l.slice(indent)).join('\n') + '\n';
}

const script = ciOkScript(workflow);
const run = (value) => {
  const r = spawnSync('bash', ['-c', script], { env: { PATH: process.env.PATH, NEEDS: value }, encoding: 'utf8' });
  return { code: r.status, out: r.stdout + r.stderr };
};
const needs = (o) => JSON.stringify(Object.fromEntries(Object.entries(o).map(([k, v]) => [k, { result: v, outputs: {} }])));

const cases = [
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

test('job parser reads CRLF, comments and multi-line needs', () => {
  const jobs = jobBlocks('on: push\r\njobs:\r\n  a: # first\r\n    runs-on: x\r\n  b:\r\n    needs:\r\n      - a\r\n      - c\r\n  c:\r\n    needs: [ a , b ]\r\n');
  assert.deepEqual([...jobs.keys()], ['a', 'b', 'c']);
  assert.deepEqual(needsOf(jobs.get('b')), ['a', 'c']);
  assert.deepEqual(needsOf(jobs.get('c')), ['a', 'b']);
  assert.deepEqual(needsOf(jobs.get('a')), []);
});

test('ci-ok is a plain job named ci-ok that runs always over every other job', () => {
  const jobs = jobBlocks(workflow);
  const ok = jobs.get('ci-ok');
  assert.ok(ok, 'ci.yml has a ci-ok job');
  assert.match(ok, /^ {4}name: ci-ok$/m);
  assert.match(ok, /^ {4}runs-on: /m);
  assert.doesNotMatch(ok, /^ {4}uses: /m);
  assert.match(ok, /^ {4}if: (always\(\)|\$\{\{ always\(\) \}\})$/m);
  assert.match(ok, /NEEDS: \$\{\{ toJSON\(needs\) \}\}/);
  const others = [...jobs.keys()].filter((j) => j !== 'ci-ok');
  assert.ok(others.length > 0);
  assert.deepEqual(needsOf(ok).sort(), others.sort());
});

// needs cannot see another workflow, so ci.yml is the only one that runs on
// pull_request, push or merge_group. Gate callers (pull_request_target,
// issue_comment), workflow_call, schedule and workflow_dispatch are allowed.
test('no other workflow runs on pull_request, push or merge_group', () => {
  for (const file of readdirSync(dir).filter((f) => /\.ya?ml$/.test(f) && f !== 'ci.yml')) {
    const text = readFileSync(new URL(file, dir), 'utf8');
    const on = /^on:([\s\S]*?)^(?=\S)/m.exec(text + '\nend:')?.[1] ?? '';
    assert.doesNotMatch(on, /\b(pull_request|push|merge_group)\b(?!_)/, file);
  }
});
