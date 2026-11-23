// VIZ alat (graditelj): after the run, viz-out/index.html puts the prototype,
// the app and their diff side by side, one row per screen and width, with
// a summary sorted by the share of differing pixels and a coverage table of
// the prototype screens (popis.viz.ts).
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { PAIRS, SCENARIJ, SCENARIJ_OUT, TEME, THEME, VIZ_OUT, WIDTHS, temaOut, type Tema } from "./pairs";
import type { Stavka } from "./popis.viz";
import { CILJ_PRAG, prekoracenja, procitajPrag, type Mjerenje } from "./prag";
import type { Razlika } from "./razlika";
import { tablicaHtml, tablicaMd, type Redak } from "./tablica";

const OUT = VIZ_OUT;
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
const json = <T>(file: string): T | null => (existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as T) : null);

/**
 * The frame the prototype gives a route (VIZ-CSS, src/host/ljuska-po-ekranu.ts). The file is read as text, not
 * imported: it pulls in the whole app (CSS modules), which this node process cannot load.
 */
const OKVIRI = [...readFileSync(resolve(import.meta.dirname, "../../src/host/ljuska-po-ekranu.ts"), "utf8")
  .matchAll(/^\s+([sn])\("([^"]+)", "[^"]*", "(side|none)"/gm)].map((m) => ({ role: m[1] === "s" ? "student" : "teacher", path: m[2]!, shell: m[3]! }));
const matches = (pattern: string, route: string) => {
  const want = pattern.split("/"), have = route.split("/");
  return want.length === have.length && want.every((w, i) => (/^\[\w+\]$/.test(w) ? (have[i] ?? "") !== "" : w === have[i]));
};
const ljuskaOd = (role: string | null, path: string) => OKVIRI.find((o) => o.role === role && matches(o.path, path.split("?")[0]!))?.shell ?? "-";

/** The coverage table (VIZ-TAMNA): a row per prototype screen, both themes of the scenario read from their folders. */
function tablica(prag: number): { md: string; html: string } | null {
  const popis = TEME.map((t) => json<Stavka[]>(resolve(temaOut(t), "popis.json"))).find((p) => p !== null) ?? null;
  if (popis === null) return null;
  const posto = (tema: Tema, slug: string) =>
    WIDTHS.map((w) => json<Razlika>(resolve(temaOut(tema), slug, `razlika-${w}.json`))?.posto ?? null);
  const redci: Redak[] = popis.flatMap((s): Redak[] => {
    const prototip = `${s.file}${s.hash ? `#${s.hash}` : ""}`;
    const parovi = PAIRS.filter(({ proto }) => proto !== null && proto.file === s.file && (proto.hash ?? "") === s.hash);
    if (parovi.length === 0) return [{ prototip, naslov: s.naslov, ekran: null, ruta: "", ljuska: "-", svijetla: [], tamna: [] }];
    return parovi.map(({ screen, slug }) => ({
      prototip, naslov: s.naslov, ekran: screen.name, ruta: screen.path,
      ljuska: ljuskaOd(screen.role, screen.path),
      svijetla: posto("light", slug), tamna: posto("dark", slug),
    }));
  });
  return { md: tablicaMd(redci, WIDTHS, SCENARIJ, prag), html: tablicaHtml(redci, WIDTHS, SCENARIJ, prag) };
}

