import assert from "node:assert/strict";
import { test } from "node:test";

import { najgore, tablicaHtml, tablicaMd, type Redak } from "./tablica.ts";

const r = (o: Partial<Redak>): Redak => ({ prototip: "P.html#a", naslov: "Naslov", ekran: "ekran", ruta: "/x", ljuska: "side", svijetla: [1, 2, 3, 4], tamna: [5, null, 1, 1], ...o });

test("najgore is the largest share of both themes, null when nothing was measured", () => {
  assert.equal(najgore(r({})), 5);
  assert.equal(najgore(r({ svijetla: [null], tamna: [] })), null);
});

test("the table has a row per prototype screen, the shares per width and theme, and a row without a pair", () => {
  const md = tablicaMd([r({}), r({ ekran: null, ruta: "", svijetla: [], tamna: [] })], [390, 768, 1100, 1280], "puno", 2);
  const linije = md.split("\n").filter((l) => l.startsWith("| "));
  assert.equal(linije.length, 3);
  assert.match(linije[0]!, /svijetla 390 \| svijetla 768 .* tamna 1280/);
  assert.match(linije[1]!, /1\.0 % \| 2\.0 % \| 3\.0 % \| 4\.0 % \| 5\.0 % \| — \| 1\.0 % \| 1\.0 %/);
  assert.match(linije[2]!, /nema para \| — \| side \| puno/);
  assert.match(md, /1 od 2 ekrana prototipa ima par; 1 od 1 izmjerenih redaka ima mjerenje iznad 2 %/);
});

test("the HTML marks a share above the threshold and escapes the text", () => {
  const html = tablicaHtml([r({ naslov: "<b>" })], [390], "puno", 2);
  assert.match(html, /&#60;b&#62;/);
  assert.match(html, /class="num bez">5\.0 %/);
});
