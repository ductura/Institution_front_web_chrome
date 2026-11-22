// Usporedba zaslona aplikacije s prototipom (VIZ-CI). Samo izvještaj: skripta
// nikad ne izlazi s greškom zbog razlike, pa ni zbog zaslona koji se ne može
// snimiti (to je redak u izvještaju). Izmišljeni podaci: lažni server iz
// packages/app/e2e/a11y/fake-server.ts, nijedan zahtjev ne izlazi iz preglednika.
//
// Okoliš: VIZ_URL (zadano http://127.0.0.1:5191, aplikacija pod /app/web),
// VIZ_OUT (zadano viz-out), VIZ_PROMIJENJENO (datoteka s popisom promijenjenih
// putanja, jedna po retku), VIZ_SVE=1 (svi zasloni), VIZ_SAMO=N-01,N-05.
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, "../..");
const requireApp = createRequire(join(repo, "packages/app/package.json"));
const { chromium } = requireApp("@playwright/test");
const { fakeServer, ASSIGNMENT_ID } = await import(pathToFileURL(join(repo, "packages/app/e2e/a11y/fake-server.ts")).href);

const mapa = JSON.parse(readFileSync(join(here, "mapa.json"), "utf8"));
const base = (process.env.VIZ_URL ?? "http://127.0.0.1:5191").replace(/\/$/, "");
const out = resolve(process.env.VIZ_OUT ?? "viz-out");
const DOC_ID = "2d3e4f5a-6b7c-4d8e-9f0a-1b2c3d4e5f01";
const fill = (p) => p.replaceAll("{A}", ASSIGNMENT_ID).replaceAll("{D}", DOC_ID);

/** Koje zaslone PR dira: promijenjena putanja pod `dira` zaslona; samo zajednička putanja ili nepoznat popis = svi. */
export function odaberi(zasloni, promijenjeno, sve) {
  if (sve || promijenjeno === null) return zasloni;
  const pogodeni = zasloni.filter((z) => promijenjeno.some((f) => z.dira.some((d) => f.startsWith(d))));
  const zajednicko = promijenjeno.some((f) => mapa.zajednicko.some((d) => f.startsWith(d)));
  return zajednicko || pogodeni.length === 0 ? zasloni : pogodeni;
}

function pad(png, w, h) {
  if (png.width === w && png.height === h) return png;
  const c = new PNG({ width: w, height: h });
  c.data.fill(255);
  PNG.bitblt(png, c, 0, 0, png.width, png.height, 0, 0);
  return c;
}

/** Postotak različitih piksela dviju slika (manja se dopuni bijelom do veće). */
export function razlika(bufA, bufB) {
  const a = PNG.sync.read(bufA), b = PNG.sync.read(bufB);
  const w = Math.max(a.width, b.width), h = Math.max(a.height, b.height);
  const pa = pad(a, w, h), pb = pad(b, w, h), d = new PNG({ width: w, height: h });
  const n = pixelmatch(pa.data, pb.data, d.data, w, h, { threshold: 0.1 });
  return { postotak: (n / (w * h)) * 100, razlikaPng: PNG.sync.write(d), app: [a.width, a.height], prototip: [b.width, b.height] };
}

async function snimi(browser, url, sirina, uloga) {
  const ctx = await browser.newContext({ viewport: { width: sirina, height: 900 }, colorScheme: "dark", reducedMotion: "reduce" });
  const page = await ctx.newPage();
  try {
    if (uloga !== undefined) await fakeServer(page, uloga);
    await page.goto(url, { waitUntil: "load", timeout: 30000 });
    await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
    await page.evaluate(() => document.fonts?.ready).catch(() => {});
    await page.locator("html").evaluate((h) => h.setAttribute("data-theme", "dark")).catch(() => {});
    await page.waitForTimeout(400);
    return await page.screenshot({ fullPage: true, animations: "disabled" });
  } finally {
    await ctx.close();
  }
}

const promijenjenoDat = process.env.VIZ_PROMIJENJENO;
const promijenjeno = promijenjenoDat && existsSync(promijenjenoDat)
  ? readFileSync(promijenjenoDat, "utf8").split("\n").map((s) => s.trim()).filter(Boolean) : null;
const samo = process.env.VIZ_SAMO?.split(",").map((s) => s.trim());
let zasloni = odaberi(mapa.zasloni, promijenjeno, process.env.VIZ_SVE === "1");
if (samo) zasloni = mapa.zasloni.filter((z) => samo.includes(z.id));

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  mkdirSync(out, { recursive: true });
  const browser = await chromium.launch();
  const redovi = [];
  for (const z of zasloni) {
    for (const sirina of mapa.sirine) {
      const red = { id: z.id, naziv: z.naziv, sirina, postotak: null, napomena: "" };
      const dir = join(out, z.id, String(sirina));
      try {
        if (z.app === null) { red.napomena = "nema zaslona u aplikaciji"; redovi.push(red); continue; }
        mkdirSync(dir, { recursive: true });
        const proto = pathToFileURL(join(repo, "docs/prototip", z.prototip.datoteka)).href + (z.prototip.hash ? `#${z.prototip.hash}` : "");
        const [app, prototip] = await Promise.all([
          snimi(browser, `${base}/app/web${fill(z.app)}`, sirina, z.uloga),
          snimi(browser, proto, sirina),
        ]);
        writeFileSync(join(dir, "app.png"), app);
        writeFileSync(join(dir, "prototip.png"), prototip);
        const r = razlika(app, prototip);
        writeFileSync(join(dir, "razlika.png"), r.razlikaPng);
        red.postotak = Number(r.postotak.toFixed(2));
        red.napomena = `app ${r.app.join("×")}, prototip ${r.prototip.join("×")}`;
      } catch (e) {
        red.napomena = `nije snimljeno: ${String(e.message ?? e).split("\n")[0]}`;
      }
      redovi.push(red);
      console.log(`${red.id} ${sirina}px: ${red.postotak ?? "-"}% ${red.napomena}`);
    }
  }
  await browser.close();

  writeFileSync(join(out, "rezultat.json"), JSON.stringify(redovi, null, 2));
  const tablica = [
    "## Usporedba s prototipom (izvještaj, ne blokira)", "",
    promijenjeno === null ? "Snimljeni su svi zasloni." : `Snimljeno zaslona: ${zasloni.length} od ${mapa.zasloni.length} (dira PR).`, "",
    `| Zaslon | ${mapa.sirine.map((s) => `${s} px`).join(" | ")} |`, `|---|${mapa.sirine.map(() => "---:").join("|")}|`,
    ...zasloni.map((z) => `| ${z.id} ${z.naziv} | ${mapa.sirine.map((s) => {
      const r = redovi.find((x) => x.id === z.id && x.sirina === s);
      return r?.postotak == null ? "–" : `${r.postotak.toFixed(1)} %`;
    }).join(" | ")} |`),
    "", "Postotak je udio različitih piksela (pixelmatch, prag 0,1). Parovi snimki su u artefaktu `viz-usporedba`.",
  ].join("\n");
  writeFileSync(join(out, "sazetak.md"), tablica + "\n");
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, tablica + "\n");
}
