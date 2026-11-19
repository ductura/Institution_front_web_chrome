import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";

import { KeyValueList } from "./index";

it("uses description pairs and leaves UTC details closed until opened", () => {
  const markup = renderToStaticMarkup(<KeyValueList items={[{
    id: "submitted-at",
    label: "Vrijeme predaje",
    value: "20. 11. 2026. u 11:00",
    details: { summary: "Vrijeme u UTC-u", children: "2026-11-20T10:00:00Z" },
  }]} />);
  expect(markup).toMatch(/^<dl\b.*<dt>Vrijeme predaje<\/dt><dd>20\. 11\. 2026\. u 11:00/);
  expect(markup).toMatch(/<details (?![^>]*\bopen=)[^>]*><summary[^>]*>Vrijeme u UTC-u<\/summary>/);
  expect(markup).toContain("2026-11-20T10:00:00Z");
});
