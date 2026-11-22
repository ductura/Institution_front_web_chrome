import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { FormSection, OptionGroup, SummaryList } from "./FormParts";

describe("form parts (VIZ-N2)", () => {
  it("labels a section by its heading", () => {
    const html = renderToStaticMarkup(<FormSection id="zs-1" title="Osnovno"><p>x</p></FormSection>);
    expect(html).toContain('aria-labelledby="zs-1"');
    expect(html).toContain('<h2 id="zs-1">Osnovno</h2>');
  });

  it("checks the selected radio and keeps a disabled option visible", () => {
    const html = renderToStaticMarkup(
      <OptionGroup legend="Pomoć" name="ai" value="a" options={[{ value: "a", label: "A" }, { value: "b", label: "B", disabled: true }]} />,
    );
    expect(html).toContain("<legend>Pomoć</legend>");
    expect(html.match(/checked=""/g)).toHaveLength(1);
    expect(html).toContain('disabled=""');
  });

  it("checks every listed checkbox", () => {
    const html = renderToStaticMarkup(
      <OptionGroup legend="Grupe" name="g" kind="checkbox" value={["2", "4"]} options={[{ value: "2", label: "Grupa 2" }, { value: "4", label: "Grupa 4" }]} />,
    );
    expect(html.match(/checked=""/g)).toHaveLength(2);
  });

  it("lists label and value pairs", () => {
    const html = renderToStaticMarkup(<SummaryList rows={[{ id: "k", label: "Kolegij", value: "Kolegij A" }]} />);
    expect(html).toContain("<dt>Kolegij</dt>");
    expect(html).toContain("<dd>Kolegij A</dd>");
  });
});
