import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { WorkingCriterion } from "@/client/teacher-working-criteria";

import { CriteriaView, type CriteriaLoad } from "./WorkingCriteria";
import { IDLE_ROW } from "./criteria-logic";
import { workingCriteriaHr as t } from "./messages.hr";

const six: WorkingCriterion[] = [1, 2, 3, 4, 5, 6].map((n) => ({
  criterionId: `bbbbbbbb-0000-4000-8000-00000000000${n}`, title: `Izmišljeni kriterij ${n}`, assessment: null, note: null,
}));
const noop = () => undefined;
const view = (load: CriteriaLoad, rows = {}) =>
  renderToStaticMarkup(createElement(CriteriaView, {
    load, rows, onPick: noop, onEdit: noop, onDraft: noop, onSaveNote: noop, onCancel: noop, onRetry: noop,
  }));

describe("CriteriaView", () => {
  it("shows all six criteria with three assessments each and the working-note line", () => {
    const html = view({ kind: "ready", criteria: six });
    for (const c of six) expect(html).toContain(c.title);
    expect(html.match(/aria-pressed/g)).toHaveLength(18);
    expect(html).toContain("Kriteriji ocjene · 0 od 6");
    expect(html).toContain(t.note);
    expect(html).toContain(t.addNote);
  });
  it("shows a saved assessment as pressed, the note and the count", () => {
    const list = [{ ...six[0], assessment: "good" as const, note: "Dobro." }, ...six.slice(1)];
    const html = view({ kind: "ready", criteria: list });
    expect(html).toContain("Kriteriji ocjene · 1 od 6");
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain("Dobro.");
    expect(html).toContain(t.editNote);
  });
  it("keeps the typed note and shows the reason after a failed write", () => {
    const rows = { [six[0].criterionId]: { ...IDLE_ROW, editing: true, draft: "Neposlana napomena", error: t.errors.unknown } };
    const html = view({ kind: "ready", criteria: six }, rows);
    expect(html).toContain("Neposlana napomena");
    expect(html).toContain(t.errors.unknown);
    expect(html).toContain(t.saveNote);
  });
  it("says loading, unavailable (with retry) and signed out without criteria", () => {
    expect(view({ kind: "loading" })).toContain(t.loading);
    const off = view({ kind: "unavailable" });
    expect(off).toContain(t.unavailable);
    expect(off).toContain(t.retry);
    expect(view({ kind: "signedOut" })).toContain(t.errors.signedOut);
    expect(view({ kind: "notFound" })).not.toContain(t.retry);
  });
  it("renders text as text, never as HTML", () => {
    const html = view({ kind: "ready", criteria: [{ ...six[0], note: "<img src=x onerror=1>" }, ...six.slice(1)] });
    expect(html).not.toContain("<img");
  });
});
