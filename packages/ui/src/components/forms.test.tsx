import { readFileSync } from "node:fs";

import { renderToStaticMarkup as html } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Checkbox } from "./Checkbox";
import { Details } from "./Details";
import { Select } from "./Select";
import { Skeleton } from "./Skeleton";
import { Tag } from "./Tag";
import { TextArea } from "./TextArea";

const describedBy = (markup: string, tag: string) => {
  const id = new RegExp(`<${tag}[^>]*aria-describedby="([^"]+)"`).exec(markup)?.[1];
  return id === undefined ? null : new RegExp(`<p id="${id}"[^>]*>([^<]*)</p>`).exec(markup)?.[1] ?? null;
};

describe("form elements (WEB-05)", () => {
  it("Checkbox: the label names the box and an error is announced with it", () => {
    const m = html(<Checkbox label="Pročitao sam obavijest" error="Potvrdite obavijest." />);
    const id = /<input[^>]*\sid="([^"]+)"/.exec(m)?.[1];
    expect(m).toContain(`for="${id}"`);
    expect(m).toMatch(/type="checkbox"/);
    expect(m).toMatch(/aria-invalid="true"/);
    expect(describedBy(m, "input")).toBe("Potvrdite obavijest.");
  });

  it("Select: placeholder first, then the options; busy stays focusable", () => {
    const m = html(<Select label="Grupa" placeholder="Odaberite grupu" options={[{ value: "a", label: "Grupa A" }]} busy hint="Učitavanje…" />);
    expect(m).toMatch(/<option value="">Odaberite grupu<\/option><option value="a">Grupa A<\/option>/);
    expect(m).toMatch(/aria-busy="true"/);
    expect(m).toMatch(/aria-disabled="true"/);
    expect(m).not.toMatch(/ disabled=""/);
    expect(describedBy(m, "select")).toBe("Učitavanje…");
  });

  it("TextArea: busy is read-only, an error marks it invalid", () => {
    expect(html(<TextArea label="Napomena" busy />)).toMatch(/readOnly=""|readonly=""/);
    const m = html(<TextArea label="Napomena" error="Upišite napomenu." />);
    expect(m).toMatch(/aria-invalid="true"/);
    expect(describedBy(m, "textarea")).toBe("Upišite napomenu.");
  });

  it("Tag shows its text with a tone mark", () => {
    expect(html(<Tag tone="warn">Rok produljen</Tag>)).toMatch(/data-tone="warn"[^>]*>Rok produljen</);
  });

  it("Skeleton is one busy status read by its label, the bars hidden", () => {
    const m = html(<Skeleton label="Učitavanje…" lines={2} />);
    expect(m).toMatch(/^<div role="status" aria-busy="true"/);
    expect(m).toContain("Učitavanje…");
    expect(m.match(/aria-hidden="true"/g)).toHaveLength(2);
    expect(html(<Skeleton label="x" lines={0} />).match(/aria-hidden="true"/g)).toHaveLength(1);
  });

  it("Details is native details and summary", () => {
    expect(html(<Details summary="Pravila zadatka" open><p>Tekst</p></Details>))
      .toMatch(/^<details open=""[^>]*><summary[^>]*>Pravila zadatka<\/summary>/);
  });

  it("Checkbox: an invalid box still shows the focus ring (WCAG 2.4.7)", () => {
    // The error mark is an outline that outranks the global :focus-visible rule,
    // so the invalid state needs its own focus rule with the shared focus tokens.
    const css = readFileSync(new URL("./Forms.module.css", import.meta.url), "utf8");
    const rule = /\.box\[aria-invalid="true"\]:focus-visible\s*\{([^}]*)\}/.exec(css)?.[1] ?? "";
    expect(rule).toMatch(/outline:\s*var\(--focus-width\) solid var\(--accent\)/);
    expect(rule).toMatch(/outline-offset:\s*var\(--focus-offset\)/);
  });
});
