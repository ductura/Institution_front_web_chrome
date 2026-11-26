import assert from "node:assert/strict";
import { test } from "node:test";

import { pairScreens } from "./ekrani.ts";

const s = (name: string, path = `/${name}`) => ({ name, path });

test("a screen already on the a11y list is not taken again from EXTRA (ED-60)", () => {
  const out = pairScreens([s("a"), s("nastavnik: usporedba verzija", "/a11y")], [s("nastavnik: usporedba verzija", "/extra"), s("b")]);
  assert.deepEqual(out.map((x) => x.name), ["a", "nastavnik: usporedba verzija", "b"]);
  assert.equal(out[1]?.path, "/a11y");
});

test("every name of a pass is unique", () => {
  const out = pairScreens([s("a"), s("b")], [s("b"), s("c"), s("a")]);
  assert.equal(new Set(out.map((x) => x.name)).size, out.length);
});
