// ED-45 (P2-17): the popover of one mark offers what the prototype offers, and only what the text allows.
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { MarkActions } from "./MarksHost";
import type { Place } from "./marks-model";

const hole: Place = { kind: "hole", level: 1, name: "Za provjeru", from: 6, to: 9 };
const plain: Place = { kind: "plain", level: 1, name: "Navod upisan kao tekst", from: 12, to: 28 };
const noop = () => {};
const html = (place: Place, more: boolean, editable: boolean) =>
  renderToStaticMarkup(createElement(MarkActions, { place, more, editable, onNext: noop, onRemove: noop }));

describe("popover of one mark", () => {
  it("says what a hole asks and offers to remove it and go to the next one", () => {
    const out = html(hole, true, true);
    expect(out).toContain("Zamijenite oznaku tekstom ili navodom. Dok stoji, rad se ne može predati.");
    expect(out).toContain("Provjereno, ukloni");
    expect(out).toContain("Sljedeće mjesto ›");
  });

  it("only explains on a text that cannot be written", () => {
    const out = html(hole, true, false);
    expect(out).not.toContain("Provjereno, ukloni");
    expect(out).toContain("Sljedeće mjesto ›");
  });

  it("offers no next place when the mark is the only one of its kind", () => {
    expect(html(hole, false, true)).not.toContain("Sljedeće mjesto");
    expect(html(plain, false, true)).not.toContain("<button");
  });

  it("explains a citation typed as text and never offers to remove it", () => {
    const out = html(plain, true, true);
    expect(out).toContain("Navod je upisan kao tekst i nije povezan s izvorom u Vašem popisu.");
    expect(out).not.toContain("Provjereno, ukloni");
    expect(out).toContain("Sljedeće mjesto ›");
  });
});
