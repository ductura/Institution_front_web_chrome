import { readdirSync, readFileSync } from "node:fs";
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

  it("leaves the interface shell alone: only the editor sheet text is targeted", () => {
    for (const selector of selectors.flatMap((s) => s.split(",")).filter((s) => !s.includes("--"))) {
      const s = selector.trim();
      if (s === ':root[data-reading-font="dyslexia"]') continue;
      expect(s, s).toContain(".editor-surface .ProseMirror");
    }
  });

  it("uses no CDN and no network: no http(s), @import or remote url()", () => {
    expect(code).not.toMatch(/https?:|\/\//);
    expect(code).not.toContain("@import");
    for (const m of code.matchAll(/url\(\s*["']?([^"')]+)/g)) {
      const target = m[1] ?? "";
      expect(target.startsWith("./dyslexia/"), target).toBe(true);
    }
  });

  it("ships no font file until the owner confirms the licence", () => {
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
