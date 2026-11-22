import { describe, expect, it } from "vitest";

import { DEFAULT_VIEW, shellCss, widthPx, withOutline, withWidth, WIDTH_KEYS } from "./shell-model";

// WEB-2136: widths are the prototype's (rail 248/288/340, panel 300/340/400).
describe("widths", () => {
  it("gives the prototype's pixels for each size", () => {
    expect(WIDTH_KEYS.map((k) => widthPx("rail", k))).toEqual([248, 288, 340]);
    expect(WIDTH_KEYS.map((k) => widthPx("panel", k))).toEqual([300, 340, 400]);
  });
  it("changes one side and leaves the other and the outline as they were", () => {
    const v = withWidth(withOutline(DEFAULT_VIEW, true), "panel", "wide");
    expect(v).toEqual({ outlineOnly: true, widths: { rail: "medium", panel: "wide" } });
  });
});

describe("shellCss", () => {
  it("sets both widths and draws every block in the default view", () => {
    const css = shellCss(withWidth(DEFAULT_VIEW, "rail", "narrow"));
    expect(css).toContain("--rail-w: 248px !important");
    expect(css).toContain("--panel-w: 340px !important");
    expect(css).not.toContain("ProseMirror");
  });
  it("shows only h1–h3 in the outline view", () => {
    expect(shellCss(withOutline(DEFAULT_VIEW, true))).toContain(".ProseMirror > :not(h1):not(h2):not(h3) { display: none !important; }");
  });
});
