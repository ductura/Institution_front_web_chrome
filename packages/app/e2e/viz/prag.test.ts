// Node test of the gate (prag.ts); no browser: node --test prag.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";

import { CILJ_PRAG, prekoracenja, procitajPrag } from "./prag.ts";

const m = (ekran: string, sirina: number, posto: number) => ({ ekran, sirina, posto });

test("the target threshold is 2 %", () => {
  assert.equal(CILJ_PRAG, 2);
});
test("no threshold without VIZ_PRAG", () => {
  assert.equal(procitajPrag(undefined), null);
  assert.equal(procitajPrag(" "), null);
});
test("the threshold is read as a percentage, comma allowed", () => {
  assert.equal(procitajPrag("2"), 2);
  assert.equal(procitajPrag("1,5"), 1.5);
  assert.equal(procitajPrag("0"), 0);
});
test("a bad threshold is an error, not a silent pass", () => {
  for (const v of ["abc", "-1", "101", "NaN"]) assert.throws(() => procitajPrag(v), /VIZ_PRAG/);
});
test("only a share above the threshold fails; equal passes; the worst is first", () => {
  const r = prekoracenja([m("a", 390, 2), m("b", 768, 2.01), m("c", 1100, 9.5), m("d", 1280, 0)], 2);
  assert.deepEqual(r.map((x) => `${x.ekran}@${x.sirina}`), ["c@1100", "b@768"]);
});
test("with a zero threshold every difference fails", () => {
  assert.equal(prekoracenja([m("a", 390, 0), m("b", 390, 0.1)], 0).length, 1);
});
