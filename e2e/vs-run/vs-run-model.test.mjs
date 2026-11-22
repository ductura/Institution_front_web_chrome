import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildVsRun, CLAIMS, table } from './vs-run-model.mjs';

const sha = (c) => c.repeat(40);
const env = { SHA_WEB: sha('a'), SHA_SERVER: sha('b'), SHA_PRELOADER: sha('c'), RUN_URL: 'https://example.invalid/run/1' };
const now = new Date('2026-11-22T12:00:00Z');
const four = { documentId: 'doc-1', revision: 3, text: 'Izmišljena rečenica.', hash: 'f'.repeat(64) };

const spec = (file, status) => ({ file: `e2e/sistem/${file}.sistem.ts`, title: file, tests: [{ status, results: [{ error: { message: 'pad\ndrugi redak' } }] }] });
const report = (statuses) => ({ suites: [{ specs: Object.entries(statuses).map(([file, status]) => spec(file, status)) }], stats: {} });
const allPass = report({
  'vs1-prijava-spremi-osvjezi': 'expected',
  'zavrsna-predaja-studenta': 'expected',
  'zavrsni-pregled-nastavnika': 'expected',
  'tok-administrator-ustanove': 'expected',
});
const values = (over = {}) => ({
  host: 'packages/app',
  restart: { pidBefore: 100, pidAfter: 200 },
  freshContext: { kind: 'browser.newContext()', journalsAtStart: 0 },
  before: four,
  after: four,
  claims: Object.fromEntries(CLAIMS.map((id) => [id, `dokaz ${id}`])),
  ...over,
});

test('a full run is ok and records the three SHAs, the PIDs and the four values', () => {
  const run = buildVsRun({ report: allPass, values: values(), env, now });
  assert.equal(run.ok, true);
  assert.deepEqual(run.sha, { web: sha('a'), server: sha('b'), preloader: sha('c') });
  assert.deepEqual(run.serverPid, { before: 100, after: 200, changed: true });
  assert.equal(run.host, 'packages/app');
  assert.equal(run.values.match, true);
  assert.deepEqual(run.claims.map((c) => c.status), CLAIMS.map(() => 'PROLAZ'));
  assert.ok(table(run).includes('PID servera: 100 → 200'));
});

test('the same PID after the restart is not a restart', () => {
  const run = buildVsRun({ report: allPass, values: values({ restart: { pidBefore: 100, pidAfter: 100 } }), env, now });
  assert.equal(run.ok, false);
  assert.equal(run.serverPid.changed, false);
});

test('one value that differs after the restart fails the run', () => {
  for (const key of ['documentId', 'revision', 'text', 'hash']) {
    const after = { ...four, [key]: key === 'revision' ? 4 : 'drugo' };
    assert.equal(buildVsRun({ report: allPass, values: values({ after }), env, now }).ok, false, key);
  }
});

test('a missing or short SHA fails the run', () => {
  for (const name of ['SHA_WEB', 'SHA_SERVER', 'SHA_PRELOADER']) {
    assert.equal(buildVsRun({ report: allPass, values: values(), env: { ...env, [name]: 'abc123' }, now }).ok, false, name);
  }
});

test('a claim without evidence is not a pass', () => {
  const claims = Object.fromEntries(CLAIMS.filter((id) => id !== 'VS-1.13').map((id) => [id, 'dokaz']));
  const run = buildVsRun({ report: allPass, values: values({ claims }), env, now });
  assert.equal(run.ok, false);
  assert.equal(run.claims.find((c) => c.id === 'VS-1.13').status, 'NEMA DOKAZA');
});

test('a failed, skipped or missing scenario fails the run and its claims', () => {
  const failed = buildVsRun({ report: report({ 'vs1-prijava-spremi-osvjezi': 'unexpected' }), values: null, env, now });
  assert.equal(failed.ok, false);
  assert.equal(failed.scenarios[0].status, 'PAD');
  assert.deepEqual(failed.scenarios[0].errors, ['vs1-prijava-spremi-osvjezi: pad']);
  assert.equal(failed.scenarios[1].status, 'NIJE POKRENUT');
  assert.ok(failed.claims.every((c) => c.status === 'PAD'));
  const skipped = buildVsRun({ report: report({ 'vs1-prijava-spremi-osvjezi': 'skipped' }), values: values(), env, now });
  assert.equal(skipped.scenarios[0].status, 'PRESKOČEN');
  assert.equal(skipped.ok, false);
});

test('no report at all is a failed run, not a crash', () => {
  const run = buildVsRun({ report: null, values: null, env: {}, now });
  assert.equal(run.ok, false);
  assert.ok(run.scenarios.every((s) => s.status === 'NIJE POKRENUT'));
  assert.equal(run.serverPid, null);
});
