import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AssistantPurposePicker, type AssistantPurpose } from "./AssistantPurposePicker";

const labels = { heading: "Za što?", levelOne: "Razina 1", levelTwo: "Razina 2", empty: "Nema svrha.", busy: "Učitavam…", foot: "Razina 2 nije uključena." };
const purposes: AssistantPurpose[] = [
  { key: "proofreading", level: 1, label: "Lektura", enabled: true },
  { key: "brainstorm", level: 2, label: "Brainstorming", enabled: false, note: "Nije uključeno." },
];
const nothing = () => undefined;

describe("AssistantPurposePicker markup", () => {
  it("groups purposes by level and marks the chosen one", () => {
    const html = renderToStaticMarkup(<AssistantPurposePicker purposes={purposes} labels={labels} onSelect={nothing} selectedKey="proofreading" />);
    expect(html).toContain(">Razina 1</h3>");
    expect(html).toContain(">Razina 2</h3>");
    expect(html).toMatch(/aria-pressed="true"[^>]*>Lektura/u);
    expect(html).toContain("Razina 2 nije uključena.");
  });

  it("a purpose that is off stays a focusable button and says why", () => {
    const html = renderToStaticMarkup(<AssistantPurposePicker purposes={purposes} labels={labels} onSelect={nothing} />);
    const button = /<button[^>]*>Brainstorming<\/button>/u.exec(html)?.[0] ?? "";
    expect(button).toContain('aria-disabled="true"');
    expect(button).not.toMatch(/\sdisabled=""/u);
    const noteId = /aria-describedby="([^"]+)"/u.exec(button)?.[1];
    expect(html).toContain(`id="${noteId}">Nije uključeno.</span>`);
    expect(/<button[^>]*>Lektura<\/button>/u.exec(html)?.[0]).not.toContain("aria-disabled");
  });

  it("empty, busy, error and disabled states", () => {
    expect(renderToStaticMarkup(<AssistantPurposePicker purposes={[]} labels={labels} onSelect={nothing} />)).toContain("Nema svrha.");
    const busy = renderToStaticMarkup(<AssistantPurposePicker purposes={[]} busy labels={labels} onSelect={nothing} />);
    expect(busy).toMatch(/role="status"[^>]*>Učitavam…/u);
    expect(busy).not.toContain("Nema svrha.");
    expect(renderToStaticMarkup(<AssistantPurposePicker purposes={purposes} error="Nije uspjelo." labels={labels} onSelect={nothing} />))
      .toMatch(/role="alert"[^>]*>Nije uspjelo\./u);
    const off = renderToStaticMarkup(<AssistantPurposePicker purposes={purposes} disabledReason="Isključen." labels={labels} onSelect={nothing} />);
    expect(/<button[^>]*>Lektura<\/button>/u.exec(off)?.[0]).toContain('aria-disabled="true"');
  });
});
