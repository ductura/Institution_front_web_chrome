import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ShellView } from "./ShellView";

// Server rendering runs no effects: the first draw is the default view.
const html = renderToStaticMarkup(createElement(ShellView));

describe("ShellView (first draw)", () => {
  it("shows the teacher's view as unavailable, with the reason, while it has no route", () => {
    expect(html).toMatch(/<button[^>]*disabled[^>]*>Kako vidi nastavnik<\/button>/);
    expect(html).toContain("Pogled nastavnika još nije spojen na poslužitelj ustanove.");
  });
  it("draws the outline view off, without its banner", () => {
    expect(html).toContain("Samo naslovi");
    expect(html).not.toContain("Prikaz samo naslova. Pisanje je isključeno");
  });
  it("offers the three widths for both panels, medium pressed", () => {
    expect(html.match(/>Uska</g)).toHaveLength(2);
    expect(html.match(/aria-pressed="true"[^>]*>Srednja</g)).toHaveLength(2);
  });
  it("links to the teacher's view when it has a route", () => {
    expect(renderToStaticMarkup(createElement(ShellView, { teacherHref: "/x" }))).toContain('href="/x"');
  });
  it("mounts the shortcut list's button, opened by ? and closed with the dialog (PIL-D8-PRECACI)", () => {
    expect(html).toMatch(/<button[^>]*aria-haspopup="dialog"[^>]*aria-keyshortcuts="\?"[^>]*>Prečaci<\/button>/);
  });
});
