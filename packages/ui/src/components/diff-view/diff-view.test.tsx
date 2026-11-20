import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";

import { DiffView } from "./DiffView";

it("exposes change labels and escapes document text", () => {
  const html = renderToStaticMarkup(<DiffView parts={[
    { kind: "removed", text: "Stari vrt." },
    { kind: "same", text: "\n" },
    { kind: "added", text: "<Novi vrt>" },
  ]} />);
  expect(html).toMatch(/<del[^>]*>.*Uklonjeno: .*Stari vrt\.<\/del>/);
  expect(html).toMatch(/<ins[^>]*>.*Dodano: .*&lt;Novi vrt&gt;<\/ins>/);
  expect(html).toContain("</del>\n<ins");
});

it("shows the empty state for identical versions", () => {
  expect(renderToStaticMarkup(<DiffView parts={[{ kind: "same", text: "Isti vrt." }]} />))
    .toContain('role="status">Nema promjena.');
});
