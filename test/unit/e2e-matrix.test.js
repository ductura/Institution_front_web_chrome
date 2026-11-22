// The e2e browser matrix (DAN-755, web 2.c6, part 755-1). The real
// playwright.config.js is loaded in a child process with an explicit
// environment, so the runner's own CI=true cannot leak into the "local" case.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { parseDocument } from 'yaml';
import { devices } from '@playwright/test';

const root = new URL('../../', import.meta.url);

const MATRIX = {
  chromium: { device: 'Desktop Chrome', browserName: 'chromium' },
  chrome: { device: 'Desktop Chrome', browserName: 'chromium', channel: 'chrome' },
  firefox: { device: 'Desktop Firefox', browserName: 'firefox' },
  webkit: { device: 'Desktop Safari', browserName: 'webkit' },
  edge: { device: 'Desktop Edge', browserName: 'chromium', channel: 'msedge' },
  'mobile-pixel-7': { device: 'Pixel 7', browserName: 'chromium' },
  'mobile-iphone-14': { device: 'iPhone 14', browserName: 'webkit' },
  'tablet-ipad': { device: 'iPad (gen 7)', browserName: 'webkit' },
  'tablet-ipad-landscape': { device: 'iPad (gen 7) landscape', browserName: 'webkit' },
};
const ALL = Object.keys(MATRIX);
const LOCAL = ALL.filter((n) => !MATRIX[n].channel);

// Loads the config with exactly the given variables (plus PATH and HOME).
function load(vars) {
  const env = { PATH: process.env.PATH, HOME: process.env.HOME, ...vars };
  const code = "const c = (await import('./playwright.config.js')).default; console.log(JSON.stringify(c));";
  const r = spawnSync(process.execPath, ['--input-type=module', '-e', code], { cwd: root, env, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  return JSON.parse(r.stdout);
}
const names = (c) => c.projects.map((p) => p.name);

test('CI registers the full matrix, each project equal to its Playwright device', () => {
  const c = load({ CI: 'true' });
  assert.deepEqual(names(c), ALL);
  for (const p of c.projects) {
    const want = MATRIX[p.name];
    const { channel, ...use } = p.use;
    assert.deepEqual(use, JSON.parse(JSON.stringify(devices[want.device])), p.name);
    // Playwright picks the engine from the device's defaultBrowserType.
    assert.equal(p.use.defaultBrowserType, want.browserName, p.name);
    assert.equal(Object.hasOwn(p.use, 'browserName'), false, p.name);
    assert.equal(channel, want.channel, p.name);
  }
});

test('branded channels follow CI set and non-empty, or DUCTURA_BRANDED=1', () => {
  const cases = [
    [{}, LOCAL], [{ CI: '' }, LOCAL], [{ CI: 'false' }, ALL], [{ CI: '1' }, ALL],
    [{ DUCTURA_BRANDED: '1' }, ALL], [{ DUCTURA_BRANDED: '1', CI: 'true' }, ALL],
    [{ DUCTURA_BRANDED: '0' }, LOCAL], [{ DUCTURA_BRANDED: '' }, LOCAL],
    [{ DUCTURA_BRANDED: 'true' }, LOCAL], [{ DUCTURA_BRANDED: ' 1' }, LOCAL],
  ];
  for (const [vars, want] of cases) assert.deepEqual(names(load(vars)), want, JSON.stringify(vars));
});

test('nothing in the matrix filters, skips or parallelises a column', () => {
  for (const vars of [{}, { CI: 'true' }]) {
    const c = load(vars);
    assert.equal(c.workers, 1, 'columns share one in-memory document');
    assert.equal(c.fullyParallel, false);
    assert.equal(c.forbidOnly, Boolean(vars.CI));
    for (const key of ['grep', 'grepInvert', 'testIgnore', 'testMatch']) {
      assert.equal(Object.hasOwn(c, key), false, `config ${key}`);
      for (const p of c.projects) assert.equal(Object.hasOwn(p, key), false, `${p.name} ${key}`);
    }
  }
});

const FLAGS = /--(project|grep|grep-invert|workers|shard|last-failed|only-changed)\b|\s-[gj]\b/;

test('the functional test script and CI step pass no filtering flag', () => {
  const pkg = JSON.parse(readFileSync(new URL('package.json', root), 'utf8'));
  assert.equal(pkg.scripts['test:functional'], 'playwright test');
  const steps = jobSteps('test');
  const run = steps.filter((s) => typeof s.run === 'string' && s.run.includes('test:functional'));
  assert.equal(run.length, 1);
  assert.doesNotMatch(run[0].run, FLAGS);
});

function jobSteps(job) {
  const text = readFileSync(new URL('.github/workflows/ci.yml', root), 'utf8');
  const doc = parseDocument(text, { uniqueKeys: true, merge: true });
  assert.equal(doc.errors.length, 0);
  return doc.toJS({ maxAliasCount: 100 }).jobs[job].steps;
}

test('CI installs every matrix browser before the functional tests', () => {
  const steps = jobSteps('test');
  const install = steps.findIndex((s) => typeof s.run === 'string' && /playwright install/.test(s.run) && s.if === '${{ github.event_name != \'pull_request\' }}');
  const functional = steps.findIndex((s) => typeof s.run === 'string' && s.run.includes('test:functional'));
  assert.ok(install >= 0 && install < functional, 'install step precedes test:functional');
  const words = steps[install].run.trim().split(/\s+/);
  assert.ok(words.includes('--with-deps'));
  for (const b of ['chromium', 'chrome', 'msedge', 'firefox', 'webkit']) assert.ok(words.includes(b), b);
});

test('a pull request installs and runs chromium only, every other event the full matrix', () => {
  const steps = jobSteps('test');
  const pr = steps.find((s) => typeof s.run === 'string' && /playwright install/.test(s.run) && s.if === "${{ github.event_name == 'pull_request' }}");
  assert.ok(pr, 'pull request install step');
  assert.equal(pr.run.trim(), 'npx playwright install --with-deps chromium');
  const fn = steps.find((s) => typeof s.run === 'string' && s.run.includes('test:functional'));
  assert.equal(fn.env.DUCTURA_PR_CHROMIUM_ONLY, "${{ github.event_name == 'pull_request' }}");
  assert.equal(fn.if, undefined, 'functional tests run on every event');
  const text = readFileSync(new URL('.github/workflows/ci.yml', root), 'utf8');
  const on = parseDocument(text).toJS().on;
  assert.ok(on.schedule?.length === 1 && on.push.branches.includes('main') && on.push.branches.includes('migracija/kopija-ductus-front'));
  assert.deepEqual(load({ DUCTURA_PR_CHROMIUM_ONLY: 'true', CI: 'true' }).projects.map((p) => p.name), ['chromium']);
  assert.ok(load({ CI: 'true' }).projects.length > 1);
});
