import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";

import { CitationSettingsDialog } from "./CitationSettingsDialog";
import { WorkPartsDialog } from "./WorkPartsDialog";

const actions = { onApply: () => true, onClose() {} };

it("shows the declaration template and keeps disabled text fields out of the dialog", () => {
  const html = renderToStaticMarkup(<WorkPartsDialog {...actions} declarationTemplate="Tekst za izmišljeni rad."
    value={{
      declaration: { enabled: true, text: "" },
      acknowledgments: { enabled: false, text: "Skrivena zahvala" },
      biography: { enabled: true, text: "Izmišljeni životopis" },
      abbreviations: true, romanNumerals: false, endnotes: true, index: false,
    }} />);
  expect(html).toContain('placeholder="Tekst za izmišljeni rad."');
  expect(html).toContain("Izmišljeni životopis");
  expect(html).not.toContain("Skrivena zahvala");
  expect(html).not.toContain("Tekst zahvale");
  expect(html.match(/<input[^>]*\bchecked=""/g)).toHaveLength(4);
});

it("uses the available institution styles when there are no profiles", () => {
  const html = renderToStaticMarkup(<CitationSettingsDialog {...actions}
    value={{ styleId: "demo-style", profileId: "" }}
    styles={[{ value: "demo-style", label: "Izmišljeni stil" }]} profiles={[]} />);
  expect(html).toContain('value="demo-style" selected=""');
  expect(html).not.toContain("Odaberite profil");
});

it("disables applying when the settings are unavailable", () => {
  const html = renderToStaticMarkup(<CitationSettingsDialog {...actions}
    value={{ styleId: "", profileId: "" }} styles={[]} profiles={[]} />);
  expect(html).toContain("Postavke citiranja trenutačno nisu dostupne.");
  expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Gotovo<\/button>/);
});
