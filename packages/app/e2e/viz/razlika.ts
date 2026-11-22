// VIZ alat (graditelj): how far the app shot is from the prototype shot.
// Both PNGs are drawn on a canvas in the browser (no image library in the
// repository); a pixel differs when a colour channel moves by more than
// TOLERANCE or when it exists in only one shot (different page heights).
// The result is a diff image (red where they differ, the app faded
// elsewhere) and the share of differing pixels.
import { readFileSync, writeFileSync } from "node:fs";
import type { Page } from "@playwright/test";

/** A colour channel may move this much (0–255) before a pixel differs. */
export const TOLERANCE = 24;

export type Razlika = { readonly posto: number; readonly sirina: number; readonly visinaApp: number; readonly visinaProto: number };

export async function razlika(page: Page, app: string, proto: string, out: { png: string; json: string }): Promise<Razlika> {
  const url = (file: string) => `data:image/png;base64,${readFileSync(file).toString("base64")}`;
  await page.setContent("<!doctype html><body></body>");
  const r = await page.evaluate(async ({ a, p, tol }) => {
    const load = (src: string) => new Promise<HTMLImageElement>((ok, fail) => {
      const img = new Image();
      img.onload = () => ok(img);
      img.onerror = fail;
      img.src = src;
    });
    const [ia, ip] = await Promise.all([load(a), load(p)]);
    const w = Math.max(ia.width, ip.width), h = Math.max(ia.height, ip.height);
    const pixels = (img: HTMLImageElement) => {
      const c = document.createElement("canvas");
      c.width = w; c.height = h;
      const g = c.getContext("2d")!;
      g.drawImage(img, 0, 0);
      return g.getImageData(0, 0, w, h).data;
    };
    const da = pixels(ia), dp = pixels(ip);
    const at = (d: Uint8ClampedArray, i: number) => d[i] ?? 0;
    const far = (i: number) => Math.abs(at(da, i) - at(dp, i)) > tol;
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    const g = c.getContext("2d")!;
    const out = g.createImageData(w, h);
    let razlicito = 0;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const uA = x < ia.width && y < ia.height, uP = x < ip.width && y < ip.height;
      const diff = uA !== uP || far(i) || far(i + 1) || far(i + 2);
      if (diff) {
        razlicito++;
        out.data.set([220, 30, 30, 255], i);
      } else {
        const l = 0.3 * at(da, i) + 0.59 * at(da, i + 1) + 0.11 * at(da, i + 2);
        const v = Math.round(190 + l * 0.25);
        out.data.set([v, v, v, 255], i);
      }
    }
    g.putImageData(out, 0, 0);
    return { posto: Math.round((razlicito / (w * h)) * 1000) / 10, sirina: w, visinaApp: ia.height, visinaProto: ip.height, png: c.toDataURL("image/png") };
  }, { a: url(app), p: url(proto), tol: TOLERANCE });
  writeFileSync(out.png, Buffer.from(r.png.slice(r.png.indexOf(",") + 1), "base64"));
  const { png: _png, ...rezultat } = r;
  writeFileSync(out.json, JSON.stringify(rezultat));
  return rezultat;
}
