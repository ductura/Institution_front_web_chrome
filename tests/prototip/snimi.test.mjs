// Provjera odabira zaslona i računa razlike; ne treba preglednik ni aplikaciju.
import assert from "node:assert/strict";
import { test } from "node:test";

import { PNG } from "pngjs";

import { odaberi, razlika } from "./snimi.mjs";

const z = (id, dira) => ({ id, dira });
const sve = [z("A", ["src/components/teacher/Fast"]), z("B", ["src/components/replay/"])];

test("odabire samo zaslone koje PR dira", () => {
  assert.deepEqual(odaberi(sve, ["src/components/replay/Player.tsx"], false).map((x) => x.id), ["B"]);
});
test("zajednička putanja ili nepoznat popis snimaju sve", () => {
  assert.equal(odaberi(sve, ["packages/ui/src/Button.tsx"], false).length, 2);
  assert.equal(odaberi(sve, null, false).length, 2);
  assert.equal(odaberi(sve, ["src/components/other/x.ts"], false).length, 2);
});
test("razlika: jednake slike 0 %, različite veličine se dopune", () => {
  const png = (w, h, v) => { const p = new PNG({ width: w, height: h }); p.data.fill(v); return PNG.sync.write(p); };
  assert.equal(razlika(png(4, 4, 255), png(4, 4, 255)).postotak, 0);
  assert.ok(razlika(png(4, 4, 0), png(4, 6, 255)).postotak > 0);
});
