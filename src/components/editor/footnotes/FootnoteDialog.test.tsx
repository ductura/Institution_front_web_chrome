import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";

import { FootnoteDialog } from "./FootnoteDialog";
import { footnoteText } from "./footnote-text";

it("opens insertion with an empty, labelled field and a disabled insert action", () => {
  const html = renderToStaticMarkup(<FootnoteDialog mode="insert" onSave={() => true} onClose={() => {}} />);
  expect(html).toContain("Tekst fusnote");
  expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Umetni<\/button>/);
});

it("prepares a single paragraph and preserves valid Unicode", () => {
  expect(footnoteText("\u00a0Izmišljeno\r\nobjašnjenje\tprimjera.\t")).toBe("Izmišljeno objašnjenje primjera.");
  expect(footnoteText("📝".repeat(2000))).toBe("📝".repeat(2000));
  expect(footnoteText("📝".repeat(2001))).toBeNull();
  expect(footnoteText("\uFEFFbilješka")).toBeNull();
  expect(footnoteText(" \n\t ")).toBe("");
});

it("shows the original note as text and permits only closing in read mode", () => {
  const html = renderToStaticMarkup(<FootnoteDialog mode="read"
    note={{ number: 2, text: "Pokus s <izmišljenim> primjerom." }} onClose={() => {}} />);
  expect(html).toContain("Fusnota 2");
  expect(html).toContain("Pokus s &lt;izmišljenim&gt; primjerom.");
  expect(html).not.toContain("Uredi");
  expect(html).not.toContain("Ukloni");
});
