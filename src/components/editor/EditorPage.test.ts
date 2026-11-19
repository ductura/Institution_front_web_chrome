import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import EditorPage from "./EditorPage";

// WEB-14b: the toolbar sits above the sheet, outside it; without one the page
// renders as in WEB-14 part 1. Invented course and title.
const page = (toolbar?: string) =>
  renderToStaticMarkup(
    createElement(EditorPage, {
      course: "Izmišljeni seminar",
      title: "Izmišljeni rad",
      status: createElement("footer", null, "traka"),
      toolbar,
      children: createElement("p", null, "list"),
    }),
  );

describe("EditorPage", () => {
  it("puts the toolbar before the sheet, outside the article", () => {
    const html = page("alati");
    expect(html.indexOf("alati")).toBeLessThan(html.indexOf("<article"));
    expect(html.slice(html.indexOf("<article"))).not.toContain("alati");
  });

  it("keeps the sheet and the status bar without a toolbar", () => {
    const html = page();
    expect(html).toContain("<article");
    expect(html).toContain("Izmišljeni rad");
    expect(html).toContain("traka");
  });
});