export default function report() {
  if (!existsSync(OUT)) return;
  const shot = (slug: string, name: string) =>
    existsSync(resolve(OUT, slug, name)) ? `<a href="${slug}/${name}"><img src="${slug}/${name}" loading="lazy"></a>` : `<p class="none">nema</p>`;
  const done = new Set(readdirSync(OUT));
  const pairs = PAIRS.filter((p) => done.has(p.slug));
  const posto = (slug: string, w: number) => json<Razlika>(resolve(OUT, slug, `razlika-${w}.json`))?.posto ?? null;

  // The gate (VIZ_PRAG, prag.ts): above the threshold is a failure, below the report.
  const prag = procitajPrag(process.env.VIZ_PRAG);
  const mjerenja: Mjerenje[] = pairs.flatMap(({ screen, slug }) => WIDTHS.flatMap((w) => {
    const p = posto(slug, w);
    return p === null ? [] : [{ ekran: screen.name, sirina: w, posto: p }];
  }));
  const pali = prag === null ? [] : prekoracenja(mjerenja, prag);
  const vrata = prag === null
    ? `<p>Vrata nisu uključena (VIZ_PRAG nije postavljen): samo izvještaj.</p>`
    : pali.length === 0
      ? `<p><b>Vrata prolaze:</b> nijedan ekran ni širina ne prelazi ${prag} %.</p>`
      : `<h2 class="bez">Vrata padaju: ${pali.length} od ${mjerenja.length} mjerenja prelazi ${prag} %</h2><table><tr><th>ekran</th><th>px</th><th>razlika</th></tr>${pali.map((r) => `<tr><td>${esc(r.ekran)}</td><td>${r.sirina}</td><td class="num">${r.posto.toFixed(1)} %</td></tr>`).join("")}</table>`;

  const sazetak = pairs.flatMap(({ screen, slug }) => WIDTHS.map((w) => ({ name: screen.name, slug, w, p: posto(slug, w) })))
    .filter((r) => r.p !== null).sort((a, b) => b.p! - a.p!)
    .map((r) => `<tr><td><a href="#${r.slug}">${esc(r.name)}</a></td><td>${r.w}</td><td class="num">${r.p!.toFixed(1)} %</td></tr>`).join("");

  const popis = json<Stavka[]>(resolve(OUT, "popis.json"));
  const pokrivenost = popis === null ? "" : `<h2>Pokrivenost prototipa</h2>
<p>${popis.filter((s) => s.par).length} od ${popis.length} ekrana prototipa ima par u aplikaciji (pairs.ts). Usporedba je uvijek u zadanom stanju.</p>
<table><tr><th>prototip</th><th>ekran</th><th>stanja</th><th>par u aplikaciji</th></tr>${popis.map((s) => `<tr${s.par ? "" : ` class="bez"`}><td>${esc(s.file)}${s.hash ? `#${esc(s.hash)}` : ""}</td><td>${esc(s.naslov)}</td><td>${esc(s.stanja.join(", "))}</td><td>${s.par ? esc(s.par) : "nema para"}</td></tr>`).join("")}</table>`;

  const tab = tablica(prag ?? CILJ_PRAG);
  const rows = pairs.map(({ screen, proto, slug }) => `
<section id="${slug}"><h2>${esc(screen.name)} <small>${esc(screen.path)}${proto ? ` · ${esc(proto.file)}${proto.hash ? `#${esc(proto.hash)}` : ""}` : " · bez prototipa"}</small></h2>
${WIDTHS.map((w) => {
    const p = posto(slug, w);
    return `<div class="row"><h3>${w} px${p === null ? "" : `<br><span class="num">${p.toFixed(1)} %</span>`}</h3><figure><figcaption>prototip</figcaption>${proto ? shot(slug, `proto-${w}.png`) : `<p class="none">—</p>`}</figure><figure><figcaption>aplikacija</figcaption>${shot(slug, `app-${w}.png`)}</figure><figure><figcaption>razlika (crveno)</figcaption>${proto ? shot(slug, `razlika-${w}.png`) : `<p class="none">—</p>`}</figure></div>`;
  }).join("")}
</section>`).join("");

  writeFileSync(resolve(OUT, "index.html"), `<!doctype html><html lang="hr"><meta charset="utf-8"><title>Usporedba s prototipom · Ductura</title>
<style>body{font:14px system-ui;margin:16px;background:#f4f4f2;color:#222}h2{margin:32px 0 8px}small{color:#777;font-weight:400}
.row{display:grid;grid-template-columns:5rem 1fr 1fr 1fr;gap:12px;align-items:start;margin:8px 0}figure{margin:0}figcaption{color:#777;font-size:12px}
img{width:100%;border:1px solid #ccc;background:#fff}.none{color:#999}table{border-collapse:collapse;background:#fff}
td,th{border:1px solid #ddd;padding:4px 8px;text-align:left}.num{font-variant-numeric:tabular-nums;text-align:right}.bez{color:#a33}</style>
<h1>Usporedba s prototipom · tema ${THEME}</h1>${vrata}<p>${new Date().toISOString()} · ${WIDTHS.join(", ")} px · razlika = udio piksela koji se razlikuju (prag po kanalu u razlika.ts)</p>
${sazetak ? `<h2>Najveća odstupanja</h2><table><tr><th>ekran</th><th>px</th><th>razlika</th></tr>${sazetak}</table>` : ""}
${pokrivenost}${tab?.html ?? ""}${rows}</html>`);
  // Both themes of the scenario in one table, for the job summary and the PR (tablica.md).
  if (tab !== null) writeFileSync(resolve(SCENARIJ_OUT, "tablica.md"), tab.md);
  console.log(`VIZ: ${resolve(OUT, "index.html")}`);
  if (pali.length > 0) {
    // Written to a file too: the workflow puts it in the job summary.
    const tekst = pali.map((r) => `${r.ekran} @ ${r.sirina} px: ${r.posto.toFixed(1)} % > ${prag} %`).join("\n");
    writeFileSync(resolve(OUT, "pali.txt"), tekst + "\n");
    throw new Error(`VIZ: ${pali.length} mjerenja iznad praga ${prag} %\n${tekst}`);
  }
}
