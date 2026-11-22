// VIZ alat (graditelj): after the run, viz-out/index.html puts the prototype
// and the app side by side, one row per screen and width.
import { existsSync, readdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { PAIRS, WIDTHS } from "./pairs";

const OUT = resolve(import.meta.dirname, "../../viz-out");
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);

export default function report() {
  if (!existsSync(OUT)) return;
  const shot = (slug: string, name: string) =>
    existsSync(resolve(OUT, slug, name)) ? `<a href="${slug}/${name}"><img src="${slug}/${name}" loading="lazy"></a>` : `<p class="none">nema</p>`;
  const done = new Set(readdirSync(OUT));
  const rows = PAIRS.filter((p) => done.has(p.slug)).map(({ screen, proto, slug }) => `
<section><h2>${esc(screen.name)} <small>${esc(screen.path)}${proto ? ` · ${esc(proto.file)}${proto.hash ? `#${esc(proto.hash)}` : ""}` : " · bez prototipa"}</small></h2>
${WIDTHS.map((w) => `<div class="row"><h3>${w} px</h3><figure><figcaption>prototip</figcaption>${proto ? shot(slug, `proto-${w}.png`) : `<p class="none">—</p>`}</figure><figure><figcaption>aplikacija</figcaption>${shot(slug, `app-${w}.png`)}</figure></div>`).join("")}
</section>`).join("");
  writeFileSync(resolve(OUT, "index.html"), `<!doctype html><html lang="hr"><meta charset="utf-8"><title>Usporedba s prototipom · Ductura</title>
<style>body{font:14px system-ui;margin:16px;background:#f4f4f2;color:#222}h2{margin:32px 0 8px}small{color:#777;font-weight:400}
.row{display:grid;grid-template-columns:5rem 1fr 1fr;gap:12px;align-items:start;margin:8px 0}figure{margin:0}figcaption{color:#777;font-size:12px}
img{width:100%;border:1px solid #ccc;background:#fff}.none{color:#999}</style>
<h1>Usporedba s prototipom</h1><p>${new Date().toISOString()} · ${WIDTHS.join(", ")} px</p>${rows}</html>`);
  console.log(`VIZ: ${resolve(OUT, "index.html")}`);
}
