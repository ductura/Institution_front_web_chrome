// WEB-DIZ-S06-S42 (S-07, E4 and E5): a failed read is a role=alert frame, its way out sits under it.
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { SheetAlert, SheetNote, SheetRetry } from "./EditorPage";
import { ScopeParts, scopeParts } from "./StatusBar";

describe("SheetAlert and SheetRetry", () => {
  it("frames the cause as role=alert, unlike the plain role=note line", () => {
    const html = renderToStaticMarkup(createElement(SheetAlert, null, "Zadatak trenutačno nije moguće učitati."));
    expect(html).toContain('role="alert"');
    expect(renderToStaticMarkup(createElement(SheetNote, null, "x"))).toContain('role="note"');
  });

  it("puts 'Pokušaj ponovno' outside the frame, as a button that looks like a link", () => {
    const html = renderToStaticMarkup(createElement("div", null,
      createElement(SheetAlert, null, "Uzrok"), createElement(SheetRetry, { label: "Pokušaj ponovno", onRetry: () => undefined })));
    expect(html.indexOf("</div>")).toBeLessThan(html.indexOf("Pokušaj ponovno"));
    expect(html).toContain("<button");
  });
});

describe("ScopeParts", () => {
  it("draws the length line as separate elements, with no middle dot", () => {
    const parts = scopeParts(340, { min: 1200, max: 1600 });
    const html = renderToStaticMarkup(createElement(ScopeParts, { parts: parts! }));
    expect(html).toContain("<span>340 riječi</span>");
    expect(html).toContain("<span>vidite samo Vi</span>");
    expect(html).not.toContain("·");
  });
});
