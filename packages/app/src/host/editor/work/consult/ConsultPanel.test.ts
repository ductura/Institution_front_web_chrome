import { readFileSync, readdirSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ConsultPanel } from "./ConsultPanel";

const ID = "11111111-1111-4111-8111-111111111111";

// Server rendering runs no effects: every part is in its loading state and no write control is drawn.
describe("ConsultPanel", () => {
  it("draws the three parts in their loading state with no write control", () => {
    const html = renderToStaticMarkup(createElement(ConsultPanel, { documentId: ID, role: "collaborator", revision: 1, slotsCall: null, criteriaCall: null }));
    expect(html).toContain("Učitavanje termina…");
    expect(html).toContain("Učitavanje zapisnika…");
    expect(html).toContain("Učitavanje kriterija…");
    expect(html).not.toContain("<button");
  });

  it("with a rubric on the assignment says where the criteria are and draws no working criteria", () => {
    const html = renderToStaticMarkup(createElement(ConsultPanel, { documentId: ID, role: "student", revision: 1, slotsCall: null, criteriaCall: null, byRubric: true }));
    expect(html).toContain("Za ovaj rad vrijede kriteriji ocjenjivanja iz uputa zadatka.");
    expect(html).not.toContain("Učitavanje kriterija…");
    expect(html).not.toContain("Kriteriji ocjene");
    expect(html).toContain("Učitavanje termina…");
  });

  it("leaves requests to the shared client", () => {
    const files = readdirSync(import.meta.dirname).filter((n) => /\.tsx?$/.test(n) && !/\.test\./.test(n));
    expect(files).toContain("ConsultPanel.tsx");
    for (const file of files) {
      const code = readFileSync(new URL(file, import.meta.url), "utf8");
      expect(code, file).not.toMatch(/\b(?:fetch|browserTransport|createApi|XMLHttpRequest|WebSocket|EventSource|sendBeacon|axios)\b|\/api\/v\d/);
    }
  });
});
