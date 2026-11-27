import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(new URL("../styles/reading-font.css", import.meta.url), "utf8");
const code = css.replace(/\/\*[\s\S]*?\*\//g, "");
const pkg = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8"));
const layout = readFileSync(new URL("../../../app/app/layout.tsx", import.meta.url), "utf8");
const selectors = [...code.matchAll(/([^{}]+)\{/g)].map((m) => (m[1] ?? "").trim().replace(/\([^)]*\)/g, "(…)")).filter((s) => !s.startsWith("@"));

describe("reading font for dyslexia", () => {
  it("changes nothing without the attribute: every rule is scoped to data-reading-font=dyslexia", () => {
    expect(selectors.length).toBeGreaterThan(0);
    for (const selector of selectors.flatMap((s) => s.split(","))) {
      expect(selector.trim(), selector).toContain('[data-reading-font="dyslexia"]');
    }
  });

  it("leaves the interface shell alone: only the sheet (.manuscript, title) and the editor text are targeted", () => {
    for (const selector of selectors.flatMap((s) => s.split(",")).filter((s) => !s.includes("--"))) {
      const s = selector.trim();
      if (s === ':root[data-reading-font="dyslexia"]') continue;
      expect(/\.manuscript|\.editor-surface \.ProseMirror/.test(s), s).toBe(true);
    }
  });

  it("covers the sheet and its title in every view that shows the work", () => {
    for (const target of [".manuscript,", ".manuscript__title", ".editor-surface .ProseMirror"]) {
      expect(code, target).toContain(target);
    }
  });

  it("uses no CDN and no network: no http(s), @import or remote url()", () => {
    expect(code).not.toMatch(/https?:|\/\//);
    expect(code).not.toContain("@import");
    for (const m of code.matchAll(/url\(\s*["']?([^"')]+)/g)) {
      const target = m[1] ?? "";
      expect(/^\.\.\/fonts\/dyslexia\/[A-Za-z0-9-]+\.woff2$/.test(target), target).toBe(true);
      expect(existsSync(new URL(`./dyslexia/${target.split("/").pop()}`, import.meta.url)), target).toBe(true);
    }
  });

  it("puts url() after local() in every source list, with a woff2 format", () => {
    const srcs = [...code.matchAll(/src:([^;]+);/g)].map((m) => m[1] ?? "");
    expect(srcs.length).toBeGreaterThan(0);
    for (const src of srcs) {
      expect(src.indexOf("local("), src).toBeGreaterThanOrEqual(0);
      expect(src.indexOf("local("), src).toBeLessThan(src.indexOf("url("));
      expect(src).toContain('format("woff2")');
    }
  });

  it("matches the README table: every font file is listed with its SHA-256 and sits next to OFL.txt", () => {
    const readme = readFileSync(new URL("./dyslexia/README.md", import.meta.url), "utf8");
    const files = readdirSync(new URL("./dyslexia/", import.meta.url)).filter((f) => /\.woff2$/.test(f));
    expect(files.length).toBeGreaterThan(0);
    for (const f of files) {
      const hash = createHash("sha256").update(readFileSync(new URL(`./dyslexia/${f}`, import.meta.url))).digest("hex");
      expect(readme, f).toContain(`\`${f}\``);
      expect(readme, f).toContain(hash);
    }
    const ofl = readFileSync(new URL("./dyslexia/OFL.txt", import.meta.url), "utf8");
    expect(ofl).toContain("SIL OPEN FONT LICENSE Version 1.1");
  });

  it("ships a font file only together with its licence", () => {
    const files = readdirSync(new URL("./dyslexia/", import.meta.url));
    const fonts = files.filter((f) => /\.(woff2?|ttf|otf)$/i.test(f));
    const hasLicence = files.some((f) => /^(OFL|LICENSE)/i.test(f));
    if (fonts.length > 0) expect(hasLicence).toBe(true);
    expect(files).toContain("README.md");
  });

  it("is mounted: exported by the package and imported by the app layout", () => {
    expect(pkg.exports["./reading-font.css"]).toBe("./src/styles/reading-font.css");
    expect(layout).toContain('import "@ductura/ui/reading-font.css";');
  });
});
