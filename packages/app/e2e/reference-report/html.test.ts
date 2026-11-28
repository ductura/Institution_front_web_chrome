import { existsSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { findForbiddenTerms } from "../../../../scripts/forbidden-terms/terms.ts";
import { buildReport, formatPercent, reportText, type ReportRow } from "./html.ts";
import { captureName, referencePath, SCREENS, THEMES, WIDTHS } from "./screens.ts";

const PIXEL = "iVBORw0KGgo=";
const row = (change: Partial<ReportRow> = {}): ReportRow => ({
  screen: "S-02", route: "/zadaci", theme: "tamna", width: 1440, actual: PIXEL, ...change,
});

describe("buildReport", () => {
  it("marks a screen without a reference as such, never as a percentage", () => {
    const html = buildReport([row({ missing: "nema <datoteke>" })], { generatedAt: "sada", source: "test" });
    expect(html.match(/nema reference/g)).toHaveLength(3);
    expect(html).toContain("nema &lt;datoteke&gt;");
    expect(html).not.toMatch(/\d %/);
    expect(html).not.toContain("Razlika</figcaption>");
  });

  it("lays reference, capture and difference side by side with the percentage", () => {
    const compared = { referenceFile: "a/b-tamna-1440.png", reference: PIXEL, diff: PIXEL, percent: 12.34, sameSize: false };
    const html = buildReport([row({ compared })], { generatedAt: "sada", source: "test" });
    expect(html.match(/<img /g)).toHaveLength(3);
    expect(html).toContain("12,3 % (slike nisu iste veličine)");
    expect(html).toContain("a/b-tamna-1440.png");
  });

  it("needs no network: every image is inside the file and nothing is loaded from outside", () => {
    const html = buildReport([row(), row()], { generatedAt: "sada", source: "test" });
    expect(html).not.toMatch(/(src|href)="(?!data:|#)/);
    expect(html).not.toContain("<script");
    expect(html).not.toContain("<link");
  });

  it("escapes what it is given", () => {
    const html = buildReport([row({ screen: "<b>", route: "\"&'" })], { generatedAt: "<i>", source: "x" });
    expect(html).not.toContain("<b>");
    expect(html).not.toContain("<i>");
    expect(html).toContain("&lt;b&gt; &quot;&amp;&#39;");
  });
});

describe("formatPercent", () => {
  it("never shows a small difference as none", () => {
    expect(formatPercent(0)).toBe("0,0 %");
    expect(formatPercent(0.04)).toBe("< 0,1 %");
    expect(formatPercent(99.96)).toBe("100,0 %");
  });
});

describe("screens", () => {
  it("names references and captures by screen, theme and width", () => {
    const [screen] = SCREENS;
    expect(referencePath(screen!, THEMES[0]!, WIDTHS[0])).toBe("m2-student-reference/snimke/pocetna-kolegiji-tamna-1440.png");
    expect(referencePath({ ...screen!, reference: null }, THEMES[0]!, 400)).toBeNull();
    expect(captureName(screen!, THEMES[1]!, 400)).toBe("S-02-svijetla-400.png");
    expect(new Set(SCREENS.map((s) => s.id)).size).toBe(SCREENS.length);
  });
});

describe("reference images", () => {
  it("exist in this repository for every screen, theme and width that names one", () => {
    const root = new URL("../../../../docs/design/reference/", import.meta.url);
    const missing = SCREENS.flatMap((screen) => THEMES.flatMap((theme) => WIDTHS.map((width) => referencePath(screen, theme, width))))
      .filter((file): file is string => file !== null)
      .filter((file) => !existsSync(new URL(file, root)));
    expect(missing).toEqual([]);
  });
});

describe("report texts", () => {
  it("hold no forbidden term (Ductus PRODUCT §5)", () => {
    for (const value of Object.values(reportText)) expect(findForbiddenTerms(value, "hr")).toEqual([]);
  });
});
