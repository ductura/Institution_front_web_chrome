// CI-WEB-TSBUILD: the typecheck of the `ui` job (part checks) keeps its .tsbuildinfo files in a cache, and
// the cache never weakens the check: same script, same packages, no failure swallowed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const text = readFileSync(new URL('../../.github/workflows/ci.yml', import.meta.url), 'utf8');
const step = (name) => {
  const start = text.indexOf(`      - name: ${name}\n`);
  assert.notEqual(start, -1, `step "${name}" is missing`);
  const next = text.indexOf('\n      - ', start + 1);
  return text.slice(start, next === -1 ? undefined : next);
};

test('typecheck runs the package scripts of every workspace package with the incremental flags', () => {
  const t = step('Typecheck');
  assert.match(t, /run: pnpm -r run typecheck --incremental --tsBuildInfoFile \.tsbuildinfo$/m);
  assert.doesNotMatch(t, /continue-on-error|\|\| true|--filter/);
  assert.match(t, /if: matrix\.part == 'checks'/);
});

test('the tsbuildinfo cache is restored before the typecheck, keyed by lockfile and every tsconfig', () => {
  const c = step('Restore tsbuildinfo');
  assert.ok(text.indexOf(c) < text.indexOf(step('Typecheck')), 'cache must come before typecheck');
  assert.match(c, /key: tsbuildinfo-.*hashFiles\('pnpm-lock\.yaml', '\*\*\/tsconfig\*\.json'/);
  assert.match(c, /restore-keys:/);
  assert.match(c, /\*\*\/\.tsbuildinfo/);
  assert.match(c, /if: matrix\.part == 'checks'/);
});
