import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import { renderTex } from "./render.ts";

describe("renderTex", () => {
  it("renders a valid formula with MathML for screen readers", () => {
    const r = renderTex("\\frac{a}{b}", true);
    expect(r.ok).toBe(true);
    expect(r.html).toContain("katex-display");
    expect(r.html).toContain("<math");
  });
  it("inline mode has no display wrapper", () => {
    const r = renderTex("x^2", false);
    expect(r.ok).toBe(true);
    expect(r.html).not.toContain("katex-display");
  });
  it("ED-128: renders a chemistry formula through mhchem", () => {
    const r = renderTex("\\ce{H2SO4}", false);
    expect(r.ok).toBe(true);
    expect(r.html).toContain("SO");
    expect(r.html).not.toContain("katex-error");
  });
  it("empty and blank input is not ok", () => {
    expect(renderTex("", true)).toEqual({ html: "", ok: false });
    expect(renderTex("   ", false)).toEqual({ html: "", ok: false });
  });
  it("refuses \\href, \\url and \\includegraphics", () => {
    for (const tex of ["\\href{https://example.org}{x}", "\\url{https://example.org}", "\\includegraphics{a.png}"]) {
      const r = renderTex(tex, false);
      expect(r.ok).toBe(false);
      expect(r.html).not.toMatch(/<a [^>]*href/);
      expect(r.html).not.toContain("<img");
    }
  });
  it("refuses 4001 code points (block) and 1001 (inline)", () => {
    expect(renderTex("x".repeat(4001), true)).toEqual({ html: "", ok: false });
    expect(renderTex("x".repeat(1001), false)).toEqual({ html: "", ok: false });
    expect(renderTex("x".repeat(1000), false).ok).toBe(true);
  });
  it("does not throw on a malformed formula and shows its source", () => {
    const r = renderTex("\\frac{a}{", true);
    expect(r.ok).toBe(false);
    expect(r.html).toContain("frac");
  });
  it("ships its stylesheet locally with no external URLs", () => {
    const css = readFileSync(createRequire(import.meta.url).resolve("katex/dist/katex.min.css"), "utf8");
    expect(css).not.toMatch(/https?:\/\//);
    expect(css).not.toMatch(/url\((?!["']?(fonts\/|data:))/);
  });
});
