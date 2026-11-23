// VIZ alat (graditelj): after the run, viz-out/index.html puts the prototype,
// the app and their diff side by side, one row per screen and width, with
// a summary sorted by the share of differing pixels and a coverage table of
// the prototype screens (popis.viz.ts).
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { PAIRS, VIZ_OUT, WIDTHS } from "./pairs";
import type { Stavka } from "./popis.viz";
import type { Razlika } from "./razlika";

const OUT = VIZ_OUT;
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
const json = <T>(file: string): T | null => (existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as T) : null);

export default function report() {
  if (!existsSync(OUT)) return;
  const shot = (slug: string, name: string) =>
    existsSync(resolve(OUT, slug, name)) ? `<a href="${slug}/${name}"><img src="${slug}/${name}" loading="lazy"></a>` : `<p class="none">nema</p>`;
  const done = new Set(readdirSync(OUT));
  const pairs = PAIRS.filter((p) => done.has(p.slug));
  const posto = (slug: string, w: number) => json<Razlika>(resolve(OUT, slug, `razlika-${w}.json`))?.posto ?? null;

  const sazetak = pairs.flatMap(({ screen, slug }) => WIDTHS.map((w) => ({ name: screen.name, slug, w, p: posto(slug, w) })))
    .filter((r) => r.p !== null).sort((a, b) => b.p! - a.p!)
    .map((r) => `<tr><td><a href="#${r.slug}">${esc(r.name)}</a></td><td>${r.w}</td><td class="num">${r.p!.toFixed(1)} %</td></tr>`).join("");

  const popis = json<Stavka[]>(resolve(OUT, "popis.json"));
  const pokrivenost = popis === null ? "" : `<h2>Pokrivenost prototipa</h2>
<p>${popis.filter((s) => s.par).length} od ${popis.length} ekrana prototipa ima par u aplikaciji (pairs.ts). Usporedba je uvijek u zadanom stanju.</p>
<table><tr><th>prototip</th><th>ekran</th><th>stanja</th><th>par u aplikaciji</th></tr>${popis.map((s) => `<tr${s.par ? "" : ` class="bez"`}><td>${esc(s.file)}${s.hash ? `#${esc(s.hash)}` : ""}</td><td>${esc(s.naslov)}</td><td>${esc(s.stanja.join(", "))}</td><td>${s.par ? esc(s.par) : "nema para"}</td></tr>`).join("")}</table>`;

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
<h1>Usporedba s prototipom</h1><p>${new Date().toISOString()} · ${WIDTHS.join(", ")} px · razlika = udio piksela koji se razlikuju (prag po kanalu u razlika.ts)</p>
${sazetak ? `<h2>Najveća odstupanja</h2><table><tr><th>ekran</th><th>px</th><th>razlika</th></tr>${sazetak}</table>` : ""}
${pokrivenost}${rows}</html>`);
  console.log(`VIZ: ${resolve(OUT, "index.html")}`);
}
