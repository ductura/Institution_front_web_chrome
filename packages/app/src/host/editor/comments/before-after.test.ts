// ED-41 (P2-12): "Prije i poslije" on a comment card shows the text the comment was written on next to the
// text in that place now, only when they differ. The texts are invented.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { BeforeAfter } from "./CommentsPanel";

const render = (quote: string, now: string | null) => renderToStaticMarkup(createElement(BeforeAfter, { quote, now }));

describe("Prije i poslije on a comment", () => {
  it("is not shown while the text is the same or the place cannot be read", () => {
    expect(render("izmišljena rečenica", "izmišljena rečenica")).toBe("");
    expect(render("izmišljena rečenica", null)).toBe("");
  });

  it("shows the text then and now", () => {
    const html = render("izmišljena rečenica", "izmijenjena rečenica");
    expect(html).toContain("Prije i poslije</summary>");
    expect(html).toContain("Kad je komentar napisan");
    expect(html).toContain("„izmišljena rečenica”");
    expect(html).toContain("Sada");
    expect(html).toContain("„izmijenjena rečenica”");
  });

  it("says the text was deleted when the place is empty", () => {
    expect(render("izmišljena rečenica", "")).toContain("<i>tekst je obrisan</i>");
  });

  it("the student's host reads the place against the text as it is now", () => {
    const host = readFileSync(join(import.meta.dirname, "CommentsHost.tsx"), "utf8");
    expect(host).toMatch(/currentText=\{currentText\}/);
    expect(host).toMatch(/doc\.textBetween\(range\.from, range\.to, " "\)/);
  });
});
