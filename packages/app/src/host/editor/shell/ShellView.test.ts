import { createElement, useContext } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { TopBarSlot } from "../../../../../../src/components/editor/WorkspaceTopBar.tsx";
import { ShellView } from "./ShellView";

/** What the top bar does with the shell: it draws the slot between the title and the actions. */
const Bar = () => createElement("header", null, useContext(TopBarSlot));
const draw = (props: { teacherHref?: string } = {}) => renderToStaticMarkup(createElement(ShellView, props, createElement(Bar)));

// Server rendering runs no effects: the first draw is the default view.
const html = draw();

describe("ShellView (first draw)", () => {
  it("shows the teacher's view as unavailable, with the reason, while it has no route", () => {
    expect(html).toMatch(/<button[^>]*aria-label="Kako vidi nastavnik"[^>]*disabled[^>]*>|<button[^>]*disabled[^>]*aria-label="Kako vidi nastavnik"/);
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
  it("offers the teacher's view when it has a route", () => {
    const live = draw({ teacherHref: "/x" });
    expect(live).not.toContain("Pogled nastavnika još nije spojen");
    expect(live).toMatch(/<a[^>]*href="\/x"[^>]*>/);
  });
  it("mounts the shortcut list's button, opened by ? and closed with the dialog (PIL-D8-PRECACI)", () => {
    expect(html).toMatch(/<button[^>]*aria-haspopup="dialog"[^>]*aria-keyshortcuts="Control\+\/ Meta\+\/ \?"[^>]*>Prečaci<\/button>/);
  });
});
