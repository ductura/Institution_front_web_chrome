import { test } from 'node:test';
import assert from 'node:assert/strict';
import { debounce, parseRoute, docHref, wordCount, saveStatusLabel, isKeyboardOpen, LABELS } from '../../public/lib/doc.js';
import { findForbiddenTerms } from '../../scripts/forbidden-terms/terms.ts';

test('parseRoute i docHref', () => {
  assert.deepEqual(parseRoute('#/doc/demo-1'), { view: 'doc', id: 'demo-1' });
  assert.deepEqual(parseRoute('#/'), { view: 'list' });
  assert.deepEqual(parseRoute(''), { view: 'list' });
  assert.deepEqual(parseRoute(docHref('abc')), { view: 'doc', id: 'abc' });
});

test('wordCount', () => {
  assert.equal(wordCount(''), 0);
  assert.equal(wordCount('  jedna   dvije\ntri '), 3);
});

test('saveStatusLabel', () => {
  assert.equal(saveStatusLabel('received'), 'Razvojni poslužitelj primio je tekst · ne čuva se nakon ponovnog pokretanja');
  assert.equal(saveStatusLabel('saved'), '');
  assert.equal(saveStatusLabel('nepoznato'), '');
  assert.equal(saveStatusLabel('toString'), '');
  assert.equal(saveStatusLabel('__proto__'), '');
});

// DAN-886: nijedan tekst stanja razvojnog editora nema zabranjeni izraz (PRODUCT §5).
test('LABELS: skener pada na golom „Spremljeno”, a nijedan tekst stanja nema nalaz', () => {
  assert.notEqual(findForbiddenTerms('Spremljeno').length, 0);
  assert.ok(Object.keys(LABELS).length > 0);
  for (const [state, text] of Object.entries(LABELS)) {
    assert.deepEqual(findForbiddenTerms(text).map((t) => t.entry), [], state);
    assert.doesNotMatch(text, /(?<!\p{L})spremljen/iu, state);
  }
});

test('isKeyboardOpen', () => {
  assert.equal(isKeyboardOpen(400, 800), true);
  assert.equal(isKeyboardOpen(780, 800), false);
  assert.equal(isKeyboardOpen(0, 800), false);
});

test('debounce poziva samo zadnji put, flush odmah', async () => {
  const calls = [];
  const d = debounce((x) => calls.push(x), 20);
  d(1); d(2); d(3);
  await new Promise((r) => setTimeout(r, 40));
  assert.deepEqual(calls, [3]);
  d(4); d.flush(5);
  assert.deepEqual(calls, [3, 5]);
});
