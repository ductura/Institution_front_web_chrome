// WEB-SISTEM-PINS (Ductus #835): on a pull request the system pass checks out
// the server and Preloader commits pinned in e2e/sistem/pins.json; a push to
// the base and a manual run keep the branch tips or the given inputs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseDocument } from 'yaml';

const root = new URL('../../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');

function sistemWorkflow() {
  const doc = parseDocument(read('.github/workflows/sistem.yml'), { uniqueKeys: true });
  assert.equal(doc.errors.length, 0, doc.errors.map((e) => e.message).join('; '));
  return doc.toJS();
}

const checkoutOf = (steps, repository) =>
  steps.find((s) => String(s.uses).startsWith('actions/checkout@') && s.with?.repository === repository);

test('pins.json holds exactly two full commit SHAs', () => {
  const pins = JSON.parse(read('e2e/sistem/pins.json'));
  assert.deepEqual(Object.keys(pins).sort(), ['preloader', 'server']);
  for (const sha of Object.values(pins)) assert.match(sha, /^[0-9a-f]{40}$/);
});

test('the pins step runs only for a pull request, after the web checkout', () => {
  const wf = sistemWorkflow();
  const steps = wf.jobs.sistem.steps;
  const at = steps.findIndex((s) => s.id === 'pins');
  assert.ok(at > 0, 'step with id pins exists');
  const web = steps.findIndex((s) => String(s.uses).startsWith('actions/checkout@') && s.with?.path === 'Institution_front_web_chrome');
  assert.ok(web >= 0 && web < at, 'pins comes after the web checkout');
  const pins = steps[at];
  assert.equal(pins.if, "${{ github.event_name == 'pull_request' }}");
  assert.match(pins.run, /jq -er '\.server' e2e\/sistem\/pins\.json/);
  assert.match(pins.run, /jq -er '\.preloader' e2e\/sistem\/pins\.json/);
  assert.match(pins.run, /\^\[0-9a-f\]\{40\}\$/, 'rejects a value that is not a full SHA');
  assert.doesNotMatch(pins.run, /\$\{\{/, 'no expression is expanded inside the script');
  assert.ok(steps.indexOf(checkoutOf(steps, 'ductura/Institution_server')) > at);
  assert.ok(steps.indexOf(checkoutOf(steps, 'ductura/Preloader')) > at);
});

test('checkouts prefer given inputs, then the pins, then the branch tip', () => {
  const steps = sistemWorkflow().jobs.sistem.steps;
  assert.equal(
    checkoutOf(steps, 'ductura/Institution_server').with.ref,
    "${{ inputs.server_ref || steps.pins.outputs.server || 'migracija/kopija-ductus-backend' }}",
  );
  assert.equal(
    checkoutOf(steps, 'ductura/Preloader').with.ref,
    "${{ inputs.preloader_ref || steps.pins.outputs.preloader || 'migracija/nextjs' }}",
  );
});

// A default on the workflow_call inputs would always win over the pins,
// because ci.yml does not pass server_ref or preloader_ref.
test('workflow_call inputs have no default; workflow_dispatch keeps the branches', () => {
  const on = sistemWorkflow().on;
  for (const name of ['server_ref', 'preloader_ref']) {
    assert.equal(on.workflow_call.inputs[name].default, undefined, `${name} has no workflow_call default`);
  }
  assert.equal(on.workflow_dispatch.inputs.server_ref.default, 'migracija/kopija-ductus-backend');
  assert.equal(on.workflow_dispatch.inputs.preloader_ref.default, 'migracija/nextjs');
  const ci = parseDocument(read('.github/workflows/ci.yml')).toJS();
  assert.equal(ci.jobs.sistem.with?.server_ref, undefined);
  assert.equal(ci.jobs.sistem.with?.preloader_ref, undefined);
});
